'use client'

import React, { memo } from 'react'

interface SkipToContentProps {
  targetId?: string
  label?: string
}

/**
 * Accessibility component that allows keyboard users to skip navigation
 * and jump directly to the main content. Only visible when focused.
 */
export const SkipToContent = memo(function SkipToContent({
  targetId = 'main-content',
  label = 'Skip to main content',
}: SkipToContentProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    const target = document.getElementById(targetId)
    if (target) {
      target.focus()
      target.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <a
      href={`#${targetId}`}
      onClick={handleClick}
      className="
        sr-only focus:not-sr-only
        fixed top-4 left-4 z-[100]
        px-4 py-2 rounded-lg
        bg-violet-600 text-white font-medium text-sm
        shadow-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2
        transition-transform transform -translate-y-16 focus:translate-y-0
      "
    >
      {label}
    </a>
  )
})
