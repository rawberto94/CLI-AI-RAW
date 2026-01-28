import * as React from "react"

import { cn } from "@/lib/utils"

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[100px] w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm shadow-sm transition-all duration-200",
          "placeholder:text-slate-400 dark:placeholder:text-slate-500",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 focus-visible:border-violet-400 dark:focus-visible:border-violet-600",
          "hover:border-slate-300 dark:hover:border-slate-600",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-slate-800",
          "resize-none",
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