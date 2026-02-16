import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-violet-600 text-white shadow-sm shadow-violet-500/25 hover:bg-violet-700",
        secondary:
          "border-transparent bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700",
        destructive:
          "border-transparent bg-red-600 text-white shadow-sm shadow-red-500/25 hover:bg-red-700",
        outline: 
          "border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 bg-violet-50/50 dark:bg-violet-950/30",
        success:
          "border-transparent bg-green-600 text-white shadow-sm shadow-green-500/25 hover:bg-green-700",
        warning:
          "border-transparent bg-amber-500 text-white shadow-sm shadow-amber-500/25 hover:bg-amber-600",
        info:
          "border-transparent bg-violet-600 text-white shadow-sm shadow-violet-500/25 hover:bg-violet-700",
        violet:
          "border-transparent bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-sm shadow-violet-500/30",
        soft:
          "border-violet-200 dark:border-violet-800 bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300",
        glass:
          "border-white/20 bg-white/10 backdrop-blur-md text-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }