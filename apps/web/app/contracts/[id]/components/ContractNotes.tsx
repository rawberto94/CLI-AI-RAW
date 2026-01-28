'use client'

import React, { memo, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import {
  MessageSquare,
  Send,
  MoreVertical,
  Edit2,
  Trash2,
  Loader2,
  Pin,
  Reply,
} from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState } from './EmptyState'

interface Note {
  id: string
  content: string
  createdAt: Date
  updatedAt?: Date
  author: {
    id: string
    name: string
    avatar?: string
  }
  isPinned?: boolean
}

interface ContractNotesProps {
  contractId: string
  notes: Note[]
  currentUserId: string
  onAddNote: (content: string) => Promise<void>
  onEditNote: (id: string, content: string) => Promise<void>
  onDeleteNote: (id: string) => Promise<void>
  onPinNote: (id: string, pinned: boolean) => Promise<void>
}

const NoteItem = memo(function NoteItem({
  note,
  currentUserId,
  onEdit,
  onDelete,
  onPin,
}: {
  note: Note
  currentUserId: string
  onEdit: (content: string) => Promise<void>
  onDelete: () => Promise<void>
  onPin: (pinned: boolean) => Promise<void>
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(note.content)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
  const isOwner = note.author.id === currentUserId
  
  const handleSave = async () => {
    if (!editContent.trim()) return
    setIsSaving(true)
    try {
      await onEdit(editContent)
      setIsEditing(false)
    } finally {
      setIsSaving(false)
    }
  }
  
  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await onDelete()
    } finally {
      setIsDeleting(false)
    }
  }
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "p-3 rounded-lg border transition-colors",
        note.isPinned ? "bg-amber-50 border-amber-200" : "bg-white border-slate-200"
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={note.author.avatar} />
          <AvatarFallback className="text-xs bg-slate-100">
            {note.author.name.split(' ').map(n => n[0]).join('')}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-800">{note.author.name}</span>
              <span className="text-xs text-slate-400">
                {formatDistanceToNow(note.createdAt, { addSuffix: true })}
              </span>
              {note.updatedAt && (
                <span className="text-xs text-slate-400">(edited)</span>
              )}
              {note.isPinned && (
                <Pin className="h-3 w-3 text-amber-500 fill-amber-500" />
              )}
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-slate-600">
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => onPin(!note.isPinned)} className="cursor-pointer">
                  <Pin className={cn("h-4 w-4 mr-2", note.isPinned && "fill-current")} />
                  {note.isPinned ? 'Unpin' : 'Pin note'}
                </DropdownMenuItem>
                {isOwner && (
                  <>
                    <DropdownMenuItem onClick={() => setIsEditing(true)} className="cursor-pointer">
                      <Edit2 className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={handleDelete} 
                      disabled={isDeleting}
                      className="cursor-pointer text-red-600 focus:text-red-600"
                    >
                      {isDeleting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-2" />
                      )}
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          {isEditing ? (
            <div className="space-y-2">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[80px] text-sm"
                placeholder="Edit your note..."
              />
              <div className="flex items-center gap-2 justify-end">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => { setIsEditing(false); setEditContent(note.content) }}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleSave}
                  disabled={isSaving || !editContent.trim()}
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{note.content}</p>
          )}
        </div>
      </div>
    </motion.div>
  )
})

export const ContractNotes = memo(function ContractNotes({
  contractId,
  notes,
  currentUserId,
  onAddNote,
  onEditNote,
  onDeleteNote,
  onPinNote,
}: ContractNotesProps) {
  const [newNote, setNewNote] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [showInput, setShowInput] = useState(false)
  
  const handleAdd = async () => {
    if (!newNote.trim()) return
    setIsAdding(true)
    try {
      await onAddNote(newNote)
      setNewNote('')
      setShowInput(false)
      toast.success('Note added')
    } catch {
      toast.error('Failed to add note')
    } finally {
      setIsAdding(false)
    }
  }
  
  const sortedNotes = [...notes].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1
    if (!a.isPinned && b.isPinned) return 1
    return b.createdAt.getTime() - a.createdAt.getTime()
  })
  
  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-violet-500" />
            Notes & Comments
            {notes.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full">
                {notes.length}
              </span>
            )}
          </CardTitle>
          {!showInput && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowInput(true)}
              className="h-7 text-xs"
            >
              <Reply className="h-3.5 w-3.5 mr-1.5" />
              Add Note
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Add Note Input */}
        <AnimatePresence>
          {showInput && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2"
            >
              <Textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a note or comment..."
                className="min-h-[80px] text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    handleAdd()
                  }
                }}
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400">⌘+Enter to submit</p>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => { setShowInput(false); setNewNote('') }}
                    disabled={isAdding}
                  >
                    Cancel
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={handleAdd}
                    disabled={isAdding || !newNote.trim()}
                  >
                    {isAdding ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5 mr-1.5" />
                        Post
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Notes List */}
        {sortedNotes.length > 0 ? (
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {sortedNotes.map((note) => (
                <NoteItem
                  key={note.id}
                  note={note}
                  currentUserId={currentUserId}
                  onEdit={(content) => onEditNote(note.id, content)}
                  onDelete={() => onDeleteNote(note.id)}
                  onPin={(pinned) => onPinNote(note.id, pinned)}
                />
              ))}
            </AnimatePresence>
          </div>
        ) : !showInput ? (
          <EmptyState
            type="notes"
            className="py-6"
            action={{
              label: 'Add note',
              onClick: () => setShowInput(true),
            }}
          />
        ) : null}
      </CardContent>
    </Card>
  )
})
