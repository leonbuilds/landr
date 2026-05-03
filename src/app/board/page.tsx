"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/hooks/use-auth"
import { KanbanBoard } from "@/components/board/kanban-board"
import { ApplicationDrawer } from "@/components/board/application-drawer"
import { LoadingSpinner } from "@/components/shared/loading-spinner"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import type { Application, ApplicationStats } from "@/types"

export default function BoardPage() {
  const { isAuthenticated, isLoading: authLoading, getHeaders } = useAuth()
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<ApplicationStats | null>(null)
  const [tab, setTab] = useState("board")
  const [selectedAppId, setSelectedAppId] = useState<number | null>(null)

  const fetchData = useCallback(async () => {
    const headers = getHeaders()
    const [appsRes, statsRes] = await Promise.all([
      fetch("/api/applications", { headers }),
      fetch("/api/applications/stats", { headers }),
    ])
    if (appsRes.ok) setApplications((await appsRes.json()).data)
    if (statsRes.ok) setStats((await statsRes.json()).data as ApplicationStats)
    setLoading(false)
  }, [getHeaders])

   
  useEffect(() => {
    if (!authLoading && isAuthenticated) fetchData()
  }, [authLoading, isAuthenticated, fetchData])

  const handleStatusChange = async (appId: number, newStatus: string) => {
    const headers = getHeaders()
    const res = await fetch(`/api/applications/${appId}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      setApplications((prev) =>
        prev.map((a) => (a.id === appId ? { ...a, status: newStatus } : a))
      )
      fetchData() // refresh stats
    }
  }

  const handleCardClick = (app: Application) => {
    setSelectedAppId(app.id)
  }

  if (authLoading || loading) return <LoadingSpinner message="加载中..." />
  if (!isAuthenticated) return null

  return (
    <div className="max-w-full mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">申请看板</h1>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="board">看板</TabsTrigger>
            <TabsTrigger value="stats">数据统计</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {tab === "board" && (
        <KanbanBoard
          applications={applications}
          onStatusChange={handleStatusChange}
          onCardClick={handleCardClick}
        />
      )}

      <ApplicationDrawer
        applicationId={selectedAppId}
        onClose={() => setSelectedAppId(null)}
        onUpdated={fetchData}
        getHeaders={getHeaders}
      />

      {tab === "stats" && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatsCard label="总投递" value={stats.total} />
            <StatsCard label="已投递" value={stats.statusCounts.applied} color="text-blue-600" />
            <StatsCard label="面试中" value={stats.statusCounts.interview} color="text-purple-600" />
            <StatsCard label="Offer" value={stats.statusCounts.offer} color="text-green-600" />
            <StatsCard label="平均匹配度" value={`${stats.avgMatchScore}分`} color="text-blue-600" />
          </div>

          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold mb-4">投递趋势（近30天）</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stats.dailyCounts}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="投递数" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold mb-4">转化漏斗</h3>
              <div className="space-y-3">
                {stats.pipeline.map((stage: { stage: string; count: number }, i: number) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 w-16">{stage.stage}</span>
                    <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full flex items-center justify-end pr-2 transition-all"
                        style={{ width: `${stats.total > 0 ? (stage.count / stats.total) * 100 : 0}%` }}
                      >
                        <span className="text-xs text-white font-medium">{stage.count}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

function StatsCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <Card>
      <CardContent className="p-4 text-center">
        <p className="text-sm text-gray-500">{label}</p>
        <p className={`text-2xl font-bold mt-1 ${color || "text-gray-900"}`}>{value}</p>
      </CardContent>
    </Card>
  )
}
