import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { decrypt } from "@/lib/crypto"

export async function GET(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key")
  if (!apiKey) {
    return NextResponse.json({ valid: false, message: "缺少API Key" }, { status: 401 })
  }

  const allSettings = await prisma.setting.findMany({ where: { key: "extension_api_key" } })
  for (const s of allSettings) {
    if (!s.value) continue
    try {
      if (decrypt(s.value) === apiKey) {
        return NextResponse.json({ valid: true, message: "连接成功" })
      }
    } catch {}
  }

  return NextResponse.json({ valid: false, message: "API Key无效" }, { status: 401 })
}
