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
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 font-mono transition-colors"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-500" />
                <span className="text-emerald-600">Copied</span>
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
