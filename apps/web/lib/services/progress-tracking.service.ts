/**
 * Progress Tracking Service
 * 
 * Manages progress events, WebSocket broadcasting, and database persistence
 * for long-running operations like contract processing.
 */

import { PrismaClient } from '@prisma/client'
import { emitProgressUpdate, emitBackgroundJobUpdate, emitJobComplete, emitJobError } from '../websocket/emit'

const prisma = new PrismaClient()

export interface ProgressStage {
  name: string
  weight: number // Percentage of total progress
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  message?: string
  startTime?: Date
  endTime?: Date
  error?: string
}

export interface JobProgress {
  jobId: string
  userId: string
  type: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  currentStage: string
  overallProgress: number
  stages: ProgressStage[]
  startTime: Date
  endTime?: Date
  result?: any
  error?: string
  metadata?: Record<string, any>
}

export class ProgressTrackingService {
  private jobId: string
  private userId: string
  private type: string
  private stages: ProgressStage[]
  private currentStageIndex: number = 0
  private startTime: Date

  constructor(jobId: string, userId: string, type: string, stages: ProgressStage[]) {
    this.jobId = jobId
    this.userId = userId
    this.type = type
    this.stages = stages
    this.startTime = new Date()
  }

  /**
   * Start tracking progress
   */
  async start(): Promise<void> {
    // Create progress event in database
    await prisma.progressEvent.create({
      data: {
        jobId: this.jobId,
        userId: this.userId,
        stage: this.stages[0].name,
        progress: 0,
        message: 'Starting...',
        metadata: {
          type: this.type,
          stages: this.stages.map(s => s.name)
        }
      }
    })

    // Emit WebSocket event
    emitProgressUpdate({
      jobId: this.jobId,
      userId: this.userId,
      stage: 'starting',
      progress: 0,
      message: 'Starting...',
      timestamp: new Date(),
      metadata: {
        type: this.type,
        totalStages: this.stages.length
      }
    })
  }

  /**
   * Update progress for current stage
   */
  async updateStage(progress: number, message: string, metadata?: Record<string, any>): Promise<void> {
    const currentStage = this.stages[this.currentStageIndex]
    if (!currentStage) return

    // Calculate overall progress
    const completedWeight = this.stages
      .slice(0, this.currentStageIndex)
      .reduce((sum, stage) => sum + stage.weight, 0)
    
    const currentStageProgress = (progress / 100) * currentStage.weight
    const overallProgress = Math.min(99, completedWeight + currentStageProgress)

    // Update stage status
    if (currentStage.status === 'pending') {
      currentStage.status = 'in_progress'
      currentStage.startTime = new Date()
    }

    currentStage.message = message

    // Save to database
    await prisma.progressEvent.create({
      data: {
        jobId: this.jobId,
        userId: this.userId,
        stage: currentStage.name,
        progress: overallProgress,
        message,
        metadata: {
          ...metadata,
          stageProgress: progress,
          stageName: currentStage.name
        }
      }
    })

    // Emit WebSocket event
    emitProgressUpdate({
      jobId: this.jobId,
      userId: this.userId,
      stage: currentStage.name,
      progress: overallProgress,
      message,
      timestamp: new Date(),
      metadata: {
        ...metadata,
        stageProgress: progress,
        currentStage: this.currentStageIndex + 1,
        totalStages: this.stages.length
      }
    })
  }

  /**
   * Complete current stage and move to next
   */
  async completeStage(message?: string): Promise<void> {
    const currentStage = this.stages[this.currentStageIndex]
    if (!currentStage) return

    currentStage.status = 'completed'
    currentStage.endTime = new Date()
    currentStage.message = message || `${currentStage.name} completed`

    await this.updateStage(100, currentStage.message)

    // Move to next stage
    this.currentStageIndex++

    if (this.currentStageIndex < this.stages.length) {
      const nextStage = this.stages[this.currentStageIndex]
      nextStage.status = 'in_progress'
      nextStage.startTime = new Date()

      await this.updateStage(0, `Starting ${nextStage.name}...`)
    }
  }

  /**
   * Mark current stage as failed
   */
  async failStage(error: string): Promise<void> {
    const currentStage = this.stages[this.currentStageIndex]
    if (!currentStage) return

    currentStage.status = 'failed'
    currentStage.endTime = new Date()
    currentStage.error = error

    // Save to database
    await prisma.progressEvent.create({
      data: {
        jobId: this.jobId,
        userId: this.userId,
        stage: currentStage.name,
        progress: this.getOverallProgress(),
        message: `Failed: ${error}`,
        metadata: {
          error,
          stageName: currentStage.name,
          failed: true
        }
      }
    })

    // Emit error event
    emitJobError(this.jobId, this.userId, error)
  }

