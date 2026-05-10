// 验证：清空未完成按钮在两种状态下都可见
//   场景 A: 有 pending/running 任务时 → enabled，点击后清空生效
//   场景 B: 全部 done/failed 时 → 仍可见但 disabled
import { chromium } from "@playwright/test"
import * as fs from "node:fs"

const DEEPSEEK_KEY = process.env.DEEPSEEK_KEY!
const BASE = "http://localhost:3000"
const SHOTS = "/Users/leon/Documents/code/ai-coding/landr/docs/screenshots"

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  fs.rmSync("/tmp/aija-verify", { recursive: true, force: true })

  const ctx = await chromium.launchPersistentContext("/tmp/aija-verify", {
    headless: false,
    viewport: { width: 1440, height: 900 },
  })
  const page = await ctx.newPage()

  console.log("[1] register")
  const email = `vrf${Date.now()}@test.com`
  await page.goto(`${BASE}/register`)
  await page.waitForLoadState("networkidle")
  await page.fill('input[type="email"]', email)
  const pw = await page.locator('input[type="password"]').all()
  await pw[0].fill("Demo1234")
  await pw[1].fill("Demo1234")
  await page.click('button[type="submit"]')
  await page.waitForURL("**/resumes", { timeout: 10000 })
  const token = await page.evaluate(() => localStorage.getItem("token"))

  console.log("[2] config DeepSeek key")
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

  console.log("[3] go to /jobs and create a task via API (skip LLM)")
  await page.goto(`${BASE}/jobs`)
  await page.waitForLoadState("networkidle")

  // 直接造一个 pending 任务
  await page.evaluate(async (t) => {
    await fetch("/api/jobs/search-tasks", {
      method: "POST",
      headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "prompt",
        prompt: "测试",
        plan: { query: "前端", city: "北京", salaryMin: 30, salaryMax: 60 },
        pages: 1,
      }),
    })
  }, token)

  // 等 UI 轮询拉到任务（5s 周期）
  await page.waitForTimeout(6000)
  await page.screenshot({ path: `${SHOTS}/verify-1-with-pending.png`, fullPage: true })
  console.log("    📸 verify-1-with-pending.png")

  // 验证按钮存在 + 可点
  const btn = page.locator("button:has-text('清空未完成')")
  const exists = await btn.count()
  if (!exists) throw new Error("FAIL: 清空未完成 按钮在有 pending 任务时也找不到")
  const disabled = await btn.first().isDisabled()
  console.log(`    button exists=${exists>0} disabled=${disabled}`)
  if (disabled) throw new Error("FAIL: 有 pending 任务时按钮应该 enabled")

  console.log("[4] click 清空未完成 (auto-confirm)")
  // 拦截 confirm dialog
  page.on("dialog", (d) => d.accept())
  await btn.first().click()
  await page.waitForTimeout(1500)

  // 现在所有任务都应该是 failed → 按钮还在但 disabled
  await page.screenshot({ path: `${SHOTS}/verify-2-after-clear.png`, fullPage: true })
  console.log("    📸 verify-2-after-clear.png")

  const btn2 = page.locator("button:has-text('清空未完成')")
  const exists2 = await btn2.count()
  const disabled2 = await btn2.first().isDisabled()
  console.log(`    after clear: button exists=${exists2>0} disabled=${disabled2}`)
  if (!exists2) throw new Error("FAIL: 清空后按钮消失了，应该是仍可见但 disabled")
  if (!disabled2) throw new Error("FAIL: 清空后按钮应该 disabled")

  // 检查任务列表里现在显示 failed 状态
  const failedBadge = await page.locator("text=失败").count()
  console.log(`    failed badges in tasks list: ${failedBadge}`)
  if (failedBadge === 0) throw new Error("FAIL: 任务清空后应该显示 失败 状态")

  console.log("\n✅ 全部验证通过")
  console.log(`   - 有 pending: 按钮可见且 enabled`)
  console.log(`   - 点击清空: 任务变 failed`)
  console.log(`   - 清空后: 按钮仍可见但 disabled`)
  console.log(`   截图: ${SHOTS}/verify-{1,2}-*.png`)

  await ctx.close()
  process.exit(0)
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1) })
