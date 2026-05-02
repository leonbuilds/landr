"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ResumeUpload } from "@/components/resumes/resume-upload"
import { DiagnosisCard } from "@/components/resumes/diagnosis-card"
import { LoadingSpinner } from "@/components/shared/loading-spinner"
import { FileText, Plus, Trash2 } from "lucide-react"

export default function ResumesPage() {
  const { isAuthenticated, isLoading: authLoading, getHeaders } = useAuth()
  const [resumes, setResumes] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [diagnosing, setDiagnosing] = useState<number | null>(null)
  const [diagnosis, setDiagnosis] = useState<Record<string, unknown> | null>(null)
  const [selectedResume, setSelectedResume] = useState<number | null>(null)

  const fetchResumes = useCallback(async () => {
    const headers = getHeaders()
    const res = await fetch("/api/resumes", { headers })
    if (res.ok) {
      const json = await res.json()
      setResumes(json.data)
    }
    setLoading(false)
  }, [getHeaders])

   
  useEffect(() => {
    if (!authLoading && isAuthenticated) fetchResumes()
  }, [authLoading, isAuthenticated, fetchResumes])

  const handleDelete = async (id: number) => {
    const headers = getHeaders()
    await fetch(`/api/resumes/${id}`, { method: "DELETE", headers })
    fetchResumes()
  }

  const handleDiagnose = async (id: number) => {
    setDiagnosing(id)
    setDiagnosis(null)
    try {
      const headers = getHeaders()
      const res = await fetch(`/api/resumes/${id}/diagnose`, { method: "POST", headers })
      const json = await res.json()
      if (json.data) {
        setDiagnosis(json.data)
        setSelectedResume(id)
      } else {
        alert(json.error?.message || "诊断失败")
      }
    } catch {
      alert("诊断请求失败")
    } finally {
      setDiagnosing(null)
    }
  }

  if (authLoading || loading) return <LoadingSpinner message="加载中..." />
  if (!isAuthenticated) return null

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">我的简历</h1>
        <Button onClick={() => setShowUpload(true)}>
          <Plus className="mr-2 h-4 w-4" />上传简历
        </Button>
      </div>

      {showUpload && (
        <ResumeUpload
          onClose={() => setShowUpload(false)}
          onSuccess={() => { setShowUpload(false); fetchResumes() }}
          getHeaders={getHeaders}
        />
      )}

      {resumes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="h-12 w-12 text-gray-300 mb-4" />
            <p className="text-gray-500 mb-2">还没有简历</p>
            <p className="text-sm text-gray-400 mb-4">点击上传第一份简历</p>
            <Button variant="outline" onClick={() => setShowUpload(true)}>
              <Plus className="mr-2 h-4 w-4" />上传简历
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {resumes.map((resume) => (
            <Card key={resume.id} className="hover:shadow-md transition-shadow">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <FileText className="h-8 w-8 text-blue-600" />
                  <div>
                    <h3 className="font-semibold">{resume.name}</h3>
                    <p className="text-xs text-gray-500">
                      创建于 {new Date(resume.createdAt).toLocaleDateString("zh-CN")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDiagnose(resume.id)}
                    disabled={diagnosing === resume.id}
                  >
                    {diagnosing === resume.id ? "诊断中..." : "AI诊断"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(resume.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
              {selectedResume === resume.id && diagnosis && (
                <div className="px-4 pb-4">
                  <DiagnosisCard diagnosis={diagnosis} />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
