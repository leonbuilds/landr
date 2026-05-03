// 端到端真实场景验证：真实 PDF 简历 + 扩展自动配置 + Boss直聘 实际采集
import { chromium, BrowserContext, Page } from "@playwright/test"
import * as fs from "node:fs"
import * as path from "node:path"

const DEEPSEEK_KEY = process.env.DEEPSEEK_KEY || "sk-a1b68a24c4664a40936dfe618048ecd8"
const RESUME_PDF = process.env.RESUME_PDF || "/Users/leon/Downloads/孙亮亮个人简历.pdf"
const EXT_DIR = "/Users/leon/Documents/code/course/ai-job-agent/extension"
const SHOTS = "/Users/leon/Documents/code/course/ai-job-agent/docs/screenshots"
const BASE = "http://localhost:3000"
const STATE_DIR = "/tmp/aija-e2e-v2"

const JD = `职位描述：负责公司核心产品的前端架构设计与开发。
要求：
- 精通 React、TypeScript，5年以上前端开发经验
- 有大型项目架构经验、性能优化经验
- 本科以上学历
薪资：30K-50K · 15薪
工作地点：北京海淀`

function log(msg: string) {
  console.log(msg)
}

async function shot(p: Page, name: string) {
  const file = path.join(SHOTS, name)
  try {
    await p.screenshot({ path: file, fullPage: false })
    log(`   📸 ${name}`)
  } catch (e: any) {
    log(`   ⚠ screenshot failed: ${e.message}`)
  }
}

