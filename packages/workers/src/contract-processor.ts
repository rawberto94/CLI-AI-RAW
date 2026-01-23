import type { Job } from 'bullmq';
import clientsDb from 'clients-db';
const getClient = typeof clientsDb === 'function' ? clientsDb : (clientsDb as any).default;
import { getQueueService, JobType } from '@repo/utils/queue/queue-service';
import { QUEUE_NAMES, ProcessContractJobData } from '@repo/utils/queue/contract-queue';
import pino from 'pino';
import fs from 'fs/promises';
import path from 'path';

const logger = pino({ name: 'contract-processor-worker' });
const prisma = getClient();

interface ArtifactGenerationResult {
  success: boolean;
  artifactsCreated: number;
  error?: string;
}

/**
 * Extract text content from a file based on its type
 */
async function extractTextFromFile(
  fileContent: Buffer,
  fileName: string,
  mimeType?: string
): Promise<string> {
  const ext = path.extname(fileName).toLowerCase();
  const effectiveMime = mimeType || getMimeType(ext);

  // PDF extraction using pdf-parse
  if (ext === '.pdf' || effectiveMime === 'application/pdf') {
    try {
      // Dynamic import to avoid bundling issues
      const pdfParse = (await import('pdf-parse')).default;
      const data = await pdfParse(fileContent);
      logger.info({ pages: data.numpages, chars: data.text.length }, 'PDF parsed successfully');
      return data.text;
    } catch (error) {
      logger.warn({ error }, 'pdf-parse failed, trying alternative method');
      // Fallback: Try extracting text patterns from raw PDF
      const rawText = fileContent.toString('utf8');
      const textMatches = rawText.match(/\(([^)]+)\)/g) || [];
      if (textMatches.length > 50) {
        return textMatches.map(m => m.slice(1, -1)).join(' ');
      }
      throw new Error('Failed to extract text from PDF');
    }
  }

  // Word documents using mammoth
  if (ext === '.docx' || effectiveMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer: fileContent });
      logger.info({ chars: result.value.length }, 'DOCX parsed successfully');
      return result.value;
    } catch (error) {
      logger.error({ error }, 'mammoth failed to parse DOCX');
      throw new Error('Failed to extract text from DOCX');
    }
  }

  // Plain text files
  if (['.txt', '.md', '.csv', '.json', '.xml', '.html'].includes(ext)) {
    return fileContent.toString('utf8');
  }

  // RTF files - basic extraction
  if (ext === '.rtf') {
    const text = fileContent.toString('utf8');
    // Remove RTF control codes
    return text
      .replace(/\\[a-z]+\d*\s?/gi, '')
      .replace(/[{}]/g, '')
      .replace(/\\\\/g, '\\')
      .trim();
  }

  // Unknown format - try as text
  logger.warn({ ext, mimeType: effectiveMime }, 'Unknown file format, attempting text extraction');
  const textContent = fileContent.toString('utf8');
  // Check if it looks like text (has reasonable ratio of printable chars)
  const printableRatio = textContent.replace(/[^\x20-\x7E\n\r\t]/g, '').length / textContent.length;
  if (printableRatio > 0.8) {
    return textContent;
  }

  throw new Error(`Unsupported file format: ${ext}`);
}

function getMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc': 'application/msword',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.rtf': 'application/rtf',
    '.html': 'text/html',
    '.xml': 'application/xml',
    '.json': 'application/json',
    '.csv': 'text/csv',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Contract Processing Worker
 * Handles end-to-end contract processing pipeline
 */
export async function processContractJob(
  job: JobType<ProcessContractJobData>
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

    // 3. Extract text from file
    let contractText: string;
    try {
      const mimeType = contract.mimeType || undefined;
      contractText = await extractTextFromFile(fileContent, originalName, mimeType);
      logger.info({ contractId, textLength: contractText.length }, 'Text extracted successfully');
    } catch (error) {
      logger.error({ error, contractId }, 'Text extraction failed');
      throw new Error(`Failed to extract text from ${originalName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
