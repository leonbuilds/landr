"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Building2, ExternalLink, Loader2, Sparkles, AlertCircle } from "lucide-react"

interface RankedJob {
  jobId: number
  title: string
  company: string | null
  location: string | null
  salaryRange: string | null
  url: string | null
  score: number
  cached: boolean
  analysis?: string
  applicationId?: number
  error?: string
}

interface BatchRankResponse {
  ranked: RankedJob[]
  total: number
  cached: number
  computed: number
  skipped: number
}

interface BatchRankDialogProps {
  open: boolean
  resumeId: number | null
  resumeName: string
  onClose: () => void
  getHeaders: () => Record<string, string>
}

export function BatchRankDialog({ open, resumeId, resumeName, onClose, getHeaders }: BatchRankDialogProps) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<BatchRankResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleRank = async () => {
    if (!resumeId) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch(`/api/resumes/${resumeId}/batch-rank`, {
        method: "POST",
        headers: getHeaders(),
      })
      const json = await res.json()
      if (res.ok) {
        setResult(json.data as BatchRankResponse)
      } else {
        setError(json.error?.message || "批量排名失败")
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "请求失败")
    } finally {
      setLoading(false)
    }
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setResult(null)
      setError(null)
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            一键批量岗位排名
          </DialogTitle>
          <DialogDescription>
            用 <span className="font-medium">{resumeName}</span> 对你岗位库里所有有 JD 的岗位评分，按匹配度排序。已有匹配会复用缓存。
          </DialogDescription>
        </DialogHeader>

        {!result && !loading && (
          <div className="py-6 text-center">
            <Button onClick={handleRank} size="lg">
              <Sparkles className="mr-2 h-4 w-4" />
              开始批量评分
            </Button>
            <p className="text-xs text-gray-500 mt-3">每次最多评 30 个未评过的岗位</p>
          </div>
        )}

        {loading && (
          <div className="py-12 text-center">
            <Loader2 className="h-8 w-8 text-blue-600 animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-600">AI 正在批量评分中…</p>
            <p className="text-xs text-gray-400 mt-1">耗时取决于岗位数量，请耐心等待</p>
          </div>
        )}

        {error && !loading && (
          <div className="py-4 px-3 bg-red-50 border border-red-200 rounded text-sm text-red-700 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">出错了</p>
              <p>{error}</p>
              <Button variant="outline" size="sm" onClick={handleRank} className="mt-2">
                重试
              </Button>
            </div>
          </div>
        )}

        {result && !loading && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm bg-gray-50 px-3 py-2 rounded">
              <span>共 {result.total} 个岗位</span>
              <span className="text-gray-400">·</span>
              <span className="text-blue-600">{result.computed} 新评分</span>
              <span className="text-gray-400">·</span>
              <span className="text-gray-500">{result.cached} 已有缓存</span>
              {result.skipped > 0 && (
                <>
                  <span className="text-gray-400">·</span>
                  <span className="text-orange-600">{result.skipped} 个本轮未评（再次点击继续）</span>
                </>
              )}
            </div>

            {result.ranked.length === 0 ? (
              <p className="text-center text-gray-500 py-8">还没有可评分的岗位。请先在岗位库添加带 JD 的岗位。</p>
            ) : (
              <ol className="space-y-2">
                {result.ranked.map((r, idx) => (
                  <li
                    key={r.jobId}
                    className="flex items-start gap-3 p-3 border rounded hover:bg-gray-50"
                  >
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-600">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-sm truncate">{r.title}</h4>
                        {r.cached && (
                          <Badge variant="outline" className="text-xs flex-shrink-0">缓存</Badge>
                        )}
                      </div>
                      {r.company && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Building2 className="h-3 w-3" />
                          {r.company}
                          {r.location && <span className="ml-2">· {r.location}</span>}
                          {r.salaryRange && <span className="ml-2">· {r.salaryRange}</span>}
                        </div>
                      )}
                      {r.analysis && (
                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">{r.analysis}</p>
                      )}
                      {r.error && (
                        <p className="text-xs text-red-600 mt-1">评分失败：{r.error}</p>
                      )}
                    </div>
                    <div className="flex-shrink-0 flex items-center gap-2">
                      {r.error ? (
                        <Badge variant="danger" className="text-xs">N/A</Badge>
                      ) : (
                        <Badge
                          variant={r.score >= 70 ? "success" : r.score >= 40 ? "warning" : "danger"}
                          className="text-xs"
                        >
                          {r.score}分
                        </Badge>
                      )}
                      {r.url && (
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700"
                          title="打开岗位详情"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
