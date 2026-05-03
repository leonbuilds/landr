// PATCH /api/jd-fetch-tasks/:id  (扩展 SW 上报终态，X-API-Key)
// body: { status: 'done' | 'failed', jdText?: string, error?: string }
// done: 写入 Job.jdText, JdFetchTask 终态
// failed: 仅 JdFetchTask 终态, 不动 Job.jdText (列表摘要兜底)
import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { corsResponse, corsPreflight, resolveExtensionApiKey } from "@/lib/extension-auth"

export async function OPTIONS() {
  return corsPreflight()
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const userId = await resolveExtensionApiKey(req)
  if (!userId) return corsResponse({ error: { code: "UNAUTHORIZED" } }, 401)

  const taskId = Number(id)
  if (!Number.isFinite(taskId)) {
    return corsResponse({ error: { code: "BAD_REQUEST", message: "id 非法" } }, 400)
  }

  const task = await prisma.jdFetchTask.findUnique({ where: { id: taskId } })
  if (!task || task.userId !== userId) {
    return corsResponse({ error: { code: "NOT_FOUND" } }, 404)
  }

  const body = (await req.json().catch(() => ({}))) as {
    status?: "done" | "failed"
    jdText?: string
    error?: string
  }
  const { status, jdText, error } = body

  if (!status || !["done", "failed"].includes(status)) {
    return corsResponse({ error: { code: "BAD_REQUEST", message: "status 必须 done|failed" } }, 400)
  }

  // 终态后不再改
  if (task.status === "done" || task.status === "failed") {
    return corsResponse({ data: task })
  }

  if (status === "done") {
    if (!jdText || jdText.length < 30) {
      // 拿到的 JD 太短，视为失败而非 done（避免覆盖摘要）
      const updated = await prisma.jdFetchTask.update({
        where: { id: taskId },
        data: { status: "failed", error: error || "jdText too short" },
      })
      return corsResponse({ data: updated })
    }
    // 同事务内：升级 Job.jdText + 翻状态
    const updated = await prisma.$transaction(async (tx) => {
      await tx.job.update({
        where: { id: task.jobId },
        data: { jdText },
      })
      return tx.jdFetchTask.update({
        where: { id: taskId },
        data: { status: "done", error: null },
      })
    })
    return corsResponse({ data: updated })
  }

  // failed
  const updated = await prisma.jdFetchTask.update({
    where: { id: taskId },
    data: { status: "failed", error: error?.slice(0, 500) || "unknown" },
  })
  return corsResponse({ data: updated })
}