  /**
   * Complete the entire job
   */
  async complete(result?: any): Promise<void> {
    // Mark all remaining stages as completed
    for (let i = this.currentStageIndex; i < this.stages.length; i++) {
      this.stages[i].status = 'completed'
      this.stages[i].endTime = new Date()
    }

    // Save final progress event
    await prisma.progressEvent.create({
      data: {
        jobId: this.jobId,
        userId: this.userId,
        stage: 'completed',
        progress: 100,
        message: 'Job completed successfully',
        metadata: {
          result,
          duration: Date.now() - this.startTime.getTime()
        }
      }
    })

    // Emit completion event
    emitJobComplete(this.jobId, this.userId, result)
  }

  /**
   * Fail the entire job
   */
  async fail(error: string): Promise<void> {
    await this.failStage(error)

    // Save final progress event
    await prisma.progressEvent.create({
      data: {
        jobId: this.jobId,
        userId: this.userId,
        stage: 'failed',
        progress: this.getOverallProgress(),
        message: `Job failed: ${error}`,
        metadata: {
          error,
          duration: Date.now() - this.startTime.getTime(),
          failed: true
        }
      }
    })
  }

  /**
   * Get overall progress percentage
   */
  private getOverallProgress(): number {
    const completedWeight = this.stages
      .filter(s => s.status === 'completed')
      .reduce((sum, stage) => sum + stage.weight, 0)

    return Math.min(100, completedWeight)
  }

  /**
   * Get job progress summary
   */
  getProgress(): JobProgress {
    return {
      jobId: this.jobId,
      userId: this.userId,
      type: this.type,
      status: this.getStatus(),
      currentStage: this.stages[this.currentStageIndex]?.name || 'completed',
      overallProgress: this.getOverallProgress(),
      stages: this.stages,
      startTime: this.startTime,
      endTime: this.stages.every(s => s.status === 'completed' || s.status === 'failed')
        ? new Date()
        : undefined
    }
  }

  /**
   * Get job status
   */
  private getStatus(): 'pending' | 'processing' | 'completed' | 'failed' {
    if (this.stages.some(s => s.status === 'failed')) {
      return 'failed'
    }
    if (this.stages.every(s => s.status === 'completed')) {
      return 'completed'
    }
    if (this.stages.some(s => s.status === 'in_progress')) {
      return 'processing'
    }
    return 'pending'
  }
}

/**
 * Get job history for a user
 */
export async function getJobHistory(userId: string, limit: number = 50): Promise<any[]> {
  const events = await prisma.progressEvent.findMany({
    where: { userId },
    orderBy: { timestamp: 'desc' },
    take: limit
  })

  // Group by jobId
  const jobMap = new Map<string, any>()

  for (const event of events) {
    if (!jobMap.has(event.jobId)) {
      jobMap.set(event.jobId, {
        jobId: event.jobId,
        userId: event.userId,
        stage: event.stage,
        progress: event.progress,
        message: event.message,
        timestamp: event.timestamp,
        metadata: event.metadata,
        events: []
      })
    }

    jobMap.get(event.jobId).events.push(event)
  }

  return Array.from(jobMap.values())
}

/**
 * Get specific job progress
 */
export async function getJobProgress(jobId: string): Promise<any[]> {
  return await prisma.progressEvent.findMany({
    where: { jobId },
    orderBy: { timestamp: 'asc' }
  })
}

/**
 * Create a progress tracker for contract processing
 */
export function createContractProcessingTracker(jobId: string, userId: string): ProgressTrackingService {
  const stages: ProgressStage[] = [
    {
      name: 'validation',
      weight: 10,
      status: 'pending'
    },
    {
      name: 'upload',
      weight: 20,
      status: 'pending'
    },
    {
      name: 'extraction',
      weight: 25,
      status: 'pending'
    },
    {
      name: 'analysis',
      weight: 30,
      status: 'pending'
    },
    {
      name: 'artifacts',
      weight: 15,
      status: 'pending'
    }
  ]

  return new ProgressTrackingService(jobId, userId, 'contract-processing', stages)
}
