/**
 * Processing Status Broadcaster
 * Broadcasts contract processing status updates via WebSocket
 */

// Try to import websocket service if available (API context)
let webSocketService: any = null;
try {
  // Use dynamic import to avoid build errors
  const wsModule = require('../../../apps/api/services/websocket-service');
  webSocketService = wsModule.webSocketService;
} catch (e) {
  // WebSocket service not available in this context (likely web/frontend)
  console.warn('WebSocket service not available - status updates will not be broadcast');
}

import { JobStatus } from '@prisma/client';

export interface ProcessingStatusUpdate {
  contractId: string;
  jobId: string;
  status: JobStatus;
  progress: number;
  currentStep: string | null;
  error: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  duration?: number;
}

export interface ProcessingEvent {
  type: 'processing' | 'completed' | 'failed' | 'progress';
  contractId: string;
  jobId: string;
  data: any;
}

export class ProcessingStatusBroadcaster {
  private tenantId: string;

  constructor(tenantId: string = 'default') {
    this.tenantId = tenantId;
  }

  /**
   * Helper to safely send messages via WebSocket if available
   */
  private safeSend(method: 'sendToSubscribers' | 'broadcastToTenant', ...args: any[]) {
    if (webSocketService && typeof webSocketService[method] === 'function') {
      try {
        webSocketService[method](...args);
      } catch (error) {
        console.warn(`Failed to send WebSocket message:`, error);
      }
    }
  }

  /**
   * Broadcast processing started event
   */
  broadcastProcessingStarted(
    contractId: string,
    jobId: string,
    step: string
  ): void {
    const message = {
      type: 'contract:processing',
      data: {
        contractId,
        jobId,
        status: 'PROCESSING',
        progress: 0,
        currentStep: step,
        startedAt: new Date().toISOString(),
      },
      timestamp: new Date(),
    };

    this.safeSend('sendToSubscribers', 
      this.tenantId,
      'contract:processing',
      message
    );

    // Also broadcast to general contract updates
    this.safeSend('broadcastToTenant', this.tenantId, message);
  }

  /**
   * Broadcast progress update
   */
  broadcastProgress(
    contractId: string,
    jobId: string,
    progress: number,
    step: string
  ): void {
    const message = {
      type: 'contract:progress',
      data: {
        contractId,
        jobId,
        status: 'PROCESSING',
        progress: Math.min(100, Math.max(0, progress)),
        currentStep: step,
      },
      timestamp: new Date(),
    };

    this.safeSend('sendToSubscribers', 
      this.tenantId,
      'contract:processing',
      message
    );
  }

  /**
   * Broadcast processing completed event
   */
  broadcastCompleted(
    contractId: string,
    jobId: string,
    result?: any
  ): void {
    const message = {
      type: 'contract:completed',
      data: {
        contractId,
        jobId,
        status: 'COMPLETED',
        progress: 100,
        currentStep: 'Completed',
        completedAt: new Date().toISOString(),
        result,
      },
      timestamp: new Date(),
    };

    this.safeSend('sendToSubscribers', 
      this.tenantId,
      'contract:processing',
      message
    );

    // Broadcast to all tenant connections
    this.safeSend('broadcastToTenant', this.tenantId, message);
  }

  /**
   * Broadcast processing failed event
   */
  broadcastFailed(
    contractId: string,
    jobId: string,
    error: string
  ): void {
    const message = {
      type: 'contract:failed',
      data: {
        contractId,
        jobId,
        status: 'FAILED',
        currentStep: 'Failed',
        error,
        completedAt: new Date().toISOString(),
      },
      timestamp: new Date(),
    };

    this.safeSend('sendToSubscribers', 
      this.tenantId,
      'contract:processing',
      message
    );

    // Broadcast to all tenant connections
    this.safeSend('broadcastToTenant', this.tenantId, message);
  }

  /**
   * Broadcast full status update
   */
  broadcastStatusUpdate(update: ProcessingStatusUpdate): void {
    const eventType = this.getEventType(update.status);
    
    const message = {
      type: `contract:${eventType}`,
      data: {
        contractId: update.contractId,
        jobId: update.jobId,
        status: update.status,
        progress: update.progress,
        currentStep: update.currentStep,
        error: update.error,
        startedAt: update.startedAt?.toISOString(),
        completedAt: update.completedAt?.toISOString(),
        duration: update.duration,
      },
      timestamp: new Date(),
    };

    this.safeSend('sendToSubscribers', 
      this.tenantId,
      'contract:processing',
      message
    );
  }

  /**
   * Broadcast worker step completion
   */
  broadcastWorkerStep(
    contractId: string,
    jobId: string,
    workerType: string,
    status: 'started' | 'completed' | 'failed',
    data?: any
  ): void {
    const message = {
      type: 'contract:worker:step',
      data: {
        contractId,
        jobId,
        workerType,
        status,
        timestamp: new Date().toISOString(),
        ...data,
      },
      timestamp: new Date(),
    };

    this.safeSend('sendToSubscribers', 
      this.tenantId,
      'contract:processing',
      message
    );
  }

  /**
   * Broadcast batch processing update
   */
  broadcastBatchUpdate(
    batchId: string,
    totalContracts: number,
    completed: number,
    failed: number,
    processing: number
  ): void {
    const message = {
      type: 'contract:batch:update',
      data: {
        batchId,
        totalContracts,
        completed,
        failed,
        processing,
        progress: Math.floor((completed + failed) / totalContracts * 100),
      },
      timestamp: new Date(),
    };

    this.safeSend('broadcastToTenant', this.tenantId, message);
  }

  /**
   * Send status update to specific user
   */
  sendToUser(
    userId: string,
    contractId: string,
    jobId: string,
    update: Partial<ProcessingStatusUpdate>
  ): void {
    const message = {
      type: 'contract:status',
      data: {
        contractId,
        jobId,
        ...update,
      },
      timestamp: new Date(),
    };

    webSocketService.sendToUser(this.tenantId, userId, message);
  }

  /**
   * Get event type from job status
   */
  private getEventType(status: JobStatus): string {
    switch (status) {
      case 'PENDING':
        return 'queued';
      case 'PROCESSING':
        return 'processing';
      case 'COMPLETED':
        return 'completed';
      case 'FAILED':
        return 'failed';
      default:
        return 'status';
    }
  }
}

// Export singleton instance
export const processingStatusBroadcaster = new ProcessingStatusBroadcaster();
