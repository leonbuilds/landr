// scripts/verify-jd-fetch.ts
// API-level e2e for JD fetch pipeline (no real browser needed)
// 1. register fresh user
// 2. provision API key
// 3. seed 3 fake Boss jobs + 3 JdFetchTask pending via prisma
// 4. exercise GET /pending → atomic flip + lock semantics
// 5. exercise PATCH /:id done (updates Job.jdText) + failed (preserves snippet)
// 6. exercise cool-off (3 failures → 4th pending blocks)
//
// Run: npx tsx scripts/verify-jd-fetch.ts  (dev server on :3000 must be up)

import { prisma } from "../src/lib/prisma"

const BASE = process.env.BASE || "http://localhost:3000"

const assertions: { name: string; ok: boolean; detail?: string }[] = []
function check(name: string, ok: boolean, detail?: string) {
  assertions.push({ name, ok, detail })
  console.log(`   ${ok ? "✅" : "❌"} ${name}${detail ? "  — " + detail : ""}`)
}

async function jsonOf(r: Response) {
  return (await r.json()) as { data?: unknown; error?: { code: string; message: string }; reason?: string }
}

async function main() {
  const email = `jdfetch${Date.now()}@test.com`
  const password = "Demo1234"

  console.log("[1] register + login")
  const reg = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name: "JD Fetch Tester" }),
  })
  const regJson = (await reg.json()) as { data: { token: string; user: { id: number } } }
  const token = regJson.data.token
  const userId = regJson.data.user.id
  check("register ok", !!token && !!userId, `userId=${userId}`)

  console.log("[2] provision extension API key")
  const apiKeyRes = await fetch(`${BASE}/api/auth/api-key`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  })
  const apiKey = ((await apiKeyRes.json()) as { data: { key: string } }).data.key
  check("api key issued", !!apiKey, apiKey.slice(0, 12) + "…")

  console.log("[3] seed 3 boss jobs with snippet jdText")
  const jobs = await Promise.all(
    [1, 2, 3].map((i) =>
      prisma.job.create({
        data: {
          userId,
          title: `测试岗位 ${i}`,
          company: `公司 ${i}`,
          platform: "boss",
          url: `https://www.zhipin.com/job_detail/test${Date.now()}-${i}.html`,
          jdText: `经验3年 · React · 福利齐全 · 北京 · 30K-60K`, // ~30 字摘要
        },
      })
    )
  )
  check("seeded 3 jobs", jobs.length === 3)
  const snippetLen = jobs[0].jdText!.length
  console.log(`    snippet length = ${snippetLen}`)

  console.log("[4] enqueue 3 JdFetchTask pending")
  await Promise.all(
    jobs.map((j) =>
      prisma.jdFetchTask.create({ data: { userId, jobId: j.id, status: "pending" } })
    )
  )
  const pendingCount = await prisma.jdFetchTask.count({ where: { userId, status: "pending" } })
  check("3 pending tasks created", pendingCount === 3)

  console.log("[5] GET /pending — first call returns task #1, atomically flips to running")
  const r1 = await fetch(`${BASE}/api/jd-fetch-tasks/pending`, {
    headers: { "X-API-Key": apiKey },
  })
  const j1 = await jsonOf(r1)
  const t1 = j1.data as { id: number; jobId: number; url: string } | null
  check("first /pending returns a task", t1 !== null && typeof t1?.id === "number")
  check("returned task has url", !!t1?.url, t1?.url?.slice(0, 50))

  console.log("[6] GET /pending again → blocked by running lock")
  const r2 = await fetch(`${BASE}/api/jd-fetch-tasks/pending`, {
    headers: { "X-API-Key": apiKey },
  })
  const j2 = await jsonOf(r2)
  check("second /pending returns null while one is running", j2.data === null, `reason=${j2.reason}`)

  console.log("[7] PATCH first task → done + jdText 完整版")
  const fullJd =
    "我们正在寻找一位经验丰富的高级前端工程师 · 5年以上 · React/TypeScript/Vite · 字节跳动 · 北京 · 30K-60K · " +
    "负责 SaaS 平台的核心 UI 组件库建设、性能优化、与后端 GraphQL/RESTful API 的对接。要求精通 React 18+ ".repeat(2)
  const r3 = await fetch(`${BASE}/api/jd-fetch-tasks/${t1!.id}`, {
    method: "PATCH",
    headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "done", jdText: fullJd }),
  })
  const j3 = await jsonOf(r3)
  check("PATCH done returns 200", r3.ok)
  check("task status now done", (j3.data as { status: string })?.status === "done")
  const updatedJob = await prisma.job.findUnique({ where: { id: t1!.jobId } })
  check(
    "Job.jdText upgraded from snippet to full",
    (updatedJob?.jdText?.length || 0) > snippetLen,
    `len: ${snippetLen} → ${updatedJob?.jdText?.length}`
  )

  console.log("[8] GET /pending → should now hand out task #2 (no lock)")
  const r4 = await fetch(`${BASE}/api/jd-fetch-tasks/pending`, {
    headers: { "X-API-Key": apiKey },
  })
  const j4 = await jsonOf(r4)
  const t2 = j4.data as { id: number; jobId: number } | null
  check("third /pending returns next task", t2 !== null && t2?.id !== t1!.id)

  console.log("[9] PATCH task #2 → failed, Job.jdText 不变")
  const beforeJob2 = await prisma.job.findUnique({ where: { id: t2!.jobId } })
  const r5 = await fetch(`${BASE}/api/jd-fetch-tasks/${t2!.id}`, {
    method: "PATCH",
    headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "failed", error: "detail-empty" }),
  })
  check("PATCH failed returns 200", r5.ok)
  const afterJob2 = await prisma.job.findUnique({ where: { id: t2!.jobId } })
  check("Job.jdText unchanged on failure", afterJob2?.jdText === beforeJob2?.jdText)

  console.log("[10] PATCH 'done' but jdText too short → coerced to failed (won't overwrite snippet)")
  const r6 = await fetch(`${BASE}/api/jd-fetch-tasks/pending`, {
    headers: { "X-API-Key": apiKey },
  })
  const t3 = ((await jsonOf(r6)).data as { id: number; jobId: number } | null)
  check("got task #3", t3 !== null)
  const r7 = await fetch(`${BASE}/api/jd-fetch-tasks/${t3!.id}`, {
    method: "PATCH",
    headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "done", jdText: "短" }), // < 30 字符
  })
  check("PATCH short-jdText returns 200", r7.ok)
  const final3 = await prisma.jdFetchTask.findUnique({ where: { id: t3!.id } })
  check("short jdText coerced to failed", final3?.status === "failed")
  const job3 = await prisma.job.findUnique({ where: { id: t3!.jobId } })
  check("Job.jdText unchanged when jdText too short", job3?.jdText !== "短")

  console.log("[11] cool-off: 3 failed in window → /pending returns null (cool-off)")
  // 此时所有 3 条都终态了 (1 done + 2 failed)。需要至少 3 个 failed 触发冷却
  // 再 seed 1 个 Boss job + pending → 看是否被冷却拦下
  const newJob = await prisma.job.create({
    data: {
      userId,
      title: "冷却测试岗位",
      platform: "boss",
      url: `https://www.zhipin.com/job_detail/cool-${Date.now()}.html`,
      jdText: "snippet",
    },
  })
  await prisma.jdFetchTask.create({ data: { userId, jobId: newJob.id, status: "pending" } })

  // 但当前只有 2 个 failed (task#2 真正 failed + task#3 coerced failed)。需要再制造 1 个 failed
  // 简化: 直接更新一条已有 done 的为 failed (or just add one more)
  await prisma.jdFetchTask.create({
    data: { userId, jobId: jobs[0].id + 999999, status: "failed", error: "synth" },
  }).catch(() => {})  // 可能因外键失败, 那就直接 manipulate updatedAt 让现有 failed 算入

  // 简单替代: 看现有 failed 数。已经有 2 failed, 不够 3 个阈值. 再 PATCH 新 task 失败一次:
  const r8 = await fetch(`${BASE}/api/jd-fetch-tasks/pending`, {
    headers: { "X-API-Key": apiKey },
  })
  const t4 = ((await jsonOf(r8)).data as { id: number } | null)
  if (t4) {
    await fetch(`${BASE}/api/jd-fetch-tasks/${t4.id}`, {
      method: "PATCH",
      headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "failed", error: "third-fail" }),
    })
  }

  // 现在应该 3 个 failed → cool-off 生效, 但需要再 seed 1 个 pending 验证拒绝
  const newJob2 = await prisma.job.create({
    data: {
      userId,
      title: "冷却测试岗位 #2",
      platform: "boss",
      url: `https://www.zhipin.com/job_detail/cool2-${Date.now()}.html`,
      jdText: "snippet",
    },
  })
  await prisma.jdFetchTask.create({ data: { userId, jobId: newJob2.id, status: "pending" } })

  const r9 = await fetch(`${BASE}/api/jd-fetch-tasks/pending`, {
    headers: { "X-API-Key": apiKey },
  })
  const j9 = await jsonOf(r9)
  check("cool-off blocks new pending pickup", j9.data === null && j9.reason === "cool-off", `reason=${j9.reason}`)

  console.log("\n=================================================")
  const failed = assertions.filter((a) => !a.ok)
  console.log(
    failed.length === 0
      ? `✅ 全部 ${assertions.length} 项断言通过`
      : `❌ ${failed.length}/${assertions.length} 失败`
  )
  failed.forEach((f) => console.log(`   - ${f.name}${f.detail ? "  (" + f.detail + ")" : ""}`))
  console.log("=================================================")

  await prisma.$disconnect()
  process.exit(failed.length === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error("FAILED:", e?.stack || e?.message || e)
  prisma.$disconnect().finally(() => process.exit(1))
})
