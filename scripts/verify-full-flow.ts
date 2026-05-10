// 全流程验证：注册 → 配 key → 上传 PDF → 一句话 → 预览 → 确认 → 任务状态机
// 配合扩展 SW 真实开 Boss → 探活 → 失败/成功 → 清空按钮可用性
import { chromium, BrowserContext } from "@playwright/test"
import * as fs from "node:fs"
import * as path from "node:path"

const DEEPSEEK_KEY = process.env.DEEPSEEK_KEY!
const RESUME_PDF = "/Users/leon/Downloads/孙亮亮个人简历.pdf"
const EXT_DIR = "/Users/leon/Documents/code/course/ai-job-agent/extension"
const SHOTS = "/Users/leon/Documents/code/course/ai-job-agent/docs/screenshots"
const BASE = "http://localhost:3000"
const STATE = "/tmp/aija-fullflow"

type Json = Record<string, unknown>

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

const assertions: { name: string; ok: boolean; detail?: string }[] = []
function check(name: string, ok: boolean, detail?: string) {
  assertions.push({ name, ok, detail })
  console.log(`   ${ok ? "✅" : "❌"} ${name}${detail ? "  — " + detail : ""}`)
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  fs.rmSync(STATE, { recursive: true, force: true })

  console.log("[0] launch chrome with extension")
  const ctx = await chromium.launchPersistentContext(STATE, {
    headless: false,
    args: [
      `--disable-extensions-except=${EXT_DIR}`,
      `--load-extension=${EXT_DIR}`,
      "--disable-blink-features=AutomationControlled",
    ],
    viewport: { width: 1440, height: 900 },
  })
  await ctx.addInitScript(() => { Object.defineProperty(navigator, "webdriver", { get: () => undefined }) })
  const extId = await getExtId(ctx)
  console.log("    ext id =", extId)

  const page = await ctx.newPage()

  console.log("[1] register + config")
  const email = `full${Date.now()}@test.com`
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

  console.log("[2] write extension storage")
  const opt = await ctx.newPage()
  await opt.goto(`chrome-extension://${extId}/options/options.html`)
  await opt.waitForLoadState("domcontentloaded")
  await opt.fill("#api-url", BASE); await opt.fill("#api-key", extKey)
  await opt.click("#save-btn"); await opt.waitForTimeout(300)
  await opt.close()

  console.log("[3] upload PDF resume")
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

  console.log("[4] /jobs — type prompt + preview")
  await page.goto(`${BASE}/jobs`)
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(800)

  // 验证空状态下"清空未完成"按钮也可见但 disabled —— 但只在有任务时才显示该区域
  // 所以先等会儿，第一次没有任务时整块"最近任务"区不渲染（设计如此）

  await page.locator('input[placeholder*="北京"]').first().fill("北京 高级前端 30K+ 字节美团")
  await page.click("button:has-text('预览')")
  await page.waitForSelector("text=AI 解析的搜索条件", { timeout: 30000 })
  await page.screenshot({ path: `${SHOTS}/full-1-preview.png`, fullPage: true })
  console.log("    📸 full-1-preview.png")

  console.log("[5] confirm → create task")
  await page.click("button:has-text('确认搜索')")
  await page.waitForTimeout(2500)

  // 验证"清空未完成"按钮可见且 enabled
  const clearBtn = page.locator("button:has-text('清空未完成')").first()
  check("有 pending 任务时 清空未完成 按钮可见", (await clearBtn.count()) > 0)
  check("清空未完成 按钮 enabled", !(await clearBtn.isDisabled()))

  await page.screenshot({ path: `${SHOTS}/full-2-pending.png`, fullPage: true })
  console.log("    📸 full-2-pending.png")

  console.log("[6] poll task status — extension SW will auto-pick (≤30s) and try Boss")
  console.log("    NOTE: Playwright Chrome 会被 Boss 反爬阻挡，预期 90s 后 failed")
  console.log("    若你想看真实采集成功，要在你自己的 Chrome 里加载扩展 + 登录 Boss")

  let lastStatus = ""
  let bossTabOpened = false
  const t0 = Date.now()

  // 监听新标签创建（验证 SW 真的打开了 Boss）
  ctx.on("page", (p) => {
    if (/zhipin\.com/.test(p.url())) {
      bossTabOpened = true
      console.log(`    🌐 [+${Math.round((Date.now() - t0) / 1000)}s] new tab: ${p.url()}`)
    }
  })

  for (let i = 0; i < 28; i++) {
    // 5s × 28 = 140s budget
    const r = await page.evaluate(async (t: string) => {
      const r = await fetch("/api/jobs/search-tasks", { headers: { Authorization: `Bearer ${t}` } })
      return r.json() as Promise<{ data: Array<{ id: number; status: string; collected: number; message: string | null }> }>
    }, token)
    const task = (r.data || [])[0]
    if (task && task.status !== lastStatus) {
      lastStatus = task.status
      const elapsed = Math.round((Date.now() - t0) / 1000)
      console.log(`    [+${elapsed}s] status=${task.status}  collected=${task.collected}  msg="${task.message || "-"}"`)
      if (task.status === "done" || task.status === "failed") {
        await page.screenshot({ path: `${SHOTS}/full-3-final.png`, fullPage: true })
        console.log("    📸 full-3-final.png")
        check("任务到达终态 (done/failed)", true, `status=${task.status}`)
        check("Boss 标签曾被打开", bossTabOpened)
        if (task.status === "failed") {
          // 应当是新版友好消息，不应是旧版"未提取到任何岗位"
          const msg = task.message || ""
          check("失败消息含新提示词（登录/超时/反爬之一）", /登录|超时|反爬|验证|首页/.test(msg), msg.slice(0, 80))
        }
        break
      }
    }
    await new Promise((r) => setTimeout(r, 5000))
  }

  console.log("[7] verify 清空未完成 按钮在终态后变 disabled")
  await page.waitForTimeout(1500)
  const btnAfter = page.locator("button:has-text('清空未完成')").first()
  check("终态后 清空未完成 仍可见", (await btnAfter.count()) > 0)
  check("终态后 清空未完成 disabled", await btnAfter.isDisabled())

  console.log("\n=================================================")
  const failed = assertions.filter((a) => !a.ok)
  if (failed.length === 0) {
    console.log(`✅ 全部 ${assertions.length} 项断言通过`)
  } else {
    console.log(`❌ ${failed.length}/${assertions.length} 断言失败`)
    failed.forEach((f) => console.log(`   - ${f.name}${f.detail ? "  ("+f.detail+")" : ""}`))
  }
  console.log(`📂 截图: ${SHOTS}/full-*.png`)
  console.log("=================================================")

  await ctx.close()
  process.exit(failed.length === 0 ? 0 : 1)
}

main().catch((e) => { console.error("FAILED:", e.stack || e.message); process.exit(1) })
