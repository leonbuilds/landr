"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { FileText, Briefcase, Kanban, Settings, LogOut, Menu, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

const navItems = [
  { href: "/resumes", label: "我的简历", icon: FileText },
  { href: "/jobs", label: "岗位库", icon: Briefcase },
  { href: "/board", label: "申请看板", icon: Kanban },
  { href: "/settings", label: "设置", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  // 切换路由时自动关掉移动端抽屉
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  return (
    <>
      {/* 移动端顶栏（lg 以下可见）—— 一个 hamburger + 品牌 */}
      <header className="fixed left-0 right-0 top-0 z-30 flex h-14 items-center border-b bg-white px-4 lg:hidden">
        <button
          aria-label="打开菜单"
          onClick={() => setMobileOpen(true)}
          className="p-2 -ml-2 hover:bg-gray-100 rounded"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link href="/resumes" className="ml-2 text-lg font-bold text-blue-600">
          Landr
        </Link>
      </header>

      {/* 移动端遮罩 */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar 本体: lg+ 始终显示, 移动端按 mobileOpen 滑入 */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-screen w-56 flex-col border-r bg-white transition-transform duration-200 ease-out",
          "lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 items-center justify-between border-b px-4">
          <Link href="/resumes" className="text-lg font-bold text-blue-600">
            Landr
          </Link>
          <button
            aria-label="关闭菜单"
            onClick={() => setMobileOpen(false)}
            className="p-1 -mr-1 hover:bg-gray-100 rounded lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                pathname === item.href || pathname?.startsWith(item.href + "/")
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-gray-600 hover:bg-gray-100"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        <Separator />
        <div className="p-3">
          <div className="mb-2 truncate text-xs text-gray-500">{user?.email}</div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-gray-600"
            onClick={logout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            退出登录
          </Button>
        </div>
      </aside>
    </>
  )
}
