import type { Job } from 'bullmq';
import clientsDb from 'clients-db';
const getClient = typeof clientsDb === 'function' ? clientsDb : (clientsDb as any).default;
import { getQueueService, JobType } from '@repo/utils/queue/queue-service';
import { QUEUE_NAMES, ProcessContractJobData } from '@repo/utils/queue/contract-queue';
import pino from 'pino';
import fs from 'fs/promises';
import path from 'path';
import { DeadLetterQueueManager } from './dead-letter-queue';

const logger = pino({ name: 'contract-processor-worker' });
const prisma = getClient();

// Initialize DLQ manager (lazy, uses same Redis connection as queue service)
let dlqManager: DeadLetterQueueManager | null = null;
function getDLQManager(): DeadLetterQueueManager {
  if (!dlqManager) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const url = new URL(redisUrl);
    dlqManager = new DeadLetterQueueManager({
      host: url.hostname,
      port: parseInt(url.port || '6379'),
      password: url.password || undefined,
    });
  }
  return dlqManager;
}

interface ArtifactGenerationResult {
  success: boolean;
  artifactsCreated: number;
  error?: string;
}

/**
 * Attempt OCR on a file buffer (for scanned PDFs and images).
 * Uses Tesseract.js if available, or Azure Document Intelligence / external API.
 * Returns null if OCR is not available or fails.
 */
async function attemptOCR(fileContent: Buffer, fileName: string): Promise<string | null> {
  // Strategy 1: Tesseract.js (local, no external dependency)
  try {
    const Tesseract = await import('tesseract.js');
    const worker = await Tesseract.createWorker('eng');
    const { data: { text } } = await worker.recognize(fileContent);
    await worker.terminate();

    const cleaned = text.replace(/\s+/g, ' ').trim();
    if (cleaned.length > 50) {
      logger.info({ chars: cleaned.length, fileName }, 'OCR extracted text via Tesseract.js');
      return text;
    }
    logger.warn({ chars: cleaned.length }, 'Tesseract OCR produced insufficient text');
  } catch (tessError) {
    logger.debug({ tessError }, 'Tesseract.js not available or failed');
  }

  // Strategy 2: Azure Document Intelligence (if configured)
  const azureDiEndpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
  const azureDiKey = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;
  if (azureDiEndpoint && azureDiKey) {
    try {
      const response = await fetch(`${azureDiEndpoint}/formrecognizer/documentModels/prebuilt-read:analyze?api-version=2023-07-31`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'Ocp-Apim-Subscription-Key': azureDiKey,
        },
        body: fileContent,
      });
      if (response.status === 202) {
        const operationLocation = response.headers.get('Operation-Location');
        if (operationLocation) {
          // Poll for result (max 60s)
          for (let i = 0; i < 30; i++) {
            await new Promise(r => setTimeout(r, 2000));
            const resultRes = await fetch(operationLocation, {
              headers: { 'Ocp-Apim-Subscription-Key': azureDiKey },
            });
            const result = await resultRes.json();
            if (result.status === 'succeeded') {
              const content = result.analyzeResult?.content;
              if (content && content.length > 50) {
                logger.info({ chars: content.length, fileName }, 'OCR extracted via Azure Document Intelligence');
                return content;
              }
            } else if (result.status === 'failed') {
              break;
            }
          }
        }
      }
    } catch (azureError) {
      logger.debug({ azureError }, 'Azure Document Intelligence OCR failed');
    }
  }

  return null;
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

      // Check if PDF is a scanned image (very little text extracted)
      const meaningfulText = data.text.replace(/\s+/g, ' ').trim();
      if (meaningfulText.length > 50) {
        return data.text;
      }

      // Scanned PDF detected — try OCR fallback
      logger.info({ pages: data.numpages, extractedChars: meaningfulText.length }, 'Scanned PDF detected, attempting OCR');
      const ocrText = await attemptOCR(fileContent, fileName);
      if (ocrText) return ocrText;

      // If OCR also fails but we got some text, return what we have
      if (meaningfulText.length > 0) return data.text;

      throw new Error('Scanned PDF with no extractable text and OCR unavailable');
    } catch (error) {
      logger.warn({ error }, 'pdf-parse failed, trying alternative method');
      // Fallback: Try OCR for image-based PDFs
      const ocrText = await attemptOCR(fileContent, fileName);
      if (ocrText) return ocrText;

      // Last resort: Try extracting text patterns from raw PDF
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
    const storageProvider = (contract as any).storageProvider || process.env.STORAGE_PROVIDER || 'local';
    try {
      if (storageProvider === 's3' || storageProvider === 'minio') {
        // Object storage: download via S3/MinIO client
        try {
          const { initializeStorage } = await import('@/lib/storage-service');
          const storage = initializeStorage();
          if (storage) {
            fileContent = await storage.download(filePath);
          }
        } catch (storageError) {
          logger.warn({ storageError, filePath, storageProvider }, 'Object storage download failed, falling back to local');
        }
      }
      // Fallback to local filesystem
      if (!fileContent) {
        fileContent = await fs.readFile(filePath);
      }
      logger.info({ contractId, fileSize: fileContent.length, storageProvider }, 'File read successfully');
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

    // 5. Update contract status (optimistic locking - only if not already processing)
    const statusUpdate = await prisma.contract.updateMany({
      where: { 
        id: contractId,
        status: { in: ['UPLOADED', 'PENDING', 'QUEUED', 'FAILED'] } // Include QUEUED in valid transition states
      },
      data: {
        status: 'PROCESSING',
        updatedAt: new Date(),
      },
    });

    if (statusUpdate.count === 0) {
      logger.warn({ contractId }, 'Contract already being processed by another worker, skipping');
      return { success: false, artifactsCreated: 0, skipped: true };
    }

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

    // Move to Dead Letter Queue if max retries exhausted
    const maxAttempts = (job as any).opts?.attempts || 3;
    if (job.attemptsMade >= maxAttempts - 1) {
      try {
        const dlq = getDLQManager();
        await dlq.moveToDeadLetter(
          { id: job.id?.toString(), name: job.name || 'process-contract', data: job.data, attemptsMade: job.attemptsMade, opts: (job as any).opts || {} },
          error instanceof Error ? error.message : 'Unknown error',
          QUEUE_NAMES.CONTRACT_PROCESSING
        );
        logger.warn({ contractId, jobId: job.id, attempts: job.attemptsMade }, 'Job moved to Dead Letter Queue after max retries');
      } catch (dlqError) {
        logger.error({ dlqError, contractId }, 'Failed to move job to DLQ');
      }
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
      concurrency: 10, // Process 10 contracts simultaneously
      limiter: {
        max: 30,
        duration: 60000, // Max 30 jobs per minute
      },
    }
  );

  logger.info('Contract processor worker registered');

  return worker;
}
