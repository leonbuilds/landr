"use client"

import { ScoreGauge } from "@/components/resumes/score-gauge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Copy, CheckCircle2, XCircle, Lightbulb } from "lucide-react"
import { useState } from "react"
import type { MatchResult, RewriteResult } from "@/types"

interface MatchVisualProps {
  match: MatchResult
  rewrite: RewriteResult
}

export function MatchVisual({ match, rewrite }: MatchVisualProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    const text = rewrite.rewrittenPoints.join("\n\n")
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-6">
        <div className="relative flex-shrink-0">
          <ScoreGauge score={match.score} />
        </div>
        <div className="flex-1 space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-700">已匹配关键词</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {match.matchedKeywords.map((kw, i) => (
                <Badge key={i} variant="success">{kw}</Badge>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium text-red-700">缺失关键词</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {match.missingKeywords.map((kw, i) => (
                <Badge key={i} variant="danger">{kw}</Badge>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="h-4 w-4 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-700">可补充关键词</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {match.suggestedKeywords.map((kw, i) => (
                <Badge key={i} variant="warning">{kw}</Badge>
              ))}
            </div>
          </div>
        </div>
      </div>

      {match.analysis && (
        <p className="text-sm text-gray-600 bg-blue-50 rounded-lg p-3">{match.analysis}</p>
      )}

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              {match.score >= 80 ? "简历已高度匹配，以下是微调建议" : "AI重写建议"}
            </CardTitle>
            <Button variant="outline" size="sm" onClick={handleCopy}>
              <Copy className="mr-2 h-3 w-3" />
              {copied ? "已复制" : "复制全部"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {rewrite.rewrittenPoints.map((point, i) => (
              <li key={i} className="flex gap-2 text-sm text-gray-700">
                <span className="text-blue-500 flex-shrink-0 font-bold">{i + 1}.</span>
                {point}
              </li>
            ))}
          </ul>
          {rewrite.tips && (
            <p className="mt-4 text-xs text-gray-500 border-t pt-3">{rewrite.tips}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
