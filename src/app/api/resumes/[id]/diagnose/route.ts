import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthUserId } from "@/lib/auth"
import { callLLM, DIAGNOSE_PROMPT, parseJsonFromLLM } from "@/lib/ai"
import { decrypt } from "@/lib/crypto"
import type { DiagnosisResult } from "@/types"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "请先登录" } }, { status: 401 })

  const { id } = await params
  const resume = await prisma.resume.findUnique({ where: { id: parseInt(id) } })
  if (!resume) return NextResponse.json({ error: { code: "NOT_FOUND", message: "简历不存在" } }, { status: 404 })
  if (resume.userId !== userId) return NextResponse.json({ error: { code: "FORBIDDEN", message: "无权访问" } }, { status: 403 })

  if (!resume.rawText) {
    return NextResponse.json({ error: { code: "BAD_REQUEST", message: "简历内容为空" } }, { status: 400 })
  }

  // Get user API key and model preference
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
    const prompt = DIAGNOSE_PROMPT.replace("{{RESUME}}", resume.rawText)
    const response = await callLLM(prompt, apiKey, modelKey)
    const diagnosis = parseJsonFromLLM<DiagnosisResult>(response)

    await prisma.resume.update({
      where: { id: parseInt(id) },
      data: { diagnosis: JSON.stringify(diagnosis) },
    })

    return NextResponse.json({ data: diagnosis })
  } catch (error) {
    console.error("Diagnose error:", error)
    return NextResponse.json({
      error: { code: "LLM_ERROR", message: "AI服务暂时不可用，请检查API Key或稍后重试" }
    }, { status: 502 })
  }
}
