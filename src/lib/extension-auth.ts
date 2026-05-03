// 扩展专用 API Key 鉴权 + CORS 响应包装
// 扩展从 chrome.storage.local 读出 apiKey，作为 X-API-Key 头发到本服务
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { decrypt } from "@/lib/crypto"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-API-Key, Authorization",
}

export function corsResponse(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS_HEADERS })
}

export function corsPreflight() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function resolveExtensionApiKey(req: NextRequest): Promise<number | null> {
  const key = req.headers.get("x-api-key")
  if (!key) return null
  try {
    const all = await prisma.setting.findMany({ where: { key: "extension_api_key" } })
    for (const s of all) {
      if (!s.value) continue
      if (decrypt(s.value) === key) return s.userId
    }
    return null
  } catch {
    return null
  }
}
