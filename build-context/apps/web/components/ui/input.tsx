import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // Base styles
          "flex h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-base shadow-sm transition-all duration-200",
          // File input styles
          "file:border-0 file:bg-violet-50 dark:file:bg-violet-950 file:text-sm file:font-medium file:text-violet-600 dark:file:text-violet-400 file:mr-3 file:px-3 file:py-1 file:rounded-lg",
          // Placeholder styles
          "placeholder:text-slate-400 dark:placeholder:text-slate-500",
          // Focus states - violet branding
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 focus-visible:ring-offset-1 focus-visible:border-violet-400 dark:focus-visible:border-violet-600",
          // Hover state
          "hover:border-slate-300 dark:hover:border-slate-600",
          // Disabled state
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-slate-800",
          // Error state (when aria-invalid)
          "aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus-visible:ring-red-500/50",
          // Responsive text size
          "md:text-sm",
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
