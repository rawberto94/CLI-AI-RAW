import { createHash } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { NextRequest } from 'next/server';

import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  type AuthenticatedApiContext,
} from '@/lib/api-middleware';
import {
  PROCESSING_PRIORITY,
  triggerArtifactGeneration,
  type ProcessingPriority,
} from '@/lib/artifact-trigger';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { scanBuffer } from '@/lib/security/virus-scan';

const BATCH_CONFIG = {
  maxFiles: parseInt(process.env.BATCH_UPLOAD_MAX_FILES || '10', 10),
  maxTotalSize: parseInt(process.env.BATCH_UPLOAD_MAX_TOTAL_SIZE || '209715200', 10),
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800', 10),
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

export function calculateFileSizePriority(fileSize: number): ProcessingPriority {
  const MB = 1024 * 1024;
  if (fileSize < 1 * MB) return PROCESSING_PRIORITY.HIGH;
  if (fileSize < 5 * MB) return PROCESSING_PRIORITY.NORMAL;
  if (fileSize < 20 * MB) return PROCESSING_PRIORITY.LOW;
  return PROCESSING_PRIORITY.BACKGROUND;
}

export async function postBatchUploadContracts(
  request: NextRequest,
  context: AuthenticatedApiContext,
) {
  try {
    const tenantId = context.tenantId;
    if (!tenantId) {
      return createErrorResponse(context, 'BAD_REQUEST', 'Tenant ID is required', 400);
    }

    const formData = await request.formData();
    const files = formData.getAll('files');
    if (!files.length) {
      return createErrorResponse(context, 'BAD_REQUEST', 'No files provided', 400);
    }
    if (files.some((value) => !(value instanceof File))) {
      return createErrorResponse(context, 'BAD_REQUEST', 'All batch upload entries must be files', 400);
    }

    const contractFiles = files as File[];
    if (contractFiles.length > BATCH_CONFIG.maxFiles) {
      return createErrorResponse(
        context,
        'BAD_REQUEST',
        `Maximum ${BATCH_CONFIG.maxFiles} files per batch (received ${contractFiles.length})`,
        400,
      );
    }

    const totalSize = contractFiles.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > BATCH_CONFIG.maxTotalSize) {
      return createErrorResponse(
        context,
        'BAD_REQUEST',
        `Total batch size ${(totalSize / (1024 * 1024)).toFixed(1)} MB exceeds limit of ${(BATCH_CONFIG.maxTotalSize / (1024 * 1024)).toFixed(0)} MB`,
        400,
      );
    }

    logger.info('Batch upload started', { tenantId, fileCount: contractFiles.length, totalSize });

    const disableDuplicateDetection = process.env.DISABLE_DUPLICATE_DETECTION === 'true';
    const skipDuplicateCheck = request.headers.get('x-skip-duplicate-check') === 'true';
    const results: BatchFileResult[] = [];

    for (let index = 0; index < contractFiles.length; index++) {
      const file = contractFiles[index];
      const fileName = file.name || `file-${index}`;

      try {
        if (file.size > BATCH_CONFIG.maxFileSize) {
          results.push({
            index,
            fileName,
            fileSize: file.size,
            status: 'error',
            error: `File exceeds size limit of ${(BATCH_CONFIG.maxFileSize / (1024 * 1024)).toFixed(0)} MB`,
          });
          continue;
        }

        if (!BATCH_CONFIG.allowedTypes.has(file.type)) {
          results.push({
            index,
            fileName,
            fileSize: file.size,
            status: 'error',
            error: `Unsupported file type: ${file.type}`,
          });
          continue;
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const scanResult = await scanBuffer(buffer, fileName);
        if (!scanResult.clean) {
          logger.warn('Batch upload: suspicious file rejected', { fileName, threats: scanResult.threats });
          results.push({
            index,
            fileName,
            fileSize: file.size,
            status: 'error',
            error: 'File flagged by virus scanner',
          });
          continue;
        }

        const contentHash = createHash('sha256').update(buffer).digest('hex');
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
              index,
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

        const { storagePath, storageProvider } = await storeBatchUploadFile(buffer, tenantId, fileName, contentHash);
        const contract = await prisma.contract.create({
          data: {
            tenantId,
            fileName,
            originalName: fileName,
            uploadedBy: context.userId,
            fileSize: BigInt(file.size),
            mimeType: file.type || 'application/octet-stream',
            storagePath,
            storageProvider,
            checksum: contentHash,
            status: 'UPLOADED',
            isDeleted: false,
          },
        });

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
              data: { status: 'QUEUED' as never, queueId: queueResult.jobId },
            });
            await prisma.contract.update({
              where: { id: contract.id },
              data: { status: 'QUEUED' as never },
            });
          }
        } catch {
          logger.warn('Queue trigger failed for batch file', { contractId: contract.id });
        }

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
        }).catch(() => undefined);

        results.push({
          index,
          fileName,
          fileSize: file.size,
          status: 'success',
          contractId: contract.id,
          processingJobId: processingJob.id,
          contentHash,
        });
      } catch (error) {
        logger.error('Batch file upload failed', error instanceof Error ? error : undefined, { fileName });
        results.push({
          index,
          fileName,
          fileSize: file.size,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successful = results.filter((result) => result.status === 'success').length;
    const duplicates = results.filter((result) => result.status === 'duplicate').length;
    const failed = results.filter((result) => result.status === 'error').length;

    logger.info('Batch upload completed', {
      tenantId,
      total: contractFiles.length,
      successful,
      duplicates,
      failed,
    });

    return createSuccessResponse(context, {
      batchId: `batch-${Date.now()}`,
      total: contractFiles.length,
      successful,
      duplicates,
      failed,
      results,
    });
  } catch (error) {
    return handleApiError(context, error);
  }
}

let storageService: { upload?: (args: { fileName: string; buffer: Buffer; contentType: string }) => Promise<unknown> } | null = null;

async function getStorageService() {
  if (storageService) return storageService;
  try {
    const { getStorageService } = await import('@/lib/storage-service');
    storageService = getStorageService();
    return storageService;
  } catch {
    return null;
  }
}

async function storeBatchUploadFile(
  buffer: Buffer,
  tenantId: string,
  fileName: string,
  contentHash: string,
) {
  const storage = await getStorageService();
  const timestamp = Date.now();
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const uniquePrefix = contentHash.slice(0, 12);

  if (storage?.upload) {
    const key = `contracts/${tenantId}/${timestamp}-${uniquePrefix}-${safeName}`;
    await storage.upload({
      fileName: key,
      buffer,
      contentType: 'application/octet-stream',
    });
    return { storagePath: key, storageProvider: 's3' };
  }

  const uploadsDir = join(process.cwd(), 'uploads', tenantId);
  await mkdir(uploadsDir, { recursive: true });
  const localPath = join(uploadsDir, `${timestamp}-${uniquePrefix}-${safeName}`);
  await writeFile(localPath, buffer);
  return { storagePath: localPath, storageProvider: 'local' };
}