import * as React from "react"
import { cn } from "@/lib/utils"

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-[10px] border px-3.5 py-2 text-[13.5px] tracking-tight transition-all duration-150 file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
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
Input.displayName = "Input"

export { Input }
