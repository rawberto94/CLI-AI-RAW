import { basename } from 'path';
import { createHash } from 'crypto';
import { NextRequest } from 'next/server';

import {
  createErrorResponse,
  createSuccessResponse,
  type ContractApiContext,
} from '@/lib/api-middleware';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { sanitizePath, hasPathTraversal } from '@/lib/security/sanitize';

interface InitUploadRequest {
  uploadId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  totalChunks: number;
  metadata?: Record<string, string>;
}

interface UploadSessionRow {
  id: string;
  tenant_id: string;
  file_name: string;
  file_size: number;
  mime_type: string | null;
  total_chunks: number;
  chunks_uploaded: number;
  status: string;
}

export async function postChunkedUploadInit(
  request: NextRequest,
  context: ContractApiContext,
) {
  const tenantId = context.tenantId;
  if (!tenantId) {
    return createErrorResponse(context, 'VALIDATION_ERROR', 'Missing tenant ID', 400);
  }

  const body: InitUploadRequest = await request.json();
  const { uploadId, fileName, fileSize, mimeType, totalChunks, metadata } = body;

  if (!uploadId || !fileName || !fileSize || !totalChunks) {
    return createErrorResponse(context, 'VALIDATION_ERROR', 'Missing required fields', 400);
  }
  if (!Number.isInteger(totalChunks) || totalChunks < 1) {
    return createErrorResponse(context, 'VALIDATION_ERROR', 'totalChunks must be a positive integer', 400);
  }
  if (hasPathTraversal(fileName)) {
    return createErrorResponse(context, 'VALIDATION_ERROR', 'Invalid file name', 400);
  }

  const existingSession = await getUploadSession(uploadId);
  if (existingSession && existingSession.tenant_id !== tenantId) {
    return createErrorResponse(context, 'CONFLICT', 'Upload session already exists', 409);
  }

  await prisma.$executeRaw`
    INSERT INTO upload_sessions (
      id, tenant_id, file_name, file_size, mime_type,
      total_chunks, chunks_uploaded, status, metadata, created_at, updated_at
    ) VALUES (
      ${uploadId}, ${tenantId}, ${fileName}, ${fileSize}, ${mimeType},
      ${totalChunks}, 0, 'pending', ${JSON.stringify(metadata || {})}, NOW(), NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      file_name = EXCLUDED.file_name,
      file_size = EXCLUDED.file_size,
      mime_type = EXCLUDED.mime_type,
      total_chunks = EXCLUDED.total_chunks,
      metadata = EXCLUDED.metadata,
      updated_at = NOW()
    WHERE upload_sessions.tenant_id = EXCLUDED.tenant_id
  `;

  return createSuccessResponse(context, {
    uploadId,
    message: 'Upload session initialized',
  });
}

