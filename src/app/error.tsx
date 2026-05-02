"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => { console.error("Page error:", error) }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center space-y-4 max-w-md">
        <h1 className="text-2xl font-bold text-gray-800">出错了</h1>
        <p className="text-gray-500">页面发生意外错误，请重试或返回首页。</p>
        <div className="flex gap-3 justify-center">
          <Button onClick={reset} variant="outline">重试</Button>
          <Button onClick={() => window.location.href = "/resumes"}>返回首页</Button>
        </div>
      </div>
    </div>
  )
}
