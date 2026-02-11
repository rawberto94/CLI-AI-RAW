'use client'

import React from 'react'

interface KeyTermObject {
  name?: string
  label?: string
  term?: string
  value?: string | { value?: string }
}

type KeyTerm = string | KeyTermObject

export function KeyTermBadge({ term }: { term: KeyTerm }) {
  // Handle various possible formats for key terms
  const displayText = typeof term === 'string' 
    ? term 
    : term?.name || term?.label || term?.term || 
      (typeof term?.value === 'string' ? term.value : term?.value?.value) || 
      'Unknown Term'
  
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
      {displayText}
    </span>
  )
}
