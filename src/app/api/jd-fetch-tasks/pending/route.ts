// GET /api/jd-fetch-tasks/pending  (扩展 SW 轮询，X-API-Key)
// 返回当前用户最早一条 pending JD 抓取任务，并原子翻转 pending→running。
// 锁: 同 user 已有 running JdFetchTask 或 SearchTask → 返回 null。
// 冷却: 近 10min ≥ 3 条 failed → 30min 暂停拾取。
// 兜底: > 3min 未上报的 running 自动 sweep 为 failed。
import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { corsResponse, corsPreflight, resolveExtensionApiKey } from "@/lib/extension-auth"
import {
  isUserCoolingOff,
  sweepStaleRunning,
  JD_FETCH_COOLOFF_DURATION_MS,
  JD_FETCH_COOLOFF_FAIL_THRESHOLD,
} from "@/lib/jd-fetch"

export async function OPTIONS() {
  return corsPreflight()
}

export async function GET(req: NextRequest) {
  const userId = await resolveExtensionApiKey(req)
  if (!userId) return corsResponse({ error: { code: "UNAUTHORIZED" } }, 401)

  // 1. sweep stale running
  await sweepStaleRunning()

  // 2. 锁 — 同 user 不能有别的 JdFetchTask running，也不能有 SearchTask running
  const otherRunning = await prisma.jdFetchTask.findFirst({
    where: { userId, status: "running" },
  })
  if (otherRunning) return corsResponse({ data: null, reason: "running-lock" })

  const searchRunning = await prisma.searchTask.findFirst({
    where: { userId, status: "running" },
  })
  if (searchRunning) return corsResponse({ data: null, reason: "search-running" })

  // 3. 冷却 — 近 10min 内 ≥ 3 失败
  const cooling = await isUserCoolingOff(userId)
  if (cooling) {
    // 检查是否还在 30min 暂停期
    const since = new Date(Date.now() - JD_FETCH_COOLOFF_DURATION_MS)
    const recentFails = await prisma.jdFetchTask.count({
      where: { userId, status: "failed", updatedAt: { gte: since } },
    })
    if (recentFails >= JD_FETCH_COOLOFF_FAIL_THRESHOLD) {
      return corsResponse({
        data: null,
        reason: "cool-off",
        cooloffMinutes: Math.round(JD_FETCH_COOLOFF_DURATION_MS / 60000),
      })
    }
  }

  // 4. 原子翻转 pending → running
  const task = await prisma.$transaction(async (tx) => {
    const t = await tx.jdFetchTask.findFirst({
      where: { userId, status: "pending" },
      orderBy: { createdAt: "asc" },
      include: { job: { select: { id: true, url: true, platform: true } } },
    })
    if (!t || !t.job?.url) return null
    const updated = await tx.jdFetchTask.update({
      where: { id: t.id },
      data: { status: "running" },
    })
    return { ...updated, job: t.job }
  })

  if (!task) return corsResponse({ data: null, reason: "empty" })

  return corsResponse({
    data: {
      id: task.id,
      jobId: task.jobId,
      url: task.job.url,
      platform: task.job.platform,
    },
  })
}
