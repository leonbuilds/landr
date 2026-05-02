"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { JobCard } from "@/components/jobs/job-card"
import { JobInput } from "@/components/jobs/job-input"
import { LoadingSpinner } from "@/components/shared/loading-spinner"
import { Plus, Briefcase } from "lucide-react"

export default function JobsPage() {
  const { isAuthenticated, isLoading: authLoading, getHeaders } = useAuth()
  const [jobs, setJobs] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [showInput, setShowInput] = useState(false)

  const fetchJobs = useCallback(async () => {
    const headers = getHeaders()
    const res = await fetch("/api/jobs", { headers })
    if (res.ok) {
      const json = await res.json()
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
        <h1 className="text-2xl font-bold">岗位库</h1>
        <Button onClick={() => setShowInput(true)}>
          <Plus className="mr-2 h-4 w-4" />添加岗位
        </Button>
      </div>

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
