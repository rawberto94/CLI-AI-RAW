'use client'

/**
 * useInlineEdit Hook
 * 
 * A hook for managing inline editing state with optional collaboration features.
 * Handles field locking, edit history, and real-time updates.
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { useWebSocket } from '@/contexts/websocket-context'
import { toast } from 'sonner'

interface EditHistoryEntry<T = unknown> {
  userId: string
  userName: string
  value: T
  timestamp: Date
}

interface UseInlineEditOptions<T> {
  /** Field identifier for collaboration */
  fieldId: string
  /** Initial value */
  initialValue: T
  /** Document ID for collaboration context */
  documentId?: string
  /** Enable collaboration features */
  enableCollaboration?: boolean
  /** Auto-save delay in ms (0 to disable) */
  autoSaveDelay?: number
  /** Validation function */
  validate?: (value: T) => string | null
  /** Callback when value changes */
  onChange?: (value: T) => void
  /** Callback when value is saved */
  onSave?: (value: T) => Promise<void>
}

interface UseInlineEditReturn<T> {
  /** Whether currently in edit mode */
  isEditing: boolean
  /** Current edit value */
  value: T
  /** Original value before editing */
  originalValue: T
  /** Whether the field is locked for editing */
  hasLock: boolean
  /** Whether someone else has the lock */
  isLockedByOther: boolean
  /** Lock holder info */
  lockHolder: { userId: string; userName: string } | null
  /** Edit history */
  editHistory: EditHistoryEntry<T>[]
  /** Validation error */
  validationError: string | null
  /** Whether saving is in progress */
  isSaving: boolean
  /** Whether value has changed */
  isDirty: boolean
  /** Start editing */
  startEdit: () => Promise<boolean>
  /** Cancel editing */
  cancelEdit: () => void
  /** Update value */
  setValue: (value: T) => void
  /** Save changes */
  save: () => Promise<boolean>
  /** Collaborators viewing this field */
  viewers: Array<{ userId: string; name: string; color: string }>
}

