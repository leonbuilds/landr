import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthUserId } from "@/lib/auth"
import { callLLM, PARSE_JD_PROMPT, parseJsonFromLLM } from "@/lib/ai"
import { decrypt } from "@/lib/crypto"
import type { ParsedJD } from "@/types"

export async function GET(req: NextRequest) {
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "请先登录" } }, { status: 401 })

  const jobs = await prisma.job.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json({ data: jobs })
}

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "请先登录" } }, { status: 401 })

  try {
    const body = await req.json()
    const { title, jdText, parseWithAI } = body

    if (!jdText?.trim()) {
      return NextResponse.json({ error: { code: "BAD_REQUEST", message: "请输入JD内容" } }, { status: 400 })
    }

    let parsedJson = ""
    let company = ""
    let finalTitle = title || "未命名岗位"

    if (parseWithAI) {
      const settings = await prisma.setting.findMany({ where: { userId } })
      const settingMap = Object.fromEntries(settings.map((s) => [s.key, s.value]))
      const modelKey = settingMap.default_model || "deepseek"
      const apiKeyEncrypted = settingMap[`api_key_${modelKey}`]

      if (apiKeyEncrypted) {
        try {
          const apiKey = decrypt(apiKeyEncrypted)
          const prompt = PARSE_JD_PROMPT.replace("{{JD}}", jdText)
          const response = await callLLM(prompt, apiKey, modelKey)
          const parsed = parseJsonFromLLM<ParsedJD>(response)
          finalTitle = parsed.title || finalTitle
          company = parsed.company || ""
          parsedJson = JSON.stringify(parsed)
        } catch {
          // AI parse failed, save with manual data only
        }
      }
    }

    const job = await prisma.job.create({
      data: {
        userId,
        title: finalTitle,
        company,
        platform: "manual",
        jdText,
        parsedJson: parsedJson || null,
      },
    })

    return NextResponse.json({ data: job }, { status: 201 })
  } catch (error) {
    console.error("Job create error:", error)
    return NextResponse.json({ error: { code: "SERVER_ERROR", message: "服务器错误" } }, { status: 500 })
  }
}
