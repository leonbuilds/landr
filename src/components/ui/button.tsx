import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-[13px] font-semibold tracking-tight transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mesh-lavender)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "text-white shadow-[0_4px_16px_-2px_rgba(167,139,250,0.45),0_0_0_1px_rgba(255,255,255,0.3)_inset] hover:shadow-[0_6px_20px_-2px_rgba(167,139,250,0.55),0_0_0_1px_rgba(255,255,255,0.35)_inset] hover:translate-y-[-1px] [background:linear-gradient(135deg,var(--mesh-lavender),var(--mesh-sky))]",
        destructive:
          "text-white [background:linear-gradient(135deg,var(--mesh-pink),var(--lo))] shadow-[0_4px_16px_-2px_rgba(255,107,157,0.4)] hover:translate-y-[-1px]",
        outline:
          "glass text-[var(--text)] hover:[background:var(--bg-elevated-strong)] hover:translate-y-[-1px] hover:shadow-[0_4px_12px_-2px_rgba(15,15,20,0.08)]",
        secondary:
          "[background:rgba(15,15,20,0.04)] text-[var(--text)] border border-transparent hover:[background:rgba(15,15,20,0.06)]",
        ghost:
          "text-[var(--text-soft)] hover:[background:rgba(255,255,255,0.5)] hover:backdrop-blur-md",
        link: "text-[var(--mesh-lavender)] underline-offset-4 hover:underline font-medium",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-[8px] px-3 text-[12px]",
        lg: "h-11 rounded-[12px] px-6 text-[14px]",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
