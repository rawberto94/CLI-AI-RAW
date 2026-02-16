import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // Base styles with improved accessibility & touch targets
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98] touch-manipulation select-none",
  {
    variants: {
      variant: {
        default:
          "bg-violet-600 text-white shadow-md shadow-violet-500/25 hover:bg-violet-700 hover:shadow-lg hover:shadow-violet-500/30",
        destructive:
          "bg-red-600 text-white shadow-sm shadow-red-500/25 hover:bg-red-700 hover:shadow-md",
        outline:
          "border-2 border-violet-200 dark:border-violet-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm shadow-sm hover:bg-violet-50 dark:hover:bg-violet-950/50 hover:border-violet-300 dark:hover:border-violet-700 text-violet-700 dark:text-violet-300",
        secondary:
          "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm hover:bg-slate-200 dark:hover:bg-slate-700",
        ghost: "hover:bg-violet-50 dark:hover:bg-violet-950/50 hover:text-violet-700 dark:hover:text-violet-300",
        link: "text-violet-600 dark:text-violet-400 underline-offset-4 hover:underline",
        success:
          "bg-green-600 text-white shadow-md shadow-green-500/25 hover:bg-green-700 hover:shadow-lg",
        gradient:
          "bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 text-white shadow-lg shadow-violet-500/30 hover:shadow-xl hover:shadow-violet-500/40 hover:scale-[1.02] hover:brightness-110",
        glass:
          "bg-white/10 backdrop-blur-xl border border-white/20 text-white hover:bg-white/20 shadow-xl",
        soft:
          "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-800/40",
      },
      size: {
        // Minimum 44px touch target for accessibility
        default: "h-10 min-h-[44px] px-4 py-2",
        sm: "h-9 min-h-[36px] rounded-md px-3 text-xs",
        lg: "h-11 min-h-[44px] rounded-md px-8",
        icon: "h-10 w-10 min-h-[44px] min-w-[44px]",
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
  loading?: boolean
  loadingText?: string
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, loadingText, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {loadingText || children}
          </>
        ) : (
          children
        )}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
