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

// Simple in-memory cache for OCR results (production would use Redis)
const ocrCache = new Map<string, { text: string; timestamp: number }>();
const artifactCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const OCR_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours for OCR results

// Cleanup old cache entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of artifactCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      artifactCache.delete(key);
    }
  }
  for (const [key, value] of ocrCache.entries()) {
    if (now - value.timestamp > OCR_CACHE_TTL) {
      ocrCache.delete(key);
    }
  }
}, 10 * 60 * 1000);

// OCR fallback chain - try in order until one succeeds
const OCR_FALLBACK_CHAIN = ['mistral', 'gpt4', 'tesseract'] as const;
type OCRMode = typeof OCR_FALLBACK_CHAIN[number];

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
  partialSuccess?: boolean;
  failedArtifacts?: string[];
}

/**
 * Generate cache key for OCR results
 */
function generateOCRCacheKey(filePath: string, fileSize: number): string {
  const fileName = path.basename(filePath);
  return `ocr:${fileName}:${fileSize}`;
}

/**
 * Perform OCR extraction on a file with circuit breaker protection and caching
 */
async function performOCR(filePath: string, ocrMode: string, fileSize?: number): Promise<string> {
  logger.info({ filePath, ocrMode }, 'Performing OCR extraction');
  
  // Check cache first
  if (fileSize) {
    const cacheKey = generateOCRCacheKey(filePath, fileSize);
    const cached = ocrCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < OCR_CACHE_TTL) {
      logger.info({ cacheKey }, 'Using cached OCR result');
      return cached.text;
    }
  }
  
  // Build fallback chain starting from preferred mode
  const preferredIndex = OCR_FALLBACK_CHAIN.indexOf(ocrMode as OCRMode);
  const fallbackOrder = preferredIndex >= 0 
    ? [...OCR_FALLBACK_CHAIN.slice(preferredIndex), ...OCR_FALLBACK_CHAIN.slice(0, preferredIndex)]
    : OCR_FALLBACK_CHAIN;
  
  let lastError: Error | null = null;
  
  for (const mode of fallbackOrder) {
    // Check circuit breaker state before attempting
    if (mode === 'mistral' && mistralCircuitBreaker.getState() === CircuitState.OPEN) {
      logger.warn('Mistral circuit breaker is open, skipping');
      continue;
    }
    if (mode === 'gpt4' && openaiCircuitBreaker.getState() === CircuitState.OPEN) {
      logger.warn('OpenAI circuit breaker is open, skipping');
      continue;
    }
    
    try {
      let result: string;
      
      if (mode === 'mistral') {
        result = await mistralCircuitBreaker.execute(() => 
          retry(() => performMistralOCR(filePath), {
            maxAttempts: 3,
            initialDelay: 1000,
            maxDelay: 10000,
            onRetry: (error, attempt, delay) => {
              logger.warn({ error: error.message, attempt, delay }, 'Mistral OCR retry');
            },
          })
        );
      } else if (mode === 'gpt4') {
        result = await openaiCircuitBreaker.execute(() => 
          retryOpenAI(() => performGPT4OCR(filePath))
        );
      } else {
        // tesseract/fallback
        result = await extractTextFallback(filePath);
      }
      
      // Cache successful result
      if (fileSize && result && result.length > 100) {
        const cacheKey = generateOCRCacheKey(filePath, fileSize);
        ocrCache.set(cacheKey, { text: result, timestamp: Date.now() });
        logger.info({ cacheKey, textLength: result.length }, 'Cached OCR result');
      }
      
      logger.info({ mode, textLength: result.length }, 'OCR extraction succeeded');
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (error instanceof CircuitBreakerError) {
        logger.warn({ mode, state: error.state }, 'Circuit breaker prevented OCR call, trying next');
      } else {
        logger.warn({ mode, error: lastError.message }, 'OCR mode failed, trying next');
      }
    }
  }
  
  // All modes exhausted - use basic extraction as last resort
  logger.error({ lastError: lastError?.message }, 'All OCR modes exhausted, using basic extraction');
  return await extractTextFallback(filePath);
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
      return typeof extractedText === 'string' ? extractedText : '';
    }
  } catch (error) {
    const err = error as Error;
    logger.error({ error: err, message: err.message, stack: err.stack }, 'Mistral OCR failed');
    throw error;
  }
}

/**
 * GPT-4 Vision OCR extraction
 * For PDFs: Uses pdf-parse to extract text, then GPT to clean/enhance
 * For images: Uses GPT-4 Vision
 */
