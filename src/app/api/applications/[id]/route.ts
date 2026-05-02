import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthUserId } from "@/lib/auth"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 })

  const { id } = await params
  const app = await prisma.application.findUnique({
    where: { id: parseInt(id) },
    include: { resume: true, job: true, statusLogs: { orderBy: { createdAt: "desc" } } },
  })
  if (!app || app.userId !== userId) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "无权访问" } }, { status: 403 })
  }
  return NextResponse.json({ data: app })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 })

  const { id } = await params
  const existing = await prisma.application.findUnique({ where: { id: parseInt(id) } })
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "无权访问" } }, { status: 403 })
  }

  const body = await req.json()
  const { status, notes, nextFollowup, ...rest } = body

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

  const app = await prisma.application.update({
    where: { id: parseInt(id) },
    data: { ...rest, status: status || existing.status, notes, nextFollowup: nextFollowup ? new Date(nextFollowup) : undefined },
    include: { resume: true, job: true, statusLogs: { orderBy: { createdAt: "desc" } } },
  })
  return NextResponse.json({ data: app })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 })

  const { id } = await params
  const existing = await prisma.application.findUnique({ where: { id: parseInt(id) } })
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 })
  }
  await prisma.application.delete({ where: { id: parseInt(id) } })
  return NextResponse.json({ data: { success: true } })
}
