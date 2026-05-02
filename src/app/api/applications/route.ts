import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthUserId } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "请先登录" } }, { status: 401 })

  const applications = await prisma.application.findMany({
    where: { userId },
    include: { resume: { select: { name: true } }, job: { select: { title: true, company: true } } },
    orderBy: { updatedAt: "desc" },
  })
  return NextResponse.json({ data: applications })
}
