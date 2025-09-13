import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { EventEmitter } from 'events';
import { logger } from '../../../packages/utils/src/logging';
import { cache } from '../cache';
import { batchProcessor } from './batch-processor';

interface StreamConnection {
  id: string;
  jobId: string;
  tenantId?: string;
  clientInfo: {
    userAgent?: string;
    ip: string;
    connectedAt: Date;
  };
  reply: FastifyReply;
  lastEventId?: string;
  isAlive: boolean;
}

interface StreamEvent {
  id: string;
  event: string;
  data: any;
  timestamp: Date;
}

interface StreamMetrics {
  totalConnections: number;
  activeConnections: number;
  eventsStreamed: number;
  averageConnectionDuration: number;
  disconnectionRate: number;
}

class ContractStreamManager extends EventEmitter {
  private connections = new Map<string, StreamConnection>();
  private eventHistory = new Map<string, StreamEvent[]>(); // jobId -> events
  private metrics: StreamMetrics = {
    totalConnections: 0,
    activeConnections: 0,
    eventsStreamed: 0,
    averageConnectionDuration: 0,
    disconnectionRate: 0
  };
  private connectionDurations: number[] = [];

  constructor() {
    super();
    this.setupBatchProcessorListeners();
    this.startHeartbeat();
    this.startMetricsCollection();
  }

  /**
   * Create a new SSE stream for a job
   */
  async createStream(
    request: FastifyRequest<{
      Params: { jobId: string };
      Querystring: { lastEventId?: string };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    const { jobId } = request.params;
    const { lastEventId } = request.query;
    const tenantId = request.headers['x-tenant-id'] as string;

    // Verify job exists
    const jobStatus = batchProcessor.getJobStatus(jobId);
    if (!jobStatus) {
      reply.code(404).send({ error: 'Job not found' });
      return;
    }

    // Check tenant access
    if (tenantId && jobStatus.tenantId !== tenantId) {
      reply.code(403).send({ error: 'Access denied' });
      return;
    }

    const connectionId = this.generateConnectionId();
    
    // Set SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
      'X-Accel-Buffering': 'no' // Disable Nginx buffering
    });

    const connection: StreamConnection = {
      id: connectionId,
      jobId,
      tenantId,
      clientInfo: {
        userAgent: request.headers['user-agent'],
        ip: request.ip,
        connectedAt: new Date()
      },
      reply,
      lastEventId,
      isAlive: true
    };

    this.connections.set(connectionId, connection);
    this.metrics.totalConnections++;
    this.metrics.activeConnections++;

    logger.info(`SSE connection established for job ${jobId}`, {
      connectionId,
      jobId,
      tenantId,
      clientIp: request.ip
    });

    // Send connection established event
    await this.sendEvent(connectionId, {
      id: this.generateEventId(),
      event: 'connected',
      data: {
        connectionId,
        jobId,
        message: 'Stream connected successfully',
        serverTime: new Date().toISOString()
      },
      timestamp: new Date()
    });

    // Send current job status
    await this.sendJobStatusEvent(connectionId, jobStatus);

    // Send missed events if lastEventId is provided
    if (lastEventId) {
      await this.sendMissedEvents(connectionId, lastEventId);
    }

    // Handle connection close
    request.raw.on('close', () => {
      this.closeConnection(connectionId);
    });

    request.raw.on('error', (error) => {
      logger.error(`SSE connection error for ${connectionId}:`, error);
      this.closeConnection(connectionId);
    });

