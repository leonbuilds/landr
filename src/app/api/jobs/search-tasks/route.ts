// /api/jobs/search-tasks
// GET: 列出当前用户的任务（Bearer，给 UI 用）
//   附带过期清理：running 超过 STALE_MS 自动改为 failed（避免扩展崩了任务永远卡运行中）
// POST: 创建任务（Bearer）
//   body: { source: 'prompt'|'resume', prompt?: string, resumeId?: number, plan: SearchPlan, pages?: number }
// DELETE: 清空当前用户所有 pending + running 任务（紧急止血，UI"清空未完成"按钮）
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthUserId } from "@/lib/auth"
import { planToParamsJson, type SearchPlan } from "@/lib/boss-search"

const STALE_MS = 3 * 60 * 1000 // running > 3 min 视为僵死

async function sweepStale(userId: number) {
  const cutoff = new Date(Date.now() - STALE_MS)
  await prisma.searchTask.updateMany({
    where: { userId, status: "running", updatedAt: { lt: cutoff } },
    data: { status: "failed", message: "扩展长时间未上报结果，自动标记为失败（可能 service worker 被 Chrome 终止）" },
  })
}

export async function GET(req: NextRequest) {
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 })

  await sweepStale(userId)

  const tasks = await prisma.searchTask.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 30,
  })
  return NextResponse.json({ data: tasks })
}

export async function DELETE(req: NextRequest) {
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 })

  const r = await prisma.searchTask.updateMany({
    where: { userId, status: { in: ["pending", "running"] } },
    data: { status: "failed", message: "用户手动取消" },
  })
  return NextResponse.json({ data: { canceled: r.count } })
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
