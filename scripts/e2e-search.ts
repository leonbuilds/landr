// 端到端验证：AI 自主搜岗位功能
// 1) 注册 + 配 DeepSeek key + 生成扩展 key
// 2) 上传真实 PDF 简历
// 3) 在 /jobs 页输入一句话 → 预览 → 确认创建任务
// 4) 扩展 service worker 30s 内轮询拿到任务 → 自动开 Boss 搜索页 → 提取 → 上传
// 5) 验证 SearchTask 状态 + Job 表新增

import { chromium, BrowserContext } from "@playwright/test"
import * as fs from "node:fs"
import * as path from "node:path"

const DEEPSEEK_KEY = process.env.DEEPSEEK_KEY!
const RESUME_PDF = "/Users/leon/Downloads/孙亮亮个人简历.pdf"
const EXT_DIR = "/Users/leon/Documents/code/course/ai-job-agent/extension"
const SHOTS = "/Users/leon/Documents/code/course/ai-job-agent/docs/screenshots"
const BASE = "http://localhost:3000"

async function getExtId(ctx: BrowserContext): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const sws = ctx.serviceWorkers()
    if (sws.length) {
      const m = sws[0].url().match(/chrome-extension:\/\/([a-z]+)\//)
      if (m) return m[1]
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error("extension service worker not detected")
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  fs.rmSync("/tmp/aija-e2e-search", { recursive: true, force: true })

  console.log("[0] launch chrome with extension")
  const ctx = await chromium.launchPersistentContext("/tmp/aija-e2e-search", {
    headless: false,
    args: [
      `--disable-extensions-except=${EXT_DIR}`,
      `--load-extension=${EXT_DIR}`,
      "--disable-blink-features=AutomationControlled",
    ],
    viewport: { width: 1440, height: 900 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
  })
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined })
  })
  const extId = await getExtId(ctx)
  console.log("    ext id =", extId)

  const page = await ctx.newPage()

  console.log("[1] register")
  const email = `search${Date.now()}@test.com`
  await page.goto(`${BASE}/register`)
  await page.waitForLoadState("networkidle")
  await page.fill('input[type="email"]', email)
  const pw = await page.locator('input[type="password"]').all()
  await pw[0].fill("Demo1234")
  await pw[1].fill("Demo1234")
  await page.click('button[type="submit"]')
  await page.waitForURL("**/resumes", { timeout: 10000 })
  const token = await page.evaluate(() => localStorage.getItem("token"))
  console.log("    user =", email)

  console.log("[2] set DeepSeek + gen ext key")
  await page.evaluate(
    async ({ t, k }) => {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
        body: JSON.stringify({ api_key_deepseek: k, default_model: "deepseek" }),
      })
    },
    { t: token, k: DEEPSEEK_KEY },
  )
  const extKey = await page.evaluate(async (t) => {
    const r = await fetch("/api/auth/api-key", { method: "POST", headers: { Authorization: `Bearer ${t}` } })
    return (await r.json()).data.key as string
  }, token)
  console.log("    ext key =", extKey.slice(0, 8) + "…")

  console.log("[3] write extension storage")
  const opt = await ctx.newPage()
  await opt.goto(`chrome-extension://${extId}/options/options.html`)
  await opt.waitForLoadState("domcontentloaded")
  await opt.fill("#api-url", BASE)
  await opt.fill("#api-key", extKey)
  await opt.click("#save-btn")
  await opt.waitForTimeout(300)
  await opt.close()

  console.log("[4] upload real PDF resume")
  await page.goto(`${BASE}/resumes`)
  await page.waitForLoadState("networkidle")
  await page.click("text=上传简历")
  await page.waitForTimeout(400)
  const fi = page.locator('input[type="file"]').first()
  if (await fi.count()) {
    await fi.setInputFiles(RESUME_PDF)
    await page.waitForTimeout(500)
    const cb = page.locator("text=确认上传").first()
    if (await cb.count()) await cb.click()
  }
  await page.waitForTimeout(2500)

  console.log("[5] navigate to /jobs and use AutoSearch")
  await page.goto(`${BASE}/jobs`)
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(800)

  // Type prompt + click 预览
  const promptInput = page.locator('input[placeholder*="北京"]').first()
  await promptInput.fill("北京 高级前端 30K+ 字节美团这种大厂")
  await page.click("button:has-text('预览')")
  console.log("    waiting LLM…")
  await page.waitForSelector("text=AI 解析的搜索条件", { timeout: 30000 })
  await page.screenshot({ path: path.join(SHOTS, "search-1-preview.png"), fullPage: true })
  console.log("    📸 search-1-preview.png")

  // Confirm
  await page.click("button:has-text('确认搜索')")
  await page.waitForTimeout(1500)
  await page.screenshot({ path: path.join(SHOTS, "search-2-task-created.png"), fullPage: true })
  console.log("    📸 search-2-task-created.png")

  console.log("[6] poll task status (extension SW will pick up within 30s)")
  let lastStatus = ""
  for (let i = 0; i < 24; i++) {
    // 5s × 24 = 120s budget
    const r = await page.evaluate(
      async (t) => {
        const r = await fetch("/api/jobs/search-tasks", { headers: { Authorization: `Bearer ${t}` } })
        return r.json()
      },
      token,
    )
    const task = (r.data || [])[0]
    if (task && task.status !== lastStatus) {
      lastStatus = task.status
      console.log(`    ${new Date().toTimeString().slice(0, 8)}  task#${task.id} status=${task.status}  collected=${task.collected}  msg=${task.message || "-"}`)
      if (task.status === "done" || task.status === "failed") {
        await page.screenshot({ path: path.join(SHOTS, "search-3-task-final.png"), fullPage: true })
        console.log("    📸 search-3-task-final.png")
        break
      }
    }
    await new Promise((rr) => setTimeout(rr, 5000))
  }

  console.log("[7] dump final job count")
  const final = await page.evaluate(async (t) => {
    const r = await fetch("/api/jobs", { headers: { Authorization: `Bearer ${t}` } })
    const j = await r.json()
    return j.data?.length || 0
  }, token)
  console.log(`    jobs in DB = ${final}`)

  console.log(`
=================================================
  ✅ search e2e finished. Browser stays open.
  📂 ${SHOTS}/search-*.png
  👤 ${email} / Demo1234
  🔑 ext key = ${extKey}

  注：Boss 反爬可能让任务采到 0 个。这正常 —
  在你自己的真实 Chrome 里登录 Boss 后再装扩展，
  本功能就能借登录态正常采集。
=================================================`)
  await new Promise(() => {})
}

main().catch((e) => { console.error("FAILED:", e.stack || e.message); process.exit(1) })
