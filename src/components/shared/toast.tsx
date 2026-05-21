"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { CheckCircle2, AlertCircle, X, Info } from "lucide-react"

type ToastKind = "success" | "error" | "info"

interface ToastItem {
  id: number
  kind: ToastKind
  title: string
  description?: string
  /** 可选 action: 显示一个跳转按钮 */
  action?: { label: string; href: string }
  /** 自动关闭毫秒。0 = 手动关。默认 4000。 */
  duration?: number
}

interface ToastContextValue {
  show: (toast: Omit<ToastItem, "id">) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    // 给一个降级实现，避免没有 Provider 时整个 app 崩。打 console 即可。
    return {
      show: (t: Omit<ToastItem, "id">) => {
        console.warn("[toast: no provider]", t)
      },
    } as ToastContextValue
  }
  return ctx
}

let idSeq = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const show = useCallback((t: Omit<ToastItem, "id">) => {
    const id = ++idSeq
    setToasts((prev) => [...prev, { id, duration: 4000, ...t }])
  }, [])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)]"
      >
        {toasts.map((t) => (
          <ToastView key={t.id} toast={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastView({ toast, onClose }: { toast: ToastItem; onClose: () => void }) {
  useEffect(() => {
    if (!toast.duration) return
    const t = setTimeout(onClose, toast.duration)
    return () => clearTimeout(t)
  }, [toast.duration, onClose])

  const accent =
    toast.kind === "success"
      ? "border-green-200 bg-green-50"
      : toast.kind === "error"
      ? "border-red-200 bg-red-50"
      : "border-blue-200 bg-blue-50"

  const Icon =
    toast.kind === "success" ? CheckCircle2 : toast.kind === "error" ? AlertCircle : Info
  const iconColor =
    toast.kind === "success"
      ? "text-green-600"
      : toast.kind === "error"
      ? "text-red-600"
      : "text-blue-600"

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 rounded-lg border ${accent} px-4 py-3 shadow-lg animate-in slide-in-from-bottom-2`}
      role="status"
    >
      <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${iconColor}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{toast.title}</p>
        {toast.description && (
          <p className="text-xs text-gray-600 mt-0.5">{toast.description}</p>
        )}
        {toast.action && (
          <a
            href={toast.action.href}
            className="inline-block mt-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 underline"
          >
            {toast.action.label} →
          </a>
        )}
      </div>
      <button
        onClick={onClose}
        className="p-0.5 hover:bg-black/5 rounded text-gray-400 hover:text-gray-600"
        aria-label="关闭"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
