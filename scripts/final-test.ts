import { chromium } from "@playwright/test"

async function main() {
  const ctx = await chromium.launchPersistentContext("/tmp/aija-v4", {
    headless: false,
    args: [
      "--disable-extensions-except=/Users/leon/Documents/code/course/ai-job-agent/extension",
      "--load-extension=/Users/leon/Documents/code/course/ai-job-agent/extension",
    ],
    viewport: { width: 1440, height: 900 },
  })

  // Login
  const p = await ctx.newPage()
  await p.goto("http://localhost:3000/login")
  await p.fill('input[type="email"]', "test@test.com")
  await p.fill('input[type="password"]', "test1234")
  await p.click('button[type="submit"]')
  await p.waitForURL("**/resumes", { timeout: 10000 })
  console.log("1. Login OK")

  // Get key
  const key: string = await p.evaluate(async () => {
    const r = await fetch("/api/auth/api-key", {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}`, "Content-Type": "application/json" },
    })
    return (await r.json()).data.key
  })
  console.log(`2. Key: ${key.slice(0, 8)}...`)

  // Extension options page
  let extId = ""
  for (const sw of ctx.serviceWorkers()) {
    const id = sw.url().split("/")[2]
    if (id && id.length === 32) { extId = id; break }
  }

  // Test 1: Extension options page
  const opt = await ctx.newPage()
  await opt.goto(`chrome-extension://${extId}/options/options.html`)
  await opt.waitForLoadState("networkidle")
  await opt.waitForTimeout(300)
  await opt.fill("#api-key", key)
  await opt.click("#save-btn")
  await opt.waitForTimeout(300)
  await opt.click("#test-btn")
  await opt.waitForTimeout(1000)
  const r1 = await opt.textContent("#test-result")
  console.log(`3. Extension test: ${r1?.trim()}`)
  await opt.close()

  // Test 2: Boss extraction
  const boss = await ctx.newPage()
  await boss.route("**://www.zhipin.com/**", (route) => {
    route.fulfill({
      body: '<!DOCTYPE html><html><head><title>Boss</title></head><body><div class="name"><h1>高级前端</h1><span class="badge">30K-50K</span></div><div class="company-info"><span class="name">字节</span></div><div class="job-location">北京</div><div class="job-sec"><div class="text">React前端开发5年经验</div></div></body></html>',
      contentType: "text/html",
    })
  })
  await boss.goto("https://www.zhipin.com/job_detail/final-test.html")
  await boss.waitForTimeout(3000)

  const btn = await boss.waitForSelector("#aija-btn", { timeout: 5000 }).catch(() => null)
  if (btn) {
    await btn.click()
    await boss.waitForTimeout(3000)
    const toast = await boss.waitForSelector(".aija-toast", { timeout: 5000 }).catch(() => null)
    console.log(`4. Boss extract: ${toast ? (await toast.textContent())?.trim() : "no toast"}`)
  } else {
    console.log("4. Boss extract: button NOT found")
  }

  // Count jobs
  const jobs: any[] = await p.evaluate(async () => {
    const r = await fetch("/api/jobs", { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } })
    return (await r.json()).data
  })
  console.log(`5. Jobs: ${jobs.length} total`)

  await ctx.close()
  console.log("\nAll tests complete!")
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
