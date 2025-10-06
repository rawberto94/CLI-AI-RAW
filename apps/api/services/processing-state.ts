/**
 * Processing State Persistence Service
 * Maintains processing state to survive system restarts
 */

import fs from 'fs/promises';
import path from 'path';

export interface ProcessingState {
  jobId: string;
  contractId: string;
  tenantId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'paused';
  currentStage: string;
  completedStages: string[];
  stageResults: Record<string, any>;
  metadata: {
    filename: string;
    fileSize: number;
    uploadedBy?: string;
    startTime: Date;
    lastUpdateTime: Date;
  };
  errors?: Array<{
    stage: string;
    error: string;
    timestamp: Date;
    retryCount: number;
  }>;
}

export class ProcessingStateManager {
  private stateDir: string;
  private states = new Map<string, ProcessingState>();

  constructor(stateDir: string = './processing-state') {
    this.stateDir = stateDir;
    this.ensureStateDirectory();
    this.loadPersistedStates();
  }

  /**
   * Save processing state
   */
  async saveState(state: ProcessingState): Promise<void> {
    try {
      // Update in-memory state
      this.states.set(state.jobId, {
        ...state,
        metadata: {
          ...state.metadata,
          lastUpdateTime: new Date()
        }
      });

      // Persist to disk
      const filePath = path.join(this.stateDir, `${state.jobId}.json`);
      await fs.writeFile(filePath, JSON.stringify(state, null, 2));
    } catch (error) {
      console.error(`Failed to save state for job ${state.jobId}:`, error);
      throw error;
    }
  }

