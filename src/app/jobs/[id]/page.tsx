"use client"

import { useState, useEffect, use } from "react"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MatchVisual } from "@/components/jobs/match-visual"
import { LoadingSpinner } from "@/components/shared/loading-spinner"
import { ChevronDown, ChevronUp } from "lucide-react"
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
  const [coverLetter, setCoverLetter] = useState<any>(null)
  const [interviewPrep, setInterviewPrep] = useState<any>(null)
  const [genCoverLetter, setGenCoverLetter] = useState(false)
  const [genInterview, setGenInterview] = useState(false)
  const [coverTone, setCoverTone] = useState("formal")
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
          {matchResult && (
            <>
              <MatchVisual match={matchResult.match} rewrite={matchResult.rewrite} />

              {/* Cover Letter Section */}
              <div className="border-t pt-4 mt-4">
                <h4 className="font-semibold mb-3">求职信生成</h4>
                {!coverLetter ? (
                  <div className="flex items-end gap-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">语气</label>
                      <Select value={coverTone} onValueChange={setCoverTone}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="formal">正式专业</SelectItem>
                          <SelectItem value="confident">自信积极</SelectItem>
                          <SelectItem value="sincere">真诚务实</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      variant="outline"
                      onClick={async () => {
                        setGenCoverLetter(true)
                        const h = getHeaders()
                        const r = await fetch(`/api/applications/${matchResult.applicationId}/cover-letter`, {
                          method: "POST", headers: h, body: JSON.stringify({ tone: coverTone }),
                        })
                        if (r.ok) setCoverLetter((await r.json()).data)
                        setGenCoverLetter(false)
                      }}
                      disabled={genCoverLetter}
                    >
                      {genCoverLetter ? "生成中..." : "生成求职信"}
                    </Button>
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <p className="text-sm font-medium">{coverLetter.subject}</p>
                    <pre className="whitespace-pre-wrap text-sm text-gray-700">{coverLetter.body}</pre>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(coverLetter.body) }}>
                        复制求职信
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setCoverLetter(null)}>重新生成</Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Interview Prep Section */}
              <div className="border-t pt-4 mt-4">
                <h4 className="font-semibold mb-3">面试准备</h4>
                {!interviewPrep ? (
                  <Button
                    variant="outline"
                    onClick={async () => {
                      setGenInterview(true)
                      const h = getHeaders()
                      const r = await fetch(`/api/applications/${matchResult.applicationId}/interview-prep`, {
                        method: "POST", headers: h,
                      })
                      if (r.ok) setInterviewPrep((await r.json()).data)
                      setGenInterview(false)
                    }}
                    disabled={genInterview}
                  >
                    {genInterview ? "生成中..." : "生成面试题"}
                  </Button>
                ) : (
                  <div className="space-y-4">
                    <InterviewSection title="行为面试题" items={interviewPrep.behavioral} />
                    <InterviewSection title="情景面试题" items={interviewPrep.situational} />
                    <InterviewSection title="技术/专业面试题" items={interviewPrep.technical} />
                    <Button size="sm" variant="ghost" onClick={() => setInterviewPrep(null)}>重新生成</Button>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function InterviewSection({ title, items }: { title: string; items: any[] }) {
  const [expanded, setExpanded] = useState<number | null>(null)

  if (!items?.length) return null

  return (
    <div>
      <h5 className="text-sm font-medium text-gray-700 mb-2">{title}</h5>
      <div className="space-y-2">
        {items.map((item, i) => (
          <Card key={i} className="bg-gray-50/50">
            <CardContent className="p-3">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpanded(expanded === i ? null : i)}
              >
                <p className="text-sm font-medium pr-2">{item.question}</p>
                {expanded === i ? <ChevronUp className="h-4 w-4 flex-shrink-0" /> : <ChevronDown className="h-4 w-4 flex-shrink-0" />}
              </div>
              {expanded === i && item.starAnswer && (
                <div className="mt-3 pt-3 border-t space-y-2 text-sm text-gray-600">
                  {item.starAnswer.situation && <p><strong>Situation:</strong> {item.starAnswer.situation}</p>}
                  {item.starAnswer.task && <p><strong>Task:</strong> {item.starAnswer.task}</p>}
                  {item.starAnswer.action && <p><strong>Action:</strong> {item.starAnswer.action}</p>}
                  {item.starAnswer.result && <p><strong>Result:</strong> {item.starAnswer.result}</p>}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
