'use client'

import { useState, useCallback, useRef } from 'react'
import { toast } from 'sonner'

interface OptimisticUpdateOptions<T> {
  onSuccess?: (data: T) => void
  onError?: (error: Error, rollback: () => void) => void
  successMessage?: string
  errorMessage?: string
  rollbackOnError?: boolean
}

interface OptimisticState<T> {
  data: T
  isUpdating: boolean
  error: Error | null
}

/**
 * Hook for optimistic updates with automatic rollback
 * Shows immediate UI feedback while the API call completes
 */
export function useOptimisticUpdate<T>(
  initialData: T,
  options: OptimisticUpdateOptions<T> = {}
) {
  const {
    onSuccess,
    onError,
    successMessage,
    errorMessage = 'Update failed',
    rollbackOnError = true,
  } = options

  const [state, setState] = useState<OptimisticState<T>>({
    data: initialData,
    isUpdating: false,
    error: null,
  })

  const previousDataRef = useRef<T>(initialData)

  const update = useCallback(
    async (
      newData: T | ((prev: T) => T),
      apiCall: () => Promise<T | void>
    ): Promise<boolean> => {
      // Store previous data for rollback
      previousDataRef.current = state.data

      // Calculate new data
      const nextData = typeof newData === 'function' 
        ? (newData as (prev: T) => T)(state.data) 
        : newData

      // Optimistically update UI immediately
      setState(prev => ({
        ...prev,
        data: nextData,
        isUpdating: true,
        error: null,
      }))

      try {
        // Execute the actual API call
        const result = await apiCall()
        
        // Update with server response if provided
        const finalData = (result !== undefined && result !== null ? result : nextData) as T
        setState(prev => ({
          ...prev,
          data: finalData,
          isUpdating: false,
        }))

        if (successMessage) {
          toast.success(successMessage)
        }
        
        onSuccess?.(finalData)
        return true
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        
        // Rollback if configured
        if (rollbackOnError) {
          setState(prev => ({
            ...prev,
            data: previousDataRef.current,
            isUpdating: false,
            error: err,
          }))
        } else {
          setState(prev => ({
            ...prev,
            isUpdating: false,
            error: err,
          }))
        }

        toast.error(errorMessage)
        onError?.(err, () => {
          setState(prev => ({
            ...prev,
            data: previousDataRef.current,
          }))
        })
        
        return false
      }
    },
    [state.data, onSuccess, onError, successMessage, errorMessage, rollbackOnError]
  )

  const reset = useCallback(() => {
    setState({
      data: initialData,
      isUpdating: false,
      error: null,
    })
  }, [initialData])

  return {
    data: state.data,
    isUpdating: state.isUpdating,
    error: state.error,
    update,
    reset,
    setData: (data: T) => setState(prev => ({ ...prev, data })),
  }
}

/**
 * Hook for optimistic toggle operations (favorite, bookmark, etc.)
 */
export function useOptimisticToggle(
  initialValue: boolean,
  apiCall: (newValue: boolean) => Promise<void>,
  options: {
    onMessage?: string
    offMessage?: string
    errorMessage?: string
  } = {}
) {
  const [isOn, setIsOn] = useState(initialValue)
  const [isUpdating, setIsUpdating] = useState(false)

  const toggle = useCallback(async () => {
    const previousValue = isOn
    const newValue = !isOn

    // Optimistic update
    setIsOn(newValue)
    setIsUpdating(true)

    try {
      await apiCall(newValue)
      
      const message = newValue ? options.onMessage : options.offMessage
      if (message) {
        toast.success(message)
      }
    } catch {
      // Rollback
      setIsOn(previousValue)
      toast.error(options.errorMessage || 'Action failed')
    } finally {
      setIsUpdating(false)
    }
  }, [isOn, apiCall, options])

  return { isOn, isUpdating, toggle, setIsOn }
}

/**
 * Hook for optimistic list operations (add, remove, reorder)
 */
export function useOptimisticList<T extends { id: string }>(
  initialItems: T[],
  options: OptimisticUpdateOptions<T[]> = {}
) {
  const [items, setItems] = useState(initialItems)
  const [isUpdating, setIsUpdating] = useState(false)
  const previousItemsRef = useRef(initialItems)

  const addItem = useCallback(
    async (item: T, apiCall: () => Promise<T | void>) => {
      previousItemsRef.current = items
      
      // Optimistic add
      setItems(prev => [...prev, item])
      setIsUpdating(true)

      try {
        const result = await apiCall()
        if (result) {
          // Update with server response
          setItems(prev => prev.map(i => i.id === item.id ? result : i))
        }
        if (options.successMessage) toast.success(options.successMessage)
      } catch {
        // Rollback
        setItems(previousItemsRef.current)
        toast.error(options.errorMessage || 'Failed to add item')
      } finally {
        setIsUpdating(false)
      }
    },
    [items, options]
  )

  const removeItem = useCallback(
    async (id: string, apiCall: () => Promise<void>) => {
      previousItemsRef.current = items
      
      // Optimistic remove
      setItems(prev => prev.filter(i => i.id !== id))
      setIsUpdating(true)

      try {
        await apiCall()
        if (options.successMessage) toast.success(options.successMessage)
      } catch {
        // Rollback
        setItems(previousItemsRef.current)
        toast.error(options.errorMessage || 'Failed to remove item')
      } finally {
        setIsUpdating(false)
      }
    },
    [items, options]
  )

  const updateItem = useCallback(
    async (id: string, updates: Partial<T>, apiCall: () => Promise<T | void>) => {
      previousItemsRef.current = items
      
      // Optimistic update
      setItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i))
      setIsUpdating(true)

      try {
        const result = await apiCall()
        if (result) {
          setItems(prev => prev.map(i => i.id === id ? result : i))
        }
        if (options.successMessage) toast.success(options.successMessage)
      } catch {
        // Rollback
        setItems(previousItemsRef.current)
        toast.error(options.errorMessage || 'Failed to update item')
      } finally {
        setIsUpdating(false)
      }
    },
    [items, options]
  )

  const reorderItems = useCallback(
    async (newOrder: T[], apiCall: () => Promise<void>) => {
      previousItemsRef.current = items
      
      // Optimistic reorder
      setItems(newOrder)
      setIsUpdating(true)

      try {
        await apiCall()
        if (options.successMessage) toast.success(options.successMessage)
      } catch {
        // Rollback
        setItems(previousItemsRef.current)
        toast.error(options.errorMessage || 'Failed to reorder items')
      } finally {
        setIsUpdating(false)
      }
    },
    [items, options]
  )

  return {
    items,
    isUpdating,
    addItem,
    removeItem,
    updateItem,
    reorderItems,
    setItems,
  }
}
