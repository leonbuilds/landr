import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthUserId } from "@/lib/auth"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "请先登录" } }, { status: 401 })

  const { id } = await params
  const job = await prisma.job.findUnique({
    where: { id: parseInt(id) },
    include: { jdFetchTask: { select: { status: true, error: true } } },
  })
  if (!job) return NextResponse.json({ error: { code: "NOT_FOUND", message: "岗位不存在" } }, { status: 404 })
  if (job.userId !== userId) return NextResponse.json({ error: { code: "FORBIDDEN", message: "无权访问" } }, { status: 403 })

  return NextResponse.json({ data: job })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "请先登录" } }, { status: 401 })

  const { id } = await params
  const existing = await prisma.job.findUnique({ where: { id: parseInt(id) } })
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "无权访问" } }, { status: 403 })
  }

  const body = await req.json()
  const job = await prisma.job.update({
    where: { id: parseInt(id) },
    data: body,
  })
  return NextResponse.json({ data: job })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "请先登录" } }, { status: 401 })

  const { id } = await params
  const existing = await prisma.job.findUnique({ where: { id: parseInt(id) } })
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "无权访问" } }, { status: 403 })
  }

  await prisma.job.delete({ where: { id: parseInt(id) } })
  return NextResponse.json({ data: { success: true } })
}
