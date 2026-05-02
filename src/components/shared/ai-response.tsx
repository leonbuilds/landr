import { cn } from "@/lib/utils"

interface AiResponseProps {
  content: string
  isLoading?: boolean
  className?: string
}

export function AiResponse({ content, isLoading, className }: AiResponseProps) {
  if (isLoading) {
    return (
      <div className={cn("rounded-lg border bg-white p-6", className)}>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-blue-600" />
          <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-blue-600 [animation-delay:0.15s]" />
          <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-blue-600 [animation-delay:0.3s]" />
          <span className="ml-2">AI正在分析...</span>
        </div>
      </div>
    )
  }

  if (!content) return null

  return (
    <div className={cn("rounded-lg border bg-white p-6", className)}>
      <div className="prose prose-sm max-w-none whitespace-pre-wrap text-gray-700">
        {content}
      </div>
    </div>
  )
}
