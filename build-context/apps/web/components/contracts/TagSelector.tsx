'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { X, Plus } from 'lucide-react'
import { getAllTags, getTagColor, createTag, type Tag } from '@/lib/contracts/tags'

interface TagSelectorProps {
  onSelect: (tagIds: string[]) => void
  onClose: () => void
  preSelected?: string[]
}

export function TagSelector({ onSelect, onClose, preSelected = [] }: TagSelectorProps) {
  const [tags, setTags] = useState<Tag[]>(getAllTags())
  const [selected, setSelected] = useState<string[]>(preSelected)
  const [showCreate, setShowCreate] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('blue')

  const toggleTag = (tagId: string) => {
    if (selected.includes(tagId)) {
      setSelected(selected.filter(id => id !== tagId))
    } else {
      setSelected([...selected, tagId])
    }
  }

  const handleCreateTag = () => {
    if (!newTagName.trim()) return

    const newTag = createTag({
      name: newTagName.trim(),
      color: newTagColor,
    })

    setTags([...tags, newTag])
    setSelected([...selected, newTag.id])
    setNewTagName('')
    setShowCreate(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Select Tags</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Tags List */}
        <div className="space-y-2 max-h-96 overflow-y-auto mb-4">
          {tags.map((tag) => (
            <label
              key={tag.id}
              className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={selected.includes(tag.id)}
                onChange={() => toggleTag(tag.id)}
                className="w-4 h-4 text-violet-600 rounded"
              />
              <Badge className={getTagColor(tag.color) + ' border'}>
                {tag.name}
              </Badge>
              {tag.description && (
                <span className="text-sm text-gray-500 flex-1">{tag.description}</span>
              )}
            </label>
          ))}
        </div>

        {/* Create New Tag */}
        {showCreate ? (
          <div className="border-t pt-4 space-y-3">
            <Input
              placeholder="Tag name"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
            />
            <div className="flex gap-2">
              {['blue', 'green', 'yellow', 'red', 'purple', 'orange', 'pink', 'gray'].map((color) => (
                <button
                  key={color}
                  onClick={() => setNewTagColor(color)}
                  className={`w-8 h-8 rounded-full border-2 ${
                    newTagColor === color ? 'border-gray-900' : 'border-gray-200'
                  } ${getTagColor(color).split(' ')[0]}`}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreateTag} size="sm" className="flex-1">
                Create
              </Button>
              <Button onClick={() => setShowCreate(false)} variant="outline" size="sm">
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCreate(true)}
            className="w-full"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create New Tag
          </Button>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-4 pt-4 border-t">
          <Button onClick={() => onSelect(selected)} className="flex-1">
            Apply {selected.length > 0 && `(${selected.length})`}
          </Button>
          <Button onClick={onClose} variant="outline">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
