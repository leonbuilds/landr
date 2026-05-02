import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthUserId } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 })

  const applications = await prisma.application.findMany({
    where: { userId },
    select: { status: true, matchScore: true, createdAt: true, appliedAt: true },
  })

  // Stats by status
  const statusCounts: Record<string, number> = {
    draft: 0, applied: 0, written_test: 0, interview: 0, offer: 0, rejected: 0, withdrawn: 0,
  }
  for (const a of applications) {
    statusCounts[a.status] = (statusCounts[a.status] || 0) + 1
  }

  // Time series: applications created per day (last 30 days)
  const dailyCounts: Record<string, number> = {}
  const now = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    dailyCounts[key] = 0
  }
  for (const a of applications) {
    const key = a.createdAt.toISOString().slice(0, 10)
    if (dailyCounts[key] !== undefined) dailyCounts[key]++
  }

  // Pipeline: total → applied → written_test → interview → offer
  const pipeline = [
    { stage: "全部", count: applications.length },
    { stage: "已投递", count: statusCounts.applied },
    { stage: "笔试", count: statusCounts.written_test },
    { stage: "面试", count: statusCounts.interview },
    { stage: "Offer", count: statusCounts.offer },
  ]

  return NextResponse.json({
    data: {
      total: applications.length,
      statusCounts,
      dailyCounts: Object.entries(dailyCounts).map(([date, count]) => ({ date, count })),
      pipeline,
      avgMatchScore: applications.length > 0
        ? Math.round(applications.reduce((s, a) => s + (a.matchScore || 0), 0) / applications.length)
        : 0,
    },
  })
}
