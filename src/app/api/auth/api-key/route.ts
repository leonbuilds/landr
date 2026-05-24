import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthUserId } from "@/lib/auth"
import { encrypt, decrypt } from "@/lib/crypto"
import crypto from "crypto"

function generateKey(): string {
  return crypto.randomBytes(32).toString("hex")
}

export async function GET(req: NextRequest) {
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 })

  const existing = await prisma.setting.findUnique({
    where: { userId_key: { userId, key: "extension_api_key" } },
  })

  if (!existing?.value) {
    // First time: generate and store
    const key = generateKey()
    await prisma.setting.upsert({
      where: { userId_key: { userId, key: "extension_api_key" } },
      update: { value: encrypt(key) },
      create: { userId, key: "extension_api_key", value: encrypt(key) },
    })
    return NextResponse.json({ data: { key, isNew: true } })
  }

  // 用户已通过会话鉴权, 查自己的 Key 直接返明文。
  // 客户端默认显示遮罩, 复制按钮可触发明文复制 — 安全边界没扩大。
  return NextResponse.json({
    data: { key: decrypt(existing.value), isNew: false },
  })
}

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 })

  const key = generateKey()
  await prisma.setting.upsert({
    where: { userId_key: { userId, key: "extension_api_key" } },
    update: { value: encrypt(key) },
    create: { userId, key: "extension_api_key", value: encrypt(key) },
  })

  return NextResponse.json({ data: { key, isNew: true } })
}
