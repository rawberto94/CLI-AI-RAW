import { createHash } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

import { nanoid } from 'nanoid';
import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';

import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  type AuthenticatedApiContext,
} from '@/lib/api-middleware';
import { PROCESSING_PRIORITY, triggerArtifactGeneration } from '@/lib/artifact-trigger';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { publishRealtimeEvent } from '@/lib/realtime/publish';
import { rateLimitConfigs } from '@/lib/rate-limit';
import { scanBuffer } from '@/lib/security/virus-scan';
import { contractUploadSchema } from '@/lib/validation/contract.validation';

let redisClient: any = null;

const memoryRateStore = new Map<string, { count: number; resetAt: number }>();
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, value] of memoryRateStore.entries()) {
    if (value.resetAt < now) {
      memoryRateStore.delete(key);
    }
  }
}, 120_000);
cleanupInterval.unref();

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/bmp',
  'image/tiff',
  'image/webp',
];

const ALLOWED_EXTENSIONS = [
  '.pdf',
  '.docx',
  '.doc',
  '.txt',
  '.jpeg',
  '.jpg',
  '.png',
  '.gif',
  '.bmp',
  '.tiff',
  '.tif',
  '.webp',
];

const MAX_FILE_SIZE = 100 * 1024 * 1024;

interface FileValidationResult {
  valid: boolean;
  error?: string;
  details?: string;
}

const MAGIC_BYTES: Record<string, { offset: number; bytes: number[] }[]> = {
  '.pdf': [{ offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] }],
  '.docx': [{ offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }],
  '.xlsx': [{ offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }],
  '.pptx': [{ offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }],
  '.png': [{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47] }],
  '.jpg': [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }],
  '.jpeg': [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }],
  '.tif': [{ offset: 0, bytes: [0x49, 0x49] }, { offset: 0, bytes: [0x4d, 0x4d] }],
  '.tiff': [{ offset: 0, bytes: [0x49, 0x49] }, { offset: 0, bytes: [0x4d, 0x4d] }],
};

async function getUploadRedisClient(): Promise<any> {
  if (redisClient) return redisClient;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  try {
    const Redis = (await import('ioredis')).default;
    redisClient = new Redis(redisUrl, { maxRetriesPerRequest: 2, lazyConnect: true });
    redisClient.on('error', () => {
      redisClient = null;
    });
    await redisClient.connect();
    return redisClient;
  } catch {
    redisClient = null;
    return null;
  }
}

async function checkUploadRateLimit(tenantId: string): Promise<{ allowed: boolean; retryAfter?: number }> {
  const config = rateLimitConfigs['/api/contracts/upload'] || {
    windowMs: 60000,
    maxRequests: 10,
    keyPrefix: 'ratelimit:upload:',
  };
  const key = `${config.keyPrefix}${tenantId}`;
  const now = Date.now();

  const redis = await getUploadRedisClient();
  if (redis) {
    try {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.pexpire(key, config.windowMs);
      }
      if (count > config.maxRequests) {
        const ttl = await redis.pttl(key);
        return { allowed: false, retryAfter: Math.ceil(Math.max(ttl, 1000) / 1000) };
      }
      return { allowed: true };
    } catch (error) {
      logger.warn('[RateLimit] Redis unavailable, falling back to in-memory rate limiter — multi-instance deployments are NOT protected', {
        error: (error as Error).message,
      });
    }
  }

  const entry = memoryRateStore.get(key);
  if (entry && entry.resetAt > now) {
    entry.count += 1;
    if (entry.count > config.maxRequests) {
      return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
    }
    return { allowed: true };
  }

  memoryRateStore.set(key, { count: 1, resetAt: now + config.windowMs });
  return { allowed: true };
}

function generateContentHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

function validateFileType(file: File): FileValidationResult {
  const fileName = file.name.toLowerCase();
  const fileExtension = fileName.substring(fileName.lastIndexOf('.'));

  if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
    return {
      valid: false,
      error: 'Invalid file type',
      details: `File extension ${fileExtension} is not supported. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`,
    };
  }

  if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid MIME type',
      details: `MIME type ${file.type} is not supported`,
    };
  }

  return { valid: true };
}

function validateMagicBytes(buffer: Buffer, extension: string): FileValidationResult {
  const rules = MAGIC_BYTES[extension];
  if (!rules || rules.length === 0) {
    return { valid: true };
  }

  const matches = rules.some((rule) => rule.bytes.every((byte, index) => buffer[rule.offset + index] === byte));
  if (!matches) {
    return {
      valid: false,
      error: 'File content mismatch',
      details: `File content does not match expected format for ${extension}. The file may have been renamed.`,
    };
  }

  return { valid: true };
}

