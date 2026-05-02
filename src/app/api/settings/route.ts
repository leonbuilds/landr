import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthUserId } from "@/lib/auth"
import { encrypt, decrypt, maskApiKey } from "@/lib/crypto"

export async function GET(req: NextRequest) {
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "请先登录" } }, { status: 401 })

  const settings = await prisma.setting.findMany({ where: { userId } })
  const result = settings.map((s) => ({
    key: s.key,
    value: s.key.startsWith("api_key_") && s.value
      ? maskApiKey(decrypt(s.value))
      : s.value,
    isApiKey: s.key.startsWith("api_key_"),
    maskedValue: s.key.startsWith("api_key_") && s.value
      ? maskApiKey(decrypt(s.value))
      : undefined,
  }))

  return NextResponse.json({ data: result })
}

export async function PUT(req: NextRequest) {
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "请先登录" } }, { status: 401 })

  const body = await req.json()
  const entries: Record<string, string> = body

  for (const [key, value] of Object.entries(entries)) {
    const storedValue = key.startsWith("api_key_") && value ? encrypt(value as string) : (value as string)
    await prisma.setting.upsert({
      where: { userId_key: { userId, key } },
      update: { value: storedValue },
      create: { userId, key, value: storedValue },
    })
  }

  return NextResponse.json({ data: { success: true } })
}
