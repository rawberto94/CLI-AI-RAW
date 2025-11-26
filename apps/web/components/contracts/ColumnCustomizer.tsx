'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  X,
  GripVertical,
  Eye,
  EyeOff,
  RotateCcw,
} from 'lucide-react'
import { TableColumn, DEFAULT_COLUMNS } from '@/lib/contracts/table-config'

interface ColumnCustomizerProps {
  columns: TableColumn[]
  onColumnsChange: (columns: TableColumn[]) => void
  onClose: () => void
}

export function ColumnCustomizer({
  columns,
  onColumnsChange,
  onClose,
}: ColumnCustomizerProps) {
  const [localColumns, setLocalColumns] = useState<TableColumn[]>([...columns])
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  const handleVisibilityToggle = (columnId: string) => {
    setLocalColumns(prev => 
      prev.map(col => 
        col.id === columnId 
          ? { ...col, visible: !col.visible }
          : col
      )
    )
  }

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    
    if (draggedIndex === null || draggedIndex === dropIndex) return

    const newColumns = [...localColumns]
    const draggedColumn = newColumns[draggedIndex]
    if (!draggedColumn) return
    
    // Remove dragged column
    newColumns.splice(draggedIndex, 1)
    
    // Insert at new position
    newColumns.splice(dropIndex, 0, draggedColumn)
    
    setLocalColumns(newColumns)
    setDraggedIndex(null)
  }

  const handleReset = () => {
    setLocalColumns([...DEFAULT_COLUMNS])
  }

  const handleApply = () => {
    onColumnsChange(localColumns)
    onClose()
  }

  const visibleCount = localColumns.filter(col => col.visible).length

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">Customize Columns</h3>
            <Badge variant="outline">
              {visibleCount} visible
            </Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Instructions */}
        <p className="text-sm text-gray-600 mb-4">
          Drag to reorder, click eye to show/hide columns
        </p>

        {/* Columns List */}
        <div className="flex-1 overflow-y-auto space-y-2 mb-4">
          {localColumns.map((column, index) => (
            <div
              key={column.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, index)}
              className={`flex items-center gap-3 p-3 border rounded-lg cursor-move transition-all ${
                column.visible 
                  ? 'border-gray-200 bg-white' 
                  : 'border-gray-100 bg-gray-50'
              } hover:shadow-sm`}
            >
              {/* Drag Handle */}
              <GripVertical className="w-4 h-4 text-gray-400" />
              
              {/* Visibility Toggle */}
              <button
                onClick={() => handleVisibilityToggle(column.id)}
                className="text-gray-500 hover:text-gray-700"
              >
                {column.visible ? (
                  <Eye className="w-4 h-4" />
                ) : (
                  <EyeOff className="w-4 h-4" />
                )}
              </button>
              
              {/* Column Info */}
              <div className="flex-1">
                <div className="font-medium text-gray-900">
                  {column.label}
                </div>
                <div className="text-xs text-gray-500">
                  {column.width} • {column.sortable ? 'Sortable' : 'Not sortable'}
                  {column.editable && ' • Editable'}
                </div>
              </div>
              
              {/* Status Indicators */}
              <div className="flex gap-1">
                {column.sortable && (
                  <Badge variant="outline" className="text-xs">
                    Sort
                  </Badge>
                )}
                {column.editable && (
                  <Badge variant="outline" className="text-xs">
                    Edit
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleReset}
            className="flex-1"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
          <Button onClick={handleApply} className="flex-1">
            Apply Changes
          </Button>
        </div>
      </div>
    </div>
  )
}
