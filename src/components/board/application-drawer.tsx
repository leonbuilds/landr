"use client"

// 申请详情抽屉：渲染匹配详情、AI 重写、求职信、面试题，底部"投递"按钮
// "投递"流程：调 /greeting 生成打招呼语 → window.open(jobUrl#__aija_apply=base64({appId,greeting})) → 用户在 Boss
//             看见扩展注入的横幅 → 一键发送 → 扩展 PATCH 标 applied
import { useEffect, useState, useCallback } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  X, Send, Trash2, Loader2, ExternalLink, AlertCircle, Check,
  Sparkles, FileText, MessageSquare, HelpCircle,
} from "lucide-react"
import type { Application, MatchResult, RewriteResult } from "@/types"

interface InterviewQA {
  question: string
  starAnswer?: { situation?: string; task?: string; action?: string; result?: string }
  answer?: string
}
interface InterviewPrepData {
  behavioral?: InterviewQA[]
  situational?: InterviewQA[]
  technical?: InterviewQA[]
}
interface CoverLetterData {
  subject?: string
  body?: string
}

function safeParse<T>(json: string | null | undefined): T | null {
  if (!json) return null
  try { return JSON.parse(json) as T } catch { return null }
}

interface Props {
  applicationId: number | null
  onClose: () => void
  onUpdated: () => void
  getHeaders: () => Record<string, string>
}

