import dotenv from 'dotenv';
// Load environment variables FIRST, before any other imports that need them
dotenv.config();

import { Job } from 'bullmq';
import getClient from 'clients-db';
import { getQueueService } from '../../utils/src/queue/queue-service';
import { QUEUE_NAMES, ProcessContractJobData } from '../../utils/src/queue/contract-queue';
import pino from 'pino';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { 
  CircuitBreaker, 
  CircuitState, 
  CircuitBreakerError 
} from '../../utils/src/patterns/circuit-breaker';
import { retry, retryOpenAI, retryStorage } from '../../utils/src/patterns/retry';

const logger = pino({ name: 'ocr-artifact-worker' });

// Circuit breakers for external services
const mistralCircuitBreaker = new CircuitBreaker('mistral-ocr', {
  failureThreshold: 5,
  successThreshold: 3,
  resetTimeout: 60000, // 1 minute
  requestTimeout: 120000, // 2 minutes for OCR
  onStateChange: (from, to, metrics) => {
    logger.warn({ from, to, metrics }, 'Mistral circuit breaker state changed');
  },
  onFailure: (error, metrics) => {
    logger.error({ error: error.message, metrics }, 'Mistral circuit breaker failure');
  },
});

const openaiCircuitBreaker = new CircuitBreaker('openai-ocr', {
  failureThreshold: 5,
  successThreshold: 3,
  resetTimeout: 60000,
  requestTimeout: 120000,
  onStateChange: (from, to, metrics) => {
    logger.warn({ from, to, metrics }, 'OpenAI circuit breaker state changed');
  },
  onFailure: (error, metrics) => {
    logger.error({ error: error.message, metrics }, 'OpenAI circuit breaker failure');
  },
});

const storageCircuitBreaker = new CircuitBreaker('storage', {
  failureThreshold: 3,
  successThreshold: 2,
  resetTimeout: 10000,
  requestTimeout: 30000,
  onStateChange: (from, to, metrics) => {
    logger.warn({ from, to, metrics }, 'Storage circuit breaker state changed');
  },
});
const prisma = getClient();

// Simple in-memory cache for artifacts (production would use Redis)
const artifactCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Cleanup old cache entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of artifactCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      artifactCache.delete(key);
    }
  }
}, 10 * 60 * 1000);

// Preload heavy modules to reduce cold start time
let pdfParseModule: any = null;
let mistralModule: any = null;

(async () => {
  try {
    // Preload in background
    pdfParseModule = (await import('pdf-parse')).default;
    const mistral = await import('@mistralai/mistralai');
    mistralModule = mistral.Mistral;
    logger.info('Heavy modules preloaded for faster processing');
  } catch (e) {
    logger.warn('Failed to preload modules, will load on-demand');
  }
})();

// Initialize S3 client for MinIO
const s3Client = new S3Client({
  endpoint: `http://${process.env.MINIO_ENDPOINT || 'localhost'}:${process.env.MINIO_PORT || '9000'}`,
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretAccessKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
  },
  forcePathStyle: true,
});

interface OCRArtifactResult {
  success: boolean;
  artifactsCreated: number;
  extractedText?: string;
}

/**
 * Perform OCR extraction on a file with circuit breaker protection
 */
