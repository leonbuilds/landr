"use client"

import { useState, useEffect, useCallback } from "react"
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core"
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable"
import { KanbanColumn } from "@/components/board/kanban-column"
import { ApplicationCard } from "@/components/board/application-card"
import type { Application } from "@/types"

const COLUMNS = [
  { id: "draft", title: "待投递", color: "bg-gray-100" },
  { id: "applied", title: "已投递", color: "bg-blue-100" },
  { id: "written_test", title: "笔试中", color: "bg-yellow-100" },
  { id: "interview", title: "面试中", color: "bg-purple-100" },
  { id: "offer", title: "已拿Offer", color: "bg-green-100" },
  { id: "rejected", title: "已拒绝", color: "bg-red-100" },
  { id: "withdrawn", title: "已放弃", color: "bg-gray-200" },
]

interface KanbanBoardProps {
  applications: Application[]
  onStatusChange: (appId: number, newStatus: string) => void
  onCardClick: (app: Application) => void
  getHeaders: () => Record<string, string>
}

export function KanbanBoard({ applications, onStatusChange, onCardClick, getHeaders }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const getAppsByStatus = (status: string) =>
    applications.filter((a) => a.status === status)

  const activeApp = activeId
    ? applications.find((a) => String(a.id) === activeId)
    : null

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over) return

    const appId = parseInt(String(active.id))
    const overId = String(over.id)

    // Check if dropped on a column or another card
    const targetColumn = COLUMNS.find((c) => c.id === overId)
    if (targetColumn) {
      const app = applications.find((a) => a.id === appId)
      if (app && app.status !== targetColumn.id) {
        onStatusChange(appId, targetColumn.id)
      }
      return
    }

    // If dropped on another card, use that card's column
    const overApp = applications.find((a) => String(a.id) === overId)
    if (overApp) {
      const app = applications.find((a) => a.id === appId)
      if (app && app.status !== overApp.status) {
        onStatusChange(appId, overApp.status)
      }
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: "60vh" }}>
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            id={col.id}
            title={col.title}
            color={col.color}
            count={getAppsByStatus(col.id).length}
          >
            {getAppsByStatus(col.id).map((app) => (
              <ApplicationCard
                key={app.id}
                application={app}
                onClick={() => onCardClick(app)}
              />
            ))}
          </KanbanColumn>
        ))}
      </div>

      <DragOverlay>
        {activeApp ? (
          <div className="rotate-2 opacity-90">
            <ApplicationCard application={activeApp} onClick={() => {}} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
