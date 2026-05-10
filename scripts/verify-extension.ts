import { chromium } from "@playwright/test"

const EXT_PATH = "/Users/leon/Documents/code/ai-coding/landr/extension"

const MOCK_PAGE = `<!DOCTYPE html>
<html><head><title>高级前端工程师-字节跳动-Boss直聘</title></head><body>
<div class="name"><h1>高级前端工程师</h1><span class="badge">30K-50K·15薪</span></div>
<div class="company-info"><span class="name">字节跳动</span></div>
<div class="job-location">北京海淀</div>
<div class="job-sec"><div class="text">
职位描述：负责抖音Web端核心功能开发。<br>
要求：精通React、TypeScript，5年以上前端开发经验。<br>
技能标签：React, TypeScript, Node.js, Webpack
</div></div>
</body></html>`

async function main() {
  console.log("Launching Chrome with extension...")
  const ctx = await chromium.launchPersistentContext("/tmp/aija-test-2", {
    headless: false,
    args: [`--disable-extensions-except=${EXT_PATH}`, `--load-extension=${EXT_PATH}`],
    viewport: { width: 1440, height: 900 },
  })

  // Step 1: Login + get API key
  const p = await ctx.newPage()
  await p.goto("http://localhost:3000/login")
  await p.waitForLoadState("networkidle")
  await p.fill('input[type="email"]', "test@test.com")
  await p.fill('input[type="password"]', "test1234")
  await p.click('button[type="submit"]')
  await p.waitForURL("**/resumes", { timeout: 10000 })
  console.log("1. Logged in ✓")

  const apiKey: string = await p.evaluate(async () => {
    const res = await fetch("/api/auth/api-key", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
        "Content-Type": "application/json",
      },
    })
    return (await res.json()).data.key
  })
  console.log(`2. API Key: ${apiKey.slice(0, 8)}... ✓`)

  // Step 2: Find extension ID from background service worker
  await p.waitForTimeout(1000)
  let extId = ""
  // Check service workers
  for (const sw of ctx.serviceWorkers()) {
    const u = sw.url()
    if (u.startsWith("chrome-extension://")) {
      extId = u.split("/")[2]
      console.log(`3. Found extension via SW: ${extId}`)
      break
    }
  }
  // Try background pages
  if (!extId) {
    for (const bp of ctx.backgroundPages()) {
      const u = bp.url()
      if (u.startsWith("chrome-extension://")) {
        extId = u.split("/")[2]
        break
      }
    }
  }
  // Fallback: spawn a visible page to access chrome.management
  if (!extId) {
    console.log("   Trying chrome.management fallback...")
    // Open any page and wait for management API to work
    await p.goto("chrome://extensions/")
    await p.waitForTimeout(2000)
    // The extension cards in dev mode show the ID in the DOM
    extId = await p.evaluate(() => {
      // Scan for extension ID patterns in the page
      const items = document.querySelectorAll("extensions-item")
      for (const item of items) {
        const html = item.shadowRoot?.innerHTML || item.innerHTML
        const match = html.match(/[a-z]{32}/)
        if (match && html.includes("AI求职Agent")) return match[0]
      }
      return ""
    })
  }

  console.log(`3. Extension ID: ${extId || "NOT FOUND"}`)

  // Step 3: Configure extension options
  if (extId) {
    const opt = await ctx.newPage()
    await opt.goto(`chrome-extension://${extId}/options/options.html`)
    await opt.waitForLoadState("networkidle")
    await opt.waitForTimeout(300)
    await opt.fill("#api-key", apiKey)
    await opt.click("#save-btn")
    await opt.waitForTimeout(300)
    await opt.click("#test-btn")
    await opt.waitForTimeout(800)
    const r = await opt.textContent("#test-result")
    console.log(`4. Config: "${r}"`)
    await opt.close()
  }

  // Step 4: Test extraction on mock zhipin.com page
  const job = await ctx.newPage()
  await job.route("**://www.zhipin.com/**", (route) => {
    route.fulfill({ body: MOCK_PAGE, contentType: "text/html; charset=utf-8" })
  })
  await job.goto("https://www.zhipin.com/job_detail/test123.html")
  await job.waitForTimeout(2500)

  const btn = await job.$("#aija-btn")
  if (btn) {
    console.log(`5. Button: "${await job.textContent("#aija-btn-text")}" ✓`)
    await btn.click()
    await job.waitForTimeout(2000)
    const toast = await job.$(".aija-toast")
    console.log(`   Toast: ${toast ? await toast.textContent() : "none"}`)
  } else {
    console.log("5. Button: NOT FOUND ✗")
  }

  // Step 5: Verify import
  const jobs: any[] = await p.evaluate(async () => {
    const res = await fetch("/api/jobs", {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    })
    return (await res.json()).data
  })
  const boss = jobs.filter((j: any) => j.platform === "boss")
  console.log(`6. Jobs: ${jobs.length} total, ${boss.length} from Boss直聘`)

  await ctx.close()
  console.log("\nDone!")
}

main().catch((e) => { console.error(e.message); process.exit(1) })
