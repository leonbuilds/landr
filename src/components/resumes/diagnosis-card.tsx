"use client"

import { ScoreGauge } from "@/components/resumes/score-gauge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { DiagnosisResult } from "@/types"

interface DiagnosisCardProps {
  diagnosis: DiagnosisResult
}

export function DiagnosisCard({ diagnosis }: DiagnosisCardProps) {
  return (
    <Card className="mt-4 border-blue-100 bg-blue-50/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-3">
          AI诊断报告
          <Badge variant={diagnosis.score >= 70 ? "success" : diagnosis.score >= 40 ? "warning" : "danger"}>
            {diagnosis.score >= 70 ? "优秀" : diagnosis.score >= 40 ? "良好" : "需改进"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-6">
          <div className="relative flex-shrink-0">
            <ScoreGauge score={diagnosis.score} />
          </div>
          <div className="flex-1 space-y-4">
            {diagnosis.dimensions.map((dim, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{dim.name}</span>
                  <span className="text-sm text-gray-500">{dim.score}分</span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${
                      dim.score >= 70 ? "bg-green-500" : dim.score >= 40 ? "bg-yellow-500" : "bg-red-500"
                    }`}
                    style={{ width: `${dim.score}%` }}
                  />
                </div>
                {dim.suggestions.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {dim.suggestions.map((s, j) => (
                      <li key={j} className="text-xs text-gray-600 flex gap-2">
                        <span className="text-blue-500 flex-shrink-0">•</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