async function performGPT4OCR(filePath: string): Promise<string> {
  try {
    const OpenAI = (await import('openai')).default;
    
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }
    
    const openai = new OpenAI({ apiKey });
    const fileBuffer = await fs.readFile(filePath);
    const isPDF = filePath.toLowerCase().endsWith('.pdf');
    
    // For PDFs, use pdf-parse first, then GPT for enhancement
    if (isPDF) {
      logger.info({ filePath, size: fileBuffer.length }, 'Processing PDF with pdf-parse + GPT enhancement');
      
      const pdfParse = pdfParseModule || (await import('pdf-parse')).default;
      const pdfData = await pdfParse(fileBuffer);
      const rawText = pdfData.text;
      
      logger.info({ textLength: rawText.length, pages: pdfData.numpages }, 'PDF text extracted');
      
      // For small documents, skip GPT enhancement
      if (rawText.length < 3000) {
        return rawText;
      }
      
      // Use GPT to clean and structure the text
      const textToProcess = rawText.substring(0, 15000);
      
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a document processing expert. Clean and structure the following extracted PDF text. Fix OCR errors, format as clean markdown, and preserve the document structure.'
          },
          {
            role: 'user',
            content: textToProcess
          }
        ],
        max_tokens: 4096,
        temperature: 0.2
      });
      
      const enhancedText = response.choices[0]?.message?.content || rawText;
      logger.info({ originalLength: rawText.length, enhancedLength: enhancedText.length }, 'GPT text enhancement completed');
      
      return enhancedText;
    } else {
      // For images, use GPT-4 Vision
      const base64 = fileBuffer.toString('base64');
      const ext = filePath.toLowerCase().split('.').pop();
      const mimeType = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
      
      logger.info({ filePath, size: fileBuffer.length, mimeType }, 'Processing image with GPT-4 Vision OCR');
      
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract all text from this image and return it in markdown format. Preserve the structure and formatting.',
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
      logger.info({ textLength: extractedText.length }, 'GPT-4 Vision OCR completed');
      
      return extractedText;
    }
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
    
    // Get ocrMode from job data (user selection) or fallback to default
    const ocrMode = job.data.ocrMode || 'mistral'; // Default to Mistral OCR
    const extractedText = await performOCR(localFilePath, ocrMode);
    
    jobLogger.info({ ocrMode, textLength: extractedText.length }, 'OCR extraction completed');

    await job.updateProgress(60);

    // 4. Generate artifacts using AI with partial success tracking
    jobLogger.info('Generating AI artifacts');
    
    const artifactTypes = [
      'OVERVIEW',
      'CLAUSES', 
      'FINANCIAL',
      'RISK',
      'COMPLIANCE',
    ];

    const failedArtifacts: string[] = [];
    const successfulArtifacts: string[] = [];

    // Generate all artifacts in parallel with retry logic
    const artifactPromises = artifactTypes.map(async (artifactType) => {
      const maxRetries = 2;
      let lastError: Error | null = null;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const artifactData = await generateArtifactWithAI(artifactType, extractedText, contract);
          successfulArtifacts.push(artifactType);
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
      
      // Track failed artifact for partial success reporting
      failedArtifacts.push(artifactType);
      
      // Generate fallback artifact with retry metadata
      jobLogger.error({ error: lastError, artifactType }, `All attempts failed, creating fallback artifact`);
      return {
        contractId,
        tenantId,
        type: artifactType,
        data: { 
          error: 'Failed to generate', 
          type: artifactType, 
          fallback: true,
          retryable: true,
          lastError: lastError?.message,
        },
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

    // Determine final status based on success rate
    const hasPartialSuccess = failedArtifacts.length > 0 && successfulArtifacts.length > 0;
    const hasCompleteFailure = successfulArtifacts.length === 0;
    const finalStatus = hasCompleteFailure ? 'FAILED' : (hasPartialSuccess ? 'PARTIAL' : 'COMPLETED');

    jobLogger.info({ 
      artifactsCreated: artifacts.count,
      successfulArtifacts,
      failedArtifacts,
      finalStatus,
    }, 'Artifact generation completed');

    await job.updateProgress(90);

    // 5. Batch update contract and processing job in parallel
    const updatePromises = [
      prisma.contract.updateMany({
        where: { id: contractId, tenantId },
        data: {
          status: finalStatus === 'PARTIAL' ? 'COMPLETED' : finalStatus, // Treat partial as completed for now
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
              status: finalStatus === 'PARTIAL' ? 'COMPLETED' : finalStatus,
              progress: 100,
              currentStep: failedArtifacts.length > 0 ? `completed with ${failedArtifacts.length} failed artifacts` : 'completed',
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
      textLength: extractedText.length,
      partialSuccess: hasPartialSuccess,
      failedArtifacts,
    }, 'OCR + artifact processing completed');

    return {
      success: !hasCompleteFailure,
      artifactsCreated: artifacts.count,
      extractedText: extractedText.substring(0, 500), // First 500 chars for logging
      partialSuccess: hasPartialSuccess,
      failedArtifacts: failedArtifacts.length > 0 ? failedArtifacts : undefined,
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
 * Generate artifact data using OpenAI API - REAL AI ANALYSIS
 */
async function generateArtifactWithAI(
  type: string,
  contractText: string,
  contract: any
): Promise<Record<string, any>> {
  const apiKey = process.env.OPENAI_API_KEY;
  
  // If no API key, use fallback templates
  if (!apiKey) {
    logger.warn('OPENAI_API_KEY not configured, using fallback templates');
    return getFallbackArtifact(type, contractText, contract);
  }

  try {
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey });
    
    // Limit contract text to avoid token limits (use first 15000 chars)
    const truncatedText = contractText.substring(0, 15000);
    
    const prompts: Record<string, string> = {
      OVERVIEW: `Analyze this contract and extract key information. Return a JSON object with:
{
  "summary": "A 2-3 sentence executive summary of what this contract is about",
  "contractType": "The type of contract (e.g., Service Agreement, NDA, MSA, SOW, Employment, Lease)",
  "parties": [{"name": "Party name", "role": "Client/Vendor/Contractor/etc"}],
  "effectiveDate": "YYYY-MM-DD or null if not found",
  "expirationDate": "YYYY-MM-DD or null if not found",
  "totalValue": numeric value or 0 if not found,
  "currency": "USD/EUR/GBP/etc",
  "keyTerms": ["list", "of", "key", "terms", "or", "topics"],
  "jurisdiction": "Legal jurisdiction if mentioned"
}

Contract text:
${truncatedText}`,

      CLAUSES: `Extract the key clauses from this contract. Return a JSON object with:
{
  "clauses": [
    {
      "title": "Clause title/name",
      "content": "Brief summary of what the clause says (2-3 sentences)",
      "importance": "high/medium/low",
      "category": "payment/termination/liability/confidentiality/indemnification/warranty/scope/other"
    }
  ]
}

Find ALL significant clauses (aim for 5-15 clauses). Focus on:
- Payment terms, pricing, invoicing
- Term and termination conditions
- Liability limitations, indemnification
- Confidentiality, IP rights
- Warranties, representations
- Scope of work, deliverables
- Force majeure, dispute resolution

Contract text:
${truncatedText}`,

      FINANCIAL: `Extract all financial terms from this contract. Return a JSON object with:
{
  "totalValue": numeric value or 0,
  "currency": "USD/EUR/GBP/etc",
  "paymentTerms": "Description of payment terms (e.g., Net 30, monthly, milestone-based)",
  "paymentSchedule": [{"milestone": "description", "amount": number, "dueDate": "date or trigger"}],
  "costBreakdown": [{"category": "name", "amount": number, "description": "details"}],
  "penalties": ["List of any late fees, penalties, or liquidated damages"],
  "discounts": ["Any discounts, volume pricing, or incentives mentioned"],
  "analysis": "Brief analysis of the financial terms and any concerns"
}

Contract text:
${truncatedText}`,

      RISK: `Analyze this contract for risks. Return a JSON object with:
{
  "overallRisk": "Low/Medium/High",
  "riskScore": number from 0-100 (0=no risk, 100=extreme risk),
  "risks": [
    {
      "category": "Financial/Legal/Operational/Compliance/Reputational",
      "level": "Low/Medium/High",
      "title": "Short risk title",
      "description": "Detailed description of the risk",
      "mitigation": "Suggested mitigation or action"
    }
  ],
  "redFlags": ["List any critical concerns or red flags"],
  "recommendations": ["Key recommendations for negotiation or review"]
}

Look for:
- Unfavorable terms, one-sided clauses
- Missing protections (liability caps, termination rights)
- Compliance concerns (GDPR, regulatory)
- Financial risks (payment terms, penalties)
- Ambiguous language that could cause disputes

Contract text:
${truncatedText}`,

      COMPLIANCE: `Review this contract for compliance requirements. Return a JSON object with:
{
  "compliant": true/false (overall assessment),
  "complianceScore": number from 0-100,
  "checks": [
    {
      "regulation": "Name of regulation/standard (GDPR, SOC2, HIPAA, etc)",
      "status": "compliant/non-compliant/needs-review/not-applicable",
      "details": "Brief explanation"
    }
  ],
  "issues": [
    {
      "severity": "high/medium/low",
      "description": "Description of the compliance issue",
      "recommendation": "How to address it"
    }
  ],
  "dataProtection": {
    "hasDataProcessing": true/false,
    "hasDPA": true/false,
    "concerns": ["any data protection concerns"]
  },
  "recommendations": ["List of compliance recommendations"]
}

Contract text:
${truncatedText}`
    };

    const prompt = prompts[type];
    if (!prompt) {
      logger.warn({ type }, 'Unknown artifact type, using fallback');
      return getFallbackArtifact(type, contractText, contract);
    }

    logger.info({ type, textLength: truncatedText.length }, 'Calling OpenAI for artifact generation');

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a contract analysis expert. Analyze contracts and return ONLY valid JSON (no markdown, no explanation). Be thorough and accurate.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 4000,
      temperature: 0.2, // Low temperature for consistent, accurate extraction
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    const artifactData = JSON.parse(content);
    logger.info({ type, keys: Object.keys(artifactData) }, 'Successfully generated artifact with AI');
    
    // Add metadata
    artifactData._meta = {
      generatedAt: new Date().toISOString(),
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      aiGenerated: true,
      textAnalyzed: truncatedText.length
    };

    return artifactData;

  } catch (error) {
    logger.error({ error, type }, 'OpenAI artifact generation failed, using fallback');
    return getFallbackArtifact(type, contractText, contract);
  }
}

/**
 * Fallback artifact templates when AI is unavailable
 */
function getFallbackArtifact(type: string, contractText: string, contract: any): Record<string, any> {
  const artifactTemplates: Record<string, any> = {
    OVERVIEW: {
      summary: `Contract uploaded: ${contract.fileName || contract.contractTitle || 'Unknown'}. AI analysis unavailable - please review manually.`,
      contractType: contract.contractType || 'Unknown',
      parties: [contract.clientName, contract.supplierName].filter(Boolean).map((name: string) => ({ name, role: 'Party' })),
      effectiveDate: contract.effectiveDate?.toISOString() || null,
      expirationDate: contract.expirationDate?.toISOString() || null,
      totalValue: contract.totalValue || 0,
      currency: contract.currency || 'USD',
      keyTerms: [],
      extractedLength: contractText.length,
      _meta: { fallback: true, reason: 'AI unavailable' }
    },
    CLAUSES: {
      clauses: [],
      _meta: { fallback: true, reason: 'AI unavailable', message: 'Clause extraction requires AI analysis' }
    },
    FINANCIAL: {
      totalValue: contract.totalValue || 0,
      currency: contract.currency || 'USD',
      paymentTerms: 'Not analyzed',
      paymentSchedule: [],
      costBreakdown: [],
      analysis: 'Financial analysis requires AI - please configure OPENAI_API_KEY',
      _meta: { fallback: true, reason: 'AI unavailable' }
    },
    RISK: {
      overallRisk: 'Unknown',
      riskScore: 50,
      risks: [],
      redFlags: [],
      recommendations: ['Configure AI analysis for proper risk assessment'],
      _meta: { fallback: true, reason: 'AI unavailable' }
    },
    COMPLIANCE: {
      compliant: null,
      complianceScore: null,
      checks: [],
      issues: [],
      recommendations: ['Configure AI analysis for compliance review'],
      _meta: { fallback: true, reason: 'AI unavailable' }
    },
  };

  return artifactTemplates[type] || { type, generated: true, timestamp: new Date(), _meta: { fallback: true } };
}

/**
 * Register OCR + Artifact worker
 */
export function registerOCRArtifactWorker() {
  const queueService = getQueueService();

  // Read concurrency from env or use optimized defaults
  const concurrency = parseInt(process.env.WORKER_CONCURRENCY || '5', 10);
  const maxJobsPerMinute = parseInt(process.env.WORKER_RATE_LIMIT || '30', 10);
  
  logger.info({ concurrency, maxJobsPerMinute }, '⚡ Worker configuration for bulk processing');
  
  const worker = queueService.registerWorker<ProcessContractJobData, OCRArtifactResult>(
    QUEUE_NAMES.CONTRACT_PROCESSING,
    processOCRArtifactJob,
    {
      concurrency, // Process multiple contracts in parallel (env configurable)
      limiter: {
        max: maxJobsPerMinute,
        duration: 60000, // Rate limit per minute
      },
      settings: {
        maxStalledCount: 3, // Retry up to 3 times if stalled
        stalledInterval: 20000, // Check for stalled jobs every 20s (faster recovery)
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
