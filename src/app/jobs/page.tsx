"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { JobCard } from "@/components/jobs/job-card"
import { JobInput } from "@/components/jobs/job-input"
import { AutoSearch } from "@/components/jobs/auto-search"
import { LoadingSpinner } from "@/components/shared/loading-spinner"
import { Plus, Briefcase } from "lucide-react"
import type { Job } from "@/types"

export default function JobsPage() {
  const { isAuthenticated, isLoading: authLoading, getHeaders } = useAuth()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [showInput, setShowInput] = useState(false)

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
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[12.5px] font-mono" style={{ color: "var(--muted)" }}>
          <span>Workspace</span>
          <span style={{ color: "var(--dim)" }}>/</span>
          <span style={{ color: "var(--text)" }} className="font-semibold font-sans">岗位库</span>
          <span style={{ color: "var(--dim)" }}>·</span>
          <span>{jobs.length} jobs</span>
        </div>
        <Button onClick={() => setShowInput(true)}>
          <Plus className="h-4 w-4" />添加岗位
        </Button>
      </div>

      <div>
        <div className="text-[11.5px] font-mono uppercase tracking-wider" style={{ color: "var(--muted)" }}>
          下午好
        </div>
        <h1 className="text-[32px] font-semibold leading-[1.15] -tracking-[0.03em] mt-1.5 max-w-[780px]">
          {jobs.length > 0 ? (
            <>
              你的岗位库里有 <span className="gradient-text">{jobs.length} 个岗位</span>
              <br />
              点开任何一个跑 AI 匹配，分数会出现在卡片上。
            </>
          ) : (
            <>用一句话告诉 AI，<span className="gradient-text">替你翻完三页 Boss</span>。</>
          )}
        </h1>
      </div>

      <AutoSearch getHeaders={getHeaders} onJobsImported={fetchJobs} />

      <JobInput
        open={showInput}
        onOpenChange={setShowInput}
        onSuccess={fetchJobs}
        getHeaders={getHeaders}
      />

      {jobs.length === 0 ? (
        <div
          className="glass-card flex flex-col items-center justify-center py-20 text-center"
          style={{ borderStyle: "dashed" }}
        >
          <Briefcase className="h-12 w-12 mb-4" style={{ color: "var(--dim)" }} />
          <p className="text-[14px] mb-1" style={{ color: "var(--muted)" }}>
            还没有岗位
          </p>
          <p className="text-[12.5px] mb-5" style={{ color: "var(--dim)" }}>
            用上方 AI 搜岗位，或手动添加一个目标
          </p>
          <Button variant="outline" onClick={() => setShowInput(true)}>
            <Plus className="h-4 w-4" />添加岗位
          </Button>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-[17px] font-semibold -tracking-[0.025em]">
                本周适合你的岗位{" "}
                <span className="text-[14px] font-normal" style={{ color: "var(--muted)" }}>
                  by AI match
                </span>
              </h2>
              <div className="text-[11px] font-mono mt-0.5" style={{ color: "var(--muted)" }}>
                {jobs.length} jobs · sorted by match score
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
