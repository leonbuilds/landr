import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthUserId } from "@/lib/auth"
import { MATCH_PROMPT, parseJsonFromLLM } from "@/lib/ai"
import { callLLMForUser, resolveUserProviders } from "@/lib/user-llm"
import type { MatchResult } from "@/types"

// 单次最多评分的岗位数。超过的截断，避免一次 LLM 调用海量。
const MAX_JOBS_PER_RUN = 30
// 并发度。LLM 调用是 IO bound 但服务商有 QPS 限制，设个温和的值。
const CONCURRENCY = 3

interface RankedJob {
  jobId: number
  title: string
  company: string | null
  location: string | null
  salaryRange: string | null
  url: string | null
  score: number
  cached: boolean // true 表示分数来自 Application.matchScore 缓存
  analysis?: string
  applicationId?: number
  error?: string
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUserId(req)
  if (!userId) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "请先登录" } }, { status: 401 })
  }

  const { id } = await params
  const resumeId = parseInt(id)

  const resume = await prisma.resume.findUnique({ where: { id: resumeId } })
  if (!resume || resume.userId !== userId) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "简历不存在" } }, { status: 404 })
  }
  if (!resume.rawText) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "简历内容为空，无法评分" } },
      { status: 400 }
    )
  }

  // 拉所有 job + 该简历已有的 Application（缓存命中）
  const jobs = await prisma.job.findMany({
    where: { userId, jdText: { not: null } },
    orderBy: { createdAt: "desc" },
  })

  if (jobs.length === 0) {
    return NextResponse.json({ data: { ranked: [], total: 0, cached: 0, computed: 0, skipped: 0 } })
  }

  // 提前校验：先看缓存命中范围，命中不够还得依赖 LLM 时才校验 key 是否配置
  // 但更直接的做法是不管有没有缓存都先看 key — 缓存的也只是历史 LLM 结果，缺 key 表示用户没填过
  // 不过为了不阻塞「我已经评过分，只想看排名」的场景，下面只在「需要计算」时才检查
  // 实际处理见 toCompute 分支

  const existingApps = await prisma.application.findMany({
    where: { userId, resumeId, jobId: { in: jobs.map((j) => j.id) } },
    select: { id: true, jobId: true, matchScore: true, matchDetail: true },
  })
  const appByJobId = new Map(existingApps.map((a) => [a.jobId!, a]))

  // 分两批：缓存命中 vs 需要计算
  const cachedResults: RankedJob[] = []
  const toCompute: typeof jobs = []
  for (const job of jobs) {
    const app = appByJobId.get(job.id)
    if (app && app.matchScore != null) {
      let analysis: string | undefined
      try {
        if (app.matchDetail) {
          const detail = JSON.parse(app.matchDetail) as MatchResult
          analysis = detail.analysis
        }
      } catch {}
      cachedResults.push({
        jobId: job.id,
        title: job.title,
        company: job.company,
        location: job.location,
        salaryRange: job.salaryRange,
        url: job.url,
        score: app.matchScore,
        cached: true,
        analysis,
        applicationId: app.id,
      })
    } else {
      toCompute.push(job)
    }
  }

  // 截断 + 计数被跳过
  const skipped = Math.max(0, toCompute.length - MAX_JOBS_PER_RUN)
  const computeBatch = toCompute.slice(0, MAX_JOBS_PER_RUN)

  // 若需要计算且 user 一个 provider 都没配，给一个清晰的错误而不是 N 个相同错误
  if (computeBatch.length > 0) {
    const providers = await resolveUserProviders(userId)
    if (providers.length === 0) {
      return NextResponse.json(
        {
          error: {
            code: "NO_API_KEY",
            message: "请先在「设置」中配置至少一个 AI 模型 API Key 才能进行 AI 评分",
          },
        },
        { status: 400 }
      )
    }
  }

  // 简单并发池：每次取 CONCURRENCY 个一起跑
  const computedResults: RankedJob[] = []
  const queue = [...computeBatch]
  const runOne = async (): Promise<void> => {
    while (queue.length > 0) {
      const job = queue.shift()
      if (!job) return
      try {
        const prompt = MATCH_PROMPT.replace("{{RESUME}}", resume.rawText || "").replace(
          "{{JD}}",
          job.jdText || ""
        )
        const { output } = await callLLMForUser(prompt, userId)
        const result = parseJsonFromLLM<MatchResult>(output)

        // 写回 Application 缓存（upsert：同 resumeId+jobId 唯一）
        const existing = appByJobId.get(job.id)
        let appId = existing?.id
        if (existing) {
          await prisma.application.update({
            where: { id: existing.id },
            data: { matchScore: result.score, matchDetail: JSON.stringify(result) },
          })
        } else {
          const created = await prisma.application.create({
            data: {
              userId,
              resumeId,
              jobId: job.id,
              status: "draft",
              matchScore: result.score,
              matchDetail: JSON.stringify(result),
            },
          })
          appId = created.id
        }

        computedResults.push({
          jobId: job.id,
          title: job.title,
          company: job.company,
          location: job.location,
          salaryRange: job.salaryRange,
          url: job.url,
          score: result.score,
          cached: false,
          analysis: result.analysis,
          applicationId: appId,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        computedResults.push({
          jobId: job.id,
          title: job.title,
          company: job.company,
          location: job.location,
          salaryRange: job.salaryRange,
          url: job.url,
          score: 0,
          cached: false,
          error: msg.slice(0, 200),
        })
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, runOne))

  const ranked = [...cachedResults, ...computedResults].sort((a, b) => b.score - a.score)

  return NextResponse.json({
    data: {
      ranked,
      total: ranked.length,
      cached: cachedResults.length,
      computed: computedResults.length,
      skipped,
    },
  })
}
