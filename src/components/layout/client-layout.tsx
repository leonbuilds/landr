"use client"

import { usePathname } from "next/navigation"
import { Sidebar } from "@/components/layout/sidebar"
import { NoApiKeyBanner } from "@/components/shared/no-api-key-banner"
import { ToastProvider } from "@/components/shared/toast"
import { useAuth } from "@/hooks/use-auth"

const publicPaths = ["/login", "/register"]

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { isAuthenticated, isLoading } = useAuth()

  // ToastProvider 包在最外层，确保任何页面（含登录/注册）都能用
  return (
    <ToastProvider>
      <ClientLayoutInner
        pathname={pathname}
        isAuthenticated={isAuthenticated}
        isLoading={isLoading}
      >
        {children}
      </ClientLayoutInner>
    </ToastProvider>
  )
}

function ClientLayoutInner({
  children,
  pathname,
  isAuthenticated,
  isLoading,
}: {
  children: React.ReactNode
  pathname: string
  isAuthenticated: boolean
  isLoading: boolean
}) {
  if (publicPaths.includes(pathname)) {
    return <>{children}</>
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <>{children}</>
  }

  return (
    <>
      <Sidebar />
      {/* lg+: 左侧让出 56 给 sidebar；移动端：顶部让出 14 给 hamburger 顶栏 */}
      <main className="min-h-screen p-4 pt-[4.5rem] lg:ml-56 lg:p-6 lg:pt-6">
        <NoApiKeyBanner />
        {children}
      </main>
    </>
  )
}
