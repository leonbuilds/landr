"use client"

import { useEffect, useState, useCallback } from "react"
import { useAuth } from "@/hooks/use-auth"

interface LlmStatus {
  configured: boolean
  providers: string[]
  count: number
}

/**
 * 拉一次 /api/settings/llm-status 缓存到内存。
 * 提供 refresh 让设置页保存 key 后立即刷新横幅可见性。
 */
export function useLlmStatus() {
  const { isAuthenticated, getHeaders } = useAuth()
  const [status, setStatus] = useState<LlmStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setStatus(null)
      setLoading(false)
      return
    }
    try {
      const r = await fetch("/api/settings/llm-status", { headers: getHeaders() })
      if (r.ok) {
        const j = await r.json()
        setStatus(j.data as LlmStatus)
      } else {
        setStatus({ configured: false, providers: [], count: 0 })
      }
    } catch {
      setStatus({ configured: false, providers: [], count: 0 })
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, getHeaders])

  useEffect(() => {
    refresh()
  }, [refresh])

  // 监听全局事件，让设置页保存 key 后能让横幅秒刷
  useEffect(() => {
    const handler = () => refresh()
    window.addEventListener("llm-key-changed", handler)
    return () => window.removeEventListener("llm-key-changed", handler)
  }, [refresh])

  return { status, loading, refresh }
}

/** 配合 useLlmStatus：保存 / 删除 key 时调用以触发横幅刷新。 */
export function emitLlmKeyChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("llm-key-changed"))
  }
}