export function useInlineEdit<T = string>(options: UseInlineEditOptions<T>): UseInlineEditReturn<T> {
  const {
    fieldId,
    initialValue,
    documentId,
    enableCollaboration = true,
    autoSaveDelay = 0,
    validate,
    onChange,
    onSave,
  } = options

  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState<T>(initialValue)
  const [originalValue, setOriginalValue] = useState<T>(initialValue)
  const [hasLock, setHasLock] = useState(false)
  const [lockHolder, setLockHolder] = useState<{ userId: string; userName: string } | null>(null)
  const [editHistory, setEditHistory] = useState<EditHistoryEntry<T>[]>([])
  const [validationError, setValidationError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastBroadcastRef = useRef<string>('')

  const {
    connected,
    presence,
    locks,
    lockSection,
    unlockSection,
    broadcastEdit,
    onEvent,
  } = useWebSocket()

  // Get lock state
  const fieldLock = locks.get(fieldId)
  const isLockedByOther = !!fieldLock && !hasLock

  // Get viewers (collaborators whose selection might be on this field)
  const viewers = Array.from(presence.values())
    .filter(user => user.selection?.start !== undefined)
    .map(user => ({
      userId: user.userId,
      name: user.name,
      color: user.color,
    }))

  // Update lock holder info
  useEffect(() => {
    if (fieldLock && !hasLock) {
      setLockHolder({
        userId: fieldLock.userId,
        userName: fieldLock.userName,
      })
    } else {
      setLockHolder(null)
    }
  }, [fieldLock, hasLock])

  // Listen for remote edits
  useEffect(() => {
    if (!enableCollaboration || !isEditing) return

    const unsubscribe = onEvent((event) => {
      if (event.type === 'edit' && event.data) {
        const editData = event.data as { sectionId: string; content: string; userId: string }
        if (editData.sectionId === fieldId && editData.content !== lastBroadcastRef.current) {
          // Someone else edited this field
          const user = presence.get(editData.userId)
          toast.info(`${user?.name || 'Someone'} is also editing this field`)
        }
      }
    })

    return unsubscribe
  }, [enableCollaboration, isEditing, fieldId, onEvent, presence])

  // Auto-save functionality
  useEffect(() => {
    if (autoSaveDelay > 0 && isEditing && value !== originalValue) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
      autoSaveTimeoutRef.current = setTimeout(() => {
        save()
      }, autoSaveDelay)
    }

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [value, autoSaveDelay, isEditing, originalValue])

  // Start editing
  const startEdit = useCallback(async (): Promise<boolean> => {
    if (isEditing) return true

    // Try to acquire lock if collaboration is enabled
    if (enableCollaboration && connected && fieldId) {
      const gotLock = await lockSection(fieldId)
      if (!gotLock) {
        if (fieldLock) {
          toast.warning(`This field is being edited by ${fieldLock.userName}`)
        }
        return false
      }
      setHasLock(true)
    }

    setOriginalValue(value)
    setIsEditing(true)
    setValidationError(null)
    return true
  }, [isEditing, enableCollaboration, connected, fieldId, lockSection, fieldLock, value])

  // Cancel editing
  const cancelEdit = useCallback(() => {
    // Release lock
    if (hasLock && fieldId) {
      unlockSection(fieldId)
      setHasLock(false)
    }

    // Reset value
    setValue(originalValue)
    setIsEditing(false)
    setValidationError(null)
  }, [hasLock, fieldId, unlockSection, originalValue])

  // Update value
  const handleSetValue = useCallback((newValue: T) => {
    setValue(newValue)
    
    // Clear validation error while typing
    if (validationError) {
      setValidationError(null)
    }

    // Notify parent
    onChange?.(newValue)

    // Broadcast to collaborators
    if (enableCollaboration && connected && hasLock) {
      const stringValue = String(newValue)
      if (stringValue !== lastBroadcastRef.current) {
        lastBroadcastRef.current = stringValue
        broadcastEdit(fieldId, stringValue)
      }
    }
  }, [validationError, onChange, enableCollaboration, connected, hasLock, fieldId, broadcastEdit])

  // Save changes
  const save = useCallback(async (): Promise<boolean> => {
    // Validate
    if (validate) {
      const error = validate(value)
      if (error) {
        setValidationError(error)
        return false
      }
    }

    setIsSaving(true)

    try {
      // Call save callback
      if (onSave) {
        await onSave(value)
      }

      // Add to history
      setEditHistory(prev => [{
        userId: 'current-user',
        userName: 'You',
        value: value as T,
        timestamp: new Date(),
      }, ...prev].slice(0, 10) as EditHistoryEntry<T>[])

      // Release lock
      if (hasLock && fieldId) {
        unlockSection(fieldId)
        setHasLock(false)
      }

      setOriginalValue(value)
      setIsEditing(false)
      return true
    } catch (error) {
      toast.error('Failed to save changes')
      return false
    } finally {
      setIsSaving(false)
    }
  }, [validate, value, onSave, hasLock, fieldId, unlockSection])

  // Sync initial value changes
  useEffect(() => {
    if (!isEditing) {
      setValue(initialValue)
      setOriginalValue(initialValue)
    }
  }, [initialValue, isEditing])

  return {
    isEditing,
    value,
    originalValue,
    hasLock,
    isLockedByOther,
    lockHolder,
    editHistory,
    validationError,
    isSaving,
    isDirty: value !== originalValue,
    startEdit,
    cancelEdit,
    setValue: handleSetValue,
    save,
    viewers,
  }
}

/**
 * Simplified hook for basic inline editing without collaboration
 */
export function useSimpleInlineEdit<T>(
  initialValue: T,
  onSave?: (value: T) => Promise<void>
) {
  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState(initialValue)
  const [isSaving, setIsSaving] = useState(false)

  const startEdit = useCallback(() => {
    setIsEditing(true)
  }, [])

  const cancelEdit = useCallback(() => {
    setValue(initialValue)
    setIsEditing(false)
  }, [initialValue])

  const save = useCallback(async () => {
    if (onSave) {
      setIsSaving(true)
      try {
        await onSave(value)
        setIsEditing(false)
      } finally {
        setIsSaving(false)
      }
    } else {
      setIsEditing(false)
    }
  }, [onSave, value])

  useEffect(() => {
    if (!isEditing) {
      setValue(initialValue)
    }
  }, [initialValue, isEditing])

  return {
    isEditing,
    value,
    setValue,
    isSaving,
    startEdit,
    cancelEdit,
    save,
  }
}
