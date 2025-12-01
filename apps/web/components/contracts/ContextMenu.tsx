'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'
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
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from 'sonner'
import { useOnClickOutside, useEventListener } from '@/hooks'

interface ContextMenuProps {
  x: number
  y: number
  contractId: string
  onClose: () => void
  onDelete?: (contractId: string) => Promise<void> | void
}

export function ContextMenu({ x, y, contractId, onClose, onDelete }: ContextMenuProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on click outside (when dialog is not open)
  const handleClickOutside = useCallback(() => {
    if (!deleteDialogOpen) onClose()
  }, [deleteDialogOpen, onClose])

  useOnClickOutside(menuRef, handleClickOutside, !deleteDialogOpen)

  // Close on Escape key
  useEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !deleteDialogOpen) onClose()
  })

  const handleAction = (action: string) => {
    console.log(`Action: ${action} on contract: ${contractId}`)
    onClose()
  }

  const handleConfirmDelete = async () => {
    setIsDeleting(true)
    try {
      if (onDelete) {
        await onDelete(contractId)
      }
      toast.success('Contract deleted successfully')
      setDeleteDialogOpen(false)
      onClose()
    } catch (error) {
      toast.error('Failed to delete contract')
    } finally {
      setIsDeleting(false)
    }
  }

  // Adjust position to stay within viewport
  const adjustedX = Math.min(x, typeof window !== 'undefined' ? window.innerWidth - 200 : x)
  const adjustedY = Math.min(y, typeof window !== 'undefined' ? window.innerHeight - 300 : y)

  return (
    <div
      ref={menuRef}
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
        onClick={(e) => {
          e.stopPropagation()
          setDeleteDialogOpen(true)
        }}
      >
        <Trash2 className="w-4 h-4" />
        Delete
      </button>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Contract"
        description="Are you sure you want to delete this contract? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}
