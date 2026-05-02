import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthUserId } from "@/lib/auth"
import { callLLM, COVER_LETTER_PROMPT, parseJsonFromLLM } from "@/lib/ai"
import { decrypt } from "@/lib/crypto"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "请先登录" } }, { status: 401 })

  const { id } = await params
  const app = await prisma.application.findUnique({
    where: { id: parseInt(id) },
    include: { resume: true, job: true },
  })
  if (!app || app.userId !== userId) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "无权访问" } }, { status: 403 })
  }

  const { tone } = await req.json().catch(() => ({ tone: "formal" }))

  const settings = await prisma.setting.findMany({ where: { userId } })
  const settingMap = Object.fromEntries(settings.map((s) => [s.key, s.value]))
  const modelKey = settingMap.default_model || "deepseek"
  const apiKeyEncrypted = settingMap[`api_key_${modelKey}`]

  if (!apiKeyEncrypted) {
    return NextResponse.json({ error: { code: "NO_API_KEY", message: "请先配置API Key" } }, { status: 400 })
  }

  try {
    const apiKey = decrypt(apiKeyEncrypted)
    const prompt = COVER_LETTER_PROMPT
      .replace("{{RESUME}}", app.resume?.rawText || "")
      .replace("{{JD}}", app.job?.jdText || "")
      .replace("{{TONE}}", tone)
    const response = await callLLM(prompt, apiKey, modelKey)
    const result = parseJsonFromLLM<{ subject: string; body: string; tone: string }>(response)

    await prisma.application.update({
      where: { id: parseInt(id) },
      data: { coverLetter: JSON.stringify(result) },
    })

    return NextResponse.json({ data: result })
  } catch {
    return NextResponse.json({ error: { code: "LLM_ERROR", message: "AI服务暂时不可用" } }, { status: 502 })
  }
}