async function performOCR(filePath: string, ocrMode: string): Promise<string> {
  logger.info({ filePath, ocrMode }, 'Performing OCR extraction');
  
  // Check circuit breaker states and potentially switch providers
  let effectiveOcrMode = ocrMode;
  
  if (ocrMode === 'mistral' && mistralCircuitBreaker.getState() === CircuitState.OPEN) {
    logger.warn('Mistral circuit breaker is open, falling back to GPT-4');
    effectiveOcrMode = 'gpt4';
  }
  
  if (effectiveOcrMode === 'gpt4' && openaiCircuitBreaker.getState() === CircuitState.OPEN) {
    logger.warn('OpenAI circuit breaker is open, using text extraction fallback');
    return await extractTextFallback(filePath);
  }

  try {
    if (effectiveOcrMode === 'mistral') {
      return await mistralCircuitBreaker.execute(() => 
        retry(() => performMistralOCR(filePath), {
          maxAttempts: 3,
          initialDelay: 1000,
          maxDelay: 10000,
          onRetry: (error, attempt, delay) => {
            logger.warn({ error: error.message, attempt, delay }, 'Mistral OCR retry');
          },
        })
      );
    } else if (effectiveOcrMode === 'gpt4') {
      return await openaiCircuitBreaker.execute(() => 
        retryOpenAI(() => performGPT4OCR(filePath))
      );
    } else {
      logger.warn({ ocrMode: effectiveOcrMode }, 'Unknown OCR mode, using text extraction');
      return await extractTextFallback(filePath);
    }
  } catch (error) {
    if (error instanceof CircuitBreakerError) {
      logger.error({ state: error.state }, 'Circuit breaker prevented OCR call');
    } else {
      logger.error({ error }, 'OCR extraction failed completely');
    }
    
    // Final fallback: basic text extraction
    logger.warn('All OCR methods failed, using fallback extraction');
    return await extractTextFallback(filePath);
  }
}

/**
 * Fallback text extraction (no AI enhancement)
 */
async function extractTextFallback(filePath: string): Promise<string> {
  try {
    const fileBuffer = await fs.readFile(filePath);
    const isPDF = filePath.toLowerCase().endsWith('.pdf');
    
    if (isPDF) {
      const pdfParse = pdfParseModule || (await import('pdf-parse')).default;
      const pdfData = await pdfParse(fileBuffer);
      return pdfData.text || 'Unable to extract text from PDF';
    } else {
      // For images, return a placeholder
      return `[Image file: ${filePath} - OCR services unavailable]`;
    }
  } catch (error) {
    logger.error({ error, filePath }, 'Fallback extraction failed');
    return `[Error extracting text from: ${filePath}]`;
  }
}

/**
 * Mistral OCR extraction
 * For PDFs: uses pdf-parse to extract text, then Mistral AI to enhance/structure it
 * For images: uses Pixtral vision model
 */
async function performMistralOCR(filePath: string): Promise<string> {
  try {
    const fileBuffer = await fs.readFile(filePath);
    const isPDF = filePath.toLowerCase().endsWith('.pdf');
    
    if (isPDF) {
      // Use pdf-parse for PDF text extraction (preloaded or lazy load)
      logger.info({ filePath, size: fileBuffer.length }, 'Extracting text from PDF with pdf-parse');
      const pdfParse = pdfParseModule || (await import('pdf-parse')).default;
      const pdfData = await pdfParse(fileBuffer);
      
      const rawText = pdfData.text;
      logger.info({ textLength: rawText.length, pages: pdfData.numpages }, 'PDF text extracted');
      
      // Optimize: Skip AI enhancement for small/medium documents to improve speed
      if (rawText.length < 5000) {
        logger.info('Text is small/medium, skipping AI enhancement for speed');
        return rawText;
      }
      
      // Use Mistral AI to enhance and structure the extracted text (preloaded or lazy load)
      const Mistral = mistralModule || (await import('@mistralai/mistralai')).Mistral;
      const apiKey = process.env.MISTRAL_API_KEY;
      if (!apiKey) {
        logger.warn('MISTRAL_API_KEY not configured, returning raw PDF text');
        return rawText;
      }
      
      const client = new Mistral({ apiKey });
      // Limit to 20k chars for even faster processing
      const textToProcess = rawText.substring(0, 20000);
      
      // Use smaller/faster model for better performance
      const chatResponse = await client.chat.complete({
        model: 'mistral-small-latest',
        messages: [
          {
            role: 'user',
            content: `Clean this text, fix errors, return markdown:\n\n${textToProcess}`,
          },
        ],
        maxTokens: 4000,
        temperature: 0.3, // Lower temperature for faster, more deterministic responses
      });
      
      const enhancedText = chatResponse.choices?.[0]?.message?.content || rawText;
      logger.info({ enhancedLength: enhancedText.length }, 'Text enhanced with Mistral AI');
      return enhancedText;
    } else {
      // For images, use Pixtral vision model
      const { Mistral } = await import('@mistralai/mistralai');
      const apiKey = process.env.MISTRAL_API_KEY;
      if (!apiKey) {
        throw new Error('MISTRAL_API_KEY not configured');
      }
      
      const client = new Mistral({ apiKey });
      const base64Data = fileBuffer.toString('base64');
      
      logger.info({ filePath, size: fileBuffer.length }, 'Processing image with Mistral Pixtral Vision OCR');
      
      const chatResponse = await client.chat.complete({
        model: 'pixtral-12b-2409',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract all text from this image and return it in markdown format. Preserve the structure and formatting as much as possible.',
              },
              {
                type: 'image_url',
                imageUrl: `data:image/png;base64,${base64Data}`,
              },
            ],
          },
        ],
        maxTokens: 8000,
      });
      
      const extractedText = chatResponse.choices?.[0]?.message?.content || '';
      logger.info({ textLength: extractedText.length }, 'Mistral Vision OCR completed');
      return extractedText;
    }
  } catch (error) {
    logger.error({ error, message: error.message, stack: error.stack }, 'Mistral OCR failed');
    throw error;
  }
}

