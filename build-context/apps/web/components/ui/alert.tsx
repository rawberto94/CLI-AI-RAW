import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const alertVariants = cva(
  "relative w-full rounded-xl border p-4 [&>svg~*]:pl-8 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground shadow-sm",
  {
    variants: {
      variant: {
        default: "bg-white border-slate-200 text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100",
        destructive:
          "border-rose-200 bg-rose-50 text-rose-900 dark:bg-rose-950/50 dark:text-rose-100 dark:border-rose-800/50 [&>svg]:text-rose-600 dark:[&>svg]:text-rose-400",
        success:
          "border-emerald-200 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100 dark:border-emerald-800/50 [&>svg]:text-emerald-600 dark:[&>svg]:text-emerald-400",
        warning:
          "border-amber-200 bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100 dark:border-amber-800/50 [&>svg]:text-amber-600 dark:[&>svg]:text-amber-400",
        info:
          "border-violet-200 bg-violet-50 text-violet-900 dark:bg-violet-950/50 dark:text-violet-100 dark:border-violet-800/50 [&>svg]:text-violet-600 dark:[&>svg]:text-violet-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
))
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-medium leading-none tracking-tight", className)}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }
