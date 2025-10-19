/**
 * WebSocket Event Emitter Utilities
 * 
 * Helper functions to emit WebSocket events from API routes and services
 */

import type { Server as SocketIOServer } from 'socket.io'

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

/**
 * Get the Socket.IO server instance from global
 */
function getIO(): SocketIOServer | null {
  if (typeof global !== 'undefined' && (global as any).io) {
    return (global as any).io
  }
  return null
}

/**
 * Emit progress update to specific job subscribers
 */
export function emitProgressUpdate(event: ProgressEvent): void {
  const io = getIO()
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
  const io = getIO()
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
  const io = getIO()
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
  const io = getIO()
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
 * Helper to emit progress for contract processing stages
 */
export function emitContractProcessingProgress(
  jobId: string,
  userId: string,
  stage: 'validation' | 'upload' | 'extraction' | 'analysis' | 'artifacts',
  progress: number,
  message: string,
  metadata?: Record<string, any>
): void {
  emitProgressUpdate({
    jobId,
    userId,
    stage,
    progress,
    message,
    timestamp: new Date(),
    metadata
  })
}

/**
 * Helper to create a progress emitter function for a specific job
 */
export function createProgressEmitter(jobId: string, userId: string) {
  return (stage: string, progress: number, message: string, metadata?: Record<string, any>) => {
    emitProgressUpdate({
      jobId,
      userId,
      stage,
      progress,
      message,
      timestamp: new Date(),
      metadata
    })
  }
}
