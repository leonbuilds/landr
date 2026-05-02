"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Upload, FileText } from "lucide-react"

interface ResumeUploadProps {
  onClose: () => void
  onSuccess: () => void
  getHeaders: () => Record<string, string>
}

export function ResumeUpload({ onClose, onSuccess, getHeaders }: ResumeUploadProps) {
  const [tab, setTab] = useState("file")
  const [text, setText] = useState("")
  const [resumeName, setResumeName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [dragOver, setDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUpload = async () => {
    setError("")
    if (tab === "text" && !text.trim()) {
      setError("请输入简历内容")
      return
    }
    if (tab === "file" && !selectedFile) {
      setError("请选择文件")
      return
    }

    setLoading(true)
    try {
      if (tab === "file" && selectedFile) {
        const formData = new FormData()
        formData.append("file", selectedFile)
        const res = await fetch("/api/resumes", {
          method: "POST",
          headers: { Authorization: getHeaders().Authorization || "" },
          body: formData,
        })
        if (!res.ok) {
          const json = await res.json()
          throw new Error(json.error?.message || "上传失败")
        }
      } else {
        const res = await fetch("/api/resumes", {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({ rawText: text, name: resumeName || "手动粘贴简历" }),
        })
        if (!res.ok) {
          const json = await res.json()
          throw new Error(json.error?.message || "上传失败")
        }
      }
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败")
    } finally {
      setLoading(false)
    }
  }

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) {
      const ext = file.name.split(".").pop()?.toLowerCase()
      if (ext === "pdf" || ext === "docx" || ext === "doc") {
        setSelectedFile(file)
        setError("")
      } else {
        setError("仅支持PDF、Word格式")
      }
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>上传简历</DialogTitle>
          <DialogDescription>支持PDF、Word文件或手动粘贴简历文本</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="file" className="flex-1">上传文件</TabsTrigger>
            <TabsTrigger value="text" className="flex-1">粘贴文本</TabsTrigger>
          </TabsList>

          <TabsContent value="file" className="space-y-4 pt-4">
            <div
              className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
                dragOver ? "border-blue-500 bg-blue-50" : "border-gray-300"
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-10 w-10 text-gray-400 mb-2" />
              <p className="text-sm text-gray-500">拖拽文件到此处，或点击选择</p>
              <p className="text-xs text-gray-400 mt-1">支持 .pdf / .docx</p>
              {selectedFile && (
                <p className="text-sm text-blue-600 mt-2 font-medium">{selectedFile.name}</p>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.doc"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) setSelectedFile(file)
                }}
              />
            </div>
          </TabsContent>

          <TabsContent value="text" className="space-y-4 pt-4">
            <Input
              placeholder="简历名称（可选）"
              value={resumeName}
              onChange={(e) => setResumeName(e.target.value)}
            />
            <Textarea
              placeholder="在此粘贴简历内容..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={12}
            />
          </TabsContent>
        </Tabs>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleUpload} disabled={loading}>
            {loading ? "上传中..." : "确认上传"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
