"use client"

import * as React from "react"
import * as SeparatorPrimitive from "@radix-ui/react-separator"

import { cn } from "@/lib/utils"

interface SeparatorProps extends React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root> {
  variant?: 'default' | 'gradient' | 'dashed'
}

const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  SeparatorProps
>(
  (
    { className, orientation = "horizontal", decorative = true, variant = 'default', ...props },
    ref
  ) => (
    <SeparatorPrimitive.Root
      ref={ref}
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "shrink-0",
        variant === 'default' && "bg-slate-200 dark:bg-slate-700",
        variant === 'gradient' && "bg-gradient-to-r from-transparent via-violet-300 dark:via-violet-700 to-transparent",
        variant === 'dashed' && "border-slate-200 dark:border-slate-700 border-dashed",
        orientation === "horizontal" 
          ? variant === 'dashed' ? "h-0 w-full border-t" : "h-[1px] w-full" 
          : variant === 'dashed' ? "w-0 h-full border-l" : "h-full w-[1px]",
        className
      )}
      {...props}
    />
  )
)
Separator.displayName = SeparatorPrimitive.Root.displayName

export { Separator }
