'use client'

import React from 'react'

export function KeyTermBadge({ term }: { term: string }) {
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
      {term}
    </span>
  )
}
