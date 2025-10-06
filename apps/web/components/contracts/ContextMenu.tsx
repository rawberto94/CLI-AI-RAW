'use client'

import React, { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Eye,
  Edit3,
  Tag,
  Download,
  Archive,
  Trash2,
  Copy,
  Share,
  GitCompare,
} from 'lucide-react'
import Link from 'next/link'

interface ContextMenuProps {
  x: number
  y: number
  contractId: string
  onClose: () => void
}

export function ContextMenu({ x, y, contractId, onClose }: ContextMenuProps) {
  useEffect(() => {
    const handleClickOutside = () => onClose()
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('click', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('click', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  const handleAction = (action: string) => {
    console.log(`Action: ${action} on contract: ${contractId}`)
    onClose()
  }

  // Adjust position to stay within viewport
  const adjustedX = Math.min(x, window.innerWidth - 200)
  const adjustedY = Math.min(y, window.innerHeight - 300)

  return (
    <div
      className="fixed bg-white border border-gray-200 rounded-lg shadow-lg py-2 z-50 min-w-[180px]"
      style={{
        left: adjustedX,
        top: adjustedY,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* View */}
      <Link href={`/contracts/${contractId}`}>
        <button
          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-3"
          onClick={onClose}
        >
          <Eye className="w-4 h-4" />
          View Details
        </button>
      </Link>

      {/* Edit */}
      <button
        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-3"
        onClick={() => handleAction('edit')}
      >
        <Edit3 className="w-4 h-4" />
        Edit
      </button>

      {/* Add Tags */}
      <button
        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-3"
        onClick={() => handleAction('tag')}
      >
        <Tag className="w-4 h-4" />
        Add Tags
      </button>

      {/* Compare */}
      <button
        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-3"
        onClick={() => handleAction('compare')}
      >
        <GitCompare className="w-4 h-4" />
        Compare
      </button>

      {/* Divider */}
      <div className="border-t border-gray-100 my-1" />

      {/* Copy */}
      <button
        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-3"
        onClick={() => handleAction('copy')}
      >
        <Copy className="w-4 h-4" />
        Copy Link
      </button>

      {/* Share */}
      <button
        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-3"
        onClick={() => handleAction('share')}
      >
        <Share className="w-4 h-4" />
        Share
      </button>

      {/* Export */}
      <button
        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-3"
        onClick={() => handleAction('export')}
      >
        <Download className="w-4 h-4" />
        Export
      </button>

      {/* Archive */}
      <button
        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-3"
        onClick={() => handleAction('archive')}
      >
        <Archive className="w-4 h-4" />
        Archive
      </button>

      {/* Divider */}
      <div className="border-t border-gray-100 my-1" />

      {/* Delete */}
      <button
        className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-3"
        onClick={() => {
          if (confirm('Delete this contract?')) {
            handleAction('delete')
          }
        }}
      >
        <Trash2 className="w-4 h-4" />
        Delete
      </button>
    </div>
  )
}
