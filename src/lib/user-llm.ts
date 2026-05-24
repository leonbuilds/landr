import { prisma } from "@/lib/prisma"
import { decrypt } from "@/lib/crypto"
import {
  SUPPORTED_PROVIDERS,
  callLLMWithFallback,
  type ProviderKey,
} from "@/lib/ai"

/**
 * 从 Setting 表里读出该用户配置了哪些 provider 的 key，
 * 返回 [primary, ...fallbacks]。primary 是 default_model；
 * fallbacks 是其它已配置 key 的 provider，按 deepseek→kimi→qwen 的顺序。
 */
export async function resolveUserProviders(userId: number): Promise<ProviderKey[]> {
  const settings = await prisma.setting.findMany({ where: { userId } })
  const map = Object.fromEntries(settings.map((s) => [s.key, s.value]))

  const primaryKey = map.default_model || "deepseek"
  const order = [
    primaryKey,
    ...SUPPORTED_PROVIDERS.filter((p) => p !== primaryKey),
  ]

  const out: ProviderKey[] = []
  for (const provider of order) {
    const encrypted = map[`api_key_${provider}`]
    if (!encrypted) continue
    try {
      out.push({ provider, apiKey: decrypt(encrypted) })
    } catch {
      // 解密失败 (key 被破坏) — 跳过
    }
  }
  return out
}

/**
 * 高层封装：从 userId 解析所有可用 provider，带重试 + 降级地调一次 LLM。
 * 路由层用这个就行，不用关心多 key 细节。
 */
export async function callLLMForUser(prompt: string, userId: number) {
  const providers = await resolveUserProviders(userId)
  return callLLMWithFallback(prompt, providers)
}
