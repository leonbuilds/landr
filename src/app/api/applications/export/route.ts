import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthUserId } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 })

  const apps = await prisma.application.findMany({
    where: { userId },
    include: { resume: { select: { name: true } }, job: { select: { title: true, company: true } } },
    orderBy: { updatedAt: "desc" },
  })

  const header = "岗位,公司,简历,状态,匹配度,投递时间,下次跟进,备注,创建时间\n"
  const rows = apps
    .map((a) =>
      [
        a.job?.title || "",
        a.job?.company || "",
        a.resume?.name || "",
        a.status,
        a.matchScore || "",
        a.appliedAt?.toISOString() || "",
        a.nextFollowup?.toISOString() || "",
        (a.notes || "").replace(/,/g, "，"),
        a.createdAt.toISOString(),
      ].join(",")
    )
    .join("\n")

  const csv = "﻿" + header + rows

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="applications-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
