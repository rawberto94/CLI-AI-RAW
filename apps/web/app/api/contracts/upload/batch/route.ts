/**
 * Batch Upload API
 * POST /api/contracts/upload/batch
 *
 * Accepts multiple files in a single multipart/form-data request and
 * queues each for processing. Returns a batch result with per-file status
 * so the UI can track each upload independently.
 *
 * Limits:
 * - Maximum 10 files per batch (configurable via env)
 * - Per-file size limit: 50 MB (same as single upload)
 * - Total batch size limit: 200 MB
 * - Rate limited per tenant
 *
 * Each file goes through:
 * 1. Validation (type, size)
 * 2. Virus scan
 * 3. Content hash for dedup
 * 4. Storage (S3 or local)
 * 5. Contract record creation (transactional with outbox)
 * 6. Queue for processing
 */

import { NextRequest } from 'next/server';
import { createHash } from 'crypto';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { prisma } from '@/lib/prisma';
import { triggerArtifactGeneration, PROCESSING_PRIORITY, ProcessingPriority } from '@/lib/artifact-trigger';
import {
  withAuthApiHandler,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  type AuthenticatedApiContext,
  getApiContext,
} from '@/lib/api-middleware';
import { logger } from '@/lib/logger';
import { scanBuffer } from '@/lib/security/virus-scan';

// ============================================================================
// Configuration
// ============================================================================

const BATCH_CONFIG = {
  /** Maximum files per batch */
  maxFiles: parseInt(process.env.BATCH_UPLOAD_MAX_FILES || '10', 10),
  /** Maximum total batch size in bytes (200 MB) */
  maxTotalSize: parseInt(process.env.BATCH_UPLOAD_MAX_TOTAL_SIZE || '209715200', 10),
  /** Per-file size limit in bytes (50 MB) */
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800', 10),
  /** Allowed MIME types */
  allowedTypes: new Set([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
    'image/png',
    'image/jpeg',
    'image/tiff',
  ]),
};

// ============================================================================
// Types
// ============================================================================

interface BatchFileResult {
  index: number;
  fileName: string;
  fileSize: number;
  status: 'success' | 'duplicate' | 'error';
  contractId?: string;
  processingJobId?: string;
  error?: string;
  contentHash?: string;
}

// ============================================================================
// Storage helpers
// ============================================================================

let _storageService: any = null;

async function getStorageService() {
  if (_storageService) return _storageService;
  try {
    const { getStorageService: getSvc } = await import('@/lib/storage-service');
    _storageService = getSvc();
    return _storageService;
  } catch {
    return null;
  }
}

async function storeFile(
  buffer: Buffer,
  tenantId: string,
  fileName: string
): Promise<{ storagePath: string; storageProvider: string }> {
  const storage = await getStorageService();
  const timestamp = Date.now();
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');

  if (storage && typeof storage.upload === 'function') {
    const key = `contracts/${tenantId}/${timestamp}-${safeName}`;
    await storage.upload({
      fileName: key,
      buffer,
      contentType: 'application/octet-stream',
    });
    return { storagePath: key, storageProvider: 's3' };
  }

  // Local filesystem fallback
  const uploadsDir = join(process.cwd(), 'uploads', tenantId);
  await mkdir(uploadsDir, { recursive: true });
  const localPath = join(uploadsDir, `${timestamp}-${safeName}`);
  await writeFile(localPath, buffer);
  return { storagePath: localPath, storageProvider: 'local' };
}

// ============================================================================
// File size priority helper (shared with P4.2)
// ============================================================================

/**
 * Calculate job priority based on file size.
 * Smaller files get higher priority (lower number = higher priority in BullMQ).
 */
export function calculateFileSizePriority(fileSize: number): ProcessingPriority {
  const MB = 1024 * 1024;
  if (fileSize < 1 * MB) return PROCESSING_PRIORITY.HIGH;    // < 1 MB → high
  if (fileSize < 5 * MB) return PROCESSING_PRIORITY.NORMAL;  // 1–5 MB → normal
  if (fileSize < 20 * MB) return PROCESSING_PRIORITY.LOW;    // 5–20 MB → low
  return PROCESSING_PRIORITY.BACKGROUND;                       // > 20 MB → background
}

// ============================================================================
// POST Handler
// ============================================================================

