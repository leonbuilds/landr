"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"

interface JobInputProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  getHeaders: () => Record<string, string>
}

export function JobInput({ open, onOpenChange, onSuccess, getHeaders }: JobInputProps) {
  const [title, setTitle] = useState("")
  const [jdText, setJdText] = useState("")
  const [parseWithAI, setParseWithAI] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async () => {
    setError("")
    if (!jdText.trim()) {
      setError("请输入JD内容")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ title, jdText, parseWithAI }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error?.message || "添加失败")
      }
      onSuccess()
      setTitle("")
      setJdText("")
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "添加失败")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>添加岗位</DialogTitle>
          <DialogDescription>粘贴目标岗位的JD，AI将自动解析关键信息</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Input
            placeholder="岗位名称（可选，AI会自动提取）"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <Textarea
            placeholder="在此粘贴JD内容..."
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
            rows={10}
          />

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">AI解析</p>
              <p className="text-xs text-gray-500">自动提取公司、岗位要求、薪资等信息</p>
            </div>
            <Switch checked={parseWithAI} onCheckedChange={setParseWithAI} />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? "添加中..." : "确认添加"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
