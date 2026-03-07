import { randomUUID } from "crypto";

type ProcessingStatus = "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface ProcessingJob {
  id: string;
  contractId: string;
  status: ProcessingStatus;
  progress: number;
  currentStep: string | null;
  error: string | null;
  startedAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  retryCount: number;
}

type InternalProcessingJob = ProcessingJob & {
  progressTimer?: NodeJS.Timeout | null;
  completionTimer?: NodeJS.Timeout | null;
};

declare global {
   
  var __CONTRACT_PROCESSING_JOBS__: Map<string, InternalProcessingJob> | undefined;
}

const jobStore: Map<string, InternalProcessingJob> =
  globalThis.__CONTRACT_PROCESSING_JOBS__ ??
  (globalThis.__CONTRACT_PROCESSING_JOBS__ = new Map<string, InternalProcessingJob>());

const PROCESSING_STAGES = ["ingestion", "analysis", "indexing", "quality_assurance", "completed"];

const PROGRESS_INTERVAL_MS = 1000;
const COMPLETION_DELAY_MS = 4500;

function toPublicJob(job: InternalProcessingJob): ProcessingJob {
  const { progressTimer, completionTimer, ...publicJob } = job;
  return { ...publicJob };
}

function clearTimers(job: InternalProcessingJob) {
  if (job.progressTimer) {
    clearInterval(job.progressTimer);
    job.progressTimer = null;
  }

  if (job.completionTimer) {
    clearTimeout(job.completionTimer);
    job.completionTimer = null;
  }
}

function createInitialJob(contractId: string): InternalProcessingJob {
  const now = new Date();
  const job: InternalProcessingJob = {
    id: randomUUID(),
    contractId,
    status: "COMPLETED",
    progress: 100,
    currentStep: "completed",
    error: null,
    startedAt: now,
    updatedAt: now,
    completedAt: now,
    retryCount: 0,
    progressTimer: null,
    completionTimer: null,
  };

  jobStore.set(contractId, job);
  return job;
}

function scheduleProgress(job: InternalProcessingJob) {
  clearTimers(job);

  let stageIndex = 0;
  job.progressTimer = setInterval(() => {
    const nextProgress = Math.min(job.progress + 20, 95);
    job.progress = nextProgress;
    job.updatedAt = new Date();
    job.currentStep = PROCESSING_STAGES[Math.min(stageIndex, PROCESSING_STAGES.length - 2)] ?? null;
    stageIndex += 1;

    if (nextProgress >= 95 && job.progressTimer) {
      clearInterval(job.progressTimer);
      job.progressTimer = null;
    }
  }, PROGRESS_INTERVAL_MS);

  job.completionTimer = setTimeout(() => {
    completeJob(job, true);
  }, COMPLETION_DELAY_MS);
}

function completeJob(job: InternalProcessingJob, success: boolean, error?: string) {
  clearTimers(job);

  job.status = success ? "COMPLETED" : "FAILED";
  job.progress = success ? 100 : job.progress;
  job.currentStep = success ? "completed" : "failed";
  job.error = success ? null : error ?? "Processing failed";
  job.completedAt = new Date();
  job.updatedAt = new Date();
}

export function getProcessingJob(contractId: string): ProcessingJob | undefined {
  const job = jobStore.get(contractId);
  return job ? toPublicJob(job) : undefined;
}

export function ensureProcessingJob(contractId: string): ProcessingJob {
  const job = jobStore.get(contractId) ?? createInitialJob(contractId);
  return toPublicJob(job);
}

export function startProcessingJob(contractId: string, { retry }: { retry?: boolean } = {}): ProcessingJob {
  const job = jobStore.get(contractId) ?? createInitialJob(contractId);

  job.status = "PROCESSING";
  job.progress = 15;
  job.currentStep = retry ? "retrying" : "ingestion";
  job.error = null;
  job.startedAt = new Date();
  job.updatedAt = new Date();
  job.completedAt = null;
  if (retry) {
    job.retryCount += 1;
  }

  scheduleProgress(job);

  return toPublicJob(job);
}

export function retryProcessingJob(contractId: string): ProcessingJob {
  return startProcessingJob(contractId, { retry: true });
}

export function failProcessingJob(contractId: string, error: string): ProcessingJob {
  const job = jobStore.get(contractId) ?? createInitialJob(contractId);
  completeJob(job, false, error);
  return toPublicJob(job);
}

export function completeProcessingJob(contractId: string): ProcessingJob {
  const job = jobStore.get(contractId) ?? createInitialJob(contractId);
  completeJob(job, true);
  return toPublicJob(job);
}

export function listProcessingJobs(): ProcessingJob[] {
  return Array.from(jobStore.values()).map(toPublicJob);
}
