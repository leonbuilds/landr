import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthUserId } from "@/lib/auth"
import { callLLM, MATCH_PROMPT, REWRITE_PROMPT, parseJsonFromLLM } from "@/lib/ai"
import { decrypt } from "@/lib/crypto"
import type { MatchResult, RewriteResult } from "@/types"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "请先登录" } }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { jobId } = body

  if (!jobId) {
    return NextResponse.json({ error: { code: "BAD_REQUEST", message: "请先选择岗位" } }, { status: 400 })
  }

  const [resume, job] = await Promise.all([
    prisma.resume.findUnique({ where: { id: parseInt(id) } }),
    prisma.job.findUnique({ where: { id: parseInt(jobId) } }),
  ])

  if (!resume || resume.userId !== userId) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "简历不存在" } }, { status: 404 })
  }
  if (!job || job.userId !== userId) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "岗位不存在" } }, { status: 404 })
  }

  const settings = await prisma.setting.findMany({ where: { userId } })
  const settingMap = Object.fromEntries(settings.map((s) => [s.key, s.value]))
  const modelKey = settingMap.default_model || "deepseek"
  const apiKeyEncrypted = settingMap[`api_key_${modelKey}`]

  if (!apiKeyEncrypted) {
    return NextResponse.json({
      error: { code: "NO_API_KEY", message: "请先在设置中配置AI模型API Key" }
    }, { status: 400 })
  }

  try {
    const apiKey = decrypt(apiKeyEncrypted)

    // Run match and rewrite in parallel
    const matchPrompt = MATCH_PROMPT.replace("{{RESUME}}", resume.rawText || "").replace("{{JD}}", job.jdText || "")
    const matchResponse = await callLLM(matchPrompt, apiKey, modelKey)
    const matchResult = parseJsonFromLLM<MatchResult>(matchResponse)

    const rewritePrompt = REWRITE_PROMPT
      .replace("{{MATCH_RESULT}}", JSON.stringify(matchResult, null, 2))
      .replace("{{RESUME}}", resume.rawText || "")
      .replace("{{JD}}", job.jdText || "")
    const rewriteResponse = await callLLM(rewritePrompt, apiKey, modelKey)
    const rewriteResult = parseJsonFromLLM<RewriteResult>(rewriteResponse)

    // Create or update application record
    const application = await prisma.application.create({
      data: {
        userId,
        resumeId: resume.id,
        jobId: job.id,
        status: "draft",
        matchScore: matchResult.score,
        matchDetail: JSON.stringify(matchResult),
        tailoredResume: JSON.stringify(rewriteResult),
      },
    })

    return NextResponse.json({
      data: {
        applicationId: application.id,
        match: matchResult,
        rewrite: rewriteResult,
      },
    })
  } catch (error) {
    console.error("Match error:", error)
    return NextResponse.json({
      error: { code: "LLM_ERROR", message: "AI服务暂时不可用，请检查API Key或稍后重试" }
    }, { status: 502 })
  }
}
