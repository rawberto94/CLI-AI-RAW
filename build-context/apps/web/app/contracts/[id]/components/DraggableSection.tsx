'use client'

import React, { memo, useState, useCallback, useRef } from 'react'
import { motion as _motion, Reorder, useDragControls as _useDragControls } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { GripVertical, ChevronUp, ChevronDown, X, Plus as _Plus } from 'lucide-react'

interface DraggableItem {
  id: string
  [key: string]: any
}

interface DraggableSectionProps<T extends DraggableItem> {
  items: T[]
  onReorder: (items: T[]) => void
  renderItem: (item: T, index: number, dragHandle: React.ReactNode) => React.ReactNode
  className?: string
  itemClassName?: string
  disabled?: boolean
}

/**
 * Drag handle component for draggable items
 */
const DragHandle = memo(function DragHandle({ 
  disabled = false,
  className,
}: { 
  disabled?: boolean
  className?: string 
}) {
  return (
    <div 
      className={cn(
        "flex items-center justify-center w-6 h-6 rounded cursor-grab active:cursor-grabbing",
        "text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      aria-label="Drag to reorder"
    >
      <GripVertical className="h-4 w-4" />
    </div>
  )
})

/**
 * Reorderable section with drag-and-drop support
 */
export function DraggableSection<T extends DraggableItem>({
  items,
  onReorder,
  renderItem,
  className,
  itemClassName,
  disabled = false,
}: DraggableSectionProps<T>) {
  return (
    <Reorder.Group
      axis="y"
      values={items}
      onReorder={onReorder}
      className={cn("space-y-2", className)}
    >
      {items.map((item, index) => (
        <Reorder.Item
          key={item.id}
          value={item}
          disabled={disabled}
          className={cn(
            "list-none",
            itemClassName
          )}
          whileDrag={{
            scale: 1.02,
            boxShadow: "0 10px 30px -10px rgba(0,0,0,0.2)",
            zIndex: 10,
          }}
        >
          {renderItem(item, index, <DragHandle disabled={disabled} />)}
        </Reorder.Item>
      ))}
    </Reorder.Group>
  )
}

interface DraggableCardItem extends DraggableItem {
  title: string
  content?: React.ReactNode
  collapsed?: boolean
}

interface DraggableCardListProps {
  items: DraggableCardItem[]
  onReorder: (items: DraggableCardItem[]) => void
  onRemove?: (id: string) => void
  onToggleCollapse?: (id: string) => void
  className?: string
  disabled?: boolean
}

/**
 * Pre-styled draggable card list
 */
export const DraggableCardList = memo(function DraggableCardList({
  items,
  onReorder,
  onRemove,
  onToggleCollapse,
  className,
  disabled = false,
}: DraggableCardListProps) {
  return (
    <DraggableSection
      items={items}
      onReorder={onReorder}
      disabled={disabled}
      className={className}
      renderItem={(item, index, dragHandle) => (
        <Card className="bg-white border-slate-200 transition-shadow hover:shadow-md">
          <CardHeader className="py-3 px-4">
            <div className="flex items-center gap-2">
              {dragHandle}
              <CardTitle className="text-sm font-medium flex-1">
                {item.title}
              </CardTitle>
              <div className="flex items-center gap-1">
                {onToggleCollapse && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => onToggleCollapse(item.id)}
                  >
                    {item.collapsed ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronUp className="h-3 w-3" />
                    )}
                  </Button>
                )}
                {onRemove && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-slate-400 hover:text-red-500"
                    onClick={() => onRemove(item.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          {!item.collapsed && item.content && (
            <CardContent className="pt-0 px-4 pb-4">
              {item.content}
            </CardContent>
          )}
        </Card>
      )}
    />
  )
})

interface DraggableGridItem extends DraggableItem {
  content: React.ReactNode
}

interface DraggableGridProps {
  items: DraggableGridItem[]
  onReorder: (items: DraggableGridItem[]) => void
  columns?: 2 | 3 | 4
  className?: string
  disabled?: boolean
}

/**
 * Draggable grid layout (for dashboard widgets, etc.)
 */
export const DraggableGrid = memo(function DraggableGrid({
  items,
  onReorder,
  columns = 2,
  className,
  disabled = false,
}: DraggableGridProps) {
  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
  }

  return (
    <Reorder.Group
      axis="y"
      values={items}
      onReorder={onReorder}
      className={cn(`grid gap-4 ${gridCols[columns]}`, className)}
    >
      {items.map((item) => (
        <Reorder.Item
          key={item.id}
          value={item}
          disabled={disabled}
          whileDrag={{
            scale: 1.02,
            boxShadow: "0 10px 30px -10px rgba(0,0,0,0.2)",
            zIndex: 10,
          }}
        >
          <div className="relative group">
            <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <DragHandle disabled={disabled} className="bg-white/80 backdrop-blur-sm shadow-sm" />
            </div>
            {item.content}
          </div>
        </Reorder.Item>
      ))}
    </Reorder.Group>
  )
})

/**
 * Hook for managing draggable state
 */
export function useDraggable<T extends DraggableItem>(initialItems: T[]) {
  const [items, setItems] = useState(initialItems)
  const [isDragging, setIsDragging] = useState(false)
  const originalOrderRef = useRef(initialItems)

  const handleReorder = useCallback((newItems: T[]) => {
    setItems(newItems)
  }, [])

  const saveOrder = useCallback(async (saveFn: (items: T[]) => Promise<void>) => {
    try {
      await saveFn(items)
      originalOrderRef.current = items
    } catch {
      // Rollback on error
      setItems(originalOrderRef.current)
      throw new Error('Failed to save order')
    }
  }, [items])

  const resetOrder = useCallback(() => {
    setItems(originalOrderRef.current)
  }, [])

  const addItem = useCallback((item: T, position?: number) => {
    setItems(prev => {
      if (position !== undefined) {
        const newItems = [...prev]
        newItems.splice(position, 0, item)
        return newItems
      }
      return [...prev, item]
    })
  }, [])

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id))
  }, [])

  const moveItem = useCallback((fromIndex: number, toIndex: number) => {
    setItems(prev => {
      const newItems = [...prev]
      const [removed] = newItems.splice(fromIndex, 1)
      newItems.splice(toIndex, 0, removed)
      return newItems
    })
  }, [])

  return {
    items,
    setItems,
    isDragging,
    setIsDragging,
    handleReorder,
    saveOrder,
    resetOrder,
    addItem,
    removeItem,
    moveItem,
    hasChanges: JSON.stringify(items) !== JSON.stringify(originalOrderRef.current),
  }
}

export { DragHandle }
