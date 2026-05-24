"use client"

// AI 搜岗位 —— /jobs 页面顶部组件
// 流程：输入一句话 / 选简历 → POST /search-plan → 显示解析的搜索条件 + Boss URL 预览
// → 用户确认 → POST /search-tasks → 任务进入 pending，扩展轮询执行
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card"
import { Loader2, Search, Check, Clock, AlertCircle, ExternalLink, X, Trash2 } from "lucide-react"

interface Plan {
  query: string
  mustInclude?: string[]
  city: string
  salaryMin: number
  salaryMax: number
  experience?: string
  companies?: string[]
  explanation?: string
}

interface Task {
  id: number
  source: string
  prompt: string | null
  resumeId: number | null
  params: string
  status: "pending" | "running" | "done" | "failed"
  collected: number
  skipped: number
  message: string | null
  createdAt: string
  updatedAt: string
}

interface Resume {
  id: number
  name: string
}

export function AutoSearch({
  getHeaders,
  onJobsImported,
}: {
  getHeaders: () => Record<string, string>
  onJobsImported: () => void
}) {
  const [prompt, setPrompt] = useState("")
  const [resumeId, setResumeId] = useState<number | null>(null)
  const [resumes, setResumes] = useState<Resume[]>([])
  const [pages, setPages] = useState(3)

  const [plan, setPlan] = useState<Plan | null>(null)
  const [previewUrl, setPreviewUrl] = useState("")
  const [planning, setPlanning] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errMsg, setErrMsg] = useState("")

  const [tasks, setTasks] = useState<Task[]>([])

  // 拉简历列表（用于"基于此简历搜"）
  useEffect(() => {
    fetch("/api/resumes", { headers: getHeaders() })
      .then((r) => r.json())
      .then((j) => setResumes(j.data || []))
      .catch(() => {})
  }, [getHeaders])

  // 任务列表轮询：每 5s 拉一次，在有 pending/running 时
  useEffect(() => {
    let stopped = false
    async function load() {
      try {
        const r = await fetch("/api/jobs/search-tasks", { headers: getHeaders() })
        if (!r.ok) return
        const j = await r.json()
        if (stopped) return
        const prevDoneIds = new Set(tasks.filter((t) => t.status === "done").map((t) => t.id))
        const next: Task[] = j.data || []
        setTasks(next)
        // 检测有新完成的任务 → 触发岗位列表刷新
        for (const t of next) {
          if (t.status === "done" && !prevDoneIds.has(t.id)) {
            onJobsImported()
            break
          }
        }
      } catch {}
    }
    load()
    const id = setInterval(load, 5000)
    return () => { stopped = true; clearInterval(id) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handlePreview(opts?: { resumeId?: number; prompt?: string }) {
    setErrMsg("")
    setPlan(null)
    setPlanning(true)
    try {
      const body: Record<string, unknown> = {}
      const useResumeId = opts?.resumeId ?? resumeId
      const usePrompt = opts?.prompt ?? prompt
      if (useResumeId) body.resumeId = useResumeId
      else if (usePrompt.trim()) body.prompt = usePrompt.trim()
      else { setErrMsg("请输入一句话或选一份简历"); setPlanning(false); return }

      const r = await fetch("/api/jobs/search-plan", {
        method: "POST",
        headers: { ...getHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const j = await r.json()
      if (!r.ok) { setErrMsg(j.error?.message || "解析失败"); return }
      setPlan(j.data.plan)
      setPreviewUrl(j.data.previewUrl)
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : "网络错误")
    } finally {
      setPlanning(false)
    }
  }

  async function handleConfirm() {
    if (!plan) return
    setSubmitting(true)
    setErrMsg("")
    try {
      const r = await fetch("/api/jobs/search-tasks", {
        method: "POST",
        headers: { ...getHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          source: resumeId ? "resume" : "prompt",
          prompt: prompt.trim() || null,
          resumeId,
          plan,
          pages,
        }),
      })
      const j = await r.json()
      if (!r.ok) { setErrMsg(j.error?.message || "创建任务失败"); return }
      setPlan(null)
      setPrompt("")
      setResumeId(null)
      // refresh tasks
      const r2 = await fetch("/api/jobs/search-tasks", { headers: getHeaders() })
      if (r2.ok) setTasks((await r2.json()).data || [])
    } finally {
      setSubmitting(false)
    }
  }

  function statusBadge(t: Task) {
    const cls =
      t.status === "done" ? "text-green-700 bg-green-50 border-green-200"
      : t.status === "running" ? "text-blue-700 bg-blue-50 border-blue-200"
      : t.status === "failed" ? "text-red-700 bg-red-50 border-red-200"
      : "text-gray-700 bg-gray-50 border-gray-200"
    const icon = t.status === "done" ? <Check className="h-3 w-3" /> : t.status === "running" ? <Loader2 className="h-3 w-3 animate-spin" /> : t.status === "failed" ? <AlertCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />
    const label = t.status === "done" ? "完成" : t.status === "running" ? "运行中" : t.status === "failed" ? "失败" : "等待扩展拾取"
    return <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border ${cls}`}>{icon}{label}</span>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />AI 搜岗位（Boss直聘）
        </CardTitle>
        <CardDescription>
          一句话告诉 AI 你想找什么样的岗位（或选简历自动推断）。AI 会生成 Boss 搜索条件，你确认后扩展会借你登录态自动翻页采集。
          <br /><span className="text-amber-600 text-xs">前置：浏览器扩展已加载并完成 API Key 配置；当前 Chrome 已登录 Boss直聘。</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="例如：北京 高级前端 30K+ 字节美团这种大厂"
            value={prompt}
            onChange={(e) => { setPrompt(e.target.value); setResumeId(null); setPlan(null) }}
            onKeyDown={(e) => { if (e.key === "Enter") handlePreview() }}
          />
          <Button onClick={() => handlePreview()} disabled={planning} variant="outline">
            {planning ? <Loader2 className="h-4 w-4 animate-spin" /> : "预览"}
          </Button>
        </div>

        {resumes.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center text-sm">
            <span className="text-gray-500">或基于简历一键搜：</span>
            {resumes.map((r) => (
              <Button
                key={r.id}
                size="sm"
                variant={resumeId === r.id ? "default" : "outline"}
                disabled={planning}
                onClick={() => {
                  setResumeId(r.id)
                  setPrompt("")
                  setPlan(null)
                  // 点简历 = 立刻调 LLM 预览（不用再点"预览"按钮）
                  handlePreview({ resumeId: r.id })
                }}
              >
                {planning && resumeId === r.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
                {r.name}
              </Button>
            ))}
          </div>
        )}

        {errMsg && <div className="text-sm text-red-600">{errMsg}</div>}

        {plan && (
          <div className="rounded-lg border p-4 bg-blue-50/40 space-y-3">
            <div className="text-sm">
              <div className="font-medium mb-1">AI 解析的搜索条件</div>
              {plan.explanation && <div className="text-gray-600 text-xs mb-2">{plan.explanation}</div>}
              <div className="grid grid-cols-2 gap-y-1 text-xs">
                <div><span className="text-gray-500">关键词：</span>{plan.query}</div>
                <div><span className="text-gray-500">城市：</span>{plan.city}</div>
                <div><span className="text-gray-500">薪资：</span>{plan.salaryMin || plan.salaryMax ? `${plan.salaryMin}K-${plan.salaryMax}K` : "不限"}</div>
                <div><span className="text-gray-500">经验：</span>{plan.experience || "不限"}</div>
              </div>
              {plan.mustInclude && plan.mustInclude.length > 0 && (
                <div className="mt-2 text-xs flex items-start gap-1.5 flex-wrap">
                  <span className="text-gray-500 flex-shrink-0">标题必含：</span>
                  {plan.mustInclude.map((kw, i) => (
                    <span key={i} className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[11px]">
                      {kw}
                    </span>
                  ))}
                  <span className="text-gray-400 text-[11px] ml-1">扩展会过滤掉标题不含这些词的岗位</span>
                </div>
              )}
              <div className="mt-2 text-xs">
                <span className="text-gray-500">预览 URL（第1页）：</span>
                <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1 break-all">
                  {previewUrl}<ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs text-gray-600">采集页数：
                <select
                  className="ml-1 border rounded px-1 py-0.5"
                  value={pages}
                  onChange={(e) => setPages(Number(e.target.value))}
                >
                  <option value={1}>1 页（约 30 个）</option>
                  <option value={3}>3 页（约 90 个）</option>
                  <option value={5}>5 页（约 150 个）</option>
                  <option value={10}>10 页（约 300 个）</option>
                </select>
              </label>
              <Button onClick={handleConfirm} disabled={submitting}>
                {submitting ? "创建中..." : "确认搜索"}
              </Button>
              <Button variant="ghost" onClick={() => setPlan(null)}>取消</Button>
            </div>
          </div>
        )}

        {tasks.length > 0 && (
          <div className="border-t pt-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-gray-500">
                最近任务（最多显示 5 条）
                {(() => {
                  const n = tasks.filter((t) => t.status === "pending" || t.status === "running").length
                  return n > 0 ? <span className="ml-1 text-amber-600">· {n} 个进行中</span> : null
                })()}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs text-red-600 hover:bg-red-50 h-7 disabled:text-gray-400"
                disabled={!tasks.some((t) => t.status === "pending" || t.status === "running")}
                onClick={async () => {
                  if (!confirm("清空所有等待中和运行中的任务？")) return
                  await fetch("/api/jobs/search-tasks", { method: "DELETE", headers: getHeaders() })
                  const r = await fetch("/api/jobs/search-tasks", { headers: getHeaders() })
                  if (r.ok) setTasks((await r.json()).data || [])
                }}
              >
                <Trash2 className="h-3 w-3 mr-1" />清空未完成
              </Button>
            </div>
            <div className="space-y-1">
              {tasks.slice(0, 5).map((t) => {
                const params = (() => { try { return JSON.parse(t.params) } catch { return {} } })()
                const cancelable = t.status === "pending" || t.status === "running"
                return (
                  <div key={t.id} className="flex items-center gap-2 text-sm py-1">
                    {statusBadge(t)}
                    <span className="text-gray-700 truncate flex-1">
                      {params.query}
                      {Array.isArray(params.mustInclude) && params.mustInclude.length > 0 && (
                        <span className="text-gray-500"> + 含「{params.mustInclude.join("、")}」</span>
                      )}
                      {" · "}{params.city} · {(params.salaryMin || params.salaryMax) ? `${params.salaryMin}K-${params.salaryMax}K` : "不限"} · {params.pages}页
                    </span>
                    {t.status === "done" && (
                      <span className="text-xs text-gray-500">采到 {t.collected} / 跳过 {t.skipped}</span>
                    )}
                    {t.message && t.status !== "done" && (
                      <span className="text-xs text-gray-500 truncate max-w-xs" title={t.message}>{t.message}</span>
                    )}
                    {cancelable && (
                      <button
                        className="text-gray-400 hover:text-red-600 p-1"
                        title="取消该任务"
                        onClick={async () => {
                          await fetch(`/api/jobs/search-tasks/${t.id}`, { method: "DELETE", headers: getHeaders() })
                          const r = await fetch("/api/jobs/search-tasks", { headers: getHeaders() })
                          if (r.ok) setTasks((await r.json()).data || [])
                        }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
