import * as React from "react"
import { cn } from "@/lib/utils"

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-[10px] border px-3.5 py-2.5 text-[13.5px] tracking-tight transition-all duration-150 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          "[background:rgba(255,255,255,0.5)] backdrop-blur-md border-[rgba(255,255,255,0.7)] placeholder:text-[var(--dim)] text-[var(--text)]",
          "focus-visible:border-[var(--mesh-lavender)] focus-visible:[background:rgba(255,255,255,0.7)] focus-visible:shadow-[0_0_0_3px_rgba(167,139,250,0.12)]",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
