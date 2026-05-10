// 验证申请抽屉 + 投递跳转
// 1. 注册 + 配 key + 上传简历
// 2. 创建一个带 url 的 Job + 一个匹配过的 Application（直接 API 注入）
// 3. 进 /board → 点卡片 → 验证 drawer 打开 + 渲染匹配/重写
// 4. 点投递按钮 → 验证 LLM 生成 greeting + 新标签打开 Boss URL（含 #__aija_apply= hash）
// 5. 等扩展 content script 在 Boss 页注入横幅（Playwright 里 Boss 多半空白，但能看到 hash 解析、横幅 DOM 注入）
import { chromium, BrowserContext, Page } from "@playwright/test"
import * as fs from "node:fs"
import * as path from "node:path"

const DEEPSEEK_KEY = process.env.DEEPSEEK_KEY!
const RESUME_PDF = "/Users/leon/Downloads/孙亮亮个人简历.pdf"
const EXT_DIR = "/Users/leon/Documents/code/ai-coding/landr/extension"
const SHOTS = "/Users/leon/Documents/code/ai-coding/landr/docs/screenshots"
const BASE = "http://localhost:3000"

const assertions: { name: string; ok: boolean; detail?: string }[] = []
function check(name: string, ok: boolean, detail?: string) {
  assertions.push({ name, ok, detail })
  console.log(`   ${ok ? "✅" : "❌"} ${name}${detail ? "  — " + detail : ""}`)
}

