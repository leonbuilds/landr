import { chromium } from "@playwright/test"

async function main() {
  const browser = await chromium.launch({ headless: false })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  // Step 1: Open login page
  console.log("1. Opening login page...")
  await page.goto("http://localhost:3000/login")
  await page.waitForLoadState("networkidle")
  await page.screenshot({ path: "docs/screenshots/01-login.png", fullPage: true })
  console.log("   Screenshot: 01-login.png")

  // Step 2: Go to register
  console.log("2. Navigating to register...")
  await page.click("text=去注册")
  await page.waitForURL("**/register")
  await page.screenshot({ path: "docs/screenshots/02-register.png", fullPage: true })
  console.log("   Screenshot: 02-register.png")

  // Step 3: Fill registration form
  console.log("3. Filling registration form...")
  const email = `demo${Date.now()}@test.com`
  await page.fill('input[type="email"]', email)
  await page.fill('input[placeholder*="8-32"]', "demo1234")
  const passwordInputs = await page.locator('input[type="password"]').all()
  await passwordInputs[1].fill("demo1234")
  await page.screenshot({ path: "docs/screenshots/03-form-filled.png", fullPage: true })
  console.log("   Screenshot: 03-form-filled.png")

  // Step 4: Submit registration
  console.log("4. Submitting registration...")
  await page.click('button[type="submit"]')
  await page.waitForURL("**/resumes", { timeout: 10000 })
  await page.screenshot({ path: "docs/screenshots/04-dashboard.png", fullPage: true })
  console.log("   Screenshot: 04-dashboard.png")

  // Step 5: Upload resume
  console.log("5. Uploading resume...")
  await page.click("text=上传简历")
  await page.waitForSelector('text=粘贴文本')
  await page.click("text=粘贴文本")
  await page.fill('input[placeholder="简历名称（可选）"]', "张三-前端工程师")
  await page.fill("textarea", "张三\n前端工程师 | 5年经验\n\n教育背景\n清华大学 计算机科学 2018-2022\n\n工作经历\n字节跳动 高级前端工程师 2022-至今\n负责抖音Web端核心功能开发与性能优化\n主导React迁移项目，页面加载速度提升40%\n\n项目经验\n电商平台前端重构 — 使用React+TypeScript+Next.js，日均UV 100万+\n设计系统建设 — 从0搭建组件库，覆盖50+组件\n\n技能\nReact TypeScript Next.js Node.js CSS Tailwind Git")
  await page.screenshot({ path: "docs/screenshots/05-upload-resume.png", fullPage: true })
  console.log("   Screenshot: 05-upload-resume.png")

  // Step 6: Save resume
  console.log("6. Saving resume...")
  await page.click("text=确认上传")
  await page.waitForTimeout(2000)
  await page.screenshot({ path: "docs/screenshots/06-resume-list.png", fullPage: true })
  console.log("   Screenshot: 06-resume-list.png")

  // Step 7: Add job
  console.log("7. Adding job...")
  await page.goto("http://localhost:3000/jobs")
  await page.waitForLoadState("networkidle")
  await page.click("text=添加岗位")
  await page.fill('input[placeholder*="岗位"]', "高级前端工程师")
  await page.fill("textarea", "职位描述：负责公司核心产品的前端架构设计与开发。要求：精通React、TypeScript，5年以上前端开发经验，有大型项目架构经验。熟练掌握CSS、Tailwind CSS。有性能优化经验者优先。熟悉Node.js服务端开发。薪资范围：30K-50K。工作地点：北京。")
  await page.screenshot({ path: "docs/screenshots/07-add-job.png", fullPage: true })
  console.log("   Screenshot: 07-add-job.png")

  // Save job
  await page.click("text=确认添加")
  await page.waitForTimeout(2000)
  await page.screenshot({ path: "docs/screenshots/08-job-list.png", fullPage: true })
  console.log("   Screenshot: 08-job-list.png")

  // Step 8: Go to job detail and match
  console.log("8. Going to job detail and matching...")
  await page.click(".grid a:first-child")
  await page.waitForLoadState("networkidle")
  await page.screenshot({ path: "docs/screenshots/09-job-detail.png", fullPage: true })
  console.log("   Screenshot: 09-job-detail.png")

  // Step 9: Settings page
  console.log("9. Settings page...")
  await page.goto("http://localhost:3000/settings")
  await page.waitForLoadState("networkidle")
  await page.screenshot({ path: "docs/screenshots/10-settings.png", fullPage: true })
  console.log("   Screenshot: 10-settings.png")

  console.log("\nDone! All screenshots saved to docs/screenshots/")
  await browser.close()
}

main().catch(console.error)