export async function postChunkedUploadChunk(
  request: NextRequest,
  context: ContractApiContext,
) {
  const tenantId = context.tenantId;
  if (!tenantId) {
    return createErrorResponse(context, 'VALIDATION_ERROR', 'Missing tenant ID', 400);
  }

  const formData = await request.formData();
  const chunk = formData.get('chunk');
  const uploadId = formData.get('uploadId');
  const chunkIndex = Number.parseInt(String(formData.get('chunkIndex')), 10);
  const totalChunks = Number.parseInt(String(formData.get('totalChunks')), 10);

  if (!(chunk instanceof File) || !uploadId || Number.isNaN(chunkIndex) || Number.isNaN(totalChunks)) {
    return createErrorResponse(context, 'VALIDATION_ERROR', 'Missing required fields', 400);
  }
  if (chunkIndex < 0 || chunkIndex >= totalChunks) {
    return createErrorResponse(context, 'VALIDATION_ERROR', 'chunkIndex is out of range', 400);
  }

  const session = await getUploadSession(String(uploadId));
  if (!session || session.tenant_id !== tenantId) {
    return createErrorResponse(context, 'NOT_FOUND', 'Upload session not found', 404);
  }
  if (session.total_chunks !== totalChunks) {
    return createErrorResponse(context, 'CONFLICT', 'Chunk count does not match upload session', 409);
  }

  const bytes = await chunk.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const chunkKey = getChunkKey(tenantId, String(uploadId), chunkIndex);

  const { uploadToStorage } = await import('@/lib/storage');
  const result = await uploadToStorage(chunkKey, buffer, 'application/octet-stream');
  if (!result.success) {
    return createErrorResponse(context, 'INTERNAL_ERROR', `Failed to store chunk: ${result.error}`, 500);
  }

  await prisma.$executeRaw`
    UPDATE upload_sessions
    SET chunks_uploaded = GREATEST(chunks_uploaded, ${chunkIndex + 1}),
        status = 'uploading',
        updated_at = NOW()
    WHERE id = ${String(uploadId)} AND tenant_id = ${tenantId}
  `;

  return createSuccessResponse(context, {
    chunkIndex,
    uploadId,
    message: `Chunk ${chunkIndex + 1}/${totalChunks} uploaded`,
  });
}