function validateFileSize(file: File): FileValidationResult {
  if (file.size === 0) {
    return {
      valid: false,
      error: 'Empty file',
      details: 'The uploaded file is empty',
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    const maxSizeMB = MAX_FILE_SIZE / (1024 * 1024);
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: 'File too large',
      details: `File size (${fileSizeMB}MB) exceeds maximum allowed size of ${maxSizeMB}MB`,
    };
  }

  return { valid: true };
}

function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/\.+/g, '.')
    .replace(/_+/g, '_')
    .substring(0, 255);
}

function calculateUploadPriority(fileSize: number, requestedPriority: string | null) {
  if (requestedPriority === 'urgent' || requestedPriority === 'high') {
    return PROCESSING_PRIORITY.HIGH;
  }
  if (requestedPriority === 'low' || requestedPriority === 'bulk') {
    return PROCESSING_PRIORITY.LOW;
  }
  if (requestedPriority === 'background') {
    return PROCESSING_PRIORITY.BACKGROUND;
  }

  const megabyte = 1024 * 1024;
  if (fileSize < 1 * megabyte) return PROCESSING_PRIORITY.HIGH;
  if (fileSize < 5 * megabyte) return PROCESSING_PRIORITY.NORMAL;
  if (fileSize < 20 * megabyte) return PROCESSING_PRIORITY.LOW;
  return PROCESSING_PRIORITY.BACKGROUND;
}

