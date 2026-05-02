"use client"

import { useDroppable } from "@dnd-kit/core"
import { cn } from "@/lib/utils"

interface KanbanColumnProps {
  id: string
  title: string
  color: string
  count: number
  children: React.ReactNode
}

export function KanbanColumn({ id, title, color, count, children }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col w-56 min-w-[224px] rounded-lg p-3 transition-colors",
        color,
        isOver && "ring-2 ring-blue-400"
      )}
    >
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        <span className="text-xs bg-white/70 rounded-full px-2 py-0.5 font-medium text-gray-600">
          {count}
        </span>
      </div>
      <div className="flex flex-col gap-2 min-h-[80px]">{children}</div>
    </div>
  )
}
