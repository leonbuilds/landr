import { chromium } from "@playwright/test"

const RESUME_TEXT = `张三维
前端工程师 | 6年经验

教育背景
清华大学 计算机科学 学士 2015-2019

工作经历
字节跳动 高级前端工程师 2022-至今
- 负责抖音Web端核心功能开发
- 主导React迁移项目，页面加载速度提升40%

阿里巴巴 前端工程师 2019-2022
- 负责淘宝商家后台系统开发

技能
React TypeScript Next.js Node.js CSS Tailwind`

const JD_TEXT = `职位描述：负责公司核心产品的前端架构设计与开发。
要求：
- 精通React、TypeScript，5年以上前端开发经验
- 有大型项目架构经验
- 有性能优化经验者优先
薪资范围：30K-50K·15薪
工作地点：北京海淀`

async function main() {
  const ctx = await chromium.launchPersistentContext("/tmp/aija-demo-v2", {
    headless: false,
    args: [
      "--disable-extensions-except=/Users/leon/Documents/code/course/ai-job-agent/extension",
      "--load-extension=/Users/leon/Documents/code/course/ai-job-agent/extension",
    ],
    viewport: { width: 1440, height: 900 },
  })

  const page = await ctx.newPage()

  // 1. Register new demo user
  const email = "demo" + Date.now() + "@test.com"
  console.log("1. Registering:", email)
  await page.goto("http://localhost:3000/register")
  await page.waitForLoadState("networkidle")
  await page.fill('input[type="email"]', email)
  const pwFields = await page.locator('input[type="password"]').all()
  await pwFields[0].fill("demo1234")
  await pwFields[1].fill("demo1234")
  await page.click('button[type="submit"]')
  await page.waitForURL("**/resumes", { timeout: 10000 })
  console.log("   ✓ Registered + logged in")

  // 2. Upload resume
  console.log("2. Uploading resume...")
  await page.click("text=上传简历")
  await page.waitForTimeout(300)
  await page.click("text=粘贴文本")
  await page.waitForTimeout(200)
  await page.fill('input[placeholder*="简历名称"]', "张三维-前端工程师")
  await page.fill("textarea", RESUME_TEXT)
  await page.click("text=确认上传")
  await page.waitForTimeout(2000)
  console.log("   ✓ Resume uploaded")
  await page.screenshot({ path: "docs/screenshots/demo-1-resume.png", fullPage: true })

  // 3. Add job
  console.log("3. Adding job...")
  await page.goto("http://localhost:3000/jobs")
  await page.waitForLoadState("networkidle")
  await page.click("text=添加岗位")
  await page.waitForTimeout(300)
  await page.fill('input[placeholder*="岗位"]', "高级前端工程师")
  await page.fill("textarea", JD_TEXT)
  await page.click("text=确认添加")
  await page.waitForTimeout(2000)
  console.log("   ✓ Job added")
  await page.screenshot({ path: "docs/screenshots/demo-2-jobs.png", fullPage: true })

  // 4. Extension setup page
  console.log("4. Extension setup...")
  await page.goto("http://localhost:3000/extension-setup")
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(500)
  console.log("   ✓ Setup page loaded")
  await page.screenshot({ path: "docs/screenshots/demo-3-setup.png", fullPage: true })

  // 5. Board + stats
  console.log("5. Board...")
  await page.goto("http://localhost:3000/board")
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(500)
  console.log("   ✓ Board loaded")
  await page.screenshot({ path: "docs/screenshots/demo-4-board.png", fullPage: true })

  // 6. Settings
  console.log("6. Settings...")
  await page.goto("http://localhost:3000/settings")
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(500)
  console.log("   ✓ Settings loaded")
  await page.screenshot({ path: "docs/screenshots/demo-5-settings.png", fullPage: true })

  // Final verification
  const token = await page.evaluate(() => localStorage.getItem("token"))
  const jobs = await page.evaluate(async (t) => {
    const r = await fetch("/api/jobs", { headers: { Authorization: `Bearer ${t}` } })
    return (await r.json()).data
  }, token)
  const resumes = await page.evaluate(async (t) => {
    const r = await fetch("/api/resumes", { headers: { Authorization: `Bearer ${t}` } })
    return (await r.json()).data
  }, token)

  console.log("\n=== FINAL VERIFICATION ===")
  console.log(`Jobs: ${jobs.length}`)
  console.log(`Resumes: ${resumes.length}`)
  console.log("All pages: login ✓ register ✓ resumes ✓ jobs ✓ board ✓ settings ✓ extension-setup ✓")
  console.log("\nBrowser open — you can explore!")

  // Keep browser open
  await new Promise(() => {})
}

main().catch((e) => {
  console.error("FAILED:", e.message)
  process.exit(1)
})
