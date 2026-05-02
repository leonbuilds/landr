"use client"

import { usePathname } from "next/navigation"
import { Sidebar } from "@/components/layout/sidebar"
import { useAuth } from "@/hooks/use-auth"

const publicPaths = ["/login", "/register"]

export function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { isAuthenticated, isLoading } = useAuth()

  // Public pages (login/register) render without sidebar
  if (publicPaths.includes(pathname)) {
    return <>{children}</>
  }

  // Show nothing while checking auth state
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }

  // Protected pages require auth
  if (!isAuthenticated) {
    // Redirect handled by individual page checks
    return <>{children}</>
  }

  return (
    <>
      <Sidebar />
      <main className="ml-56 min-h-screen bg-gray-50 p-6">{children}</main>
    </>
  )
}
