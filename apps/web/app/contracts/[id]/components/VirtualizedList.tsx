'use client'

import React, { memo, useCallback, useMemo, useRef, useState, useEffect } from 'react'
import { motion as _motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface VirtualizedListProps<T> {
  items: T[]
  itemHeight: number
  containerHeight: number
  renderItem: (item: T, index: number) => React.ReactNode
  overscan?: number
  className?: string
  emptyState?: React.ReactNode
  keyExtractor?: (item: T, index: number) => string
}

/**
 * Virtualized list component for rendering large lists efficiently.
 * Only renders visible items + overscan buffer.
 */
export function VirtualizedList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 3,
  className,
  emptyState,
  keyExtractor = (_, index) => String(index),
}: VirtualizedListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  const { startIndex, endIndex: _endIndex, offsetTop, visibleItems } = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
    const end = Math.min(
      items.length,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    )

    return {
      startIndex: start,
      endIndex: end,
      offsetTop: start * itemHeight,
      visibleItems: items.slice(start, end),
    }
  }, [scrollTop, itemHeight, containerHeight, items, overscan])

  const totalHeight = items.length * itemHeight

  if (items.length === 0 && emptyState) {
    return <>{emptyState}</>
  }

  return (
    <div
      ref={containerRef}
      className={cn("overflow-auto", className)}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ position: 'absolute', top: offsetTop, left: 0, right: 0 }}>
          {visibleItems.map((item, idx) => (
            <div
              key={keyExtractor(item, startIndex + idx)}
              style={{ height: itemHeight }}
            >
              {renderItem(item, startIndex + idx)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Simple virtualized list for dynamic heights (less performant but flexible)
 */
interface DynamicVirtualizedListProps<T> {
  items: T[]
  estimatedItemHeight: number
  containerHeight: number
  renderItem: (item: T, index: number) => React.ReactNode
  className?: string
  emptyState?: React.ReactNode
}

export function DynamicVirtualizedList<T>({
  items,
  estimatedItemHeight,
  containerHeight,
  renderItem,
  className,
  emptyState,
}: DynamicVirtualizedListProps<T>) {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 })
  const containerRef = useRef<HTMLDivElement>(null)
  const itemHeights = useRef<Map<number, number>>(new Map())

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          const index = parseInt(entry.target.getAttribute('data-index') || '0')
          if (entry.isIntersecting) {
            itemHeights.current.set(index, entry.boundingClientRect.height)
          }
        })
      },
      { root: container, threshold: 0 }
    )

    const items = container.querySelectorAll('[data-index]')
    items.forEach(item => observer.observe(item))

    return () => observer.disconnect()
  }, [visibleRange])

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight } = e.currentTarget
    const itemsPerScreen = Math.ceil(clientHeight / estimatedItemHeight)
    const start = Math.max(0, Math.floor(scrollTop / estimatedItemHeight) - 5)
    const end = Math.min(items.length, start + itemsPerScreen + 10)
    setVisibleRange({ start, end })
  }, [estimatedItemHeight, items.length])

  if (items.length === 0 && emptyState) {
    return <>{emptyState}</>
  }

  return (
    <div
      ref={containerRef}
      className={cn("overflow-auto", className)}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ paddingTop: visibleRange.start * estimatedItemHeight }}>
        {items.slice(visibleRange.start, visibleRange.end).map((item, idx) => (
          <div key={visibleRange.start + idx} data-index={visibleRange.start + idx}>
            {renderItem(item, visibleRange.start + idx)}
          </div>
        ))}
      </div>
      <div style={{ height: (items.length - visibleRange.end) * estimatedItemHeight }} />
    </div>
  )
}

/**
 * Hook for windowing/virtualization logic
 */
export function useVirtualization<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  overscan = 3
) {
  const [scrollTop, setScrollTop] = useState(0)

  const virtualData = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
    const end = Math.min(
      items.length,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    )

    return {
      startIndex: start,
      endIndex: end,
      offsetTop: start * itemHeight,
      totalHeight: items.length * itemHeight,
      visibleItems: items.slice(start, end),
      visibleCount: end - start,
    }
  }, [scrollTop, itemHeight, containerHeight, items, overscan])

  const handleScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  return {
    ...virtualData,
    handleScroll,
    scrollTop,
    setScrollTop,
  }
}

export default memo(VirtualizedList) as typeof VirtualizedList
