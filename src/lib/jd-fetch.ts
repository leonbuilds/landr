import { prisma } from "@/lib/prisma"

export const JD_FETCH_USER_PENDING_LIMIT = 50
export const JD_FETCH_COOLOFF_WINDOW_MS = 10 * 60 * 1000
export const JD_FETCH_COOLOFF_FAIL_THRESHOLD = 3
export const JD_FETCH_COOLOFF_DURATION_MS = 30 * 60 * 1000
export const JD_FETCH_STALE_RUNNING_MS = 3 * 60 * 1000

export interface EnqueueCandidate {
  id: number
  url?: string | null
  platform?: string | null
}

export interface EnqueueResult {
  enqueued: number
  skippedExisting: number
  skippedNoUrl: number
  skippedPlatform: number
  skippedOverLimit: number
}

export async function enqueueJdFetch(
  userId: number,
  candidates: EnqueueCandidate[]
): Promise<EnqueueResult> {
  const result: EnqueueResult = {
    enqueued: 0,
    skippedExisting: 0,
    skippedNoUrl: 0,
    skippedPlatform: 0,
    skippedOverLimit: 0,
  }

  const eligible = candidates.filter((c) => {
    if (c.platform !== "boss") {
      result.skippedPlatform++
      return false
    }
    if (!c.url) {
      result.skippedNoUrl++
      return false
    }
    return true
  })

  if (eligible.length === 0) return result

  const currentPending = await prisma.jdFetchTask.count({
    where: { userId, status: { in: ["pending", "running"] } },
  })
  const room = Math.max(0, JD_FETCH_USER_PENDING_LIMIT - currentPending)

  for (let i = 0; i < eligible.length; i++) {
    const c = eligible[i]
    if (i >= room) {
      result.skippedOverLimit++
      continue
    }
    const existing = await prisma.jdFetchTask.findUnique({ where: { jobId: c.id } })
    if (existing) {
      result.skippedExisting++
      continue
    }
    await prisma.jdFetchTask.create({
      data: { userId, jobId: c.id, status: "pending" },
    })
    result.enqueued++
  }

  return result
}

export async function isUserCoolingOff(userId: number, now: Date = new Date()): Promise<boolean> {
  const since = new Date(now.getTime() - JD_FETCH_COOLOFF_WINDOW_MS)
  const recentFails = await prisma.jdFetchTask.count({
    where: {
      userId,
      status: "failed",
      updatedAt: { gte: since },
    },
  })
  return recentFails >= JD_FETCH_COOLOFF_FAIL_THRESHOLD
}

export async function sweepStaleRunning(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - JD_FETCH_STALE_RUNNING_MS)
  const result = await prisma.jdFetchTask.updateMany({
    where: { status: "running", updatedAt: { lt: cutoff } },
    data: { status: "failed", error: "stale-running-timeout" },
  })
  return result.count
}
