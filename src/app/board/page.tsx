"use client"

import { useAuth } from "@/hooks/use-auth"
import { Card, CardContent } from "@/components/ui/card"
import { Kanban } from "lucide-react"

export default function BoardPage() {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading || !isAuthenticated) return null

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">申请看板</h1>
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Kanban className="h-12 w-12 text-gray-300 mb-4" />
          <p className="text-gray-500 mb-1">申请看板功能即将上线</p>
          <p className="text-sm text-gray-400">拖拽管理申请状态、查看投递趋势——敬请期待 Phase 2</p>
        </CardContent>
      </Card>
    </div>
  )
}
