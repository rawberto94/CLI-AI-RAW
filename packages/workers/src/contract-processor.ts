import { Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { getQueueService } from '../../utils/src/queue/queue-service';
import { QUEUE_NAMES, ProcessContractJobData } from '../../utils/src/queue/contract-queue';
import pino from 'pino';
import fs from 'fs/promises';
import path from 'path';

const logger = pino({ name: 'contract-processor-worker' });
const prisma = new PrismaClient();

interface ArtifactGenerationResult {
  success: boolean;
  artifactsCreated: number;
  error?: string;
}

/**
 * Contract Processing Worker
 * Handles end-to-end contract processing pipeline
 */
export async function processContractJob(
  job: Job<ProcessContractJobData>
): Promise<ArtifactGenerationResult> {
  const { contractId, tenantId, filePath, originalName } = job.data;

  logger.info(
    { contractId, tenantId, jobId: job.id },
    'Starting contract processing'
  );

  try {
    // Update job progress
    await job.updateProgress(10);

    // 1. Validate contract exists
    const contract = await prisma.contract.findUnique({
      where: { id: contractId, tenantId },
    });

    if (!contract) {
      throw new Error(`Contract ${contractId} not found`);
    }

    logger.info({ contractId }, 'Contract validated');
    await job.updateProgress(20);

    // 2. Read file content (if needed for processing)
    let fileContent: Buffer | null = null;
    try {
      fileContent = await fs.readFile(filePath);
      logger.info({ contractId, fileSize: fileContent.length }, 'File read successfully');
    } catch (error) {
      logger.error({ error, filePath }, 'Failed to read file');
      throw new Error('File not accessible');
    }

    await job.updateProgress(30);

    // 3. Extract text from PDF (placeholder - would use actual PDF parser)
    const contractText = `Contract text extracted from ${originalName}`;
    await job.updateProgress(40);

    // 4. Queue artifact generation job
    const queueService = getQueueService();
    await queueService.addJob(
      QUEUE_NAMES.ARTIFACT_GENERATION,
      'generate-artifacts',
      {
        contractId,
        tenantId,
        contractText,
        priority: 'high',
      },
      {
        priority: 1,
      }
    );

    logger.info({ contractId }, 'Artifact generation queued');
    await job.updateProgress(60);

    // 5. Update contract status
    await prisma.contract.update({
      where: { id: contractId },
      data: {
        status: 'PROCESSING',
        updatedAt: new Date(),
      },
    });

    await job.updateProgress(80);

    // 6. Queue RAG indexing (if enabled)
    if (process.env.RAG_INTEGRATION_ENABLED === 'true') {
      await queueService.addJob(
        QUEUE_NAMES.RAG_INDEXING,
        'index-contract',
        {
          contractId,
          tenantId,
          artifactIds: [], // Will be populated after artifacts are generated
        },
        {
          priority: 15,
          delay: 5000, // Wait 5s for artifacts to be generated
        }
      );

      logger.info({ contractId }, 'RAG indexing queued');
    }

    await job.updateProgress(100);

    logger.info({ contractId }, 'Contract processing completed');

    return {
      success: true,
      artifactsCreated: 0, // Will be updated by artifact generation job
    };
  } catch (error) {
    logger.error({ error, contractId, jobId: job.id }, 'Contract processing failed');

    // Update contract status to failed
    try {
      await prisma.contract.update({
        where: { id: contractId },
        data: {
          status: 'FAILED',
          updatedAt: new Date(),
        },
      });
    } catch (updateError) {
      logger.error({ updateError, contractId }, 'Failed to update contract status');
    }

    throw error;
  }
}

/**
 * Register contract processing worker
 */
export function registerContractProcessorWorker() {
  const queueService = getQueueService();

  const worker = queueService.registerWorker<ProcessContractJobData, ArtifactGenerationResult>(
    QUEUE_NAMES.CONTRACT_PROCESSING,
    processContractJob,
    {
      concurrency: 3, // Process 3 contracts simultaneously
      limiter: {
        max: 10,
        duration: 60000, // Max 10 jobs per minute
      },
    }
  );

  logger.info('Contract processor worker registered');

  return worker;
}
