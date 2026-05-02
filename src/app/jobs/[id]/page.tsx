"use client"

import { useState, useEffect, use } from "react"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MatchVisual } from "@/components/jobs/match-visual"
import { LoadingSpinner } from "@/components/shared/loading-spinner"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { isAuthenticated, isLoading: authLoading, getHeaders } = useAuth()
  const [job, setJob] = useState<any>(null)
  const [resumes, setResumes] = useState<any[]>([])
  const [selectedResume, setSelectedResume] = useState("")
  const [matching, setMatching] = useState(false)
  const [matchResult, setMatchResult] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      const headers = getHeaders()
      Promise.all([
        fetch(`/api/jobs/${id}`, { headers }).then((r) => r.json()),
        fetch("/api/resumes", { headers }).then((r) => r.json()),
      ]).then(([jobJson, resumesJson]) => {
        setJob(jobJson.data)
        setResumes(resumesJson.data || [])
        setLoading(false)
      })
    }
  }, [authLoading, isAuthenticated, id, getHeaders])

  const handleMatch = async () => {
    if (!selectedResume) return
    setMatching(true)
    setMatchResult(null)
    try {
      const headers = getHeaders()
      const res = await fetch(`/api/resumes/${selectedResume}/match`, {
        method: "POST",
        headers,
        body: JSON.stringify({ jobId: parseInt(id) }),
      })
      const json = await res.json()
      if (json.data) {
        setMatchResult(json.data)
      } else {
        alert(json.error?.message || "匹配失败")
      }
    } catch {
      alert("匹配请求失败")
    } finally {
      setMatching(false)
    }
  }

  if (authLoading || loading) return <LoadingSpinner message="加载中..." />
  if (!isAuthenticated || !job) return null

  const parsed = job.parsedJson ? JSON.parse(job.parsedJson) : null

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link href="/jobs" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" />返回岗位库
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl">{job.title}</CardTitle>
              {job.company && <p className="text-gray-500 mt-1">{job.company}</p>}
            </div>
            <Badge variant="outline">{job.platform === "manual" ? "手动添加" : job.platform}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {parsed && (
            <div className="grid grid-cols-2 gap-4 mb-4">
              {parsed.location && (
                <div>
                  <span className="text-xs text-gray-500">工作地点</span>
                  <p className="text-sm">{parsed.location}</p>
                </div>
              )}
              {parsed.salaryRange && (
                <div>
                  <span className="text-xs text-gray-500">薪资范围</span>
                  <p className="text-sm text-green-600 font-medium">{parsed.salaryRange}</p>
                </div>
              )}
            </div>
          )}
          {job.jdText && (
            <div>
              <h4 className="text-sm font-medium mb-2">JD原文</h4>
              <pre className="whitespace-pre-wrap text-sm text-gray-600 bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto">
                {job.jdText}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">匹配分析</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-1 block">选择简历</label>
              <Select value={selectedResume} onValueChange={setSelectedResume}>
                <SelectTrigger>
                  <SelectValue placeholder="选择一份简历进行匹配..." />
                </SelectTrigger>
                <SelectContent>
                  {resumes.map((r: any) => (
                    <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleMatch} disabled={!selectedResume || matching}>
              {matching ? "匹配分析中..." : "开始匹配"}
            </Button>
          </div>

          {matching && <LoadingSpinner message="AI正在分析简历与JD的匹配度..." />}
          {matchResult && <MatchVisual match={matchResult.match} rewrite={matchResult.rewrite} />}
        </CardContent>
      </Card>
    </div>
  )
}
