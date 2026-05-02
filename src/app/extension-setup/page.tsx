"use client"

import { useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Copy, CheckCircle2, XCircle, ExternalLink } from "lucide-react"

export default function ExtensionSetupPage() {
  const { isAuthenticated, isLoading, getHeaders } = useAuth()
  const [apiKey, setApiKey] = useState("")
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [testing, setTesting] = useState(false)
  const [generating, setGenerating] = useState(false)

  if (isLoading) return <div className="p-6 text-gray-500">加载中...</div>
  if (!isAuthenticated) return <div className="p-6 text-gray-500">请先登录</div>

  const generateKey = async () => {
    setGenerating(true)
    const res = await fetch("/api/auth/api-key", { method: "POST", headers: getHeaders() })
    const json = await res.json()
    if (json.data) setApiKey(json.data.key)
    setGenerating(false)
  }

  const testConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch("/api/auth/verify-api-key", { headers: { "X-API-Key": apiKey } })
      const data = await res.json()
      setTestResult({ ok: data.valid, msg: data.valid ? "连接成功" : data.message || "无效" })
    } catch {
      setTestResult({ ok: false, msg: "无法连接服务器" })
    }
    setTesting(false)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">浏览器插件设置</h1>

      <Card>
        <CardHeader>
          <CardTitle>API Key</CardTitle>
          <CardDescription>为Chrome扩展生成API Key，用于从招聘网站采集岗位。此页面运行在本地服务器上，无需担心CORS问题。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              type={apiKey.includes("*") ? "text" : "text"}
              value={apiKey}
              readOnly
              placeholder="点击下方按钮生成"
              className="font-mono text-sm"
            />
            <Button
              variant="outline"
              size="sm"
              disabled={!apiKey}
              onClick={() => { navigator.clipboard.writeText(apiKey); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
            >
              {copied ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>

          <div className="flex gap-2">
            <Button onClick={generateKey} disabled={generating}>
              {apiKey ? "重新生成" : "生成API Key"}
            </Button>
            <Button variant="outline" onClick={testConnection} disabled={!apiKey || testing}>
              {testing ? "测试中..." : "测试连接"}
            </Button>
            {testResult && (
              <span className={`inline-flex items-center gap-1 text-sm ${testResult.ok ? "text-green-600" : "text-red-600"}`}>
                {testResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {testResult.msg}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>安装步骤</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 text-sm list-decimal pl-5">
            <li>
              打开 Chrome 扩展管理页
              <Button variant="link" size="sm" className="px-1" onClick={() => window.open("chrome://extensions/", "_blank")}>
                chrome://extensions/ <ExternalLink className="h-3 w-3 ml-1" />
              </Button>
            </li>
            <li>开启右上角 <strong>开发者模式</strong></li>
            <li>点击 <strong>加载已解压的扩展程序</strong>，选择项目的 <code className="bg-gray-100 px-1 rounded text-xs">extension/</code> 文件夹</li>
            <li>
              右键Chrome工具栏的插件图标 → <strong>选项</strong>，在弹出页面中粘贴上方的API Key
            </li>
            <li>或者直接在本页点击 <strong>测试连接</strong>（本页运行在localhost，无CORS问题）</li>
            <li>浏览Boss直聘/LinkedIn/拉勾/智联/小红书 → 点击右下角浮窗按钮采集岗位</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}