/**
 * GPT-4 Vision OCR extraction
 */
async function performGPT4OCR(filePath: string): Promise<string> {
  try {
    const OpenAI = (await import('openai')).default;
    
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }
    
    const openai = new OpenAI({ apiKey });
    
    // Read file and convert to base64
    const fileBuffer = await fs.readFile(filePath);
    const base64 = fileBuffer.toString('base64');
    const mimeType = filePath.endsWith('.pdf') ? 'application/pdf' : 'image/png';
    
    logger.info({ filePath, size: fileBuffer.length }, 'Processing with GPT-4 Vision OCR');
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract all text from this document and return it in markdown format. Preserve the structure and formatting.',
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 4096,
    });
    
    const extractedText = response.choices[0]?.message?.content || '';
    logger.info({ textLength: extractedText.length }, 'GPT-4 OCR completed');
    
    return extractedText;
  } catch (error) {
    logger.error({ error }, 'GPT-4 OCR failed');
    throw error;
  }
}

/**
 * OCR + Artifact Generation Worker
 * Downloads file from storage, runs OCR, generates artifacts
 */
export async function processOCRArtifactJob(
  job: Job<ProcessContractJobData>
): Promise<OCRArtifactResult> {
  const { contractId, tenantId, filePath } = job.data;
  const jobLogger = logger.child({ jobId: job.id, contractId, tenantId });

  jobLogger.info({ jobData: job.data }, '🔍 RAW JOB DATA RECEIVED');

  jobLogger.info({ filePath }, 'Starting OCR + artifact processing');

  try {
    jobLogger.info('Step 1: Updating progress to 5%');
    await job.updateProgress(5);

    // 1. Fetch contract from database
    jobLogger.info('Step 2: Fetching contract from database');
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
    });

    if (!contract || contract.tenantId !== tenantId) {
      jobLogger.error({ found: !!contract }, 'Contract not found or tenant mismatch');
      throw new Error(`Contract ${contractId} not found`);
    }

    jobLogger.info({ status: contract.status }, 'Contract found');
    await job.updateProgress(10);

    // 2. Download file from storage to temp location
    let localFilePath: string;
    
    if (contract.storageProvider === 's3') {
      jobLogger.info({ storagePath: contract.storagePath }, 'Downloading from S3/MinIO');
      
      // Use circuit breaker and retry for storage operations
      const fileBuffer = await storageCircuitBreaker.execute(() => 
        retryStorage(async () => {
          const getObjectCommand = new GetObjectCommand({
            Bucket: process.env.MINIO_BUCKET || 'contracts',
            Key: contract.storagePath,
          });

          const response = await s3Client.send(getObjectCommand);
          
          // Read stream to buffer
          const stream = response.Body as Readable;
          const chunks: Buffer[] = [];
          
          for await (const chunk of stream) {
            chunks.push(Buffer.from(chunk));
          }
          
          return Buffer.concat(chunks);
        })
      );
      
      // Create temp file
      const tempDir = os.tmpdir();
      const fileName = path.basename(contract.storagePath);
      localFilePath = path.join(tempDir, `${contractId}-${fileName}`);
      
      await fs.writeFile(localFilePath, fileBuffer);
      jobLogger.info({ localFilePath, size: fileBuffer.length }, 'File downloaded');
    } else {
      // Local file system
      localFilePath = contract.storagePath;
      jobLogger.info({ localFilePath }, 'Using local file');
    }

    // 3. Run OCR extraction (skip progress update for speed)
    jobLogger.info({ filePath: localFilePath }, 'Running OCR extraction');
    
    const ocrMode = (contract as any).ocrMode || 'mistral'; // Default to Mistral OCR
    const extractedText = await performOCR(localFilePath, ocrMode);
    
    jobLogger.info({ ocrMode, textLength: extractedText.length }, 'OCR extraction completed');

    await job.updateProgress(60);

    // 4. Generate artifacts using AI
    jobLogger.info('Generating AI artifacts');
    
    const artifactTypes = [
      'OVERVIEW',
      'CLAUSES', 
      'FINANCIAL',
      'RISK',
      'COMPLIANCE',
    ];

    // Generate all artifacts in parallel with retry logic
    const artifactPromises = artifactTypes.map(async (artifactType) => {
      const maxRetries = 2;
      let lastError: Error | null = null;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const artifactData = await generateArtifactWithAI(artifactType, extractedText, contract);
          return {
            contractId,
            tenantId,
            type: artifactType,
            data: artifactData,
            validationStatus: 'valid',
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        } catch (error) {
          lastError = error as Error;
          jobLogger.warn({ error, artifactType, attempt }, `Artifact generation attempt ${attempt} failed`);
          
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 500 * attempt));
          }
        }
      }
      
      // Generate fallback artifact
      jobLogger.error({ error: lastError, artifactType }, `All attempts failed, creating fallback artifact`);
      return {
        contractId,
        tenantId,
        type: artifactType,
        data: { error: 'Failed to generate', type: artifactType, fallback: true },
        validationStatus: 'error',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });

    const artifactDataArray = (await Promise.all(artifactPromises)).filter(Boolean);
    
    // Batch create all artifacts at once
    const artifacts = await prisma.artifact.createMany({
      data: artifactDataArray as any,
      skipDuplicates: true,
    });

    jobLogger.info({ artifactsCreated: artifacts.count }, 'All artifacts created in batch');

    await job.updateProgress(90);

    // 5. Batch update contract and processing job in parallel
    const updatePromises = [
      prisma.contract.updateMany({
        where: { id: contractId, tenantId },
        data: {
          status: 'COMPLETED',
          updatedAt: new Date(),
        },
      }),
      prisma.processingJob.findFirst({
        where: { contractId, tenantId },
        orderBy: { createdAt: 'desc' },
      }).then(processingJob => {
        if (processingJob) {
          return prisma.processingJob.updateMany({
            where: { id: processingJob.id, tenantId },
            data: {
              status: 'COMPLETED',
              progress: 100,
              currentStep: 'completed',
            },
          });
        }
      })
    ];
    
    const [contractUpdateResult] = await Promise.all(updatePromises);

    if (contractUpdateResult.count === 0) {
      jobLogger.warn('Contract update skipped because no matching record was found');
    }

    // Clean up temp file if we created one
    if (contract.storageProvider === 's3') {
      await fs.unlink(localFilePath).catch(() => {});
    }

    await job.updateProgress(100);

    jobLogger.info({ 
      artifactsCreated: artifacts.count,
      textLength: extractedText.length 
    }, 'OCR + artifact processing completed');

    return {
      success: true,
      artifactsCreated: artifacts.count,
      extractedText: extractedText.substring(0, 500), // First 500 chars for logging
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    jobLogger.error({ 
      error: errorMessage,
      stack: errorStack
    }, 'OCR + artifact processing failed');

    // Update statuses to failed
    try {
      await prisma.contract.updateMany({
        where: { id: contractId, tenantId },
        data: { status: 'FAILED', updatedAt: new Date() },
      });

      const processingJob = await prisma.processingJob.findFirst({
        where: { contractId, tenantId },
        orderBy: { createdAt: 'desc' },
      });

      if (processingJob) {
        await prisma.processingJob.updateMany({
          where: { id: processingJob.id, tenantId },
          data: {
            status: 'FAILED',
            currentStep: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    } catch (updateError) {
      jobLogger.error({ updateError }, 'Failed to update failure status');
    }

    throw error;
  }
}

/**
 * Generate artifact data using AI (placeholder - integrate with actual OpenAI)
 */
async function generateArtifactWithAI(
  type: string,
  contractText: string,
  contract: any
): Promise<Record<string, any>> {
  // This is a placeholder - should integrate with actual OpenAI API
  // For now, return structured data based on type
  
  const artifactTemplates: Record<string, any> = {
    OVERVIEW: {
      summary: `Contract analysis for ${contract.contractTitle}`,
      contractType: contract.contractType || 'Service Agreement',
      parties: [contract.clientName, contract.supplierName].filter(Boolean),
      effectiveDate: contract.effectiveDate?.toISOString() || new Date().toISOString(),
      expirationDate: contract.expirationDate?.toISOString() || null,
      totalValue: contract.totalValue || 0,
      currency: contract.currency || 'USD',
      keyTerms: ['Payment terms', 'Deliverables', 'Service levels'],
      extractedLength: contractText.length,
    },
    CLAUSES: {
      clauses: [
        {
          title: 'Scope of Work',
          content: 'Extracted scope of work details',
          importance: 'high',
          pageReference: 1,
        },
        {
          title: 'Payment Terms',
          content: 'Payment terms and conditions',
          importance: 'high',
          pageReference: 2,
        },
        {
          title: 'Termination',
          content: 'Termination clauses and conditions',
          importance: 'high',
          pageReference: 3,
        },
      ],
    },
    FINANCIAL: {
      totalValue: contract.totalValue || 0,
      currency: contract.currency || 'USD',
      paymentSchedule: 'To be determined from contract text',
      costBreakdown: [],
      analysis: 'Financial analysis based on OCR extraction',
    },
    RISK: {
      overallRisk: 'Medium',
      risks: [
        {
          category: 'Compliance',
          level: 'Low',
          description: 'Standard compliance requirements',
        },
        {
          category: 'Financial',
          level: 'Medium',
          description: 'Payment terms require monitoring',
        },
      ],
    },
    COMPLIANCE: {
      compliant: true,
      checks: [
        { regulation: 'Internal Policy', status: 'compliant' },
      ],
      issues: [],
      recommendations: [],
    },
  };

  return artifactTemplates[type] || { type, generated: true, timestamp: new Date() };
}

/**
 * Register OCR + Artifact worker
 */
export function registerOCRArtifactWorker() {
  const queueService = getQueueService();

  const worker = queueService.registerWorker<ProcessContractJobData, OCRArtifactResult>(
    QUEUE_NAMES.CONTRACT_PROCESSING,
    processOCRArtifactJob,
    {
      concurrency: 3, // Process 3 contracts at a time (optimized)
      limiter: {
        max: 15,
        duration: 60000, // Max 15 jobs per minute
      },
      settings: {
        maxStalledCount: 2, // Retry up to 2 times if stalled
        stalledInterval: 30000, // Check for stalled jobs every 30s
      },
    }
  );

  logger.info('OCR + Artifact worker registered');

  return worker;
}

// Start worker if this file is run directly
if (require.main === module) {
  logger.info('Starting OCR + Artifact worker...');
  registerOCRArtifactWorker();
  
  // Keep process alive
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully...');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully...');
    process.exit(0);
  });
}

/**
 * Get circuit breaker metrics for health monitoring
 */
export function getCircuitBreakerMetrics() {
  return {
    mistral: mistralCircuitBreaker.getMetrics(),
    openai: openaiCircuitBreaker.getMetrics(),
    storage: storageCircuitBreaker.getMetrics(),
  };
}

/**
 * Reset circuit breakers (for testing or manual intervention)
 */
export function resetCircuitBreakers() {
  mistralCircuitBreaker.reset();
  openaiCircuitBreaker.reset();
  storageCircuitBreaker.reset();
  logger.info('All circuit breakers reset');
}
