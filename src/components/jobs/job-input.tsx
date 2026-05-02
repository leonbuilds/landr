"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Copy, CheckCircle2, ExternalLink } from "lucide-react"

interface JobInputProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  getHeaders: () => Record<string, string>
}

export function JobInput({ open, onOpenChange, onSuccess, getHeaders }: JobInputProps) {
  const [tab, setTab] = useState("manual")
  const [title, setTitle] = useState("")
  const [jdText, setJdText] = useState("")
  const [parseWithAI, setParseWithAI] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Extension tab state
  const [apiKey, setApiKey] = useState("")
  const [apiKeyLoading, setApiKeyLoading] = useState(false)
  const [apiKeyCopied, setApiKeyCopied] = useState(false)
  const [apiKeyNew, setApiKeyNew] = useState(false)

  const fetchApiKey = async () => {
    setApiKeyLoading(true)
    try {
      const res = await fetch("/api/auth/api-key", { headers: getHeaders() })
      const json = await res.json()
      if (json.data) {
        // For new keys, show full key. For existing, show masked.
        if (json.data.isNew) {
          setApiKey(json.data.key)
          setApiKeyNew(true)
        } else {
          setApiKey(json.data.key)
          setApiKeyNew(false)
        }
      }
    } catch {} finally { setApiKeyLoading(false) }
  }

  const regenerateKey = async () => {
    setApiKeyLoading(true)
    try {
      const res = await fetch("/api/auth/api-key", {
        method: "POST",
        headers: getHeaders(),
      })
      const json = await res.json()
      if (json.data) {
        setApiKey(json.data.key)
        setApiKeyNew(true)
      }
    } catch {} finally { setApiKeyLoading(false) }
  }

  useEffect(() => {
    if (open && tab === "extension") { fetchApiKey() }
  }, [open, tab]) // eslint-disable-line react-hooks/exhaustive-deps

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
          <DialogDescription>手动粘贴JD或使用浏览器插件采集</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="manual" className="flex-1">手动粘贴</TabsTrigger>
            <TabsTrigger value="extension" className="flex-1">浏览器插件</TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="space-y-4 pt-4">
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
          </TabsContent>

          <TabsContent value="extension" className="space-y-4 pt-4">
            <div className="rounded-lg border bg-blue-50/50 p-4 space-y-3">
              <p className="text-sm font-medium text-blue-800">安装步骤</p>
              <ol className="text-xs text-blue-700 space-y-2 list-decimal pl-4">
                <li>打开 Chrome 扩展管理页 <code className="bg-blue-100 px-1 rounded">chrome://extensions/</code></li>
                <li>开启右上角&ldquo;开发者模式&rdquo;</li>
                <li>点击&ldquo;加载已解压的扩展程序&rdquo;</li>
                <li>选择项目的 <code className="bg-blue-100 px-1 rounded">extension/</code> 文件夹</li>
                <li>复制下方 API Key 粘贴到扩展的选项页中</li>
                <li>浏览招聘网站，点击右下角浮窗按钮采集岗位</li>
              </ol>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">扩展 API Key</label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={apiKey}
                  readOnly
                  placeholder={apiKeyLoading ? "加载中..." : "点击下方按钮生成"}
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(apiKey)
                    setApiKeyCopied(true)
                    setTimeout(() => setApiKeyCopied(false), 2000)
                  }}
                  disabled={!apiKey || apiKey === "****"}
                >
                  {apiKeyCopied ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              {apiKeyNew && (
                <p className="text-xs text-green-600">新Key已生成，请立即复制！关闭后将以脱敏形式显示。</p>
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={apiKey ? regenerateKey : fetchApiKey}
                  disabled={apiKeyLoading}
                >
                  {apiKey ? "重新生成" : "生成API Key"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open("chrome://extensions/", "_blank")}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  打开扩展管理
                </Button>
              </div>
            </div>

            <p className="text-xs text-gray-400">
              安装完成后，在Boss直聘、LinkedIn、拉勾、智联、小红书浏览岗位时，页面右下角会出现&ldquo;采集到AI求职Agent&rdquo;浮窗按钮。
            </p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
