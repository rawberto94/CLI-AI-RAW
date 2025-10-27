/**
 * Server-Sent Events (SSE) Progress Tracking
 * Real-time updates for artifact generation
 */

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

// Simple in-memory event emitter for progress events
// In production, use Redis PubSub for multi-instance support
class ProgressTracker {
  private listeners: Map<string, Set<(event: ArtifactProgressEvent) => void>> = new Map()

  subscribe(contractId: string, callback: (event: ArtifactProgressEvent) => void) {
    if (!this.listeners.has(contractId)) {
      this.listeners.set(contractId, new Set())
    }
    this.listeners.get(contractId)!.add(callback)

    // Return unsubscribe function
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

  emit(event: ArtifactProgressEvent) {
    const callbacks = this.listeners.get(event.contractId)
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(event)
        } catch (error) {
          console.error('Error in progress callback:', error)
        }
      })
    }
  }

  // Helper to create progress events
  createEvent(
    contractId: string,
    stage: ArtifactProgressEvent['stage'],
    progress: number,
    message: string,
    options: Partial<ArtifactProgressEvent> = {}
  ): ArtifactProgressEvent {
    return {
      contractId,
      stage,
      progress,
      message,
      timestamp: new Date().toISOString(),
      ...options
    }
  }
}

export const progressTracker = new ProgressTracker()

// Convenience functions for artifact generator
export function emitProgress(
  contractId: string,
  stage: ArtifactProgressEvent['stage'],
  progress: number,
  message: string,
  options?: Partial<ArtifactProgressEvent>
) {
  progressTracker.emit(
    progressTracker.createEvent(contractId, stage, progress, message, options)
  )
}

export function emitArtifactComplete(
  contractId: string,
  artifactType: string,
  data: any,
  progress: number
) {
  emitProgress(
    contractId,
    artifactType.toLowerCase() as any,
    progress,
    `✅ ${artifactType} artifact generated`,
    { artifactType, data }
  )
}

export function emitError(
  contractId: string,
  stage: ArtifactProgressEvent['stage'],
  error: string
) {
  emitProgress(
    contractId,
    'failed',
    100,
    `❌ ${error}`,
    { error, stage }
  )
}
