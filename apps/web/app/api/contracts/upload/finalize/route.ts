/**
 * Chunked Upload API - Finalize
 * POST /api/contracts/upload/finalize
 * 
 * Combine all chunks into final file and create contract.
 * Reads chunks via the storage abstraction layer, so chunks may live
 * on S3/MinIO, Azure Blob, or local filesystem depending on config.
 * Includes virus scanning before assembly for security.
 */

import { basename } from 'path';
import { createHash } from 'crypto';
import { prisma } from "@/lib/prisma";
import { createContractWithSideEffects } from '@/lib/transaction-service';
import { triggerArtifactGeneration } from '@/lib/artifact-trigger';
import { sanitizePath, hasPathTraversal } from '@/lib/security/sanitize';
import { publishRealtimeEvent } from '@/lib/realtime/publish';
import { scanBuffer } from '@/lib/security/virus-scan';
import { uploadToStorage, downloadFromStorage, deleteFromStorage } from '@/lib/storage';
import { getStorageProvider } from '@/lib/storage/storage-factory';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { logger } from '@/lib/logger';

export const POST = withAuthApiHandler(async (req, ctx) => {
  const tenantId = ctx.tenantId;
  
  if (!tenantId) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Missing tenant ID', 400);
  }

  const body = await req.json();
  const { uploadId, fileName } = body;

  if (!uploadId || !fileName) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Missing uploadId or fileName', 400);
  }

  // Prevent path traversal attacks - sanitize fileName
  if (hasPathTraversal(fileName)) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Invalid file name', 400);
  }
  
  // Use only the basename to prevent directory traversal
  const safeFileName = basename(sanitizePath(fileName)) || `contract-${Date.now()}`;

  // ── List and download chunks from storage ─────────────────────────────
  const chunkPrefix = `chunks/${uploadId}/`;
  const provider = await getStorageProvider();
  const chunkKeys = await provider.list(chunkPrefix);

  // Filter to only chunk files and sort by index
  const sortedChunkKeys = chunkKeys
    .filter((k: string) => k.includes('chunk-'))
    .sort((a: string, b: string) => {
      const idxA = parseInt(a.split('chunk-').pop() || '0');
      const idxB = parseInt(b.split('chunk-').pop() || '0');
      return idxA - idxB;
    });

  if (sortedChunkKeys.length === 0) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Upload session not found or chunks missing', 404);
  }

  // Download and combine chunks in order
  const chunkBuffers: Buffer[] = [];
  for (const key of sortedChunkKeys) {
    const data = await downloadFromStorage(key);
    if (!data) {
      return createErrorResponse(ctx, 'INTERNAL_ERROR', `Failed to read chunk: ${key}`, 500);
    }
    chunkBuffers.push(data);
  }

  const finalBuffer = Buffer.concat(chunkBuffers);
  const fileSize = finalBuffer.length;

  // ── Virus scan before processing ──────────────────────────────────────
  const scanResult = await scanBuffer(finalBuffer, safeFileName);
  if (!scanResult.clean) {
    // Clean up infected chunks immediately
    await cleanupChunks(sortedChunkKeys);

    logger.warn(`Virus detected in chunked upload: ${safeFileName}`, {
      threats: scanResult.threats,
      tenantId,
      uploadId,
    });

    return createErrorResponse(ctx, 'VALIDATION_ERROR',
      'File rejected by security scan', 422, {
      details: 'Infected file detected and quarantined',
      threats: scanResult.threats,
    });
  }

  // ── Generate content hash for deduplication ───────────────────────────
  const contentHash = createHash('sha256').update(finalBuffer).digest('hex');

  // Detect MIME type
  const ext = safeFileName.toLowerCase().substring(safeFileName.lastIndexOf('.'));
  const mimeTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc': 'application/msword',
    '.txt': 'text/plain',
  };
  const mimeType = mimeTypes[ext] || 'application/octet-stream';

  // ── Upload final assembled file via storage abstraction ───────────────
  const objectKey = `contracts/${tenantId}/${Date.now()}-${safeFileName}`;
  const uploadResult = await uploadToStorage(objectKey, finalBuffer, mimeType);

  if (!uploadResult.success) {
    logger.error('finalize_upload_storage_failed', { tenantId, uploadId, error: uploadResult.error });
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to store assembled file', 500);
  }

  const storagePath = uploadResult.key;

  // Create contract in database using transactional service
  const { result: txResult } = await createContractWithSideEffects({
    contractData: {
      tenantId,
      status: 'UPLOADED',
      storagePath,
      fileName: safeFileName,
      fileSize: BigInt(fileSize),
      mimeType,
      originalName: fileName,
      checksum: contentHash,
      uploadedBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  const contract = txResult.contract;
  const processingJob = txResult.processingJob;

  await publishRealtimeEvent({
    event: 'contract:created',
    data: {
      tenantId,
      contractId: contract.id,
      status: contract.status,
    },
    source: 'api:contracts/upload/finalize',
  });

  // Trigger artifact generation with proper parameters
  await triggerArtifactGeneration({
    contractId: contract.id,
    tenantId,
    filePath: storagePath,
    mimeType,
    useQueue: true,
  });

  // Clean up chunks (best-effort)
  await cleanupChunks(sortedChunkKeys);

  return createSuccessResponse(ctx, {
    contractId: contract.id,
    fileId: contract.id,
    fileName,
    fileSize,
    contentHash,
    processingJobId: processingJob.id,
    status: 'PROCESSING',
    message: 'Upload completed successfully',
  });
});

/** Best-effort cleanup of chunk keys from storage */
async function cleanupChunks(chunkKeys: string[]) {
  for (const key of chunkKeys) {
    try { await deleteFromStorage(key); } catch { /* silent */ }
  }
}
