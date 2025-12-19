/**
 * Worker Metrics & Monitoring (P4: Worker Scalability)
 * 
 * Prometheus-compatible metrics for queue monitoring
 * Provides visibility into worker performance and health
 */

import { Queue, Worker } from 'bullmq';
import pino from 'pino';

const logger = pino({ name: 'worker-metrics' });

export interface QueueMetrics {
  queue: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

export interface WorkerMetrics {
  name: string;
  isRunning: boolean;
  isPaused: boolean;
  concurrency: number;
}

export interface MetricsSnapshot {
  timestamp: number;
  queues: QueueMetrics[];
  workers: WorkerMetrics[];
  totals: {
    totalJobs: number;
    activeJobs: number;
    waitingJobs: number;
    failedJobs: number;
    completedJobs: number;
  };
}

/**
 * Metrics Collector for Workers
 */
class MetricsCollector {
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, any> = new Map();
  private metricsHistory: MetricsSnapshot[] = [];
  private maxHistorySize = 100;

  /**
   * Register a queue for metrics collection
   */
  registerQueue(name: string, queue: Queue): void {
    this.queues.set(name, queue);
    logger.info({ queueName: name }, 'Queue registered for metrics');
  }

  /**
   * Register a worker for metrics collection
   */
  registerWorker(name: string, worker: any): void {
    this.workers.set(name, worker);
    logger.info({ workerName: name }, 'Worker registered for metrics');
  }

  /**
   * Collect metrics from all registered queues
   */
  async collectQueueMetrics(): Promise<QueueMetrics[]> {
    const metrics: QueueMetrics[] = [];

    for (const [name, queue] of this.queues) {
      try {
        const [waiting, active, completed, failed, delayed, isPaused] = await Promise.all([
          queue.getWaitingCount(),
          queue.getActiveCount(),
          queue.getCompletedCount(),
          queue.getFailedCount(),
          queue.getDelayedCount(),
          queue.isPaused(),
        ]);

        metrics.push({
          queue: name,
          waiting,
          active,
          completed,
          failed,
          delayed,
          paused: isPaused,
        });
      } catch (error) {
        logger.error({ error, queueName: name }, 'Failed to collect queue metrics');
      }
    }

    return metrics;
  }

  /**
   * Collect worker status
   */
  collectWorkerMetrics(): WorkerMetrics[] {
    const metrics: WorkerMetrics[] = [];

    for (const [name, worker] of this.workers) {
      metrics.push({
        name,
        isRunning: worker.isRunning(),
        isPaused: worker.isPaused(),
        concurrency: worker.opts.concurrency || 1,
      });
    }

    return metrics;
  }

  /**
   * Get full metrics snapshot
   */
  async getSnapshot(): Promise<MetricsSnapshot> {
    const queueMetrics = await this.collectQueueMetrics();
    const workerMetrics = this.collectWorkerMetrics();

    const totals = queueMetrics.reduce(
      (acc, q) => ({
        totalJobs: acc.totalJobs + q.waiting + q.active + q.completed + q.failed + q.delayed,
        activeJobs: acc.activeJobs + q.active,
        waitingJobs: acc.waitingJobs + q.waiting,
        failedJobs: acc.failedJobs + q.failed,
        completedJobs: acc.completedJobs + q.completed,
      }),
      { totalJobs: 0, activeJobs: 0, waitingJobs: 0, failedJobs: 0, completedJobs: 0 }
    );

    const snapshot: MetricsSnapshot = {
      timestamp: Date.now(),
      queues: queueMetrics,
      workers: workerMetrics,
      totals,
    };

    // Store in history
    this.metricsHistory.push(snapshot);
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory.shift();
    }

    return snapshot;
  }

  /**
   * Get metrics in Prometheus format
   */
  async getPrometheusMetrics(): Promise<string> {
    const snapshot = await this.getSnapshot();
    const lines: string[] = [];

    // Queue metrics
    lines.push('# HELP queue_jobs_total Total number of jobs in queue by status');
    lines.push('# TYPE queue_jobs_total gauge');
    
    for (const queue of snapshot.queues) {
      lines.push(`queue_jobs_total{queue="${queue.queue}",status="waiting"} ${queue.waiting}`);
      lines.push(`queue_jobs_total{queue="${queue.queue}",status="active"} ${queue.active}`);
      lines.push(`queue_jobs_total{queue="${queue.queue}",status="completed"} ${queue.completed}`);
      lines.push(`queue_jobs_total{queue="${queue.queue}",status="failed"} ${queue.failed}`);
      lines.push(`queue_jobs_total{queue="${queue.queue}",status="delayed"} ${queue.delayed}`);
    }

    // Queue paused status
    lines.push('# HELP queue_paused Queue paused status (1 = paused)');
    lines.push('# TYPE queue_paused gauge');
    for (const queue of snapshot.queues) {
      lines.push(`queue_paused{queue="${queue.queue}"} ${queue.paused ? 1 : 0}`);
    }

    // Worker metrics
    lines.push('# HELP worker_running Worker running status (1 = running)');
    lines.push('# TYPE worker_running gauge');
    for (const worker of snapshot.workers) {
      lines.push(`worker_running{worker="${worker.name}"} ${worker.isRunning ? 1 : 0}`);
    }

    lines.push('# HELP worker_concurrency Worker concurrency limit');
    lines.push('# TYPE worker_concurrency gauge');
    for (const worker of snapshot.workers) {
      lines.push(`worker_concurrency{worker="${worker.name}"} ${worker.concurrency}`);
    }

    // Totals
    lines.push('# HELP jobs_total_active Total active jobs across all queues');
    lines.push('# TYPE jobs_total_active gauge');
    lines.push(`jobs_total_active ${snapshot.totals.activeJobs}`);

    lines.push('# HELP jobs_total_waiting Total waiting jobs across all queues');
    lines.push('# TYPE jobs_total_waiting gauge');
    lines.push(`jobs_total_waiting ${snapshot.totals.waitingJobs}`);

    lines.push('# HELP jobs_total_failed Total failed jobs across all queues');
    lines.push('# TYPE jobs_total_failed counter');
    lines.push(`jobs_total_failed ${snapshot.totals.failedJobs}`);

    return lines.join('\n');
  }

  /**
   * Get metrics history for graphing
   */
  getHistory(): MetricsSnapshot[] {
    return [...this.metricsHistory];
  }

  /**
   * Health check - returns true if all workers are running
   */
  isHealthy(): boolean {
    for (const [, worker] of this.workers) {
      if (!worker.isRunning()) {
        return false;
      }
    }
    return true;
  }
}

// Singleton instance
let metricsCollector: MetricsCollector | null = null;

export function getMetricsCollector(): MetricsCollector {
  if (!metricsCollector) {
    metricsCollector = new MetricsCollector();
  }
  return metricsCollector;
}

export { MetricsCollector };
