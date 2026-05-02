import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthUserId } from "@/lib/auth"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "请先登录" } }, { status: 401 })

  const { id } = await params
  const resume = await prisma.resume.findUnique({ where: { id: parseInt(id) } })
  if (!resume) return NextResponse.json({ error: { code: "NOT_FOUND", message: "简历不存在" } }, { status: 404 })
  if (resume.userId !== userId) return NextResponse.json({ error: { code: "FORBIDDEN", message: "无权访问" } }, { status: 403 })

  return NextResponse.json({ data: resume })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "请先登录" } }, { status: 401 })

  const { id } = await params
  const existing = await prisma.resume.findUnique({ where: { id: parseInt(id) } })
  if (!existing) return NextResponse.json({ error: { code: "NOT_FOUND", message: "简历不存在" } }, { status: 404 })
  if (existing.userId !== userId) return NextResponse.json({ error: { code: "FORBIDDEN", message: "无权访问" } }, { status: 403 })

  const body = await req.json()
  const resume = await prisma.resume.update({
    where: { id: parseInt(id) },
    data: { name: body.name, rawText: body.rawText },
  })
  return NextResponse.json({ data: resume })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "请先登录" } }, { status: 401 })

  const { id } = await params
  const existing = await prisma.resume.findUnique({ where: { id: parseInt(id) } })
  if (!existing) return NextResponse.json({ error: { code: "NOT_FOUND", message: "简历不存在" } }, { status: 404 })
  if (existing.userId !== userId) return NextResponse.json({ error: { code: "FORBIDDEN", message: "无权访问" } }, { status: 403 })

  await prisma.resume.delete({ where: { id: parseInt(id) } })
  return NextResponse.json({ data: { success: true } })
}
