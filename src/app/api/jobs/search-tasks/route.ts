// /api/jobs/search-tasks
// GET: 列出当前用户的任务（Bearer，给 UI 用）
// POST: 创建任务（Bearer）
//   body: { source: 'prompt'|'resume', prompt?: string, resumeId?: number, plan: SearchPlan, pages?: number }
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthUserId } from "@/lib/auth"
import { planToParamsJson, type SearchPlan } from "@/lib/boss-search"

export async function GET(req: NextRequest) {
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 })

  const tasks = await prisma.searchTask.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 30,
  })
  return NextResponse.json({ data: tasks })
}

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 })

  try {
    const body = await req.json()
    const { source, prompt, resumeId, plan, pages = 3 } = body as {
      source: "prompt" | "resume"
      prompt?: string
      resumeId?: number
      plan: SearchPlan
      pages?: number
    }

    if (!plan?.query) {
      return NextResponse.json({ error: { code: "BAD_REQUEST", message: "缺少 plan.query" } }, { status: 400 })
    }
    if (!["prompt", "resume"].includes(source)) {
      return NextResponse.json({ error: { code: "BAD_REQUEST", message: "source 非法" } }, { status: 400 })
    }

    const task = await prisma.searchTask.create({
      data: {
        userId,
        source,
        prompt: prompt || null,
        resumeId: resumeId ? Number(resumeId) : null,
        params: planToParamsJson(plan, Math.min(Math.max(1, pages), 10)),
        status: "pending",
      },
    })

    return NextResponse.json({ data: task }, { status: 201 })
  } catch (e) {
    console.error("create search-task error:", e)
    return NextResponse.json({ error: { code: "SERVER_ERROR", message: "创建任务失败" } }, { status: 500 })
  }
}
