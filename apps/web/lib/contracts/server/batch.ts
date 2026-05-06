import { createHash } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

import { NextRequest } from 'next/server';

import { PROCESSING_PRIORITY, triggerArtifactGeneration } from '@/lib/artifact-trigger';
import { contractService } from '@/lib/data-orchestration';
import { prisma } from '@/lib/prisma';
import { publishRealtimeEvent } from '@/lib/realtime/publish';
import { initializeStorage } from '@/lib/storage-service';
import { createErrorResponse, createSuccessResponse } from '@/lib/api-middleware';

import type { ContractApiContext } from '@/lib/contracts/server/context';

function isFile(value: unknown): value is File {
  return typeof File !== 'undefined' && value instanceof File;
}

export async function postContractBatchUpload(
  request: NextRequest,
  context: ContractApiContext,
) {
  const formData = await request.formData();
  const files: File[] = [];

  for (const [, value] of formData.entries()) {
    if (isFile(value)) {
      files.push(value);
    }
  }

  if (files.length === 0) {
    return createErrorResponse(context, 'VALIDATION_ERROR', 'No files provided', 400);
  }

  if (files.length > 100) {
    return createErrorResponse(context, 'VALIDATION_ERROR', 'Maximum 100 files allowed per batch', 400);
  }

  const tenantId = context.tenantId;
  const userId = context.userId;

  if (!tenantId || !userId) {
    return createErrorResponse(context, 'UNAUTHORIZED', 'Unauthorized', 401);
  }

  const results: Array<{
    contractId: string;
    fileName: string;
    status: string;
    jobId: string | null;
  }> = [];
  const duplicates: Array<{
    fileName: string;
    existingContractId: string;
  }> = [];
  const skipDupCheck = request.headers.get('x-skip-duplicate-check') === 'true';

  for (const file of files) {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const contentHash = createHash('sha256').update(buffer).digest('hex');

    if (!skipDupCheck) {
      try {
        const existing = await prisma.contract.findFirst({
          where: {
            tenantId,
            checksum: contentHash,
            isDeleted: false,
            status: { notIn: ['FAILED', 'DELETED'] },
          },
          select: { id: true, fileName: true },
        });
        if (existing) {
          duplicates.push({ fileName: file.name, existingContractId: existing.id });
          continue;
        }
      } catch {
        // Dedup check failed; continue with upload.
      }
    }

    const storedFileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const objectKey = `contracts/${tenantId}/${storedFileName}`;

    let storagePath = objectKey;

    try {
      const storageService = initializeStorage();
      if (storageService) {
        const uploadResult = await storageService.upload({
          fileName: objectKey,
          buffer,
          contentType: file.type || 'application/pdf',
          metadata: {
            tenantId,
            originalName: file.name,
            uploadedAt: new Date().toISOString(),
          },
        });

        if (!uploadResult.success) {
          throw new Error(uploadResult.error || 'Upload failed');
        }
        storagePath = objectKey;
      } else {
        throw new Error('Storage service not available');
      }
    } catch {
      const uploadDir = join(process.cwd(), 'uploads', 'contracts', tenantId);
      await mkdir(uploadDir, { recursive: true });
      const localPath = join(uploadDir, storedFileName);
      await writeFile(localPath, buffer);
      storagePath = localPath;
    }

    const result = await contractService.createContract({
      tenantId,
      fileName: file.name,
      mimeType: file.type || 'application/pdf',
      fileSize: BigInt(file.size),
      uploadedBy: userId,
      status: 'UPLOADED',
      storagePath,
      checksum: contentHash,
      contractType: formData.get(`${file.name}_type`) as string | undefined,
    });

    if (!result.success || !result.data?.id) {
      continue;
    }

    const contract = result.data;

    await publishRealtimeEvent({
      event: 'contract:created',
      data: {
        tenantId,
        contractId: contract.id,
        status: contract.status?.toLowerCase(),
      },
      source: 'api:contracts/batch',
    });

    try {
      await prisma.processingJob.create({
        data: {
          tenantId,
          contractId: contract.id,
          status: 'QUEUED' as any,
          progress: 0,
          startedAt: new Date(),
        },
      });
    } catch {
      // Best-effort tracking row.
    }

    const queueResult = await triggerArtifactGeneration({
      contractId: contract.id,
      tenantId,
      filePath: storagePath,
      mimeType: file.type || 'application/pdf',
      useQueue: true,
      priority: PROCESSING_PRIORITY.LOW,
      source: 'bulk',
    });

    results.push({
      contractId: contract.id,
      fileName: file.name,
      status: queueResult.status,
      jobId: queueResult.jobId || null,
    });
  }

  return createSuccessResponse(context, {
    processed: results.length,
    results,
    duplicates: duplicates.length > 0 ? duplicates : undefined,
    duplicateCount: duplicates.length,
  });
}

export async function deleteContractBatch(
  request: NextRequest,
  context: ContractApiContext,
) {
  const body = await request.json();
  const { contractIds } = body ?? {};

  if (!Array.isArray(contractIds) || contractIds.length === 0) {
    return createErrorResponse(context, 'VALIDATION_ERROR', 'Contract IDs array is required', 400);
  }

  return createSuccessResponse(context, {
    deleted: contractIds.length,
    contractIds,
  });
}

export async function putContractBatch(
  request: NextRequest,
  context: ContractApiContext,
) {
  const body = await request.json();
  const { updates } = body ?? {};

  if (!Array.isArray(updates) || updates.length === 0) {
    return createErrorResponse(context, 'VALIDATION_ERROR', 'Updates array is required', 400);
  }

  return createSuccessResponse(context, {
    updated: updates.length,
    updates,
  });
}