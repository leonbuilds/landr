"use client"

import { useDraggable } from "@dnd-kit/core"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Building2, Calendar, BellRing } from "lucide-react"
import type { Application } from "@/types"
import { describeFollowup } from "@/lib/followup"

interface ApplicationCardProps {
  application: Application
  onClick: () => void
}

export function ApplicationCard({ application, onClick }: ApplicationCardProps) {
  const followup = describeFollowup(application.nextFollowup)
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: String(application.id),
  })

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <Card
        className={`cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${
          isDragging ? "opacity-50 shadow-lg" : ""
        } ${followup?.overdue ? "border-red-300 bg-red-50/40" : ""}`}
        onClick={onClick}
      >
        <CardContent className="p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-medium line-clamp-1">
              {application.job?.title || "未知岗位"}
            </h4>
            {application.matchScore != null && (
              <Badge
                variant={application.matchScore >= 70 ? "success" : application.matchScore >= 40 ? "warning" : "danger"}
                className="text-xs flex-shrink-0"
              >
                {application.matchScore}分
              </Badge>
            )}
          </div>

          {application.job?.company && (
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Building2 className="h-3 w-3" />
              {application.job.company}
            </div>
          )}

          {application.appliedAt && (
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Calendar className="h-3 w-3" />
              {new Date(application.appliedAt).toLocaleDateString("zh-CN")}
            </div>
          )}

          {followup && (
            <div
              className={`flex items-center gap-1 text-xs font-medium ${
                followup.overdue
                  ? "text-red-600"
                  : followup.dueToday
                  ? "text-orange-600"
                  : "text-blue-600"
              }`}
            >
              <BellRing className="h-3 w-3" />
              {followup.label}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
