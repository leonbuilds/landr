import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-tight transition-colors",
  {
    variants: {
      variant: {
        default:
          "text-white [background:linear-gradient(135deg,var(--mesh-lavender),var(--mesh-sky))] shadow-[0_2px_8px_-1px_rgba(167,139,250,0.4)]",
        secondary:
          "[background:rgba(15,15,20,0.06)] text-[var(--text)] border border-[var(--line-hi)]",
        destructive:
          "text-white [background:linear-gradient(135deg,var(--mesh-pink),var(--lo))] shadow-[0_2px_8px_-1px_rgba(255,107,157,0.4)]",
        outline:
          "border border-[var(--line-hi)] text-[var(--text)] bg-white/40",
        success:
          "[background:var(--hi-soft)] text-[var(--hi)] border border-[rgba(16,185,129,0.25)]",
        warning:
          "[background:var(--med-soft)] text-[var(--med)] border border-[rgba(245,158,11,0.25)]",
        danger:
          "[background:var(--lo-soft)] text-[var(--lo)] border border-[rgba(239,68,68,0.25)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
