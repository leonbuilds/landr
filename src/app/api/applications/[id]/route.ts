import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthUserId } from "@/lib/auth"
import { resolveExtensionApiKey, corsResponse, corsPreflight } from "@/lib/extension-auth"

// 同时接受 Bearer (UI) 和 X-API-Key (扩展)
async function authedUserId(req: NextRequest): Promise<number | null> {
  const ext = await resolveExtensionApiKey(req)
  if (ext) return ext
  return getAuthUserId(req)
}

export async function OPTIONS() {
  return corsPreflight()
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await authedUserId(req)
  if (!userId) return corsResponse({ error: { code: "UNAUTHORIZED" } }, 401)

  const { id } = await params
  const app = await prisma.application.findUnique({
    where: { id: parseInt(id) },
    include: { resume: true, job: true, statusLogs: { orderBy: { createdAt: "desc" } } },
  })
  if (!app || app.userId !== userId) {
    return corsResponse({ error: { code: "FORBIDDEN", message: "无权访问" } }, 403)
  }
  return corsResponse({ data: app })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await authedUserId(req)
  if (!userId) return corsResponse({ error: { code: "UNAUTHORIZED" } }, 401)

  const { id } = await params
  const existing = await prisma.application.findUnique({ where: { id: parseInt(id) } })
  if (!existing || existing.userId !== userId) {
    return corsResponse({ error: { code: "FORBIDDEN", message: "无权访问" } }, 403)
  }

  const body = await req.json()
  const { status, notes, nextFollowup, appliedAt, ...rest } = body

  // Log status change
  if (status && status !== existing.status) {
    await prisma.statusLog.create({
      data: {
        applicationId: parseInt(id),
        fromStatus: existing.status,
        toStatus: status,
        note: notes || "",
      },
    })
  }

  const updateData: Record<string, unknown> = { ...rest, status: status || existing.status }
  if (notes !== undefined) updateData.notes = notes
  if (nextFollowup !== undefined) updateData.nextFollowup = nextFollowup ? new Date(nextFollowup) : null
  if (appliedAt !== undefined) updateData.appliedAt = appliedAt ? new Date(appliedAt) : null
  // 自动 stamp appliedAt：状态切到 applied 且原来没有 appliedAt
  if (status === "applied" && !existing.appliedAt && updateData.appliedAt === undefined) {
    updateData.appliedAt = new Date()
  }

  const app = await prisma.application.update({
    where: { id: parseInt(id) },
    data: updateData,
    include: { resume: true, job: true, statusLogs: { orderBy: { createdAt: "desc" } } },
  })
  return corsResponse({ data: app })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await authedUserId(req)
  if (!userId) return corsResponse({ error: { code: "UNAUTHORIZED" } }, 401)

  const { id } = await params
  const existing = await prisma.application.findUnique({ where: { id: parseInt(id) } })
  if (!existing || existing.userId !== userId) {
    return corsResponse({ error: { code: "FORBIDDEN" } }, 403)
  }
  await prisma.application.delete({ where: { id: parseInt(id) } })
  return corsResponse({ data: { success: true } })
}
