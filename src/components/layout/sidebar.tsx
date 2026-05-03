"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { FileText, Briefcase, Kanban, Settings, LogOut, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"

const navItems = [
  { href: "/resumes", label: "我的简历", icon: FileText },
  { href: "/jobs", label: "岗位库", icon: Briefcase },
  { href: "/board", label: "申请看板", icon: Kanban },
  { href: "/settings", label: "设置", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()

  return (
    <aside
      className="fixed left-0 top-0 z-40 flex h-screen w-60 flex-col p-4 glass"
      style={{ borderRight: "1px solid var(--line)" }}
    >
      <Link href="/resumes" className="flex items-center gap-3 px-2 py-2 mb-6">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl text-white text-base font-bold ring-mesh"
          style={{
            background:
              "linear-gradient(135deg, var(--mesh-pink) 0%, var(--mesh-lavender) 50%, var(--mesh-sky) 100%)",
            letterSpacing: "-0.04em",
          }}
        >
          求
        </div>
        <div className="leading-tight">
          <div className="text-[15px] font-semibold tracking-tight">jobpilot</div>
          <div className="text-[11px] font-mono" style={{ color: "var(--muted)" }}>
            · ai
          </div>
        </div>
      </Link>

      <SectionLabel>Workspace</SectionLabel>
      <nav className="space-y-1 mb-4">
        {navItems.slice(0, 3).map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>

      <SectionLabel>Insights</SectionLabel>
      <nav className="space-y-1 mb-4">
        <a
          href="#"
          className="flex items-center gap-3 rounded-[10px] px-3 py-2 text-[13.5px] font-medium opacity-60 cursor-not-allowed"
          style={{ color: "var(--muted)" }}
        >
          <Sparkles className="h-4 w-4 opacity-70" />
          AI 推荐
        </a>
      </nav>

      <SectionLabel>System</SectionLabel>
      <nav className="space-y-1">
        <NavLink item={navItems[3]} pathname={pathname} />
      </nav>

      <div
        className="mt-auto flex items-center gap-3 px-3 py-3"
        style={{ borderTop: "1px solid var(--line)" }}
      >
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full text-white text-xs font-semibold"
          style={{
            background: "linear-gradient(135deg, var(--mesh-amber), var(--mesh-pink))",
            boxShadow: "0 4px 12px -2px rgba(255,107,157,0.4)",
          }}
        >
          {(user?.email?.[0] || "L").toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] font-medium truncate">
            {user?.email?.split("@")[0]}
          </div>
          <button
            onClick={logout}
            className="text-[11px] font-mono hover:underline transition-colors flex items-center gap-1"
            style={{ color: "var(--muted)" }}
          >
            <LogOut className="h-3 w-3" />
            退出
          </button>
        </div>
      </div>
    </aside>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="px-3 mb-1 text-[10px] font-medium uppercase tracking-wider font-mono"
      style={{ color: "var(--dim)" }}
    >
      {children}
    </div>
  )
}

function NavLink({
  item,
  pathname,
}: {
  item: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }
  pathname: string
}) {
  const isActive =
    pathname === item.href || pathname.startsWith(item.href + "/")
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-[10px] px-3 py-2 text-[13.5px] font-medium transition-all duration-150"
      )}
      style={
        isActive
          ? {
              background: "var(--bg-elevated-strong)",
              color: "var(--text)",
              boxShadow:
                "0 2px 12px -2px rgba(15,15,20,0.06), 0 0 0 1px rgba(255,255,255,0.6) inset",
            }
          : { color: "var(--muted)" }
      }
    >
      <item.icon
        className={cn("h-4 w-4", isActive ? "opacity-100" : "opacity-70")}
      />
      {item.label}
    </Link>
  )
}
