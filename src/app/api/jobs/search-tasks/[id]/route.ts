// PATCH /api/jobs/search-tasks/:id  (扩展 X-API-Key 或 用户 Bearer 都接受)
// body: { status: 'running' | 'done' | 'failed', jobs?: ImportJob[], message?: string }
// status=done 时同时把 jobs 入库（去重 by url），并把 collected/skipped 写回任务
import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthUserId } from "@/lib/auth"
import { corsResponse, corsPreflight, resolveExtensionApiKey } from "@/lib/extension-auth"
import { enqueueJdFetch } from "@/lib/jd-fetch"

interface InboundJob {
  title: string
  company?: string
  salaryRange?: string
  location?: string
  url?: string
  jdText?: string
  platform?: string
}

async function authedUserId(req: NextRequest): Promise<number | null> {
  // 扩展走 X-API-Key，UI 走 Bearer
  const ext = await resolveExtensionApiKey(req)
  if (ext) return ext
  return getAuthUserId(req)
}

export async function OPTIONS() {
  return corsPreflight()
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const userId = await authedUserId(req)
  if (!userId) return corsResponse({ error: { code: "UNAUTHORIZED" } }, 401)

  const taskId = Number(id)
  const task = await prisma.searchTask.findUnique({ where: { id: taskId } })
  if (!task || task.userId !== userId) {
    return corsResponse({ error: { code: "NOT_FOUND", message: "任务不存在" } }, 404)
  }

  const body = await req.json().catch(() => ({}))
  const { status, jobs, message } = body as {
    status?: "running" | "done" | "failed"
    jobs?: InboundJob[]
    message?: string
  }

  if (!status || !["running", "done", "failed"].includes(status)) {
    return corsResponse({ error: { code: "BAD_REQUEST", message: "status 非法" } }, 400)
  }

  let collected = task.collected
  let skipped = task.skipped
  const newlyCreated: { id: number; url: string | null; platform: string | null }[] = []

  if (status === "done" && Array.isArray(jobs) && jobs.length) {
    const existingUrls = new Set(
      (
        await prisma.job.findMany({
          where: { userId, url: { not: null } },
          select: { url: true },
        })
      ).map((j) => j.url as string),
    )

    for (const j of jobs) {
      if (!j.title) continue
      if (j.url && existingUrls.has(j.url)) {
        skipped++
        continue
      }
      try {
        const created = await prisma.job.create({
          data: {
            userId,
            title: j.title,
            company: j.company || null,
            platform: j.platform || "boss",
            jdText: j.jdText || "",
            salaryRange: j.salaryRange || null,
            location: j.location || null,
            url: j.url || null,
          },
          select: { id: true, url: true, platform: true },
        })
        if (j.url) existingUrls.add(j.url)
        collected++
        newlyCreated.push(created)
      } catch {
        skipped++
      }
    }
  }

  const updated = await prisma.searchTask.update({
    where: { id: taskId },
    data: { status, collected, skipped, message: message || null },
  })

  // Auto-enqueue JD-fetch for newly imported boss jobs (failure ignored — not critical)
  if (status === "done" && newlyCreated.length > 0) {
    try {
      await enqueueJdFetch(userId, newlyCreated)
    } catch (err) {
      console.error("[search-task] enqueueJdFetch failed:", err)
    }
  }

  return corsResponse({ data: updated })
}

// DELETE /api/jobs/search-tasks/:id  —  UI"取消"按钮：把 pending/running 改成 failed
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const userId = await authedUserId(req)
  if (!userId) return corsResponse({ error: { code: "UNAUTHORIZED" } }, 401)

  const taskId = Number(id)
  const task = await prisma.searchTask.findUnique({ where: { id: taskId } })
  if (!task || task.userId !== userId) {
    return corsResponse({ error: { code: "NOT_FOUND" } }, 404)
  }
  if (task.status === "done" || task.status === "failed") {
    return corsResponse({ data: task }) // already terminal, idempotent
  }
  const updated = await prisma.searchTask.update({
    where: { id: taskId },
    data: { status: "failed", message: "用户取消" },
  })
  return corsResponse({ data: updated })
}
