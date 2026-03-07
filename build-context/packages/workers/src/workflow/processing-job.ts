import clientsDb from 'clients-db';
import { RetryableError } from '../utils/errors';

const getClient = typeof clientsDb === 'function' ? clientsDb : (clientsDb as any).default;
const prisma = getClient();

export type ProcessingStepStatus = 'pending' | 'running' | 'completed' | 'skipped' | 'failed';

export type ProcessingPlan = {
  ragIndexing: boolean;
  metadataExtraction: boolean;
  categorization: boolean;
};

type StepState = {
  status: ProcessingStepStatus;
  startedAt?: string;
  completedAt?: string;
  attempts?: number;
  lastError?: string;
};

type CheckpointData = {
  traceId?: string;
  plan?: ProcessingPlan;
  steps?: Record<string, StepState>;
  inputs?: Record<string, unknown>;
};

export async function ensureProcessingJob(args: {
  tenantId: string;
  contractId: string;
  queueId?: string;
  traceId?: string;
}): Promise<void> {
  const { tenantId, contractId, queueId, traceId } = args;

  const existing = await prisma.processingJob.findFirst({
    where: { tenantId, contractId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, checkpointData: true },
  });

  const checkpointData = mergeCheckpoint(existing?.checkpointData, { traceId });

  if (existing) {
    await prisma.processingJob.update({
      where: { id: existing.id },
      data: {
        queueId: queueId ?? existing.id,
        checkpointData: checkpointData as any,
        updatedAt: new Date(),
      },
    });
    return;
  }

  await prisma.processingJob.create({
    data: {
      tenantId,
      contractId,
      status: 'PENDING',
      progress: 0,
      totalStages: 5,
      queueId,
      checkpointData: checkpointData as any,
      metadata: {},
    },
  });
}

export async function setProcessingPlan(args: {
  tenantId: string;
  contractId: string;
  plan: ProcessingPlan;
  inputs?: Record<string, unknown>;
}): Promise<void> {
  const { tenantId, contractId, plan, inputs } = args;
  const existing = await prisma.processingJob.findFirst({
    where: { tenantId, contractId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, checkpointData: true },
  });

  if (!existing) {
    await ensureProcessingJob({ tenantId, contractId });
    return setProcessingPlan(args);
  }

  const next = mergeCheckpoint(existing.checkpointData, { plan, inputs });

  await prisma.processingJob.update({
    where: { id: existing.id },
    data: { checkpointData: next as any, updatedAt: new Date() },
  });
}

export async function updateStep(args: {
  tenantId: string;
  contractId: string;
  step: string;
  status: ProcessingStepStatus;
  progress?: number;
  currentStep?: string;
  error?: string;
}): Promise<void> {
  const { tenantId, contractId, step, status, progress, currentStep, error } = args;
  const existing = await prisma.processingJob.findFirst({
    where: { tenantId, contractId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, checkpointData: true },
  });

  if (!existing) {
    await ensureProcessingJob({ tenantId, contractId });
    return updateStep(args);
  }

  const checkpoint = (existing.checkpointData ?? {}) as CheckpointData;
  const steps = { ...(checkpoint.steps ?? {}) };
  const prev = steps[step] ?? { status: 'pending' as const };

  const nowIso = new Date().toISOString();
  const nextState: StepState = {
    ...prev,
    status,
    attempts: (prev.attempts ?? 0) + (status === 'running' ? 1 : 0),
    startedAt: prev.startedAt ?? (status === 'running' ? nowIso : undefined),
    completedAt: status === 'completed' || status === 'skipped' || status === 'failed' ? nowIso : prev.completedAt,
    lastError: error ?? prev.lastError,
  };

  steps[step] = nextState;

  const next: CheckpointData = {
    ...checkpoint,
    steps,
  };

  await prisma.processingJob.update({
    where: { id: existing.id },
    data: {
      checkpointData: next as any,
      lastCheckpoint: step,
      currentStep: currentStep ?? step,
      progress: progress ?? undefined,
      status: status === 'failed' ? 'FAILED' : undefined,
      updatedAt: new Date(),
    },
  });
}

export async function getProcessingPlan(tenantId: string, contractId: string): Promise<ProcessingPlan | null> {
  const job = await prisma.processingJob.findFirst({
    where: { tenantId, contractId },
    orderBy: { createdAt: 'desc' },
    select: { checkpointData: true },
  });

  const data = (job?.checkpointData ?? {}) as CheckpointData;
  return data.plan ?? null;
}

export function assertRetryableReady(args: { status?: string | null; message: string }): void {
  const validStatuses = ['COMPLETED', 'PARTIAL', 'PROCESSED'];
  if (!validStatuses.includes(args.status || '')) {
    throw new RetryableError(args.message);
  }
}

function mergeCheckpoint(existing: unknown, patch: Partial<CheckpointData>): CheckpointData {
  const current = (existing ?? {}) as CheckpointData;
  return {
    ...current,
    ...patch,
    steps: {
      ...(current.steps ?? {}),
      ...(patch.steps ?? {}),
    },
    inputs: {
      ...(current.inputs ?? {}),
      ...(patch.inputs ?? {}),
    },
  };
}
