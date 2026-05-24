"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { JobCard } from "@/components/jobs/job-card"
import { JobInput } from "@/components/jobs/job-input"
import { AutoSearch } from "@/components/jobs/auto-search"
import { LoadingSpinner } from "@/components/shared/loading-spinner"
import { useToast } from "@/components/shared/toast"
import { Plus, Briefcase, Trash2 } from "lucide-react"
import type { Job } from "@/types"

export default function JobsPage() {
  const { isAuthenticated, isLoading: authLoading, getHeaders } = useAuth()
  const toast = useToast()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [showInput, setShowInput] = useState(false)
  const [clearing, setClearing] = useState(false)

  const handleClear = async (scope: "untouched" | "all") => {
    const label = scope === "untouched" ? "未匹配过的岗位" : "所有岗位"
    const warn = scope === "all"
      ? `确认清空所有 ${jobs.length} 个岗位？\n已生成的申请记录会保留, 但会失去岗位关联。`
      : "确认删除所有从未匹配过的岗位？已有申请记录的岗位会保留。"
    if (!confirm(warn)) return
    setClearing(true)
    try {
      const r = await fetch(`/api/jobs?scope=${scope}`, { method: "DELETE", headers: getHeaders() })
      const j = await r.json()
      if (r.ok) {
        toast.show({ kind: "success", title: `已清空${label}`, description: `删除了 ${j.data?.deleted ?? 0} 个岗位` })
        fetchJobs()
      } else {
        toast.show({ kind: "error", title: "清空失败", description: j.error?.message || "请稍后重试" })
      }
    } finally { setClearing(false) }
  }

  const fetchJobs = useCallback(async () => {
    const headers = getHeaders()
    const res = await fetch("/api/jobs", { headers })
    if (res.ok) {
      const json = (await res.json()) as { data: Job[] }
      setJobs(json.data)
    }
    setLoading(false)
  }, [getHeaders])

  useEffect(() => {
    if (!authLoading && isAuthenticated) fetchJobs()
  }, [authLoading, isAuthenticated, fetchJobs])

  if (authLoading || loading) return <LoadingSpinner message="加载中..." />
  if (!isAuthenticated) return null

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          岗位库
          {jobs.length > 0 && (
            <span className="ml-2 text-sm text-gray-500 font-normal">{jobs.length} 个</span>
          )}
        </h1>
        <div className="flex items-center gap-2">
          {jobs.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-gray-600 hover:bg-gray-100"
              disabled={clearing}
              onClick={() => handleClear("untouched")}
              title="只删未匹配过的岗位 (有申请记录的会保留)"
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />清空未用
            </Button>
          )}
          {jobs.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-red-600 hover:bg-red-50"
              disabled={clearing}
              onClick={() => handleClear("all")}
              title="清空岗位库全部岗位"
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />清空全部
            </Button>
          )}
          <Button onClick={() => setShowInput(true)}>
            <Plus className="mr-2 h-4 w-4" />添加岗位
          </Button>
        </div>
      </div>

      <AutoSearch getHeaders={getHeaders} onJobsImported={fetchJobs} />

      <JobInput
        open={showInput}
        onOpenChange={setShowInput}
        onSuccess={fetchJobs}
        getHeaders={getHeaders}
      />

      {jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-lg border-2 border-dashed">
          <Briefcase className="h-12 w-12 text-gray-300 mb-4" />
          <p className="text-gray-500 mb-1">还没有添加岗位</p>
          <p className="text-sm text-gray-400 mb-4">点击添加第一个目标岗位</p>
          <Button variant="outline" onClick={() => setShowInput(true)}>
            <Plus className="mr-2 h-4 w-4" />添加岗位
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  )
}