export async function postChunkedUploadFinalize(
  request: NextRequest,
  context: ContractApiContext,
) {
  const tenantId = context.tenantId;
  if (!tenantId) {
    return createErrorResponse(context, 'VALIDATION_ERROR', 'Missing tenant ID', 400);
  }

  const body = await request.json();
  const uploadId = typeof body.uploadId === 'string' ? body.uploadId : null;
  if (!uploadId) {
    return createErrorResponse(context, 'VALIDATION_ERROR', 'Missing uploadId', 400);
  }

  const session = await getUploadSession(uploadId);
  if (!session || session.tenant_id !== tenantId) {
    return createErrorResponse(context, 'NOT_FOUND', 'Upload session not found', 404);
  }

  if (hasPathTraversal(session.file_name)) {
    return createErrorResponse(context, 'VALIDATION_ERROR', 'Invalid file name', 400);
  }

  const safeFileName = basename(sanitizePath(session.file_name)) || `contract-${Date.now()}`;
  const chunkPrefix = getChunkPrefix(tenantId, uploadId);
  const { getStorageProvider } = await import('@/lib/storage/storage-factory');
  const { downloadFromStorage, uploadToStorage } = await import('@/lib/storage');
  const { scanBuffer } = await import('@/lib/security/virus-scan');
  const { createContractWithSideEffects } = await import('@/lib/transaction-service');
  const { publishRealtimeEvent } = await import('@/lib/realtime/publish');
  const { triggerArtifactGeneration } = await import('@/lib/artifact-trigger');
  const provider = await getStorageProvider();
  const chunkKeys = await provider.list(chunkPrefix);
  const sortedChunkKeys = chunkKeys
    .filter((key: string) => key.includes('chunk-'))
    .sort((left: string, right: string) => {
      const leftIndex = Number.parseInt(left.split('chunk-').pop() || '0', 10);
      const rightIndex = Number.parseInt(right.split('chunk-').pop() || '0', 10);
      return leftIndex - rightIndex;
    });

  if (sortedChunkKeys.length !== session.total_chunks) {
    return createErrorResponse(context, 'CONFLICT', 'Upload is incomplete', 409);
  }

  const chunkBuffers: Buffer[] = [];
  for (const key of sortedChunkKeys) {
    const data = await downloadFromStorage(key);
    if (!data) {
      return createErrorResponse(context, 'INTERNAL_ERROR', `Failed to read chunk: ${key}`, 500);
    }
    chunkBuffers.push(data);
  }

  const finalBuffer = Buffer.concat(chunkBuffers);
  const fileSize = finalBuffer.length;
  const scanResult = await scanBuffer(finalBuffer, safeFileName);
  if (!scanResult.clean) {
    await cleanupUploadArtifacts(tenantId, uploadId, sortedChunkKeys);
    logger.warn(`Virus detected in chunked upload: ${safeFileName}`, {
      threats: scanResult.threats,
      tenantId,
      uploadId,
    });
    return createErrorResponse(context, 'VALIDATION_ERROR', 'File rejected by security scan', 422, {
      details: `Infected file detected and quarantined. Threats: ${JSON.stringify(scanResult.threats)}`,
    });
  }

  const contentHash = createHash('sha256').update(finalBuffer).digest('hex');
  const mimeType = session.mime_type || detectMimeType(safeFileName);
  const objectKey = `contracts/${tenantId}/${Date.now()}-${safeFileName}`;
  const uploadResult = await uploadToStorage(objectKey, finalBuffer, mimeType);
  if (!uploadResult.success) {
    logger.error('finalize_upload_storage_failed', { tenantId, uploadId, error: uploadResult.error });
    return createErrorResponse(context, 'INTERNAL_ERROR', 'Failed to store assembled file', 500);
  }

  const storagePath = uploadResult.key;
  const { result: txResult } = await createContractWithSideEffects({
    contractData: {
      tenantId,
      status: 'UPLOADED',
      storagePath,
      fileName: safeFileName,
      fileSize: BigInt(fileSize),
      mimeType,
      originalName: session.file_name,
      checksum: contentHash,
      uploadedBy: context.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  const contract = txResult.contract;
  const processingJob = txResult.processingJob;
  await prisma.$executeRaw`
    UPDATE upload_sessions
    SET status = 'completed', updated_at = NOW()
    WHERE id = ${uploadId} AND tenant_id = ${tenantId}
  `;

  await publishRealtimeEvent({
    event: 'contract:created',
    data: {
      tenantId,
      contractId: contract.id,
      status: contract.status?.toLowerCase(),
    },
    source: 'api:contracts/upload/finalize',
  });

  await triggerArtifactGeneration({
    contractId: contract.id,
    tenantId,
    filePath: storagePath,
    mimeType,
    useQueue: true,
  });

  await cleanupUploadArtifacts(tenantId, uploadId, sortedChunkKeys, false);

  return createSuccessResponse(context, {
    contractId: contract.id,
    fileId: contract.id,
    fileName: session.file_name,
    fileSize,
    contentHash,
    processingJobId: processingJob.id,
    status: 'PROCESSING',
    message: 'Upload completed successfully',
  });
}

async function getUploadSession(uploadId: string) {
  const sessions = await prisma.$queryRaw<UploadSessionRow[]>`
    SELECT id, tenant_id, file_name, file_size, mime_type, total_chunks, chunks_uploaded, status
    FROM upload_sessions
    WHERE id = ${uploadId}
    LIMIT 1
  `;

  return sessions[0] || null;
}

function getChunkPrefix(tenantId: string, uploadId: string) {
  return `chunks/${tenantId}/${uploadId}/`;
}

function getChunkKey(tenantId: string, uploadId: string, chunkIndex: number) {
  return `${getChunkPrefix(tenantId, uploadId)}chunk-${chunkIndex}`;
}

function detectMimeType(fileName: string) {
  const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
  const mimeTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc': 'application/msword',
    '.txt': 'text/plain',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

async function cleanupUploadArtifacts(
  tenantId: string,
  uploadId: string,
  chunkKeys: string[],
  deleteSession = true,
) {
  const { deleteFromStorage } = await import('@/lib/storage');
  for (const key of chunkKeys) {
    try {
      await deleteFromStorage(key);
    } catch {
      // best effort cleanup
    }
  }

  if (deleteSession) {
    try {
      await prisma.$executeRaw`
        DELETE FROM upload_sessions WHERE id = ${uploadId} AND tenant_id = ${tenantId}
      `;
    } catch {
      // best effort cleanup
    }
  }
}