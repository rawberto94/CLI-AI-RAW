'use client'

/**
 * React Hook for WebSocket Connection
 * 
 * Provides a simple interface for components to connect to WebSocket
 * and subscribe to real-time updates.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

export interface ProgressUpdate {
  jobId: string
  userId: string
  stage: string
  progress: number
  message: string
  timestamp: Date
  metadata?: Record<string, any>
}

export interface BackgroundJobUpdate {
  jobId: string
  userId: string
  type: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  result?: any
  error?: string
  timestamp: Date
}

export interface UseSocketOptions {
  userId?: string
  autoConnect?: boolean
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: any) => void
}

export function useSocket(options: UseSocketOptions = {}) {
  const {
    userId,
    autoConnect = true,
    onConnect,
    onDisconnect,
    onError
  } = options

  const [isConnected, setIsConnected] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const socketRef = useRef<Socket | null>(null)

  // Initialize socket connection
  useEffect(() => {
    if (!autoConnect) return

    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || window.location.origin
    const socket = io(socketUrl, {
      path: '/api/socket',
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    })

    socketRef.current = socket

    // Connection event handlers
    socket.on('connect', () => {
      console.log('Socket connected:', socket.id)
      setIsConnected(true)
      onConnect?.()

      // Authenticate if userId is provided
      if (userId) {
        socket.emit('authenticate', { userId })
      }
    })

    socket.on('disconnect', () => {
      console.log('Socket disconnected')
      setIsConnected(false)
      setIsAuthenticated(false)
      onDisconnect?.()
    })

    socket.on('authenticated', () => {
      console.log('Socket authenticated')
      setIsAuthenticated(true)
    })

    socket.on('authentication_error', (data) => {
      console.error('Authentication error:', data)
      setIsAuthenticated(false)
      onError?.(data)
    })

    socket.on('error', (error) => {
      console.error('Socket error:', error)
      onError?.(error)
    })

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error)
      onError?.(error)
    })

    // Cleanup on unmount
    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [autoConnect, userId, onConnect, onDisconnect, onError])

  // Subscribe to job progress updates
  const subscribeToJob = useCallback((jobId: string, callback: (update: ProgressUpdate) => void) => {
    const socket = socketRef.current
    if (!socket) {
      console.warn('Socket not initialized')
      return () => {}
    }

    // Subscribe to job
    socket.emit('subscribe:job', jobId)

    // Listen for progress updates
    const handler = (update: ProgressUpdate) => {
      if (update.jobId === jobId) {
        callback(update)
      }
    }

    socket.on('progress:update', handler)

    // Return cleanup function
    return () => {
      socket.emit('unsubscribe:job', jobId)
      socket.off('progress:update', handler)
    }
  }, [])

  // Subscribe to background jobs
  const subscribeToBackgroundJobs = useCallback((callback: (update: BackgroundJobUpdate) => void) => {
    const socket = socketRef.current
    if (!socket) {
      console.warn('Socket not initialized')
      return () => {}
    }

    // Subscribe to background jobs
    socket.emit('subscribe:background-jobs')

    // Listen for background job updates
    socket.on('background-job:update', callback)

    // Return cleanup function
    return () => {
      socket.off('background-job:update', callback)
    }
  }, [])

  // Listen for job completion
  const onJobComplete = useCallback((callback: (data: any) => void) => {
    const socket = socketRef.current
    if (!socket) {
      console.warn('Socket not initialized')
      return () => {}
    }

    socket.on('job:complete', callback)

    return () => {
      socket.off('job:complete', callback)
    }
  }, [])

  // Listen for job errors
  const onJobError = useCallback((callback: (data: any) => void) => {
    const socket = socketRef.current
    if (!socket) {
      console.warn('Socket not initialized')
      return () => {}
    }

    socket.on('job:error', callback)

    return () => {
      socket.off('job:error', callback)
    }
  }, [])

  // Manual connect/disconnect
  const connect = useCallback(() => {
    socketRef.current?.connect()
  }, [])

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect()
  }, [])

  return {
    socket: socketRef.current,
    isConnected,
    isAuthenticated,
    connect,
    disconnect,
    subscribeToJob,
    subscribeToBackgroundJobs,
    onJobComplete,
    onJobError
  }
}

/**
 * Hook for tracking a specific job's progress
 */
export function useJobProgress(jobId: string | null) {
  const [progress, setProgress] = useState<ProgressUpdate | null>(null)
  const [isComplete, setIsComplete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { subscribeToJob, onJobComplete, onJobError } = useSocket({
    userId: 'demo-user-id', // TODO: Get from auth context
    autoConnect: true
  })

  useEffect(() => {
    if (!jobId) return

    // Subscribe to progress updates
    const unsubscribeProgress = subscribeToJob(jobId, (update) => {
      setProgress(update)
    })

    // Listen for completion
    const unsubscribeComplete = onJobComplete((data) => {
      if (data.jobId === jobId) {
        setIsComplete(true)
      }
    })

    // Listen for errors
    const unsubscribeError = onJobError((data) => {
      if (data.jobId === jobId) {
        setError(data.error)
      }
    })

    return () => {
      unsubscribeProgress()
      unsubscribeComplete()
      unsubscribeError()
    }
  }, [jobId, subscribeToJob, onJobComplete, onJobError])

  return {
    progress,
    isComplete,
    error
  }
}
