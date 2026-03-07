/**
 * Chunked Upload API - Upload Chunk
 * POST /api/contracts/upload/chunk
 * 
 * Upload a single chunk of a large file
 */

import { NextRequest } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

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

  // Create chunks directory
  const chunksDir = join(process.cwd(), 'uploads', 'chunks', uploadId);
  if (!existsSync(chunksDir)) {
    await mkdir(chunksDir, { recursive: true });
  }

  // Save chunk to disk
  const chunkPath = join(chunksDir, `chunk-${chunkIndex}`);
  const bytes = await chunk.arrayBuffer();
  const buffer = Buffer.from(bytes);
  await writeFile(chunkPath, buffer);

  return createSuccessResponse(ctx, {
    chunkIndex,
    uploadId,
    message: `Chunk ${chunkIndex + 1}/${totalChunks} uploaded`,
  });
});