    // Keep the request alive
    reply.hijack();
  }

  /**
   * Broadcast event to all connections for a specific job
   */
  async broadcastToJob(jobId: string, event: Omit<StreamEvent, 'id' | 'timestamp'>): Promise<void> {
    const streamEvent: StreamEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      ...event
    };

    // Store event in history
    if (!this.eventHistory.has(jobId)) {
      this.eventHistory.set(jobId, []);
    }
    
    const jobEvents = this.eventHistory.get(jobId)!;
    jobEvents.push(streamEvent);
    
    // Keep only last 100 events per job
    if (jobEvents.length > 100) {
      jobEvents.splice(0, jobEvents.length - 100);
    }

    // Send to all connections for this job
    const jobConnections = Array.from(this.connections.values()).filter(
      conn => conn.jobId === jobId && conn.isAlive
    );

    const sendPromises = jobConnections.map(conn => 
      this.sendEvent(conn.id, streamEvent)
    );

    await Promise.all(sendPromises);
    
    logger.debug(`Broadcasted event ${streamEvent.event} to ${jobConnections.length} connections`, {
      jobId,
      eventId: streamEvent.id,
      connections: jobConnections.length
    });
  }

  /**
   * Get stream metrics
   */
  getMetrics(): StreamMetrics {
    return { ...this.metrics };
  }

  /**
   * Get active connections for monitoring
   */
  getActiveConnections(): Array<{
    id: string;
    jobId: string;
    tenantId?: string;
    clientIp: string;
    connectedAt: Date;
    duration: number;
  }> {
    return Array.from(this.connections.values())
      .filter(conn => conn.isAlive)
      .map(conn => ({
        id: conn.id,
        jobId: conn.jobId,
        tenantId: conn.tenantId,
        clientIp: conn.clientInfo.ip,
        connectedAt: conn.clientInfo.connectedAt,
        duration: Date.now() - conn.clientInfo.connectedAt.getTime()
      }));
  }

  /**
   * Close connection gracefully
   */
  private async closeConnection(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    connection.isAlive = false;
    
    try {
      // Send close event
      await this.sendEvent(connectionId, {
        id: this.generateEventId(),
        event: 'close',
        data: { message: 'Connection closed' },
        timestamp: new Date()
      });

      connection.reply.raw.end();
    } catch (error) {
      logger.debug(`Error closing connection ${connectionId}:`, error);
    }

    // Update metrics
    const duration = Date.now() - connection.clientInfo.connectedAt.getTime();
    this.connectionDurations.push(duration);
    this.metrics.activeConnections--;

    this.connections.delete(connectionId);

    logger.info(`SSE connection closed for job ${connection.jobId}`, {
      connectionId,
      jobId: connection.jobId,
      duration: `${Math.round(duration / 1000)}s`
    });
  }

  /**
   * Send individual event to a connection
   */
  private async sendEvent(connectionId: string, event: StreamEvent): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.isAlive) return;

    try {
      const eventData = `id: ${event.id}\nevent: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
      
      const written = connection.reply.raw.write(eventData);
      if (!written) {
        // Buffer is full, connection might be slow
        logger.warn(`SSE buffer full for connection ${connectionId}`);
      }

      this.metrics.eventsStreamed++;
    } catch (error) {
      logger.error(`Failed to send SSE event to ${connectionId}:`, error);
      this.closeConnection(connectionId);
    }
  }

  /**
   * Send current job status as an event
   */
  private async sendJobStatusEvent(connectionId: string, jobStatus: any): Promise<void> {
    await this.sendEvent(connectionId, {
      id: this.generateEventId(),
      event: 'job_status',
      data: {
        jobId: jobStatus.id,
        status: jobStatus.status,
        progress: jobStatus.progress,
        createdAt: jobStatus.createdAt,
        startedAt: jobStatus.startedAt,
        completedAt: jobStatus.completedAt,
        error: jobStatus.error
      },
      timestamp: new Date()
    });
  }

  /**
   * Send missed events since lastEventId
   */
  private async sendMissedEvents(connectionId: string, lastEventId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const jobEvents = this.eventHistory.get(connection.jobId) || [];
    
    // Find events after lastEventId
    const lastEventIndex = jobEvents.findIndex(event => event.id === lastEventId);
    if (lastEventIndex === -1) {
      // LastEventId not found, send all recent events
      const recentEvents = jobEvents.slice(-10); // Last 10 events
      for (const event of recentEvents) {
        await this.sendEvent(connectionId, event);
      }
    } else {
      // Send events after lastEventId
      const missedEvents = jobEvents.slice(lastEventIndex + 1);
      for (const event of missedEvents) {
        await this.sendEvent(connectionId, event);
      }
    }
  }

  /**
   * Setup listeners for batch processor events
   */
  private setupBatchProcessorListeners(): void {
    batchProcessor.on('jobSubmitted', (job) => {
      this.broadcastToJob(job.id, {
        event: 'job_submitted',
        data: {
          jobId: job.id,
          status: job.status,
          totalContracts: job.contractFiles.length,
          priority: job.priority
        }
      });
    });

    batchProcessor.on('jobStarted', (job) => {
      this.broadcastToJob(job.id, {
        event: 'job_started',
        data: {
          jobId: job.id,
          status: job.status,
          startedAt: job.startedAt
        }
      });
    });

    batchProcessor.on('jobProgress', (progressData) => {
      this.broadcastToJob(progressData.jobId, {
        event: 'job_progress',
        data: {
          jobId: progressData.jobId,
          progress: progressData.progress,
          lastProcessed: progressData.lastProcessed,
          percentComplete: Math.round((progressData.progress.processed / progressData.progress.total) * 100)
        }
      });
    });

    batchProcessor.on('jobCompleted', (job) => {
      this.broadcastToJob(job.id, {
        event: 'job_completed',
        data: {
          jobId: job.id,
          status: job.status,
          progress: job.progress,
          completedAt: job.completedAt,
          results: job.results.length > 10 ? job.results.slice(0, 10) : job.results // Limit results in event
        }
      });
    });

    batchProcessor.on('jobFailed', (job) => {
      this.broadcastToJob(job.id, {
        event: 'job_failed',
        data: {
          jobId: job.id,
          status: job.status,
          error: job.error,
          progress: job.progress,
          completedAt: job.completedAt
        }
      });
    });

    batchProcessor.on('jobCancelled', (job) => {
      this.broadcastToJob(job.id, {
        event: 'job_cancelled',
        data: {
          jobId: job.id,
          status: job.status,
          cancelledAt: job.completedAt
        }
      });
    });
  }

  /**
   * Send heartbeat to keep connections alive
   */
  private startHeartbeat(): void {
    setInterval(async () => {
      const activeConnections = Array.from(this.connections.values()).filter(conn => conn.isAlive);
      
      const heartbeatPromises = activeConnections.map(conn =>
        this.sendEvent(conn.id, {
          id: this.generateEventId(),
          event: 'heartbeat',
          data: { timestamp: new Date().toISOString() },
          timestamp: new Date()
        })
      );

      await Promise.allSettled(heartbeatPromises);
    }, 30000); // Every 30 seconds
  }

  /**
   * Update metrics periodically
   */
  private startMetricsCollection(): void {
    setInterval(() => {
      // Calculate average connection duration
      if (this.connectionDurations.length > 0) {
        const sum = this.connectionDurations.reduce((acc, duration) => acc + duration, 0);
        this.metrics.averageConnectionDuration = sum / this.connectionDurations.length;
        
        // Keep only recent durations for rolling average
        if (this.connectionDurations.length > 1000) {
          this.connectionDurations = this.connectionDurations.slice(-1000);
        }
      }

      // Calculate disconnection rate (disconnections per minute)
      const recentDisconnections = this.connectionDurations.filter(
        duration => Date.now() - duration < 60000 // Last minute
      ).length;
      
      this.metrics.disconnectionRate = recentDisconnections;
    }, 10000); // Update every 10 seconds
  }

  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup old event history to prevent memory leaks
   */
  private cleanupEventHistory(): void {
    const cutoffTime = Date.now() - (2 * 60 * 60 * 1000); // 2 hours ago
    
    for (const [jobId, events] of this.eventHistory.entries()) {
      const recentEvents = events.filter(event => event.timestamp.getTime() > cutoffTime);
      
      if (recentEvents.length === 0) {
        this.eventHistory.delete(jobId);
      } else {
        this.eventHistory.set(jobId, recentEvents);
      }
    }
  }
}

// Export singleton instance
export const streamManager = new ContractStreamManager();

// Start cleanup process
setInterval(() => {
  (streamManager as any).cleanupEventHistory();
}, 30 * 60 * 1000); // Run every 30 minutes

/**
 * Register SSE routes with Fastify
 */
export function registerStreamRoutes(fastify: FastifyInstance) {
  // Stream job progress
  fastify.get('/api/v1/jobs/:jobId/stream', async (request, reply) => {
    await streamManager.createStream(request as any, reply);
  });

  // Get stream metrics
  fastify.get('/api/v1/stream/metrics', async (request, reply) => {
    const metrics = streamManager.getMetrics();
    const activeConnections = streamManager.getActiveConnections();
    
    reply.send({
      metrics,
      activeConnections: activeConnections.length,
      connections: activeConnections
    });
  });

  // Broadcast custom event to job streams
  fastify.post('/api/v1/jobs/:jobId/broadcast', async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const { event, data } = request.body as { event: string; data: any };

    await streamManager.broadcastToJob(jobId, { event, data });
    
    reply.send({ success: true, jobId, event });
  });
}
