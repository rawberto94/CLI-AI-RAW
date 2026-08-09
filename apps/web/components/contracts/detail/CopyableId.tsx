'use client'

import React, { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export function CopyableId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false)

  const copyId = () => {
    navigator.clipboard.writeText(id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={copyId}
            aria-label={copied ? 'Copied contract id' : 'Copy contract id'}
            className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 font-mono text-xs font-medium leading-4 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-violet-500" />
                <span className="text-violet-600">Copied</span>
              </>
            ) : (
              <>
                <span className="truncate max-w-[100px]">{id.slice(0, 8)}...</span>
                <Copy className="h-3 w-3" />
              </>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-mono text-xs">{id}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
