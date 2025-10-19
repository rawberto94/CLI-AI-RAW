/**
 * WebSocket Server for Real-time Progress Updates
 * 
 * This module sets up a Socket.IO server for real-time communication
 * between the server and clients for progress tracking.
 */

import { Server as HTTPServer } from 'http'
import { Server as SocketIOServer, Socket } from 'socket.io'

export interface ProgressEvent {
  jobId: string
  userId: string
  stage: string
  progress: number
  message: string
  timestamp: Date
  metadata?: Record<string, any>
}

export interface BackgroundJobEvent {
  jobId: string
  userId: string
  type: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  result?: any
  error?: string
  timestamp: Date
}

let io: SocketIOServer | null = null

/**
 * Initialize WebSocket server
 */
export function initializeWebSocketServer(httpServer: HTTPServer): SocketIOServer {
  if (io) {
    return io
  }

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3005',
      methods: ['GET', 'POST'],
      credentials: true
    },
    path: '/api/socket',
    transports: ['websocket', 'polling']
  })

  io.on('connection', (socket: Socket) => {
    console.log('Client connected:', socket.id)

    // Handle authentication
    socket.on('authenticate', async (data: { userId: string; token?: string }) => {
      try {
        // TODO: Implement actual authentication
        // For now, just store userId in socket data
        socket.data.userId = data.userId
        socket.data.authenticated = true

        // Join user-specific room
        socket.join(`user:${data.userId}`)

        socket.emit('authenticated', { success: true })
        console.log(`User ${data.userId} authenticated`)
      } catch (error) {
        socket.emit('authentication_error', { error: 'Authentication failed' })
      }
    })

    // Subscribe to specific job updates
    socket.on('subscribe:job', (jobId: string) => {
      if (!socket.data.authenticated) {
        socket.emit('error', { message: 'Not authenticated' })
        return
      }

      socket.join(`job:${jobId}`)
      console.log(`Socket ${socket.id} subscribed to job ${jobId}`)
    })

    // Unsubscribe from job updates
    socket.on('unsubscribe:job', (jobId: string) => {
      socket.leave(`job:${jobId}`)
      console.log(`Socket ${socket.id} unsubscribed from job ${jobId}`)
    })

    // Subscribe to background jobs
    socket.on('subscribe:background-jobs', () => {
      if (!socket.data.authenticated) {
        socket.emit('error', { message: 'Not authenticated' })
        return
      }

      const userId = socket.data.userId
      socket.join(`background-jobs:${userId}`)
      console.log(`Socket ${socket.id} subscribed to background jobs for user ${userId}`)
    })

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id)
    })

    // Handle errors
    socket.on('error', (error) => {
      console.error('Socket error:', error)
    })
  })

  console.log('WebSocket server initialized')
  return io
}

/**
 * Get the Socket.IO server instance
 */
export function getSocketServer(): SocketIOServer | null {
  return io
}

/**
 * Emit progress update to specific job subscribers
 */
export function emitProgressUpdate(event: ProgressEvent): void {
  if (!io) {
    console.warn('Socket.IO server not initialized')
    return
  }

  // Emit to job-specific room
  io.to(`job:${event.jobId}`).emit('progress:update', event)

  // Also emit to user-specific room
  io.to(`user:${event.userId}`).emit('progress:update', event)

  console.log(`Progress update emitted for job ${event.jobId}: ${event.stage} - ${event.progress}%`)
}

/**
 * Emit background job update
 */
export function emitBackgroundJobUpdate(event: BackgroundJobEvent): void {
  if (!io) {
    console.warn('Socket.IO server not initialized')
    return
  }

  // Emit to user's background jobs room
  io.to(`background-jobs:${event.userId}`).emit('background-job:update', event)

  // Also emit to user-specific room
  io.to(`user:${event.userId}`).emit('background-job:update', event)

  console.log(`Background job update emitted for user ${event.userId}: ${event.type} - ${event.status}`)
}

/**
 * Emit job completion
 */
export function emitJobComplete(jobId: string, userId: string, result: any): void {
  if (!io) {
    console.warn('Socket.IO server not initialized')
    return
  }

  const event = {
    jobId,
    userId,
    result,
    timestamp: new Date()
  }

  io.to(`job:${jobId}`).emit('job:complete', event)
  io.to(`user:${userId}`).emit('job:complete', event)

  console.log(`Job completion emitted for job ${jobId}`)
}

/**
 * Emit job error
 */
export function emitJobError(jobId: string, userId: string, error: string): void {
  if (!io) {
    console.warn('Socket.IO server not initialized')
    return
  }

  const event = {
    jobId,
    userId,
    error,
    timestamp: new Date()
  }

  io.to(`job:${jobId}`).emit('job:error', event)
  io.to(`user:${userId}`).emit('job:error', event)

  console.log(`Job error emitted for job ${jobId}:`, error)
}

/**
 * Get connected clients count
 */
export function getConnectedClientsCount(): number {
  if (!io) {
    return 0
  }

  return io.engine.clientsCount
}

/**
 * Get clients in a specific room
 */
export async function getClientsInRoom(room: string): Promise<string[]> {
  if (!io) {
    return []
  }

  const sockets = await io.in(room).fetchSockets()
  return sockets.map(socket => socket.id)
}
