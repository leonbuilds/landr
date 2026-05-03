// GET /api/jobs/search-tasks/pending  (扩展 service worker 轮询用，X-API-Key 鉴权)
// 返回当前用户最早一条 pending 任务（一次只跑一个，避免并发开多个 Boss 标签）
import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { corsResponse, corsPreflight, resolveExtensionApiKey } from "@/lib/extension-auth"
import { buildBossSearchUrl } from "@/lib/boss-search"

export async function OPTIONS() {
  return corsPreflight()
}

export async function GET(req: NextRequest) {
  const userId = await resolveExtensionApiKey(req)
  if (!userId) return corsResponse({ error: { code: "UNAUTHORIZED", message: "无效的 API Key" } }, 401)

  const task = await prisma.searchTask.findFirst({
    where: { userId, status: "pending" },
    orderBy: { createdAt: "asc" },
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