async function getExtId(ctx: BrowserContext): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const sws = ctx.serviceWorkers()
    if (sws.length) {
      const m = sws[0].url().match(/chrome-extension:\/\/([a-z]+)\//)
      if (m) return m[1]
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error("ext sw not found")
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  fs.rmSync("/tmp/aija-apply", { recursive: true, force: true })

  console.log("[0] launch")
  const ctx = await chromium.launchPersistentContext("/tmp/aija-apply", {
    headless: false,
    args: [`--disable-extensions-except=${EXT_DIR}`, `--load-extension=${EXT_DIR}`],
    viewport: { width: 1440, height: 900 },
  })
  const extId = await getExtId(ctx)
  console.log("    ext id =", extId)

  const page = await ctx.newPage()

  console.log("[1] register + config")
  const email = `apply${Date.now()}@test.com`
  await page.goto(`${BASE}/register`)
  await page.waitForLoadState("networkidle")
  await page.fill('input[type="email"]', email)
  const pw = await page.locator('input[type="password"]').all()
  await pw[0].fill("Demo1234"); await pw[1].fill("Demo1234")
  await page.click('button[type="submit"]')
  await page.waitForURL("**/resumes", { timeout: 10000 })
  const token = (await page.evaluate(() => localStorage.getItem("token"))) as string

  await page.evaluate(async ({ t, k }: { t: string; k: string }) => {
    await fetch("/api/settings", {
      method: "PUT",
      headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
      body: JSON.stringify({ api_key_deepseek: k, default_model: "deepseek" }),
    })
  }, { t: token, k: DEEPSEEK_KEY })
  const extKey = (await page.evaluate(async (t: string) => {
    const r = await fetch("/api/auth/api-key", { method: "POST", headers: { Authorization: `Bearer ${t}` } })
    return ((await r.json()) as { data: { key: string } }).data.key
  }, token)) as string

  // write to extension storage
  const opt = await ctx.newPage()
  await opt.goto(`chrome-extension://${extId}/options/options.html`)
  await opt.waitForLoadState("domcontentloaded")
  await opt.fill("#api-url", BASE); await opt.fill("#api-key", extKey)
  await opt.click("#save-btn"); await opt.waitForTimeout(300)
  await opt.close()

  console.log("[2] upload PDF")
  await page.goto(`${BASE}/resumes`)
  await page.waitForLoadState("networkidle")
  await page.click("text=上传简历")
  await page.waitForTimeout(500)
  const fi = page.locator('input[type="file"]').first()
  if (await fi.count()) {
    await fi.setInputFiles(RESUME_PDF)
    await page.waitForTimeout(500)
    const cb = page.locator("text=确认上传").first()
    if (await cb.count()) await cb.click()
  }
  await page.waitForTimeout(2500)

  console.log("[3] inject job (with url) + matched application via API")
  const seedResult = await page.evaluate(async (t: string) => {
    const headers = { Authorization: `Bearer ${t}`, "Content-Type": "application/json" }
    // 1) get latest resume
    const rR = await fetch("/api/resumes", { headers })
    const resumes = (await rR.json()).data as Array<{ id: number }>
    const resumeId = resumes[0]?.id
    // 2) create a job with a Boss-like URL
    const jR = await fetch("/api/jobs", {
      method: "POST", headers,
      body: JSON.stringify({
        title: "高级前端工程师",
        company: "字节跳动",
        location: "北京",
        salaryRange: "30-60K",
        url: "https://www.zhipin.com/job_detail/aija-test-1.html",
        jdText: "职位要求 React TypeScript 5年以上 微服务",
      }),
    })
    const job = (await jR.json()).data as { id: number }
    // 3) directly create application (skip match, since match would call LLM and fail without resume content fully parsed)
    //    Use the match endpoint though — it'll use LLM and create the application properly
    const mR = await fetch(`/api/resumes/${resumeId}/match`, {
      method: "POST", headers,
      body: JSON.stringify({ jobId: job.id }),
    })
    const m = await mR.json()
    return { resumeId, jobId: job.id, applicationId: m.data?.applicationId, status: mR.status, raw: m }
  }, token)
  console.log("    seed:", JSON.stringify(seedResult).slice(0, 150))
  const appId = seedResult.applicationId as number
  if (!appId) {
    console.error("    failed to seed application:", seedResult.raw)
    process.exit(1)
  }

  console.log("[4] go /board, click card → drawer should open with rich content")
  await page.goto(`${BASE}/board`)
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(800)

  // Find the application card
  const card = page.locator("text=高级前端工程师").first()
  await card.waitFor({ timeout: 8000 })
  await card.click()
  await page.waitForTimeout(800)

  // drawer assertions
  check("Drawer 打开 + 显示岗位标题", (await page.locator("h2:has-text('高级前端工程师')").count()) > 0)
  check("Drawer 显示匹配详情区", (await page.locator("text=匹配详情").count()) > 0)
  check("Drawer 显示三个 Tab", (await page.locator("button:has-text('简历重写')").count()) > 0)
  check("Drawer 显示投递按钮", (await page.locator("button:has-text('投递')").count()) > 0)

  await page.screenshot({ path: `${SHOTS}/apply-1-drawer.png`, fullPage: true })
  console.log("    📸 apply-1-drawer.png")

  console.log("[5] click 投递 → expect new tab opens Boss URL with hash")
  // 监听新页面
  const newPagePromise = ctx.waitForEvent("page", { timeout: 30000 })
  await page.click("button:has-text('投递（去 Boss）'), button:has-text('投递')")

  // Drawer 同时显示状态消息
  await page.waitForTimeout(8000) // LLM 生成 greeting

  let bossPage: Page | null = null
  try { bossPage = await newPagePromise } catch { bossPage = null }

  if (bossPage) {
    const bossUrl = bossPage.url()
    console.log("    new tab url:", bossUrl)
    // Boss 可能把详情页重定向到 security-check（反爬），但 hash 会保留
    check("新标签在 zhipin.com 域", /zhipin\.com/.test(bossUrl))
    check("URL 含 #__aija_apply= hash", /__aija_apply=/.test(bossUrl))
    // 解码 hash 验证 greeting 不为空
    const m = bossUrl.match(/__aija_apply=([^&]+)/)
    if (m) {
      try {
        const json = JSON.parse(Buffer.from(decodeURIComponent(m[1]), "base64").toString("utf-8"))
        check("hash 解出有 appId + greeting", !!json.appId && !!json.greeting && json.greeting.length > 10, `greeting "${json.greeting?.slice(0, 30)}…" (${json.greeting?.length} 字)`)
      } catch (e) {
        check("hash 解出有 appId + greeting", false, String(e))
      }
    }
  } else {
    check("新标签打开 Boss URL", false, "未捕获到 page event")
  }

  await page.screenshot({ path: `${SHOTS}/apply-2-after-click.png`, fullPage: true })
  console.log("    📸 apply-2-after-click.png")

  // banner 注入需要 Boss 真页面渲染，这里 Playwright 会被反爬挡（about:blank），所以 banner 注入断言跳过
  // 但 hash 解析逻辑可以单独测：在一个本地 HTML 里模拟 Boss DOM？暂略

  console.log("\n=================================================")
  const failed = assertions.filter((a) => !a.ok)
  if (failed.length === 0) console.log(`✅ 全部 ${assertions.length} 项断言通过`)
  else {
    console.log(`❌ ${failed.length}/${assertions.length} 失败`)
    failed.forEach((f) => console.log(`   - ${f.name}${f.detail ? "  ("+f.detail+")" : ""}`))
  }
  console.log(`📂 ${SHOTS}/apply-*.png`)
  console.log("=================================================")

  await ctx.close()
  process.exit(failed.length === 0 ? 0 : 1)
}

main().catch((e) => { console.error("FAILED:", e.stack || e.message); process.exit(1) })
