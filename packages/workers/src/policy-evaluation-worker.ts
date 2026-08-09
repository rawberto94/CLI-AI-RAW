/**
 * Policy evaluation worker — runs policy packs against contracts after OCR.
 * Modelled on categorization-worker (single-purpose, no import-time isMainModule).
 */

type Job<T = any> = {
  id?: string;
  name: string;
  data: T;
  attemptsMade: number;
  opts: any;
  updateProgress: (progress: number | object) => Promise<void>;
};

import { Worker } from 'bullmq';
import pino from 'pino';
import { getTraceContextFromJobData } from './observability/trace';
import { ensureProcessingJob, updateStep } from './workflow/processing-job';
import { getWorkerConcurrency, getWorkerLimiter } from './config/worker-runtime';

export interface PolicyEvaluationJobData {
  contractId: string;
  tenantId: string;
  packId?: string;
  triggeredBy?: 'pipeline' | 'manual' | 'rerun' | 'backfill' | 'dryrun';
  allowSemantic?: boolean;
  traceId?: string;
  requestId?: string;
}

export interface PolicyEvaluationWorkerResult {
  success: boolean;
  contractId: string;
  status?: string;
  policyScore?: number;
  evaluationId?: string;
  cached?: boolean;
  processingTimeMs: number;
  errors?: string[];
}

export const POLICY_EVALUATION_QUEUE = 'policy-evaluation';

export const POLICY_EVALUATION_CONFIG = {
  name: POLICY_EVALUATION_QUEUE,
  concurrency: 5,
  limiter: {
    max: 30,
    duration: 60000,
  },
};

const logger = pino({
  name: 'policy-evaluation-worker',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
    },
  },
});

export async function processPolicyEvaluationJob(
  job: Job<PolicyEvaluationJobData>,
): Promise<PolicyEvaluationWorkerResult> {
  const {
    contractId,
    tenantId,
    packId,
    triggeredBy = 'pipeline',
    allowSemantic,
  } = job.data;

  const startTime = Date.now();
  const trace = getTraceContextFromJobData(job.data);

  try {
    await job.updateProgress(5);

    await ensureProcessingJob({
      tenantId,
      contractId,
      queueId: job.id ? String(job.id) : undefined,
      traceId: trace.traceId,
    });

    await updateStep({
      tenantId,
      contractId,
      step: 'policy.evaluation',
      status: 'running',
      progress: 10,
      currentStep: 'policy.evaluation',
    });

    const { prisma } = await import('./lib/prisma');
    // Path-mapped to source in workers tsconfig; dist export via package services barrel
    const { evaluatePolicyPack } = await import('@repo/data-orchestration/services/policy/index');

    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: { id: true, rawText: true, status: true },
    });

    if (!contract) {
      throw new Error('Contract not found');
    }

    const rawText = contract.rawText || '';
    if (rawText.length < 1000) {
      logger.info({ contractId, len: rawText.length }, 'Text too short; evaluation will be INDETERMINATE');
    }

    await job.updateProgress(30);

    const result = await evaluatePolicyPack({
      tenantId,
      contractId,
      packId,
      triggeredBy,
      allowSemantic,
      prisma,
    });

    await job.updateProgress(80);

    // Gate mode: route to review, never reject upload
    if (result.status === 'FAIL' && result.mode === 'gate') {
      try {
        await prisma.contract.update({
          where: { id: contractId },
          data: {
            status: 'PENDING' as any,
            documentRole: 'REVIEW',
          },
        });
        try {
          await (prisma as any).contractAlert.create({
            data: {
              tenantId,
              contractId,
              type: 'POLICY',
              severity: 'critical',
              message: `Policy gate FAIL: ${result.criticalCount} critical violation(s)`,
              status: 'open',
            },
          });
        } catch {
          /* optional model shape */
        }
      } catch (gateErr) {
        logger.warn({ err: gateErr }, 'Gate mode lifecycle update failed (non-fatal)');
      }
    }

    await updateStep({
      tenantId,
      contractId,
      step: 'policy.evaluation',
      status: 'completed',
      progress: 100,
      currentStep: 'policy.evaluation',
    });

    await job.updateProgress(100);

    return {
      success: true,
      contractId,
      status: result.status,
      policyScore: result.policyScore,
      evaluationId: result.evaluationId,
      cached: result.cached,
      processingTimeMs: Date.now() - startTime,
    };
  } catch (err: any) {
    logger.error({ err, contractId, tenantId }, 'Policy evaluation failed');

    try {
      await updateStep({
        tenantId,
        contractId,
        step: 'policy.evaluation',
        status: 'failed',
        progress: 100,
        currentStep: 'policy.evaluation',
        error: err?.message,
      });
    } catch {
      /* ignore */
    }

    throw err;
  }
}

/**
 * Register the policy evaluation worker
 */
export function registerPolicyEvaluationWorker(): Worker {
  const redisConfig = {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
  };

  const worker = new Worker(
    POLICY_EVALUATION_QUEUE,
    async (job) => {
      logger.info({ jobId: job.id, contractId: job.data.contractId }, 'Processing policy evaluation job');
      try {
        const result = await processPolicyEvaluationJob(job);
        logger.info(
          {
            jobId: job.id,
            contractId: job.data.contractId,
            status: result.status,
            policyScore: result.policyScore,
            cached: result.cached,
          },
          'Policy evaluation completed',
        );
        return result;
      } catch (error) {
        logger.error(
          {
            jobId: job.id,
            contractId: job.data.contractId,
            error: error instanceof Error ? error.message : String(error),
          },
          'Policy evaluation failed',
        );
        throw error;
      }
    },
    {
      connection: redisConfig,
      concurrency: getWorkerConcurrency('POLICY_EVALUATION_WORKER_CONCURRENCY', POLICY_EVALUATION_CONFIG.concurrency),
      limiter: getWorkerLimiter(
        'POLICY_EVALUATION_WORKER_LIMIT_MAX',
        'POLICY_EVALUATION_WORKER_LIMIT_DURATION_MS',
        POLICY_EVALUATION_CONFIG.limiter,
      ),
    },
  );

  worker.on('completed', (job, result) => {
    logger.info(
      { jobId: job.id, contractId: job.data.contractId, status: result?.status },
      '✅ Policy evaluation job completed',
    );
  });

  worker.on('failed', (job, error) => {
    logger.error(
      { jobId: job?.id, contractId: job?.data?.contractId, error: error.message },
      '❌ Policy evaluation job failed',
    );
  });

  worker.on('error', (error) => {
    logger.error({ error: error.message }, 'Policy evaluation worker error');
  });

  logger.info('📋 Policy evaluation worker registered');
  return worker;
}
