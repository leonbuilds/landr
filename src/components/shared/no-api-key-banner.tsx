"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { AlertTriangle, ArrowRight } from "lucide-react"
import { useLlmStatus } from "@/hooks/use-llm-status"

// 在这些路径下展示横幅 —— 不配 key 就用不了的核心页
const GUARDED_PATHS = ["/resumes", "/jobs", "/board"]

/**
 * 全局横幅：未配置任何 LLM Key 时, 在 AI 强依赖页顶部显示提醒。
 * 在 /settings 自身不显示 (用户已经在路上了)。
 */
export function NoApiKeyBanner() {
  const pathname = usePathname() || ""
  const { status, loading } = useLlmStatus()

  // 等待状态前不闪烁
  if (loading) return null
  if (!status || status.configured) return null
  // 仅在受保护页展示，避免遮挡 settings/auth 页面
  const onGuarded = GUARDED_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))
  if (!onGuarded) return null

  return (
    <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-900">
            还没配置 AI 模型 Key —— 简历诊断 / 岗位匹配 / 求职信生成等功能用不了
          </p>
          <p className="text-xs text-amber-800 mt-0.5">
            支持 DeepSeek、Kimi、通义千问，配置任意一个即可。Key 加密存储，多个 Key 自动降级。
          </p>
        </div>
        <Link
          href="/settings"
          className="flex-shrink-0 inline-flex items-center gap-1 rounded bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 transition-colors"
        >
          去配置
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  )
}
