// GET /api/jobs/search-tasks/pending  (扩展 service worker 轮询用，X-API-Key 鉴权)
// 返回当前用户最早一条 pending 任务，并原子翻转 pending→running
// 同时确保用户只有一个 running 任务（避免 SW 重启或并发同时拉到多条 pending）
import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { corsResponse, corsPreflight, resolveExtensionApiKey } from "@/lib/extension-auth"
import { buildBossSearchUrl } from "@/lib/boss-search"

const STALE_MS = 3 * 60 * 1000

export async function OPTIONS() {
  return corsPreflight()
}

export async function GET(req: NextRequest) {
  const userId = await resolveExtensionApiKey(req)
  if (!userId) return corsResponse({ error: { code: "UNAUTHORIZED", message: "无效的 API Key" } }, 401)

  // 1. 先清理僵死的 running（防止之前 SW 崩了把 slot 永远占住）
  const cutoff = new Date(Date.now() - STALE_MS)
  await prisma.searchTask.updateMany({
    where: { userId, status: "running", updatedAt: { lt: cutoff } },
    data: { status: "failed", message: "上次执行超时（>3min 未上报）" },
  })

  // 2. 如果当前已有 running 任务，跳过本次轮询，避免并发开多个 Boss 标签
  const running = await prisma.searchTask.findFirst({
    where: { userId, status: "running" },
  })
  if (running) return corsResponse({ data: null })

  // 3. 原子翻转：findFirst pending → updateMany 把它直接置 running，同次返回
  //    SQLite 里 prisma.$transaction 提供顺序原子性
  const task = await prisma.$transaction(async (tx) => {
    const t = await tx.searchTask.findFirst({
      where: { userId, status: "pending" },
      orderBy: { createdAt: "asc" },
    })
    if (!t) return null
    const updated = await tx.searchTask.update({
      where: { id: t.id },
      data: { status: "running" },
    })
    return updated
  })

  if (!task) return corsResponse({ data: null })

  // 解析 params 并构造每页 URL，方便扩展直接打开
  const params = JSON.parse(task.params)
  const urls: string[] = []
  for (let p = 1; p <= (params.pages || 3); p++) {
    urls.push(
      buildBossSearchUrl(
        {
          query: params.query,
          city: params.city,
          salaryMin: params.salaryMin || 0,
          salaryMax: params.salaryMax || 0,
        },
        p,
      ),
    )
  }

  return corsResponse({
    data: {
      id: task.id,
      params,
      urls,
    },
  })
}
