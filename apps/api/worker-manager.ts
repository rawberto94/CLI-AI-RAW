/* eslint-disable @typescript-eslint/no-explicit-any */
import { Worker } from 'bullmq';

export class WorkerManager {
  private workers: Map<string, Worker> = new Map();
  private logger: any;

  constructor(logger: any) {
    this.logger = logger;
  }

  async startWorkers() {
    const redisConnection = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    } as any;

    const types = ['ingestion', 'overview', 'clauses', 'rates', 'compliance', 'benchmark', 'risk', 'report'];

    for (const type of types) {
      const worker = new Worker(
        type,
        async (job) => {
          this.logger.info({ jobId: job.id, type, docId: job.data.docId }, `Processing ${type}`);
          // Placeholder: simulate work; real logic lives in apps/workers
          await new Promise((r) => setTimeout(r, 500));
          return { docId: job.data.docId, status: 'completed' };
        },
        { connection: redisConnection }
      );
      this.workers.set(type, worker);
    }

    this.logger.info(`Started ${this.workers.size} workers`);
  }

  async stopWorkers() {
    for (const [name, worker] of this.workers) {
      await worker.close();
      this.logger.info(`Stopped worker: ${name}`);
    }
  }

  getWorkerStatus() {
    const status: Record<string, any> = {};
    for (const [name, worker] of this.workers) {
      status[name] = {
        running: worker.isRunning(),
      };
    }
    return status;
  }
}
