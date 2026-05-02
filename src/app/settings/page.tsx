"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { LoadingSpinner } from "@/components/shared/loading-spinner"
import { Eye, EyeOff, CheckCircle2, XCircle } from "lucide-react"

const MODELS = [
  { key: "deepseek", name: "DeepSeek" },
  { key: "kimi", name: "Kimi (Moonshot)" },
  { key: "qwen", name: "通义千问" },
]

export default function SettingsPage() {
  const { isAuthenticated, isLoading: authLoading, getHeaders, logout } = useAuth()
  const [loading, setLoading] = useState(true)
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({})
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({})
  const [defaultModel, setDefaultModel] = useState("deepseek")
  const [testResults, setTestResults] = useState<Record<string, boolean | null>>({})
  const [testing, setTesting] = useState<Record<string, boolean>>({})

  // Password change
  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [pwMsg, setPwMsg] = useState("")

  // Delete account
  const [showDelete, setShowDelete] = useState(false)

  const fetchSettings = useCallback(async () => {
    const headers = getHeaders()
    const res = await fetch("/api/settings", { headers })
    if (res.ok) {
      const json = await res.json()
      const map: Record<string, string> = {}
      for (const s of json.data) {
        if (s.isApiKey) map[s.key.replace("api_key_", "")] = s.maskedValue || ""
        if (s.key === "default_model") setDefaultModel(s.value || "deepseek")
      }
      setApiKeys(map)
    }
    setLoading(false)
  }, [getHeaders])

  useEffect(() => {
    if (!authLoading && isAuthenticated) fetchSettings()
  }, [authLoading, isAuthenticated, fetchSettings])

  const saveApiKey = async (model: string, key: string) => {
    const headers = getHeaders()
    await fetch("/api/settings", {
      method: "PUT",
      headers,
      body: JSON.stringify({ [`api_key_${model}`]: key }),
    })
    fetchSettings()
  }

  const testConnection = async (model: string) => {
    setTesting((s) => ({ ...s, [model]: true }))
    try {
      const headers = getHeaders()
      const res = await fetch("/api/settings/test", {
        method: "POST",
        headers,
        body: JSON.stringify({ model }),
      })
      const json = await res.json()
      setTestResults((s) => ({ ...s, [model]: json.data.success }))
    } catch {
      setTestResults((s) => ({ ...s, [model]: false }))
    }
    setTesting((s) => ({ ...s, [model]: false }))
  }

  const changePassword = async () => {
    setPwMsg("")
    try {
      const headers = getHeaders()
      const res = await fetch("/api/auth/password", {
        method: "PUT",
        headers,
        body: JSON.stringify({ oldPassword, newPassword }),
      })
      const json = await res.json()
      if (res.ok) {
        setPwMsg("密码修改成功")
        setOldPassword("")
        setNewPassword("")
      } else {
        setPwMsg(json.error?.message || "修改失败")
      }
    } catch {
      setPwMsg("请求失败")
    }
  }

  const deleteAccount = async (password?: string) => {
    try {
      const headers = getHeaders()
      const res = await fetch("/api/auth/account", {
        method: "DELETE",
        headers,
        body: JSON.stringify({ password }),
      })
      if (res.ok) {
        logout()
      } else {
        const json = await res.json()
        alert(json.error?.message || "删除失败")
      }
    } catch {
      alert("请求失败")
    }
  }

  if (authLoading || loading) return <LoadingSpinner message="加载中..." />
  if (!isAuthenticated) return null

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">设置</h1>

      {/* API Keys */}
      <Card>
        <CardHeader>
          <CardTitle>API Key 配置</CardTitle>
          <CardDescription>配置AI模型提供商的API Key，密钥将加密存储</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {MODELS.map(({ key, name }) => (
            <div key={key} className="space-y-2">
              <label className="text-sm font-medium">{name}</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={visibleKeys[key] ? "text" : "password"}
                    placeholder="输入API Key"
                    value={apiKeys[key] || ""}
                    onChange={(e) => setApiKeys((s) => ({ ...s, [key]: e.target.value }))}
                  />
                  <button
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                    onClick={() => setVisibleKeys((s) => ({ ...s, [key]: !s[key] }))}
                  >
                    {visibleKeys[key] ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
                  </button>
                </div>
                <Button variant="outline" size="sm" onClick={() => saveApiKey(key, apiKeys[key] || "")}>
                  保存
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testConnection(key)}
                  disabled={testing[key]}
                >
                  {testing[key] ? "测试中..." : "测试"}
                </Button>
                {testResults[key] !== undefined && (
                  testResults[key]
                    ? <CheckCircle2 className="h-5 w-5 text-green-600 self-center" />
                    : <XCircle className="h-5 w-5 text-red-600 self-center" />
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Default Model */}
      <Card>
        <CardHeader>
          <CardTitle>默认模型</CardTitle>
          <CardDescription>选择AI功能使用的默认模型</CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={defaultModel}
            onValueChange={async (v) => {
              setDefaultModel(v)
              const headers = getHeaders()
              await fetch("/api/settings", {
                method: "PUT",
                headers,
                body: JSON.stringify({ default_model: v }),
              })
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODELS.map(({ key, name }) => (
                <SelectItem key={key} value={key}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Password Change */}
      <Card>
        <CardHeader>
          <CardTitle>修改密码</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="password"
            placeholder="当前密码"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
          />
          <Input
            type="password"
            placeholder="新密码（8-32位，含字母和数字）"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <Button onClick={changePassword}>修改密码</Button>
          {pwMsg && <p className={`text-sm ${pwMsg.includes("成功") ? "text-green-600" : "text-red-600"}`}>{pwMsg}</p>}
        </CardContent>
      </Card>

      {/* Delete Account */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600">删除账号</CardTitle>
          <CardDescription>此操作不可撤销，将删除您的所有数据（简历、岗位、申请记录等）</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => setShowDelete(true)}>删除账号</Button>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        title="确认删除账号"
        description="此操作不可撤销，将删除您的所有数据。请输入密码确认。"
        confirmLabel="确认删除"
        confirmVariant="destructive"
        requirePassword
        onConfirm={deleteAccount}
      />
    </div>
  )
}