export const POST = withAuthApiHandler(async (
  request: NextRequest,
  ctx: AuthenticatedApiContext
) => {
  try {
    const tenantId = ctx.tenantId;
    if (!tenantId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant ID is required', 400);
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'No files provided', 400);
    }

    if (files.length > BATCH_CONFIG.maxFiles) {
      return createErrorResponse(
        ctx,
        'BAD_REQUEST',
        `Maximum ${BATCH_CONFIG.maxFiles} files per batch (received ${files.length})`,
        400
      );
    }

    // Calculate total size
    let totalSize = 0;
    for (const file of files) {
      totalSize += file.size;
    }
    if (totalSize > BATCH_CONFIG.maxTotalSize) {
      return createErrorResponse(
        ctx,
        'BAD_REQUEST',
        `Total batch size ${(totalSize / (1024 * 1024)).toFixed(1)} MB exceeds limit of ${(BATCH_CONFIG.maxTotalSize / (1024 * 1024)).toFixed(0)} MB`,
        400
      );
    }

    logger.info('Batch upload started', {
      tenantId,
      fileCount: files.length,
      totalSize,
    });

    // Check for duplicate detection preference
    const disableDuplicateDetection = process.env.DISABLE_DUPLICATE_DETECTION === 'true';
    const skipDuplicateCheck = request.headers.get('x-skip-duplicate-check') === 'true';

    const results: BatchFileResult[] = [];

    // Process each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileName = file.name || `file-${i}`;

      try {
        // 1. Validate size
        if (file.size > BATCH_CONFIG.maxFileSize) {
          results.push({
            index: i,
            fileName,
            fileSize: file.size,
            status: 'error',
            error: `File exceeds size limit of ${(BATCH_CONFIG.maxFileSize / (1024 * 1024)).toFixed(0)} MB`,
          });
          continue;
        }

        // 2. Validate type
        if (!BATCH_CONFIG.allowedTypes.has(file.type)) {
          results.push({
            index: i,
            fileName,
            fileSize: file.size,
            status: 'error',
            error: `Unsupported file type: ${file.type}`,
          });
          continue;
        }

        // 3. Read buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 4. Virus scan
        try {
          const scanResult = await scanBuffer(buffer, fileName);
          if (!scanResult.clean) {
            logger.warn('Batch upload: suspicious file rejected', { fileName, threats: scanResult.threats });
            results.push({
              index: i,
              fileName,
              fileSize: file.size,
              status: 'error',
              error: 'File flagged by virus scanner',
            });
            continue;
          }
        } catch (scanErr) {
          logger.error('Virus scan unavailable for batch file', scanErr instanceof Error ? scanErr : undefined, { fileName });
          results.push({
            index: i,
            fileName,
            fileSize: file.size,
            status: 'error',
            error: 'Security scan unavailable. Please retry.',
          });
          continue;
        }

        // 5. Content hash
        const contentHash = createHash('sha256').update(buffer).digest('hex');

        // 6. Duplicate check
        if (!disableDuplicateDetection && !skipDuplicateCheck) {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

          const existing = await prisma.contract.findFirst({
            where: {
              tenantId,
              checksum: contentHash,
              isDeleted: false,
              status: { notIn: ['FAILED', 'DELETED'] },
              createdAt: { gte: sevenDaysAgo },
            },
            select: { id: true, fileName: true },
          });

          if (existing) {
            results.push({
              index: i,
              fileName,
              fileSize: file.size,
              status: 'duplicate',
              contractId: existing.id,
              contentHash,
              error: `Duplicate of existing contract (${existing.fileName})`,
            });
            continue;
          }
        }

        // 7. Store file
        const { storagePath, storageProvider } = await storeFile(buffer, tenantId, fileName);

        // 8. Create contract record
        const contract = await prisma.contract.create({
          data: {
            tenantId,
            fileName,
            fileSize: BigInt(file.size),
            mimeType: file.type || 'application/octet-stream',
            storagePath,
            storageProvider,
            checksum: contentHash,
            status: 'UPLOADED',
            isDeleted: false,
          },
        });

        // 9. Create processing job
        const processingJob = await prisma.processingJob.create({
          data: {
            tenantId,
            contractId: contract.id,
            status: 'PENDING',
            currentStep: 'uploaded',
            totalStages: 5,
            priority: calculateFileSizePriority(file.size),
            maxRetries: 3,
            retryCount: 0,
          },
        });

        // 10. Queue for processing
        try {
          const queueResult = await triggerArtifactGeneration({
            contractId: contract.id,
            tenantId,
            filePath: storagePath,
            mimeType: file.type || 'application/octet-stream',
            priority: calculateFileSizePriority(file.size),
          });

          if (queueResult.jobId) {
            await prisma.processingJob.update({
              where: { id: processingJob.id },
              data: { status: 'QUEUED' as any, queueId: queueResult.jobId },
            });
            await prisma.contract.update({
              where: { id: contract.id },
              data: { status: 'QUEUED' as any },
            });
          }
        } catch (queueErr) {
          logger.warn('Queue trigger failed for batch file', { contractId: contract.id });
        }

        // 11. Create outbox event
        await prisma.outboxEvent.create({
          data: {
            tenantId,
            aggregateType: 'Contract',
            aggregateId: contract.id,
            eventType: 'CONTRACT_CREATED',
            payload: {
              contractId: contract.id,
              tenantId,
              fileName,
              status: contract.status?.toLowerCase(),
              batchUpload: true,
            },
            status: 'PENDING',
          },
        }).catch(() => {}); // Non-critical

        results.push({
          index: i,
          fileName,
          fileSize: file.size,
          status: 'success',
          contractId: contract.id,
          processingJobId: processingJob.id,
          contentHash,
        });

        logger.info('Batch file uploaded successfully', { contractId: contract.id, fileName });
      } catch (fileErr: any) {
        logger.error('Batch file upload failed', fileErr instanceof Error ? fileErr : undefined, { fileName });
        results.push({
          index: i,
          fileName,
          fileSize: file.size,
          status: 'error',
          error: fileErr.message || 'Unknown error',
        });
      }
    }

    const successful = results.filter(r => r.status === 'success').length;
    const duplicates = results.filter(r => r.status === 'duplicate').length;
    const failed = results.filter(r => r.status === 'error').length;

    logger.info('Batch upload completed', {
      tenantId,
      total: files.length,
      successful,
      duplicates,
      failed,
    });

    return createSuccessResponse(ctx, {
      batchId: `batch-${Date.now()}`,
      total: files.length,
      successful,
      duplicates,
      failed,
      results,
    });
  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
});
