'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type Options = {
  initialRatio: number
  minRatio: number
  maxRatio: number
}

export function useSplitPaneResize({ initialRatio, minRatio, maxRatio }: Options) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [ratio, setRatioInternal] = useState(initialRatio)
  const [isResizing, setIsResizing] = useState(false)

  const clampRatio = useCallback(
    (nextRatio: number) => Math.max(minRatio, Math.min(maxRatio, nextRatio)),
    [minRatio, maxRatio]
  )

  const setRatio = useCallback(
    (nextRatio: number) => setRatioInternal(clampRatio(nextRatio)),
    [clampRatio]
  )

  const beginResize = useCallback(() => {
    setIsResizing(true)
  }, [])

  const endResize = useCallback(() => {
    setIsResizing(false)
  }, [])

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const container = containerRef.current
      if (!container) return

      const rect = container.getBoundingClientRect()
      const nextRatio = ((e.clientX - rect.left) / rect.width) * 100
      setRatio(nextRatio)
    }

    const handleMouseUp = () => {
      endResize()
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [endResize, isResizing, setRatio])

  const aria = useMemo(
    () => ({
      min: minRatio,
      max: maxRatio,
      now: Math.round(ratio),
    }),
    [maxRatio, minRatio, ratio]
  )

  return {
    containerRef,
    ratio,
    setRatio,
    isResizing,
    beginResize,
    endResize,
    aria,
  }
}
