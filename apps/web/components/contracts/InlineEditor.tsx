'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Check, X } from 'lucide-react'

interface InlineEditorProps {
  value: any
  onSave: (value: any) => void
  onCancel: () => void
  type?: 'text' | 'number' | 'date'
}

export function InlineEditor({
  value,
  onSave,
  onCancel,
  type = 'text',
}: InlineEditorProps) {
  const [editValue, setEditValue] = useState(value || '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [])

  const handleSave = () => {
    let processedValue = editValue
    
    if (type === 'number') {
      processedValue = parseFloat(editValue) || 0
    }
    
    onSave(processedValue)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
  }

  const handleBlur = () => {
    // Small delay to allow clicking save button
    setTimeout(() => {
      onCancel()
    }, 150)
  }

  return (
    <div className="flex items-center gap-1 min-w-0">
      <Input
        ref={inputRef}
        type={type}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className="h-8 text-sm min-w-0 flex-1"
        size={Math.max(10, String(editValue).length + 2)}
      />
      <div className="flex gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={handleSave}
          className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
        >
          <Check className="w-3 h-3" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onCancel}
          className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    </div>
  )
}
