'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { 
  Check, 
  X, 
  Lock, 
  Unlock, 
  MessageSquare, 
  History,
  Users,
  AlertCircle,
  Loader2,
  Eye
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWebSocket, type Presence, type DocumentLock } from '@/contexts/websocket-context'
import { toast } from 'sonner'

interface EditHistoryEntry {
  userId: string;
  userName: string;
  value: string;
  timestamp: Date;
}

interface InlineEditorProps {
  /** Field ID for collaboration locking */
  fieldId: string
  /** Current value */
  value: any
  /** Callback when saving */
  onSave: (value: any) => void
  /** Callback when canceling */
  onCancel: () => void
  /** Input type */
  type?: 'text' | 'number' | 'date' | 'textarea'
  /** Placeholder text */
  placeholder?: string
  /** Whether collaboration features are enabled */
  enableCollaboration?: boolean
  /** Current document ID for collaboration */
  documentId?: string
  /** Edit history for this field */
  editHistory?: EditHistoryEntry[]
  /** Whether field is required */
  required?: boolean
  /** Min length for text fields */
  minLength?: number
  /** Max length for text fields */
  maxLength?: number
  /** Validation function */
  validate?: (value: any) => string | null
  /** Show character count */
  showCharCount?: boolean
  /** Allow adding comments */
  enableComments?: boolean
  /** Callback for adding a comment */
  onAddComment?: (comment: string) => void
}

