/**
 * Server-Sent Events (SSE) Progress Tracking via Redis Pub/Sub
 * Workers publish progress via publishJobProgress() → Redis Pub/Sub → this tracker → SSE
 */

import { redisEventBus, RedisEvents, type EventPayload } from '@repo/utils/events/redis-event-bus';

export interface ArtifactProgressEvent {
  contractId: string
  stage: 
    | 'started'
    | 'text_extraction' 
    | 'rag_embeddings' 
    | 'overview' 
    | 'clauses' 
    | 'financial' 
    | 'risk' 
    | 'compliance'
    | 'rate_cards'
    | 'completed'
    | 'failed'
  progress: number // 0-100
  message: string
  artifactType?: string
  data?: any
  estimatedTimeRemaining?: number
  error?: string
  timestamp: string
}

/**
 * Redis-backed progress tracker.
 * Subscribes to JOB_PROGRESS events via Redis Pub/Sub so SSE works across
 * multiple web server instances.
 */
class ProgressTracker {
  private listeners: Map<string, Set<(event: ArtifactProgressEvent) => void>> = new Map()
  private redisUnsub: (() => void) | null = null
  private connected = false

  /**
   * Ensure we are subscribed to the Redis event bus.
   * Safe to call multiple times — only connects once.
   */
  private async ensureConnected(): Promise<void> {
    if (this.connected) return

    await redisEventBus.connect()

    this.redisUnsub = redisEventBus.on(RedisEvents.JOB_PROGRESS, (payload: EventPayload) => {
      const contractId = payload.data.contractId as string | undefined
      if (!contractId) return

      const event: ArtifactProgressEvent = {
        contractId,
        stage: (payload.data.status as ArtifactProgressEvent['stage']) || 'started',
        progress: (payload.data.progress as number) ?? 0,
        message: (payload.data.message as string) || '',
        timestamp: payload.timestamp,
      }

      const callbacks = this.listeners.get(contractId)
      if (callbacks) {
        callbacks.forEach(cb => {
          try { cb(event) } catch { /* callback error */ }
        })
      }
    })

    this.connected = true
  }

  /**
   * Subscribe to progress events for a specific contract.
   * Returns an unsubscribe function.
   */
  async subscribe(contractId: string, callback: (event: ArtifactProgressEvent) => void): Promise<() => void> {
    await this.ensureConnected()

    if (!this.listeners.has(contractId)) {
      this.listeners.set(contractId, new Set())
    }
    this.listeners.get(contractId)!.add(callback)

    return () => {
      const callbacks = this.listeners.get(contractId)
      if (callbacks) {
        callbacks.delete(callback)
        if (callbacks.size === 0) {
          this.listeners.delete(contractId)
        }
      }
    }
  }
}

export const progressTracker = new ProgressTracker()
