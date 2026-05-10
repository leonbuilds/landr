// 验证：岗位详情页有"打开 Boss 原页"按钮且点击 href 正确
import { chromium } from "@playwright/test"
import * as fs from "node:fs"

const BASE = "http://localhost:3000"
const SHOTS = "/Users/leon/Documents/code/ai-coding/landr/docs/screenshots"

const assertions: { name: string; ok: boolean; detail?: string }[] = []
function check(name: string, ok: boolean, detail?: string) {
  assertions.push({ name, ok, detail })
  console.log(`   ${ok ? "✅" : "❌"} ${name}${detail ? "  — " + detail : ""}`)
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  fs.rmSync("/tmp/aija-jdburl", { recursive: true, force: true })

  const ctx = await chromium.launchPersistentContext("/tmp/aija-jdburl", {
    headless: false,
    viewport: { width: 1440, height: 900 },
  })
  const page = await ctx.newPage()

  console.log("[1] register")
  const email = `urlbtn${Date.now()}@test.com`
  await page.goto(`${BASE}/register`)
  await page.waitForLoadState("networkidle")
  await page.fill('input[type="email"]', email)
  const pw = await page.locator('input[type="password"]').all()
  await pw[0].fill("Demo1234"); await pw[1].fill("Demo1234")
  await page.click('button[type="submit"]')
  await page.waitForURL("**/resumes", { timeout: 10000 })
  const token = (await page.evaluate(() => localStorage.getItem("token"))) as string

  console.log("[2] create one job WITH url, one WITHOUT")
  const ids = await page.evaluate(async (t: string) => {
    const headers = { Authorization: `Bearer ${t}`, "Content-Type": "application/json" }
    const j1 = await (await fetch("/api/jobs", {
      method: "POST", headers,
      body: JSON.stringify({
        title: "带 URL 的岗位",
        company: "字节",
        url: "https://www.zhipin.com/job_detail/test-with-url.html",
        location: "北京",
        salaryRange: "30-60K",
        platform: "boss",
        jdText: "JD text 带 URL",
      }),
    })).json()
    const j2 = await (await fetch("/api/jobs", {
      method: "POST", headers,
      body: JSON.stringify({
        title: "无 URL 的岗位",
        jdText: "JD text 无 URL",
      }),
    })).json()
    return { withUrl: j1.data.id, withoutUrl: j2.data.id }
  }, token)
  console.log("    seeded", ids)

  console.log("[3] open job detail with url")
  await page.goto(`${BASE}/jobs/${ids.withUrl}`)
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${SHOTS}/jdburl-1-with-url.png`, fullPage: true })
  console.log("    📸 jdburl-1-with-url.png")

  const btn = page.locator("a:has-text('打开'), a:has-text('Boss 原页')").first()
  check("带 URL 岗位 — 显示打开原页按钮", (await btn.count()) > 0)
  if (await btn.count()) {
    const href = await btn.getAttribute("href")
    const target = await btn.getAttribute("target")
    check("按钮 href 是 Boss URL", href === "https://www.zhipin.com/job_detail/test-with-url.html", href || "null")
    check("按钮 target=_blank", target === "_blank")
  }

  console.log("[4] open job detail without url")
  await page.goto(`${BASE}/jobs/${ids.withoutUrl}`)
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(500)
  const btn2 = page.locator("a:has-text('打开'), a:has-text('Boss 原页')")
  check("无 URL 岗位 — 不显示打开按钮", (await btn2.count()) === 0)
  await page.screenshot({ path: `${SHOTS}/jdburl-2-without-url.png`, fullPage: true })
  console.log("    📸 jdburl-2-without-url.png")

  console.log("\n=================================================")
  const failed = assertions.filter((a) => !a.ok)
  if (failed.length === 0) console.log(`✅ 全部 ${assertions.length} 项断言通过`)
  else { console.log(`❌ ${failed.length}/${assertions.length} 失败`); failed.forEach(f => console.log(`   - ${f.name}${f.detail ? "  ("+f.detail+")" : ""}`)) }
  console.log("=================================================")
  await ctx.close()
  process.exit(failed.length === 0 ? 0 : 1)
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1) })