export function InlineEditor({
  fieldId,
  value,
  onSave,
  onCancel,
  type = 'text',
  placeholder,
  enableCollaboration = true,
  documentId,
  editHistory = [],
  required = false,
  minLength,
  maxLength,
  validate,
  showCharCount = false,
  enableComments = false,
  onAddComment,
}: InlineEditorProps) {
  const [editValue, setEditValue] = useState(value || '')
  const [isLocking, setIsLocking] = useState(false)
  const [hasLock, setHasLock] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [showComment, setShowComment] = useState(false)
  const [comment, setComment] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
  
  const ws = useWebSocket()
  const connected = ws?.connected ?? false
  const presence = ws?.presence ?? new Map()
  const locks = ws?.locks ?? new Map()
  const lockSection = ws?.lockSection ?? (async () => false)
  const unlockSection = ws?.unlockSection ?? (() => {})
  const broadcastEdit = ws?.broadcastEdit ?? (() => {})
  const sendComment = ws?.sendComment ?? (() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const onEvent = ws?.onEvent ?? (() => () => {})

  // Get collaborators viewing/editing this field
  const fieldCollaborators = Array.from(presence.values()).filter(
    (user: { selection?: { start?: number } }) => user.selection?.start !== undefined
  )

  // Check if this field is locked by someone else
  const fieldLock = locks.get(fieldId)
  const isLockedByOther = fieldLock && !hasLock

  // Acquire lock on mount if collaboration is enabled
  useEffect(() => {
    if (enableCollaboration && connected && fieldId) {
      setIsLocking(true)
      lockSection(fieldId).then((success: boolean) => {
        setHasLock(success)
        setIsLocking(false)
        if (!success && fieldLock) {
          toast.warning(`This field is being edited by ${fieldLock.userName}`)
        }
      })
    }

    return () => {
      if (hasLock && fieldId) {
        unlockSection(fieldId)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enableCollaboration, connected, fieldId, lockSection, unlockSection])

  // Focus input on mount
  useEffect(() => {
    if (inputRef.current && !isLockedByOther) {
      inputRef.current.focus()
      if ('select' in inputRef.current) {
        inputRef.current.select()
      }
    }
  }, [isLockedByOther])

  // Listen for remote edits
  useEffect(() => {
    if (!enableCollaboration) return

    const unsubscribe = onEvent((event) => {
      if (event.type === 'edit' && event.data) {
        const editData = event.data as { sectionId: string; content: string }
        if (editData.sectionId === fieldId) {
          // Another user edited this field - show notification
          toast.info('Field updated by another user')
        }
      }
    })

    return unsubscribe
     
  }, [enableCollaboration, fieldId, onEvent])

  // Validate value
  const validateValue = useCallback((val: any): string | null => {
    if (required && (!val || String(val).trim() === '')) {
      return 'This field is required'
    }
    if (minLength && String(val).length < minLength) {
      return `Minimum ${minLength} characters required`
    }
    if (maxLength && String(val).length > maxLength) {
      return `Maximum ${maxLength} characters allowed`
    }
    if (validate) {
      return validate(val)
    }
    return null
  }, [required, minLength, maxLength, validate])

  // Handle value change with validation and broadcasting
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newValue = e.target.value
    setEditValue(newValue)
    
    // Clear validation error while typing
    if (validationError) {
      setValidationError(null)
    }

    // Broadcast edit to collaborators
    if (enableCollaboration && connected && hasLock) {
      broadcastEdit(fieldId, newValue)
    }
  }

  const handleSave = async () => {
    // Validate before saving
    const error = validateValue(editValue)
    if (error) {
      setValidationError(error)
      return
    }

    setIsSaving(true)
    
    try {
      let processedValue = editValue
      
      if (type === 'number') {
        processedValue = parseFloat(editValue) || 0
      }
      
      await onSave(processedValue)
      
      // Release lock after successful save
      if (hasLock && fieldId) {
        unlockSection(fieldId)
      }
      
      toast.success('Field updated successfully')
    } catch (error) {
      toast.error('Failed to save changes')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    // Release lock on cancel
    if (hasLock && fieldId) {
      unlockSection(fieldId)
    }
    onCancel()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && type !== 'textarea') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancel()
    }
  }

  const handleAddComment = () => {
    if (comment.trim() && onAddComment) {
      onAddComment(comment)
      if (enableCollaboration && connected) {
        sendComment(fieldId, comment)
      }
      setComment('')
      setShowComment(false)
      toast.success('Comment added')
    }
  }

  const charCount = String(editValue).length

  // If locked by another user, show read-only view
  if (isLockedByOther && fieldLock) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg"
      >
        <Lock className="w-4 h-4 text-amber-600" />
        <span className="text-sm text-amber-700">
          Being edited by {fieldLock.userName}
        </span>
        <Avatar className="h-5 w-5">
          <AvatarFallback className="text-xs bg-amber-500 text-white">
            {fieldLock.userName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </motion.div>
    )
  }

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-2"
    >
      {/* Main editor row */}
      <div className="flex items-start gap-2 min-w-0">
        <div className="flex-1 min-w-0 relative">
          {type === 'textarea' ? (
            <Textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={editValue}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className={cn(
                "min-h-[80px] text-sm resize-none",
                validationError && "border-red-500 focus-visible:ring-red-500"
              )}
              maxLength={maxLength}
              disabled={isLocking || isSaving}
            />
          ) : (
            <Input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type={type}
              value={editValue}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className={cn(
                "h-8 text-sm",
                validationError && "border-red-500 focus-visible:ring-red-500"
              )}
              maxLength={maxLength}
              disabled={isLocking || isSaving}
            />
          )}
          
          {/* Collaborator presence indicators on field */}
          {enableCollaboration && fieldCollaborators.length > 0 && (
            <div className="absolute -top-2 -right-2 flex -space-x-1">
              {(fieldCollaborators as Presence[]).slice(0, 3).map((user) => (
                <TooltipProvider key={user.userId}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Avatar 
                        className="h-4 w-4 border border-white"
                        style={{ borderColor: user.color }}
                      >
                        <AvatarFallback 
                          className="text-[8px]"
                          style={{ backgroundColor: user.color, color: 'white' }}
                        >
                          {user.name.slice(0, 1)}
                        </AvatarFallback>
                      </Avatar>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      {user.name} is viewing
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          {/* Save button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleSave}
                  disabled={isLocking || isSaving || !!validationError}
                  className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Save (Enter)</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Cancel button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <X className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Cancel (Esc)</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* History button */}
          {editHistory.length > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowHistory(!showHistory)}
                    className={cn(
                      "h-8 w-8 p-0 text-slate-500 hover:text-slate-700 hover:bg-slate-100",
                      showHistory && "bg-slate-100"
                    )}
                  >
                    <History className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>View history ({editHistory.length})</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Comment button */}
          {enableComments && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowComment(!showComment)}
                    className={cn(
                      "h-8 w-8 p-0 text-slate-500 hover:text-slate-700 hover:bg-slate-100",
                      showComment && "bg-slate-100"
                    )}
                  >
                    <MessageSquare className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add comment</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Bottom row: validation, char count, lock status */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          {/* Validation error */}
          {validationError && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-1 text-red-600"
            >
              <AlertCircle className="w-3 h-3" />
              <span>{validationError}</span>
            </motion.div>
          )}

          {/* Lock status */}
          {enableCollaboration && (
            <div className="flex items-center gap-1 text-slate-500">
              {isLocking ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Acquiring lock...</span>
                </>
              ) : hasLock ? (
                <>
                  <Lock className="w-3 h-3 text-green-600" />
                  <span className="text-green-600">Locked for editing</span>
                </>
              ) : !connected ? (
                <>
                  <Unlock className="w-3 h-3" />
                  <span>Offline mode</span>
                </>
              ) : null}
            </div>
          )}
        </div>

        {/* Character count */}
        {showCharCount && maxLength && (
          <span className={cn(
            "text-slate-400",
            charCount > maxLength * 0.9 && "text-amber-600",
            charCount >= maxLength && "text-red-600"
          )}>
            {charCount}/{maxLength}
          </span>
        )}
      </div>

      {/* Edit History Panel */}
      <AnimatePresence>
        {showHistory && editHistory.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                <History className="w-3 h-3" />
                Recent changes
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {editHistory.slice(0, 5).map((entry, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center justify-between text-xs p-1 rounded hover:bg-slate-100 cursor-pointer"
                    onClick={() => setEditValue(entry.value)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{entry.userName}</span>
                      <span className="text-slate-400 truncate max-w-[150px]">
                        &ldquo;{entry.value}&rdquo;
                      </span>
                    </div>
                    <span className="text-slate-400">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Comment Panel */}
      <AnimatePresence>
        {showComment && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-2 bg-violet-50 rounded-lg border border-violet-200 space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-violet-600">
                <MessageSquare className="w-3 h-3" />
                Add a comment about this change
              </div>
              <div className="flex gap-2">
                <Input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Why are you making this change?"
                  className="h-7 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddComment()
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={handleAddComment}
                  disabled={!comment.trim()}
                  className="h-7 px-2 text-xs"
                >
                  Add
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collaborators viewing this field */}
      {enableCollaboration && fieldCollaborators.length > 0 && (
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <Eye className="w-3 h-3" />
          <span>
            {(fieldCollaborators as Presence[]).map(u => u.name.split(' ')[0]).join(', ')} 
            {fieldCollaborators.length === 1 ? ' is' : ' are'} viewing
          </span>
        </div>
      )}
    </motion.div>
  )
}