export async function postContractUpload(
  request: NextRequest,
  context: AuthenticatedApiContext,
) {
  const uploadStartTime = Date.now();
  const tenantId = context.tenantId;

  if (!tenantId) {
    logger.warn('[ContractUpload] No tenant ID found in authenticated context', {
      userId: context.userId,
    });
    return createErrorResponse(context, 'VALIDATION_ERROR', 'Tenant ID is required', 400, {
      details: 'No tenant ID found in your session. Please sign out and sign back in.',
    });
  }

  logger.info('[ContractUpload] Upload request received', {
    tenantId,
    userId: context.userId,
  });

  try {
    const rateLimitResult = await checkUploadRateLimit(tenantId);
    if (!rateLimitResult.allowed) {
      return createErrorResponse(context, 'RATE_LIMITED', 'Too many uploads. Limit: 10 per minute.', 429, {
        retryAfter: rateLimitResult.retryAfter,
      });
    }

    const tenantMaxContracts = parseInt(process.env.TENANT_MAX_CONTRACTS || '10000', 10);
    const tenantMaxStorageMb = parseInt(process.env.TENANT_MAX_STORAGE_MB || '50000', 10);
    try {
      const tenantUsage = await prisma.contract.aggregate({
        where: { tenantId, isDeleted: false },
        _count: { id: true },
        _sum: { fileSize: true },
      });
      const contractCount = tenantUsage._count.id || 0;
      const storageMB = Number(tenantUsage._sum.fileSize || 0) / (1024 * 1024);

      if (contractCount >= tenantMaxContracts) {
        return createErrorResponse(
          context,
          'QUOTA_EXCEEDED',
          `Tenant quota exceeded: ${contractCount}/${tenantMaxContracts} contracts`,
          403,
          {
            details: `Maximum ${tenantMaxContracts} contracts per tenant (current: ${contractCount}). Please archive or delete unused contracts.`,
          },
        );
      }
      if (storageMB >= tenantMaxStorageMb) {
        return createErrorResponse(
          context,
          'QUOTA_EXCEEDED',
          `Storage quota exceeded: ${storageMB.toFixed(0)}MB/${tenantMaxStorageMb}MB`,
          403,
          {
            details: `Maximum ${tenantMaxStorageMb}MB storage per tenant (current: ${Math.round(storageMB)}MB).`,
          },
        );
      }
    } catch (error) {
      logger.warn('Failed to check tenant quota, allowing upload', { tenantId, error: String(error) });
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return createErrorResponse(context, 'VALIDATION_ERROR', 'Invalid request format', 400, {
        details: 'Request must be multipart/form-data with a file field',
      });
    }

    const fileField = formData.get('file');
    if (!(fileField instanceof File)) {
      return createErrorResponse(context, 'VALIDATION_ERROR', 'No file provided', 400, {
        details: 'Please select a file to upload',
      });
    }

    const file = fileField;

    try {
      contractUploadSchema.parse({
        contractType: formData.get('contractType') ? (formData.get('contractType') as string) : undefined,
        startDate: formData.get('startDate') ? (formData.get('startDate') as string) : undefined,
        endDate: formData.get('endDate') ? (formData.get('endDate') as string) : undefined,
        totalValue: formData.get('totalValue')
          ? (Number.isFinite(parseFloat(formData.get('totalValue') as string))
              ? parseFloat(formData.get('totalValue') as string)
              : undefined)
          : undefined,
        currency: formData.get('currency') ? (formData.get('currency') as string) : undefined,
        clientName: formData.get('clientName') ? (formData.get('clientName') as string) : undefined,
        supplierName: formData.get('supplierName') ? (formData.get('supplierName') as string) : undefined,
        contractTitle: formData.get('contractTitle') ? (formData.get('contractTitle') as string) : undefined,
        description: formData.get('description') ? (formData.get('description') as string) : undefined,
        category: formData.get('category') ? (formData.get('category') as string) : undefined,
        priority: formData.get('priority') ? (formData.get('priority') as string) : undefined,
        ocrMode: formData.get('ocrMode') ? (formData.get('ocrMode') as string) : undefined,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return createErrorResponse(context, 'VALIDATION_ERROR', 'Validation failed', 400, {
          details: error.errors.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(', '),
        });
      }
      throw error;
    }

    const typeValidation = validateFileType(file);
    if (!typeValidation.valid) {
      return createErrorResponse(context, 'VALIDATION_ERROR', typeValidation.error || 'Invalid file type', 400, {
        details: typeValidation.details,
      });
    }

    const sizeValidation = validateFileSize(file);
    if (!sizeValidation.valid) {
      return createErrorResponse(context, 'VALIDATION_ERROR', sizeValidation.error || 'Invalid file size', 400, {
        details: sizeValidation.details,
      });
    }

    const timestamp = Date.now();
    const sanitizedFileName = sanitizeFileName(file.name);
    const storedFileName = `${timestamp}-${nanoid(8)}-${sanitizedFileName}`;
    const objectKey = `contracts/${tenantId}/${storedFileName}`;

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    const magicValidation = validateMagicBytes(buffer, fileExtension);
    if (!magicValidation.valid) {
      return createErrorResponse(context, 'VALIDATION_ERROR', magicValidation.error || 'File content mismatch', 400, {
        details: magicValidation.details,
      });
    }

    const scanResult = await scanBuffer(buffer, file.name);
    if (!scanResult.clean) {
      logger.warn(`Virus scan failed for ${file.name}`, { threats: scanResult.threats, tenantId });
      return NextResponse.json(
        { error: 'File rejected by security scan', threats: scanResult.threats },
        { status: 422 },
      );
    }

    const contentHash = generateContentHash(buffer);
    const skipDuplicateCheck = request.headers.get('x-skip-duplicate-check') === 'true';
    const enableDuplicateDetection = process.env.DISABLE_DUPLICATE_DETECTION !== 'true';

    if (enableDuplicateDetection && !skipDuplicateCheck) {
      try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const existingContract = await prisma.contract.findFirst({
          where: {
            tenantId,
            checksum: contentHash,
            isDeleted: false,
            status: { notIn: ['FAILED', 'DELETED'] },
            createdAt: { gte: sevenDaysAgo },
          },
          select: { id: true, status: true, fileName: true, createdAt: true },
        });

        if (existingContract) {
          return createSuccessResponse(context, {
            contractId: existingContract.id,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
            status: existingContract.status,
            message: 'This file was uploaded recently (within 7 days). You can re-process or view existing.',
            isDuplicate: true,
          });
        }
      } catch (error) {
        logger.error('[ContractUpload] Duplicate check failed:', error);
      }
    }

    let filePath = objectKey;
    let storageProvider = 's3';

    try {
      const { initializeStorage } = await import('@/lib/storage-service');
      const storageService = initializeStorage();

      if (!storageService) {
        throw new Error('Storage service not available');
      }

      const uploadResult = await storageService.upload({
        fileName: objectKey,
        buffer,
        contentType: file.type,
        metadata: {
          tenantId,
          originalName: file.name,
          uploadedAt: new Date().toISOString(),
        },
      });

      if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'Upload failed');
      }

      const localUploadDir = join(process.cwd(), 'uploads', 'contracts', tenantId);
      await mkdir(localUploadDir, { recursive: true });
      const localCopyPath = join(localUploadDir, storedFileName);
      await writeFile(localCopyPath, buffer);
      logger.info(`[ContractUpload] Local copy saved at ${localCopyPath}`);
    } catch (error) {
      logger.error('[ContractUpload] S3/MinIO upload failed, falling back to local:', error);
      const uploadDir = join(process.cwd(), 'uploads', 'contracts', tenantId);
      await mkdir(uploadDir, { recursive: true });
      const localPath = join(uploadDir, storedFileName);
      await writeFile(localPath, buffer);

      filePath = localPath;
      storageProvider = 'local';
      logger.warn(`[ContractUpload] File stored locally at ${localPath} — worker must run on same host`);
    }

    const metadata = {
      contractType: formData.get('contractType') as string | null,
      contractTitle: formData.get('contractTitle') as string | null,
      clientName: formData.get('clientName') as string | null,
      supplierName: formData.get('supplierName') as string | null,
      description: formData.get('description') as string | null,
      category: formData.get('category') as string | null,
      totalValue: formData.get('totalValue') as string | null,
      currency: formData.get('currency') as string | null,
      lifecycle: formData.get('lifecycle') as string | null,
    };

    const idempotencyKey = formData.get('idempotency_key') as string | undefined;
    const { result: transactionResult, wasExecuted } = await (async () => {
      try {
        const { createContractWithSideEffects } = await import('@/lib/transaction-service');
        return await createContractWithSideEffects({
          contractData: {
            tenantId,
            fileName: file.name,
            originalName: file.name,
            fileSize: BigInt(file.size),
            mimeType: file.type || 'application/octet-stream',
            storagePath: filePath,
            storageProvider,
            status: metadata.lifecycle === 'REVIEW'
              ? 'PENDING'
              : metadata.lifecycle === 'NEW' || metadata.lifecycle === 'AMENDMENT'
                ? 'DRAFT'
                : 'PROCESSING',
            documentRole: metadata.lifecycle === 'REVIEW'
              ? 'REVIEW'
              : metadata.lifecycle === 'NEW'
                ? 'NEW_CONTRACT'
                : metadata.lifecycle === 'AMENDMENT'
                  ? 'AMENDMENT'
                  : metadata.lifecycle === 'RENEWAL'
                    ? 'RENEWAL'
                    : 'EXISTING',
            uploadedBy: context.userId,
            contractType: metadata.contractType || 'UNKNOWN',
            contractTitle: metadata.contractTitle || file.name,
            clientName: metadata.clientName || undefined,
            supplierName: metadata.supplierName || undefined,
            description: metadata.description || undefined,
            category: metadata.category || undefined,
            uploadedAt: new Date(),
            checksum: contentHash,
          },
          idempotencyKey,
        });
      } catch (error) {
        logger.warn('[ContractUpload] createContractWithSideEffects unavailable, using direct creation: ' + (error as Error).message);
        const result = await prisma.$transaction(async (transaction) => {
          const contract = await transaction.contract.create({
            data: {
              tenantId,
              fileName: file.name,
              originalName: file.name,
              fileSize: BigInt(file.size),
              mimeType: file.type || 'application/octet-stream',
              storagePath: filePath,
              storageProvider,
              status: 'PROCESSING',
              uploadedBy: context.userId,
              contractType: metadata.contractType || 'UNKNOWN',
              contractTitle: metadata.contractTitle || file.name,
              clientName: metadata.clientName || undefined,
              supplierName: metadata.supplierName || undefined,
              description: metadata.description || undefined,
              category: metadata.category || undefined,
              uploadedAt: new Date(),
              checksum: contentHash,
            },
          });

          const processingJob = await transaction.processingJob.create({
            data: {
              contractId: contract.id,
              tenantId: contract.tenantId,
              status: 'PENDING',
              progress: 0,
              currentStep: 'uploaded',
              totalStages: 5,
              priority: 5,
              maxRetries: 3,
              retryCount: 0,
            },
          });

          return { contract, processingJob, outboxEvent: null };
        });

        return { result, wasExecuted: true };
      }
    })();

    const { contract, processingJob } = transactionResult;

    if (wasExecuted) {
      await publishRealtimeEvent({
        event: 'contract:created',
        data: {
          tenantId: contract.tenantId,
          contractId: contract.id,
          status: contract.status?.toLowerCase(),
        },
        source: 'api:contracts/upload',
      });

      // Fire outbound contract.created webhook (non-blocking).
      import('@/lib/webhook-triggers')
        .then(({ triggerContractCreated }) =>
          triggerContractCreated(contract.tenantId, contract.id, {
            fileName: contract.fileName,
            contractType: contract.contractType,
            clientName: contract.clientName ?? undefined,
            supplierName: contract.supplierName ?? undefined,
            uploadedBy: context.userId,
          }),
        )
        .catch((error) =>
          logger.warn('[ContractUpload] webhook trigger failed: ' + (error as Error).message),
        );

      // Durable event log for /api/v1/events consumers.
      import('@/lib/events/integration-events')
        .then(({ recordIntegrationEvent }) =>
          recordIntegrationEvent({
            tenantId: contract.tenantId,
            eventType: 'contract.created',
            resourceId: contract.id,
            payload: {
              contractId: contract.id,
              fileName: contract.fileName,
              contractType: contract.contractType,
              clientName: contract.clientName ?? undefined,
              supplierName: contract.supplierName ?? undefined,
              uploadedBy: context.userId,
            },
          }),
        )
        .catch(() => {});
    }

    try {
      const { initializeContractMetadata } = await import('@/lib/contract-integration');
      await initializeContractMetadata(contract.id, contract.tenantId, {
        fileName: file.name,
        contractType: metadata.contractType,
        clientName: metadata.clientName,
        supplierName: metadata.supplierName,
        totalValue: metadata.totalValue ? Number(metadata.totalValue) : undefined,
        currency: metadata.currency,
      }).catch((error) => logger.error('[ContractUpload] Metadata initialization error:', error));
    } catch (error) {
      logger.error('[ContractUpload] Metadata init import error:', error);
    }

    const ext = file.name.toLowerCase().split('.').pop() || '';
    const isPlainTextFormat = ['txt', 'text', 'csv', 'html', 'htm', 'xml', 'md', 'rtf', 'json'].includes(ext);
    const probeSize = Math.min(20000, buffer.length);
    let printableRatio = 0;
    if (probeSize > 0) {
      let printable = 0;
      for (let index = 0; index < probeSize; index++) {
        const byte = buffer[index];
        if (byte === 9 || byte === 10 || byte === 13 || (byte >= 32 && byte <= 126)) {
          printable += 1;
        }
      }
      printableRatio = printable / probeSize;
    }

    const hasReadableText = isPlainTextFormat || printableRatio >= 0.6;
    const isTextBased = isPlainTextFormat;

    if (isTextBased) {
      try {
        const textContent = buffer.toString('utf-8', 0, Math.min(10000, buffer.length));
        const { quickClassifyContract } = await import('@/lib/ai/contract-classifier-taxonomy');

        Promise.race([
          quickClassifyContract(textContent, file.name),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Classification timeout')), 30_000)),
        ])
          .then(async (classification) => {
            const category = await prisma.taxonomyCategory.findFirst({
              where: {
                id: classification.category_id,
                tenantId,
              },
            });

            if (category || !classification.category_id) {
              await prisma.contract.update({
                where: { id: contract.id },
                data: {
                  contractCategoryId: classification.category_id,
                  contractSubtype: classification.subtype,
                  documentRole: classification.role,
                  classificationConf: classification.confidence,
                  classifiedAt: new Date(),
                },
              });
            }
          })
          .catch((error) => logger.error('[ContractUpload] Classification error:', error));
      } catch (error) {
        logger.error('[ContractUpload] Taxonomy classification error:', error);
      }
    }

    if (isTextBased) {
      try {
        const partyText = buffer.toString('utf-8', 0, Math.min(15000, buffer.length));
        if (!metadata.clientName && !metadata.supplierName && partyText.length > 50) {
          const partyUpdate: Record<string, string> = {};
          const betweenMatch = partyText.match(
            /(?:between|by and between|entered into by)\s+([A-Z][A-Za-z0-9\s&,.'()\-]{2,80}?)\s*(?:\(.*?\))?\s*(?:,?\s*(?:and|&)\s+)([A-Z][A-Za-z0-9\s&,.'()\-]{2,80}?)\s*(?:\(|,|\n)/i,
          );
          if (betweenMatch) {
            partyUpdate.clientName = betweenMatch[1].replace(/\s+$/, '').trim();
            partyUpdate.supplierName = betweenMatch[2].replace(/\s+$/, '').trim();
          } else {
            const clientMatch = partyText.match(/(?:Client|Buyer|Customer|Auftraggeber)\s*[:.]\s*(.+?)(?:\n|$)/i);
            const supplierMatch = partyText.match(/(?:Service Provider|Vendor|Supplier|Provider|Contractor|Auftragnehmer)\s*[:.]\s*(.+?)(?:\n|$)/i);
            if (clientMatch) {
              partyUpdate.clientName = clientMatch[1].replace(/[,;]+$/, '').trim().substring(0, 200);
            }
            if (supplierMatch) {
              partyUpdate.supplierName = supplierMatch[1].replace(/[,;]+$/, '').trim().substring(0, 200);
            }
          }

          if (Object.keys(partyUpdate).length > 0) {
            await prisma.contract.update({
              where: { id: contract.id },
              data: partyUpdate,
            });
          }
        }
      } catch (error) {
        logger.error('[ContractUpload] Party extraction error:', error);
      }
    }

    if (hasReadableText) {
      try {
        const textContent = buffer.toString('utf-8', 0, Math.min(10000, buffer.length));
        const { detectContractType } = await import('@repo/workers/contract-type-profiles');
        const detection = detectContractType(textContent);
        const minConfidence = isPlainTextFormat ? 0.4 : 0.7;
        if (detection.type !== 'OTHER' && detection.confidence >= minConfidence) {
          await prisma.contract.update({
            where: { id: contract.id },
            data: {
              contractType: detection.type,
              classificationConf: detection.confidence,
              classifiedAt: new Date(),
              classificationMeta: {
                method: 'upload-keyword-detection',
                confidence: detection.confidence,
                matchedKeywords: detection.matchedKeywords,
                detectedAt: new Date().toISOString(),
                printableRatio: Number(printableRatio.toFixed(3)),
                ext,
                tier: isPlainTextFormat ? 'plain-text' : 'binary-readable',
              },
            },
          });
        }
      } catch (error) {
        logger.error('[ContractUpload] Contract type detection error:', error);
      }
    }

    let queueTriggered = true;
    try {
      await import('@/lib/queue-init');
      const requestedPriority = formData.get('priority') as string | null;
      const priority = calculateUploadPriority(file.size, requestedPriority);
      const ocrMode = formData.get('ocrMode') as string | null;
      const artifactResult = await triggerArtifactGeneration({
        contractId: contract.id,
        tenantId: contract.tenantId,
        filePath,
        mimeType: file.type,
        useQueue: true,
        priority: priority as any,
        source: 'upload',
        ocrMode: ocrMode || undefined,
      });

      if (artifactResult.jobId) {
        await prisma.processingJob.update({
          where: { id: processingJob.id },
          data: { queueId: artifactResult.jobId, status: 'QUEUED' },
        }).catch((error) => logger.error('[ContractUpload] Processing job update error:', error));

        await prisma.contract.update({
          where: { id: contract.id },
          data: { status: 'QUEUED' },
        }).catch((error) => logger.error('[ContractUpload] Contract QUEUED status update error:', error));
      }
    } catch (error) {
      logger.error('[ContractUpload] Artifact queue trigger error:', error);
      try {
        await prisma.contract.update({
          where: { id: contract.id },
          data: { status: 'UPLOADED' },
        });
        await prisma.processingJob.update({
          where: { id: processingJob.id },
          data: { status: 'FAILED', error: `Queue trigger failed: ${(error as Error).message}` },
        });
        logger.warn(`[ContractUpload] Contract ${contract.id} reverted to UPLOADED after queue failure`);
      } catch (revertError) {
        logger.error('[ContractUpload] Failed to revert contract status:', revertError);
      }
      queueTriggered = false;
    }

    const actualStatus = !queueTriggered
      ? 'UPLOADED'
      : metadata.lifecycle === 'REVIEW'
        ? 'PENDING'
        : 'PROCESSING';

    logger.info('upload_complete', {
      tenantId,
      contractId: contract.id,
      fileSize: file.size,
      fileType: file.type,
      duration: Date.now() - uploadStartTime,
      processingMode: metadata.lifecycle || 'standard',
      ocrMode: (formData.get('ocrMode') as string) || 'default',
      queueTriggered,
      status: queueTriggered ? 'success' : 'fallback',
    });

    return createSuccessResponse(
      context,
      {
        contractId: contract.id,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        status: actualStatus,
        documentRole: metadata.lifecycle === 'REVIEW' ? 'REVIEW' : undefined,
        processingJobId: processingJob.id,
        queueTriggered,
        message: !queueTriggered
          ? 'File uploaded but processing could not be started. Please retry from the contract page.'
          : metadata.lifecycle === 'REVIEW'
            ? 'File uploaded for review — AI analysis is running in the background'
            : 'File uploaded successfully',
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(context, error);
  }
}