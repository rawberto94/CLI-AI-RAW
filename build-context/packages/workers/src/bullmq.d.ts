/**
 * Type declarations for bullmq exports
 * This helps with module resolution in bundler mode
 */

declare module 'bullmq' {
  export class Job<DataType = any, ReturnType = any, NameType extends string = string> {
    id?: string;
    name: NameType;
    queueName: string;
    data: DataType;
    opts: any;
    progress: number;
    attemptsMade: number;
    processedOn?: number;
    finishedOn?: number;
    failedReason?: string;
    returnvalue?: ReturnType;
    
    updateProgress(progress: number | object): Promise<void>;
    log(row: string): Promise<void>;
    getState(): Promise<string>;
    moveToFailed(error: Error, token: string): Promise<void>;
  }

  export class Worker<DataType = any, ReturnType = any, NameType extends string = string> {
    constructor(name: string, processor: (job: Job<DataType, ReturnType, NameType>) => Promise<ReturnType>, opts?: any);
    on(event: string, callback: (...args: any[]) => void): this;
    close(): Promise<void>;
    run(): Promise<void>;
    pause(): Promise<void>;
    resume(): Promise<void>;
  }

  export class Queue<DataType = any, ReturnType = any, NameType extends string = string> {
    constructor(name: string, opts?: any);
    add(name: NameType, data: DataType, opts?: any): Promise<Job<DataType, ReturnType, NameType>>;
    close(): Promise<void>;
    getJobCounts(): Promise<{ waiting: number; active: number; completed: number; failed: number }>;
    pause(): Promise<void>;
    resume(): Promise<void>;
    obliterate(opts?: any): Promise<void>;
    drain(): Promise<void>;
  }

  export class QueueEvents {
    constructor(name: string, opts?: any);
    on(event: string, callback: (...args: any[]) => void): this;
    close(): Promise<void>;
  }

  export interface ConnectionOptions {
    host?: string;
    port?: number;
    password?: string;
    db?: number;
    maxRetriesPerRequest?: number | null;
  }

  export interface JobsOptions {
    delay?: number;
    attempts?: number;
    backoff?: number | { type: string; delay: number };
    priority?: number;
    removeOnComplete?: boolean | number;
    removeOnFail?: boolean | number;
    jobId?: string;
    lifo?: boolean;
    repeat?: any;
  }
}
