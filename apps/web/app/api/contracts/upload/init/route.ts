/**
 * Chunked Upload API - Initialize
 * POST /api/contracts/upload/init
 * 
 * Initialize a chunked upload session for large files
 */

import { NextRequest } from 'next/server';
import { prisma } from "@/lib/prisma";
import { contractService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

// Using singleton prisma instance from @/lib/prisma

interface InitUploadRequest {
  uploadId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  totalChunks: number;
  metadata?: Record<string, string>;
}

export const POST = withAuthApiHandler(async (req, ctx) => {
  const tenantId = ctx.tenantId;
  
  if (!tenantId) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Missing tenant ID', 400);
  }

  const body: InitUploadRequest = await req.json();
  const { uploadId, fileName, fileSize, mimeType, totalChunks, metadata } = body;

  // Validate input
  if (!uploadId || !fileName || !fileSize || !totalChunks) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Missing required fields', 400);
  }

  // Store upload session in database
  await prisma.$executeRaw`
    INSERT INTO upload_sessions (
      id, tenant_id, file_name, file_size, mime_type, 
      total_chunks, chunks_uploaded, status, metadata, created_at
    ) VALUES (
      ${uploadId}, ${tenantId}, ${fileName}, ${fileSize}, ${mimeType},
      ${totalChunks}, 0, 'pending', ${JSON.stringify(metadata || {})}, NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      updated_at = NOW()
  `;

  return createSuccessResponse(ctx, {
    uploadId,
    message: 'Upload session initialized',
  });
});
