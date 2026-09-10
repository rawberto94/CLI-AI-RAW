'use client'

import { useCallback, type ReactNode } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { FileSearch } from 'lucide-react'
import { buildCitationHref } from '@/lib/ai/citations'
import { cn } from '@/lib/utils'

export interface FindingSourceLinkProps {
  contractId?: string | null
  snippet?: string | null
  heading?: string | null
  startOffset?: number | null
  endOffset?: number | null
  page?: number | null
  className?: string
  children?: ReactNode
}

export function canOpenFindingSource(props: Pick<FindingSourceLinkProps, 'snippet' | 'startOffset' | 'endOffset'>): boolean {
  if (typeof props.startOffset === 'number' && typeof props.endOffset === 'number' && props.endOffset > props.startOffset) {
    return true
  }
  return Boolean(props.snippet && props.snippet.trim().length >= 8)
}

export function FindingSourceLink({
  contractId,
  snippet,
  heading,
  startOffset,
  endOffset,
  page,
  className,
  children,
}: FindingSourceLinkProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const href = contractId
    ? buildCitationHref(
        {
          contractId,
          index: 1,
          heading: heading || undefined,
          startOffset: typeof startOffset === 'number' ? startOffset : undefined,
          endOffset: typeof endOffset === 'number' ? endOffset : undefined,
          snippet: snippet?.trim() || undefined,
          page: typeof page === 'number' && page > 0 ? page : undefined,
        },
        { pathname, searchParams: searchParams?.toString() ?? '' },
      )
    : null

  const open = useCallback(() => {
    if (href) router.push(href)
  }, [href, router])

  if (!href || !canOpenFindingSource({ snippet, startOffset, endOffset })) {
    return null
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        open()
      }}
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-800',
        className,
      )}
    >
      {children ?? (
        <>
          <FileSearch className="h-3 w-3" />
          View in contract
        </>
      )}
    </button>
  )
}
