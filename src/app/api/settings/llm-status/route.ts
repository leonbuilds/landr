import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthUserId } from "@/lib/auth"

/**
 * 轻量探针：用户是否已配置至少一个 LLM provider key。
 * 给前端横幅/引导用，所以不解密、不返 key，只返计数和 provider 列表。
 */
export async function GET(req: NextRequest) {
  const userId = await getAuthUserId(req)
  if (!userId) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 })
  }

  const settings = await prisma.setting.findMany({
    where: { userId, key: { startsWith: "api_key_" }, NOT: { value: null } },
    select: { key: true },
  })

  const providers = settings
    .map((s) => s.key.replace(/^api_key_/, ""))
    .filter(Boolean)

  return NextResponse.json({
    data: {
      configured: providers.length > 0,
      providers,
      count: providers.length,
    },
  })
}
