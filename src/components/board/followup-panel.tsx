"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BellRing, Calendar } from "lucide-react"
import type { Application } from "@/types"
import { describeFollowup } from "@/lib/followup"

interface FollowupPanelProps {
  applications: Application[]
  onSelect: (app: Application) => void
}

/**
 * 看板顶部待跟进面板：
 *  - 把所有 nextFollowup <= 今天 + 7 天后内的 application 摘出来
 *  - 逾期排在最前，今天次之，未来按日期升序
 *  - 已 rejected / withdrawn 的不显示
 */
export function FollowupPanel({ applications, onSelect }: FollowupPanelProps) {
  const items = applications
    .map((a) => {
      const info = describeFollowup(a.nextFollowup)
      return info ? { app: a, info } : null
    })
    .filter((x): x is { app: Application; info: NonNullable<ReturnType<typeof describeFollowup>> } => {
      if (!x) return false
      const status = x.app.status
      if (status === "rejected" || status === "withdrawn") return false
      // 显示已到期 + 未来 7 天内
      return x.info.diffDays >= -7
    })
    .sort((a, b) => b.info.diffDays - a.info.diffDays) // 大 diff = 更逾期 = 排前

  if (items.length === 0) return null

  const overdueCount = items.filter((i) => i.info.overdue).length
  const todayCount = items.filter((i) => i.info.dueToday).length

  return (
    <Card className="border-orange-200 bg-orange-50/40">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <BellRing className="h-4 w-4 text-orange-600" />
            待跟进（{items.length}）
          </h3>
          <div className="flex items-center gap-2 text-xs">
            {overdueCount > 0 && (
              <Badge variant="danger">逾期 {overdueCount}</Badge>
            )}
            {todayCount > 0 && (
              <Badge variant="warning">今天 {todayCount}</Badge>
            )}
          </div>
        </div>
        <ul className="space-y-1.5">
          {items.map(({ app, info }) => (
            <li key={app.id}>
              <button
                type="button"
                onClick={() => onSelect(app)}
                className="w-full text-left flex items-center gap-3 px-3 py-2 rounded hover:bg-white border border-transparent hover:border-gray-200 transition-colors"
              >
                <Calendar
                  className={`h-3.5 w-3.5 flex-shrink-0 ${
                    info.overdue ? "text-red-500" : info.dueToday ? "text-orange-500" : "text-blue-500"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {app.job?.title || "未知岗位"}
                    {app.job?.company && (
                      <span className="text-gray-500 font-normal"> · {app.job.company}</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {info.date.toLocaleDateString("zh-CN")} · {statusLabel(app.status)}
                  </div>
                </div>
                <span
                  className={`text-xs font-medium flex-shrink-0 ${
                    info.overdue ? "text-red-600" : info.dueToday ? "text-orange-600" : "text-blue-600"
                  }`}
                >
                  {info.label}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function statusLabel(s?: string) {
  return ({
    draft: "待投递",
    applied: "已投递",
    written_test: "笔试中",
    interview: "面试中",
    offer: "已拿 Offer",
    rejected: "已拒",
    withdrawn: "已撤回",
  } as Record<string, string>)[s || ""] || s || "-"
}
