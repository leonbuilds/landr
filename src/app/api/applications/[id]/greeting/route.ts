// POST /api/applications/:id/greeting
// 给 Boss 直聘投递场景生成 80 字打招呼语（不存库，前端拿到后编进 URL hash 给扩展）
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthUserId } from "@/lib/auth"
import { callLLM, GREETING_PROMPT } from "@/lib/ai"
import { decrypt } from "@/lib/crypto"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 })

  const { id } = await params
  const app = await prisma.application.findUnique({
    where: { id: Number(id) },
    include: { resume: true, job: true },
  })
  if (!app || app.userId !== userId) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "申请不存在" } }, { status: 404 })
  }
  if (!app.job?.url) {
    return NextResponse.json(
      { error: { code: "NO_URL", message: "该岗位没有 Boss 链接，无法自动投递。请重新从 Boss 采集这个岗位。" } },
      { status: 400 },
    )
  }

  const settings = await prisma.setting.findMany({ where: { userId } })
  const map = Object.fromEntries(settings.map((s) => [s.key, s.value]))
  const provider = map.default_model || "deepseek"
  const apiKeyEnc = map[`api_key_${provider}`]
  if (!apiKeyEnc) {
    return NextResponse.json({ error: { code: "NO_API_KEY", message: "请先配置 AI API Key" } }, { status: 400 })
  }
  const apiKey = decrypt(apiKeyEnc)

  try {
    const prompt = GREETING_PROMPT
      .replace("{{RESUME}}", (app.resume?.rawText || "").slice(0, 2000))
      .replace("{{JD}}", (app.job.jdText || "").slice(0, 1500))
      .replace("{{JOB_TITLE}}", app.job.title || "")
      .replace("{{COMPANY}}", app.job.company || "")
    const raw = await callLLM(prompt, apiKey, provider)
    // 去掉首尾引号、markdown 代码块
    const greeting = raw
      .trim()
      .replace(/^```[\s\S]*?\n/, "")
      .replace(/\n```$/, "")
      .replace(/^["'「]+|["'」]+$/g, "")
      .trim()
      .slice(0, 100) // 给 20 字 buffer 防溢出

    return NextResponse.json({ data: { greeting, jobUrl: app.job.url } })
  } catch (e) {
    console.error("greeting gen error:", e)
    return NextResponse.json(
      { error: { code: "LLM_ERROR", message: "生成打招呼语失败，请检查 API Key 或稍后重试" } },
      { status: 502 },
    )
  }
}