  /**
   * Load processing state
   */
  async loadState(jobId: string): Promise<ProcessingState | null> {
    try {
      // Check in-memory first
      if (this.states.has(jobId)) {
        return this.states.get(jobId)!;
      }

      // Load from disk
      const filePath = path.join(this.stateDir, `${jobId}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      const state = JSON.parse(data) as ProcessingState;
      
      // Convert date strings back to Date objects
      state.metadata.startTime = new Date(state.metadata.startTime);
      state.metadata.lastUpdateTime = new Date(state.metadata.lastUpdateTime);
      
      if (state.errors) {
        state.errors = state.errors.map(error => ({
          ...error,
          timestamp: new Date(error.timestamp)
        }));
      }

      this.states.set(jobId, state);
      return state;
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return null; // File doesn't exist
      }
      console.error(`Failed to load state for job ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Update stage completion
   */
  async updateStageCompletion(
    jobId: string,
    stage: string,
    result: any,
    nextStage?: string
  ): Promise<void> {
    const state = await this.loadState(jobId);
    if (!state) {
      throw new Error(`State not found for job ${jobId}`);
    }

    // Mark stage as completed
    if (!state.completedStages.includes(stage)) {
      state.completedStages.push(stage);
    }

    // Save stage result
    state.stageResults[stage] = result;

    // Update current stage
    if (nextStage) {
      state.currentStage = nextStage;
    }

    await this.saveState(state);
  }

  /**
   * Update job status
   */
  async updateJobStatus(
    jobId: string,
    status: ProcessingState['status'],
    error?: string
  ): Promise<void> {
    const state = await this.loadState(jobId);
    if (!state) {
      throw new Error(`State not found for job ${jobId}`);
    }

    state.status = status;

    if (error) {
      if (!state.errors) {
        state.errors = [];
      }
      state.errors.push({
        stage: state.currentStage,
        error,
        timestamp: new Date(),
        retryCount: 0
      });
    }

    await this.saveState(state);
  }

  /**
   * Get all active jobs
   */
  async getActiveJobs(): Promise<ProcessingState[]> {
    const activeStates: ProcessingState[] = [];
    
    for (const state of this.states.values()) {
      if (state.status === 'processing' || state.status === 'queued') {
        activeStates.push(state);
      }
    }

    return activeStates;
  }

  /**
   * Get jobs by tenant
   */
  async getJobsByTenant(tenantId: string): Promise<ProcessingState[]> {
    const tenantJobs: ProcessingState[] = [];
    
    for (const state of this.states.values()) {
      if (state.tenantId === tenantId) {
        tenantJobs.push(state);
      }
    }

    return tenantJobs;
  }

  /**
   * Resume interrupted jobs
   */
  async resumeInterruptedJobs(): Promise<ProcessingState[]> {
    const interruptedJobs: ProcessingState[] = [];
    
    for (const state of this.states.values()) {
      if (state.status === 'processing') {
        // Job was processing when system went down
        state.status = 'queued'; // Reset to queued for retry
        await this.saveState(state);
        interruptedJobs.push(state);
      }
    }

    return interruptedJobs;
  }

  /**
   * Clean up completed jobs
   */
  async cleanupCompletedJobs(olderThan: Date): Promise<number> {
    let cleaned = 0;
    
    for (const [jobId, state] of this.states.entries()) {
      if (
        (state.status === 'completed' || state.status === 'failed') &&
        state.metadata.lastUpdateTime < olderThan
      ) {
        // Remove from memory
        this.states.delete(jobId);
        
        // Remove from disk
        try {
          const filePath = path.join(this.stateDir, `${jobId}.json`);
          await fs.unlink(filePath);
          cleaned++;
        } catch (error) {
          console.warn(`Failed to delete state file for job ${jobId}:`, error);
        }
      }
    }

    return cleaned;
  }

  /**
   * Get processing statistics
   */
  getProcessingStats(): {
    total: number;
    byStatus: Record<string, number>;
    byTenant: Record<string, number>;
    averageProcessingTime: number;
    oldestActiveJob?: Date;
  } {
    const states = Array.from(this.states.values());
    const byStatus: Record<string, number> = {};
    const byTenant: Record<string, number> = {};
    let totalProcessingTime = 0;
    let completedJobs = 0;
    let oldestActiveJob: Date | undefined;

    states.forEach(state => {
      byStatus[state.status] = (byStatus[state.status] || 0) + 1;
      byTenant[state.tenantId] = (byTenant[state.tenantId] || 0) + 1;

      if (state.status === 'completed' || state.status === 'failed') {
        const processingTime = state.metadata.lastUpdateTime.getTime() - state.metadata.startTime.getTime();
        totalProcessingTime += processingTime;
        completedJobs++;
      }

      if (state.status === 'processing' || state.status === 'queued') {
        if (!oldestActiveJob || state.metadata.startTime < oldestActiveJob) {
          oldestActiveJob = state.metadata.startTime;
        }
      }
    });

    return {
      total: states.length,
      byStatus,
      byTenant,
      averageProcessingTime: completedJobs > 0 ? totalProcessingTime / completedJobs : 0,
      oldestActiveJob
    };
  }

  /**
   * Create checkpoint for long-running operations
   */
  async createCheckpoint(
    jobId: string,
    checkpointData: any,
    description: string
  ): Promise<void> {
    const state = await this.loadState(jobId);
    if (!state) {
      throw new Error(`State not found for job ${jobId}`);
    }

    // Save checkpoint data
    if (!state.stageResults.checkpoints) {
      state.stageResults.checkpoints = [];
    }

    state.stageResults.checkpoints.push({
      timestamp: new Date(),
      stage: state.currentStage,
      description,
      data: checkpointData
    });

    await this.saveState(state);
  }

  /**
   * Restore from checkpoint
   */
  async restoreFromCheckpoint(
    jobId: string,
    checkpointIndex?: number
  ): Promise<any> {
    const state = await this.loadState(jobId);
    if (!state) {
      throw new Error(`State not found for job ${jobId}`);
    }

    const checkpoints = state.stageResults.checkpoints;
    if (!checkpoints || checkpoints.length === 0) {
      throw new Error(`No checkpoints found for job ${jobId}`);
    }

    // Use latest checkpoint if index not specified
    const checkpoint = checkpoints[checkpointIndex ?? checkpoints.length - 1];
    if (!checkpoint) {
      throw new Error(`Checkpoint ${checkpointIndex} not found for job ${jobId}`);
    }

    return checkpoint.data;
  }

  /**
   * Ensure state directory exists
   */
  private async ensureStateDirectory(): Promise<void> {
    try {
      await fs.access(this.stateDir);
    } catch (error) {
      await fs.mkdir(this.stateDir, { recursive: true });
    }
  }

  /**
   * Load all persisted states on startup
   */
  private async loadPersistedStates(): Promise<void> {
    try {
      const files = await fs.readdir(this.stateDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));

      for (const file of jsonFiles) {
        try {
          const jobId = path.basename(file, '.json');
          await this.loadState(jobId);
        } catch (error) {
          console.warn(`Failed to load state from ${file}:`, error);
        }
      }

      console.log(`Loaded ${this.states.size} persisted processing states`);
    } catch (error) {
      console.warn('Failed to load persisted states:', error);
    }
  }
}

// Export singleton instance
export const processingStateManager = new ProcessingStateManager();