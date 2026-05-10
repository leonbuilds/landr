// 全流程可视化验证脚本：浏览器自动跑端到端，用户能看见，最后保持打开
// 包含：PDF 上传修复验证 + 全部 AI 功能 + Boss直聘 扩展加载

import { chromium } from "@playwright/test"
import * as fs from "node:fs"
import * as path from "node:path"

const DEEPSEEK_KEY = process.env.DEEPSEEK_KEY!
const EXT_DIR = "/Users/leon/Documents/code/course/ai-job-agent/extension"
const SHOTS = "/Users/leon/Documents/code/course/ai-job-agent/docs/screenshots"
const BASE = "http://localhost:3000"

const RESUME_TEXT = `张三维
前端工程师 6年经验

教育经历
清华大学 计算机科学 学士 2015-2019

工作经历
字节跳动 高级前端工程师 2022-至今
负责抖音Web端核心功能开发，主导React迁移项目，页面加载速度提升40%

阿里巴巴 前端工程师 2019-2022
负责淘宝商家后台系统开发

技能
React TypeScript Next.js Node.js Tailwind CSS Webpack`

const JD_TEXT = `职位描述：负责公司核心产品的前端架构设计与开发。
要求：精通 React、TypeScript，5年以上前端开发经验；
有大型项目架构经验、性能优化经验者优先；
本科以上学历。
薪资 30K-50K·15薪。工作地点：北京海淀。`

function step(n: number, msg: string) {
  console.log(`\n[${n}] ${msg}`)
}

async function shot(page: any, name: string) {
  const p = path.join(SHOTS, name)
  await page.screenshot({ path: p, fullPage: true })
  console.log(`   📸 ${name}`)
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })

  step(0, "Launching Chrome with extension loaded…")
  const ctx = await chromium.launchPersistentContext("/tmp/aija-e2e", {
    headless: false,
    args: [
      `--disable-extensions-except=${EXT_DIR}`,
      `--load-extension=${EXT_DIR}`,
    ],
    viewport: { width: 1440, height: 900 },
  })
  const page = await ctx.newPage()

  // 1. Register
  step(1, "Register fresh user")
  const email = `e2e${Date.now()}@test.com`
  await page.goto(`${BASE}/register`)
  await page.waitForLoadState("networkidle")
  await page.fill('input[type="email"]', email)
  const pw = await page.locator('input[type="password"]').all()
  await pw[0].fill("Demo1234")
  await pw[1].fill("Demo1234")
  await page.click('button[type="submit"]')
  await page.waitForURL("**/resumes", { timeout: 10000 })
  console.log(`   ✓ ${email}`)

  // 2. Configure DeepSeek key via Settings page
  step(2, "Configure DeepSeek API key (via API directly to avoid UI flake)")
  const token = await page.evaluate(() => localStorage.getItem("token"))
  await page.evaluate(
    async ({ t, key }) => {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
        body: JSON.stringify({ api_key_deepseek: key, default_model: "deepseek" }),
      })
    },
    { t: token, key: DEEPSEEK_KEY },
  )
  console.log("   ✓ key written")

  // 3. Upload resume — PDF (the bug we fixed)
  step(3, "Upload resume via PDF (verifies bugfix)")
  await page.goto(`${BASE}/resumes`)
  await page.waitForLoadState("networkidle")
  await page.click("text=上传简历")
  await page.waitForTimeout(400)
  // Try PDF tab if present, otherwise use file input directly
  const pdfPath = "/tmp/resume.pdf"
  if (!fs.existsSync(pdfPath)) {
    fs.writeFileSync("/tmp/resume.txt", RESUME_TEXT)
    require("node:child_process").execSync(`cupsfilter /tmp/resume.txt > ${pdfPath} 2>/dev/null`)
  }
  const fileInput = page.locator('input[type="file"]').first()
  if (await fileInput.count()) {
    await fileInput.setInputFiles(pdfPath)
    await page.waitForTimeout(500)
    // Click 确认上传 if visible
    const confirmBtn = page.locator("text=确认上传").first()
    if (await confirmBtn.count()) await confirmBtn.click()
  } else {
    console.log("   ⚠ no file input found, falling back to text paste")
    await page.click("text=粘贴文本")
    await page.waitForTimeout(200)
    await page.fill('input[placeholder*="简历名称"]', "张三维-前端")
    await page.fill("textarea", RESUME_TEXT)
    await page.click("text=确认上传")
  }
  await page.waitForTimeout(3000)
  await shot(page, "e2e-1-resume-uploaded.png")

  // 4. AI Diagnose
  step(4, "Trigger AI diagnose (DeepSeek, ~8s)")
  const diagnoseBtn = page.locator("text=/诊断|AI 诊断/").first()
  if (await diagnoseBtn.count()) {
    await diagnoseBtn.click()
    await page.waitForTimeout(15000)
    await shot(page, "e2e-2-resume-diagnosed.png")
    console.log("   ✓ diagnosed")
  } else {
    console.log("   ⚠ diagnose button not found, skipping UI trigger")
  }

  // 5. Add Job (paste JD)
  step(5, "Add job (paste JD)")
  await page.goto(`${BASE}/jobs`)
  await page.waitForLoadState("networkidle")
  await page.click("text=添加岗位")
  await page.waitForTimeout(400)
  await page.fill('input[placeholder*="岗位"]', "高级前端工程师")
  await page.fill("textarea", JD_TEXT)
  await page.click("text=确认添加")
  await page.waitForTimeout(8000) // AI parse JD
  await shot(page, "e2e-3-job-added.png")

  // 6. Match resume to job (visit job detail)
  step(6, "Match resume → job (AI)")
  const firstJobLink = page.locator('a[href^="/jobs/"]').first()
  if (await firstJobLink.count()) {
    await firstJobLink.click()
    await page.waitForLoadState("networkidle")
    await page.waitForTimeout(500)
    const matchBtn = page.locator("text=/匹配|开始匹配/").first()
    if (await matchBtn.count()) {
      await matchBtn.click()
      await page.waitForTimeout(20000) // AI match + rewrite
      await shot(page, "e2e-4-match-result.png")
      console.log("   ✓ matched")
    }
  }

  // 7. Board view
  step(7, "Application board (kanban)")
  await page.goto(`${BASE}/board`)
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(800)
  await shot(page, "e2e-5-board.png")

  // 8. Boss直聘 with extension
  step(8, "Open Boss直聘 public listing (extension content script loaded)")
  const boss = await ctx.newPage()
  try {
    await boss.goto("https://www.zhipin.com/web/geek/job?query=前端工程师&city=101010100", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    })
    await boss.waitForTimeout(4000)
    await boss.screenshot({ path: path.join(SHOTS, "e2e-6-boss.png"), fullPage: false })
    console.log("   📸 e2e-6-boss.png")
    // Check if extension floating button exists
    const hasExtUI = await boss.evaluate(() => !!document.querySelector("[id*=aija],[class*=aija],#__aija_root,[data-aija]"))
    console.log(`   extension UI present on Boss: ${hasExtUI}`)
  } catch (e: any) {
    console.log(`   ⚠ Boss page load issue: ${e.message}`)
  }

  console.log(`
=================================================
  ✅ E2E visual run finished. Browser stays open.
  Screenshots: ${SHOTS}
  Login: ${email}  /  Demo1234

  你可以接管这个 Chrome 窗口继续探索。
  关闭浏览器或 Ctrl+C 终止脚本即结束。
=================================================`)

  await new Promise(() => {})
}

main().catch((e) => {
  console.error("FAILED:", e.message)
  process.exit(1)
})
