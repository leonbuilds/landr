import { beforeEach, describe, expect, it, vi } from "vitest"

const mockPrisma = vi.hoisted(() => ({
  jdFetchTask: {
    count: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
}))

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))

import {
  enqueueJdFetch,
  isUserCoolingOff,
  sweepStaleRunning,
  JD_FETCH_USER_PENDING_LIMIT,
} from "@/lib/jd-fetch"

beforeEach(() => {
  Object.values(mockPrisma.jdFetchTask).forEach((fn) => fn.mockReset())
})

describe("enqueueJdFetch", () => {
  it("skips non-boss platform jobs", async () => {
    mockPrisma.jdFetchTask.count.mockResolvedValueOnce(0)
    const r = await enqueueJdFetch(1, [
      { id: 10, url: "https://linkedin.com/jobs/1", platform: "linkedin" },
      { id: 11, url: "https://lagou.com/2", platform: "lagou" },
    ])
    expect(r.enqueued).toBe(0)
    expect(r.skippedPlatform).toBe(2)
    expect(mockPrisma.jdFetchTask.create).not.toHaveBeenCalled()
  })

  it("skips jobs without url", async () => {
    mockPrisma.jdFetchTask.count.mockResolvedValueOnce(0)
    const r = await enqueueJdFetch(1, [
      { id: 10, url: "", platform: "boss" },
      { id: 11, url: null, platform: "boss" },
    ])
    expect(r.enqueued).toBe(0)
    expect(r.skippedNoUrl).toBe(2)
  })

  it("skips jobs that already have a task (upsert semantics)", async () => {
    mockPrisma.jdFetchTask.count.mockResolvedValueOnce(0)
    mockPrisma.jdFetchTask.findUnique.mockResolvedValue({ id: 99, jobId: 10 })

    const r = await enqueueJdFetch(1, [
      { id: 10, url: "https://www.zhipin.com/job_detail/abc.html", platform: "boss" },
    ])

    expect(r.enqueued).toBe(0)
    expect(r.skippedExisting).toBe(1)
    expect(mockPrisma.jdFetchTask.create).not.toHaveBeenCalled()
  })

  it("creates one task per eligible boss job with url", async () => {
    mockPrisma.jdFetchTask.count.mockResolvedValueOnce(0)
    mockPrisma.jdFetchTask.findUnique.mockResolvedValue(null)
    mockPrisma.jdFetchTask.create.mockResolvedValue({ id: 1 })

    const r = await enqueueJdFetch(7, [
      { id: 10, url: "https://www.zhipin.com/job_detail/a.html", platform: "boss" },
      { id: 11, url: "https://www.zhipin.com/job_detail/b.html", platform: "boss" },
    ])

    expect(r.enqueued).toBe(2)
    expect(mockPrisma.jdFetchTask.create).toHaveBeenCalledTimes(2)
    expect(mockPrisma.jdFetchTask.create).toHaveBeenCalledWith({
      data: { userId: 7, jobId: 10, status: "pending" },
    })
  })

  it("respects per-user pending limit (50)", async () => {
    mockPrisma.jdFetchTask.count.mockResolvedValueOnce(JD_FETCH_USER_PENDING_LIMIT - 1)
    mockPrisma.jdFetchTask.findUnique.mockResolvedValue(null)
    mockPrisma.jdFetchTask.create.mockResolvedValue({ id: 1 })

    const candidates = [
      { id: 100, url: "https://www.zhipin.com/job_detail/a.html", platform: "boss" },
      { id: 101, url: "https://www.zhipin.com/job_detail/b.html", platform: "boss" },
      { id: 102, url: "https://www.zhipin.com/job_detail/c.html", platform: "boss" },
    ]
    const r = await enqueueJdFetch(7, candidates)

    expect(r.enqueued).toBe(1)
    expect(r.skippedOverLimit).toBe(2)
  })
})

describe("isUserCoolingOff", () => {
  it("returns true when 3+ failures in window", async () => {
    mockPrisma.jdFetchTask.count.mockResolvedValueOnce(3)
    expect(await isUserCoolingOff(1)).toBe(true)
  })

  it("returns false below threshold", async () => {
    mockPrisma.jdFetchTask.count.mockResolvedValueOnce(2)
    expect(await isUserCoolingOff(1)).toBe(false)
  })
})

describe("sweepStaleRunning", () => {
  it("flips running tasks older than 3min to failed", async () => {
    mockPrisma.jdFetchTask.updateMany.mockResolvedValueOnce({ count: 4 })
    const swept = await sweepStaleRunning()
    expect(swept).toBe(4)
    expect(mockPrisma.jdFetchTask.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "running" }),
        data: { status: "failed", error: "stale-running-timeout" },
      })
    )
  })
})