async function getExtensionId(ctx: BrowserContext): Promise<string> {
  // Try service worker first
  for (let i = 0; i < 20; i++) {
    const sws = ctx.serviceWorkers()
    if (sws.length) {
      const u = sws[0].url() // chrome-extension://<id>/...
      const m = u.match(/chrome-extension:\/\/([a-z]+)\//)
      if (m) return m[1]
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error("Extension service worker not detected")
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  fs.rmSync(STATE_DIR, { recursive: true, force: true })

  log("[0] Launching Chrome with extension…")
  const ctx = await chromium.launchPersistentContext(STATE_DIR, {
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

  // Stealth: hide webdriver
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined })
  })

  const extId = await getExtensionId(ctx)
  log(`   ✓ extension id = ${extId}`)

  const page = await ctx.newPage()

  // 1. Register
  log("\n[1] Register fresh user")
  const email = `real${Date.now()}@test.com`
  await page.goto(`${BASE}/register`)
  await page.waitForLoadState("networkidle")
  await page.fill('input[type="email"]', email)
  const pw = await page.locator('input[type="password"]').all()
  await pw[0].fill("Demo1234")
  await pw[1].fill("Demo1234")
  await page.click('button[type="submit"]')
  await page.waitForURL("**/resumes", { timeout: 10000 })
  log(`   ✓ ${email}`)
  const userToken = await page.evaluate(() => localStorage.getItem("token"))

  // 2. DeepSeek key + extension API key (via API)
  log("\n[2] Configure DeepSeek + generate extension API key")
  await page.evaluate(
    async ({ t, k }) => {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
        body: JSON.stringify({ api_key_deepseek: k, default_model: "deepseek" }),
      })
    },
    { t: userToken, k: DEEPSEEK_KEY },
  )
  const extApiKey = await page.evaluate(async (t) => {
    const r = await fetch("/api/auth/api-key", {
      method: "POST",
      headers: { Authorization: `Bearer ${t}` },
    })
    return (await r.json()).data.key as string
  }, userToken)
  log(`   ✓ deepseek key set; extension api key = ${extApiKey.slice(0, 8)}…`)

  // 3. Inject apiUrl + apiKey into extension storage via options page
  log("\n[3] Auto-configure extension via options page")
  const optionsPage = await ctx.newPage()
  await optionsPage.goto(`chrome-extension://${extId}/options/options.html`)
  await optionsPage.waitForLoadState("domcontentloaded")
  await optionsPage.fill("#api-url", BASE)
  await optionsPage.fill("#api-key", extApiKey)
  await optionsPage.click("#save-btn")
  await optionsPage.waitForTimeout(400)
  await optionsPage.click("#test-btn")
  await optionsPage.waitForTimeout(2000)
  await shot(optionsPage, "real-1-extension-options.png")
  // Verify storage
  const storedOk = await optionsPage.evaluate(() => {
    return new Promise<{ apiUrl: string; apiKey: string }>((resolve) => {
      // @ts-ignore
      chrome.storage.local.get(["apiUrl", "apiKey"], (d: any) => resolve(d))
    })
  })
  log(`   ✓ storage: apiUrl=${storedOk.apiUrl} apiKey=${storedOk.apiKey?.slice(0, 8)}…`)
  await optionsPage.close()

  // 4. Upload REAL PDF resume
  log("\n[4] Upload real PDF resume")
  await page.goto(`${BASE}/resumes`)
  await page.waitForLoadState("networkidle")
  await page.click("text=上传简历")
  await page.waitForTimeout(500)
  const fileInput = page.locator('input[type="file"]').first()
  if (await fileInput.count()) {
    await fileInput.setInputFiles(RESUME_PDF)
    await page.waitForTimeout(800)
    const confirmBtn = page.locator("text=确认上传").first()
    if (await confirmBtn.count()) {
      await confirmBtn.click()
      log("   confirm clicked")
    }
  } else {
    log("   ⚠ no file input; falling back to API upload")
    const fbuf = fs.readFileSync(RESUME_PDF)
    const result = await page.evaluate(
      async ({ t, b64, name }) => {
        const blob = new Blob([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], { type: "application/pdf" })
        const fd = new FormData()
        fd.append("file", blob, name)
        const r = await fetch("/api/resumes", { method: "POST", headers: { Authorization: `Bearer ${t}` }, body: fd })
        return { status: r.status, body: await r.text() }
      },
      { t: userToken, b64: fbuf.toString("base64"), name: "孙亮亮个人简历.pdf" },
    )
    log(`   API status=${result.status}`)
  }
  await page.waitForTimeout(3000)
  await shot(page, "real-2-resume-list.png")

  // 5. AI Diagnose (find diagnose button on resume row)
  log("\n[5] AI Diagnose (DeepSeek)")
  const diagBtn = page.locator("button:has-text('AI诊断'), button:has-text('AI 诊断'), button:has-text('诊断')").first()
  if (await diagBtn.count()) {
    await diagBtn.click()
    log("   ⏳ waiting up to 30s for diagnosis…")
    await page.waitForTimeout(20000)
    await shot(page, "real-3-diagnosis.png")
  } else {
    log("   ⚠ diagnose button not found in DOM")
  }

  // 6. Add job
  log("\n[6] Add job (paste JD)")
  await page.goto(`${BASE}/jobs`)
  await page.waitForLoadState("networkidle")
  await page.click("text=添加岗位")
  await page.waitForTimeout(400)
  const titleInput = page.locator('input[placeholder*="岗位"], input[placeholder*="title"]').first()
  await titleInput.fill("高级前端工程师")
  await page.locator("textarea").first().fill(JD)
  await page.click("text=确认添加")
  log("   ⏳ waiting up to 12s for AI parse…")
  await page.waitForTimeout(12000)
  await shot(page, "real-4-job-list.png")

  // 7. Now Boss直聘 — open a DETAIL page (less anti-bot than search)
  log("\n[7] Open Boss直聘 list page (extension content script auto-injects)")
  const boss = await ctx.newPage()
  // Try public list URL — content script matches *.zhipin.com/*
  try {
    await boss.goto("https://www.zhipin.com/web/geek/job?query=前端", { waitUntil: "domcontentloaded", timeout: 30000 })
    await boss.waitForTimeout(6000)
    await shot(boss, "real-5-boss-list.png")
    // Check for extension UI injection
    const probe = await boss.evaluate(() => {
      const root = document.querySelector('[id^="aija-"], [class*="aija-"], #__aija_root')
      const styleTags = document.querySelectorAll('style[data-aija], style')
      const bodyHTML = (document.body?.innerHTML || "").length
      const title = document.title
      return {
        hasAijaRoot: !!root,
        bodyLen: bodyHTML,
        title,
        url: location.href,
        anyAijaClass: !!document.querySelector('[class*="aija"]'),
      }
    })
    log(`   Boss page probe: ${JSON.stringify(probe)}`)
  } catch (e: any) {
    log(`   ⚠ Boss page error: ${e.message}`)
  }

  // 8. Try a direct localhost test — call /api/jobs/import as the extension would
  log("\n[8] Direct test of extension's import endpoint with X-API-Key")
  const importTest = await page.evaluate(
    async ({ apiKey, jobs }) => {
      const r = await fetch("/api/jobs/import", {
        method: "POST",
        headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ jobs }),
      })
      return { status: r.status, body: await r.json() }
    },
    {
      apiKey: extApiKey,
      jobs: [{ title: "测试-前端工程师", company: "测试公司", platform: "boss", url: "https://www.zhipin.com/job_detail/test123.html" }],
    },
  )
  log(`   status=${importTest.status} body=${JSON.stringify(importTest.body).slice(0, 200)}`)

  log(`
=================================================
  ✅ 流程跑完。Browser stays open.
  📂 Screenshots: ${SHOTS}/real-*.png
  👤 Login: ${email}  /  Demo1234
  🔑 Extension API key: ${extApiKey}

  现在你可以在那个 Chrome 窗口里:
  1. 看 Boss直聘 标签页的页面状态
  2. 如果页面有内容,右下角应该有 AI 求职 Agent 浮动按钮
  3. 点击采集按钮看效果

  要终止: pkill -f "tsx scripts/e2e-real"
=================================================`)

  await new Promise(() => {})
}

main().catch((e) => {
  console.error("FAILED:", e.stack || e.message)
  process.exit(1)
})