export function ApplicationDrawer({ applicationId, onClose, onUpdated, getHeaders }: Props) {
  const [app, setApp] = useState<Application | null>(null)
  const [loading, setLoading] = useState(false)
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [generating, setGenerating] = useState<string | null>(null) // "cover-letter" | "interview-prep"
  const [errMsg, setErrMsg] = useState("")
  const [okMsg, setOkMsg] = useState("")

  const open = applicationId != null

  const load = useCallback(async () => {
    if (!applicationId) return
    setLoading(true); setErrMsg(""); setOkMsg("")
    try {
      const r = await fetch(`/api/applications/${applicationId}`, { headers: getHeaders() })
      if (!r.ok) { setErrMsg((await r.json()).error?.message || "加载失败"); return }
      const d = (await r.json()).data as Application
      setApp(d)
      setNotes(d.notes || "")
    } finally { setLoading(false) }
  }, [applicationId, getHeaders])

  useEffect(() => { if (open) load() }, [open, load])

  if (!open) return null

  const match = safeParse<MatchResult>(app?.matchDetail)
  const rewrite = safeParse<RewriteResult>(app?.tailoredResume)
  const cover = safeParse<CoverLetterData>(app?.coverLetter)
  const prep = safeParse<InterviewPrepData>(app?.interviewPrep)

  const job = app?.job
  const hasUrl = !!job?.url
  const isApplied = ["applied", "written_test", "interview", "offer"].includes(app?.status || "")

  async function generateMissing(kind: "cover-letter" | "interview-prep") {
    if (!app) return
    setGenerating(kind); setErrMsg("")
    try {
      const body = kind === "cover-letter" ? { tone: "confident" } : {}
      const r = await fetch(`/api/applications/${app.id}/${kind}`, {
        method: "POST",
        headers: { ...getHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const j = await r.json()
      if (!r.ok) { setErrMsg(j.error?.message || "生成失败"); return }
      await load()
    } finally { setGenerating(null) }
  }

  async function handleApply() {
    if (!app || !hasUrl) return
    setSubmitting(true); setErrMsg(""); setOkMsg("")
    try {
      // Step 1: save notes if changed
      if (notes !== (app.notes || "")) {
        await fetch(`/api/applications/${app.id}`, {
          method: "PUT",
          headers: { ...getHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ notes }),
        })
      }

      // Step 2: generate greeting via LLM
      const r = await fetch(`/api/applications/${app.id}/greeting`, {
        method: "POST",
        headers: getHeaders(),
      })
      const j = await r.json()
      if (!r.ok) { setErrMsg(j.error?.message || "生成打招呼语失败"); return }
      const { greeting, jobUrl } = j.data as { greeting: string; jobUrl: string }

      // Step 3: encode payload into URL hash, open new tab
      // 扩展 content script 看到 hash 后注入"AI 投递助手"横幅
      const payload = btoa(unescape(encodeURIComponent(JSON.stringify({
        appId: app.id,
        greeting,
        apiBase: window.location.origin,
      }))))
      const targetUrl = `${jobUrl}#__aija_apply=${payload}`
      window.open(targetUrl, "_blank")

      setOkMsg("已打开 Boss 详情页。请在新标签页里看 AI 投递助手横幅 → 确认打招呼语 → 发送。")
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : "投递失败")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!app) return
    if (!confirm(`确认删除这个申请？\n${job?.title || ""} - ${job?.company || ""}`)) return
    const r = await fetch(`/api/applications/${app.id}`, { method: "DELETE", headers: getHeaders() })
    if (r.ok) { onUpdated(); onClose() }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-40 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed right-0 top-0 z-50 h-full w-full sm:max-w-2xl bg-white shadow-xl flex flex-col data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right"
        >
          <DialogPrimitive.Title className="sr-only">申请详情</DialogPrimitive.Title>

          {/* Header */}
          <div className="flex items-start justify-between p-5 border-b">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold truncate">{job?.title || "未知岗位"}</h2>
              <div className="text-sm text-gray-500 mt-1 flex flex-wrap gap-x-3">
                {job?.company && <span>{job.company}</span>}
                {job?.salaryRange && <span>· {job.salaryRange}</span>}
                {job?.location && <span>· {job.location}</span>}
              </div>
              <div className="flex items-center gap-2 mt-2">
                {app?.matchScore != null && (
                  <Badge variant={app.matchScore >= 70 ? "success" : app.matchScore >= 40 ? "warning" : "danger"}>
                    匹配 {app.matchScore} 分
                  </Badge>
                )}
                <Badge variant="default">{statusLabel(app?.status)}</Badge>
                {hasUrl && (
                  <a href={job!.url!} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1">
                    Boss 原页 <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded ml-2">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {loading && <div className="text-center text-gray-500 py-10"><Loader2 className="h-5 w-5 animate-spin inline" /> 加载中…</div>}

            {!loading && app && (
              <>
                {/* Match section */}
                <section>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-1"><Sparkles className="h-4 w-4 text-blue-500" />匹配详情</h3>
                  {match ? (
                    <div className="space-y-2 text-sm bg-gray-50 rounded-lg p-3">
                      {match.matchedKeywords?.length > 0 && (
                        <div>
                          <div className="text-xs text-gray-500 mb-1">✅ 已匹配关键词</div>
                          <div className="flex flex-wrap gap-1">
                            {match.matchedKeywords.map((k, i) => (
                              <span key={i} className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">{k}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {match.missingKeywords?.length > 0 && (
                        <div>
                          <div className="text-xs text-gray-500 mb-1">❌ 缺失关键词</div>
                          <div className="flex flex-wrap gap-1">
                            {match.missingKeywords.map((k, i) => (
                              <span key={i} className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded">{k}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {match.suggestedKeywords?.length > 0 && (
                        <div>
                          <div className="text-xs text-gray-500 mb-1">💡 建议补充</div>
                          <div className="flex flex-wrap gap-1">
                            {match.suggestedKeywords.map((k, i) => (
                              <span key={i} className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs rounded">{k}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {match.analysis && (
                        <div className="text-xs text-gray-600 mt-2 leading-relaxed">{match.analysis}</div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 italic">该申请未做过匹配</div>
                  )}
                </section>

                {/* Tabs: rewrite / cover letter / interview prep */}
                <Tabs defaultValue="rewrite">
                  <TabsList>
                    <TabsTrigger value="rewrite"><FileText className="h-3.5 w-3.5 mr-1" />简历重写</TabsTrigger>
                    <TabsTrigger value="cover"><MessageSquare className="h-3.5 w-3.5 mr-1" />求职信</TabsTrigger>
                    <TabsTrigger value="prep"><HelpCircle className="h-3.5 w-3.5 mr-1" />面试题</TabsTrigger>
                  </TabsList>

                  <TabsContent value="rewrite" className="mt-3">
                    {rewrite ? (
                      <div className="text-sm space-y-2">
                        {rewrite.rewrittenPoints?.length > 0 && (
                          <ul className="list-disc list-inside space-y-1 bg-gray-50 rounded p-3">
                            {rewrite.rewrittenPoints.map((p, i) => <li key={i}>{p}</li>)}
                          </ul>
                        )}
                        {rewrite.tips && <div className="text-xs text-gray-500 mt-2">{rewrite.tips}</div>}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500 italic">未生成（在岗位库点匹配会自动生成）</div>
                    )}
                  </TabsContent>

                  <TabsContent value="cover" className="mt-3">
                    {cover ? (
                      <div className="text-sm space-y-2 bg-gray-50 rounded p-3">
                        {cover.subject && <div className="font-medium">{cover.subject}</div>}
                        {cover.body && <div className="whitespace-pre-wrap text-gray-700 text-sm leading-relaxed">{cover.body}</div>}
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" disabled={generating === "cover-letter"} onClick={() => generateMissing("cover-letter")}>
                        {generating === "cover-letter" ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />生成中…</> : "现在生成求职信"}
                      </Button>
                    )}
                  </TabsContent>

                  <TabsContent value="prep" className="mt-3">
                    {prep ? (
                      <div className="text-sm space-y-3 max-h-80 overflow-auto">
                        {(["behavioral", "situational", "technical"] as const).map((cat) => (
                          (prep[cat] || []).length > 0 && (
                            <div key={cat}>
                              <div className="text-xs font-medium text-gray-500 mb-1">
                                {cat === "behavioral" ? "行为题" : cat === "situational" ? "情景题" : "技术题"}
                              </div>
                              <ul className="space-y-1.5">
                                {(prep[cat] || []).map((q, i) => (
                                  <li key={i} className="bg-gray-50 rounded p-2">
                                    <div className="font-medium text-xs">{q.question}</div>
                                    {q.starAnswer && (
                                      <div className="text-xs text-gray-600 mt-1 leading-relaxed">
                                        {q.starAnswer.situation && <div>📍 {q.starAnswer.situation}</div>}
                                        {q.starAnswer.task && <div>🎯 {q.starAnswer.task}</div>}
                                        {q.starAnswer.action && <div>🛠 {q.starAnswer.action}</div>}
                                        {q.starAnswer.result && <div>✨ {q.starAnswer.result}</div>}
                                      </div>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )
                        ))}
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" disabled={generating === "interview-prep"} onClick={() => generateMissing("interview-prep")}>
                        {generating === "interview-prep" ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />生成中…</> : "现在生成面试题"}
                      </Button>
                    )}
                  </TabsContent>
                </Tabs>

                {/* Notes */}
                <section>
                  <h3 className="text-sm font-semibold mb-2">备注</h3>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="记录沟通进展、HR 反馈、跟进时间…"
                    rows={3}
                  />
                </section>
              </>
            )}

            {errMsg && <div className="text-sm text-red-600 flex items-center gap-1"><AlertCircle className="h-4 w-4" />{errMsg}</div>}
            {okMsg && <div className="text-sm text-green-700 flex items-center gap-1"><Check className="h-4 w-4" />{okMsg}</div>}
          </div>

          {/* Footer */}
          <div className="border-t p-4 flex items-center justify-between gap-3">
            <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-1" />删除
            </Button>
            <div className="flex items-center gap-2">
              {!hasUrl && (
                <span className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />无 Boss 链接
                </span>
              )}
              {isApplied ? (
                <Button disabled variant="outline">
                  <Check className="h-4 w-4 mr-1" />已投递
                </Button>
              ) : (
                <Button
                  onClick={handleApply}
                  disabled={!hasUrl || submitting}
                  title={!hasUrl ? "该岗位没有 Boss 链接，无法自动投递" : undefined}
                >
                  {submitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                  投递（去 Boss）
                </Button>
              )}
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
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
