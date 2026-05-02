import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthUserId } from "@/lib/auth"
import { callLLM } from "@/lib/ai"
import { decrypt } from "@/lib/crypto"

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "请先登录" } }, { status: 401 })

  try {
    const { model } = await req.json()
    const modelKey = model || "deepseek"

    const setting = await prisma.setting.findUnique({
      where: { userId_key: { userId, key: `api_key_${modelKey}` } },
    })

    if (!setting?.value) {
      return NextResponse.json({
        data: { success: false, message: `请先配置${modelKey}的API Key` }
      })
    }

    const apiKey = decrypt(setting.value)
    await callLLM("回复OK", apiKey, modelKey)

    return NextResponse.json({
      data: { success: true, message: "连接成功" }
    })
  } catch (error) {
    return NextResponse.json({
      data: { success: false, message: `连接失败：${error instanceof Error ? error.message : "未知错误"}` }
    })
  }
}
