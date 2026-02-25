/**
 * Chunked Upload API - Upload Chunk
 * POST /api/contracts/upload/chunk
 * 
 * Upload a single chunk of a large file.
 * Uses the storage abstraction layer so chunks are stored via the
 * configured provider (S3/MinIO, Azure Blob, or local filesystem).
 */

import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { uploadToStorage } from '@/lib/storage';

export const POST = withAuthApiHandler(async (req, ctx) => {
  const tenantId = ctx.tenantId;
  
  if (!tenantId) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Missing tenant ID', 400);
  }

  const formData = await req.formData();
  const chunk = formData.get('chunk') as File;
  const uploadId = formData.get('uploadId') as string;
  const chunkIndex = parseInt(formData.get('chunkIndex') as string);
  const totalChunks = parseInt(formData.get('totalChunks') as string);

  if (!chunk || !uploadId || isNaN(chunkIndex) || isNaN(totalChunks)) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Missing required fields', 400);
  }

  // Store chunk via the storage abstraction layer
  const bytes = await chunk.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const chunkKey = `chunks/${uploadId}/chunk-${chunkIndex}`;

  const result = await uploadToStorage(chunkKey, buffer, 'application/octet-stream');

  if (!result.success) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `Failed to store chunk: ${result.error}`, 500);
  }

  return createSuccessResponse(ctx, {
    chunkIndex,
    uploadId,
    message: `Chunk ${chunkIndex + 1}/${totalChunks} uploaded`,
  });
});
