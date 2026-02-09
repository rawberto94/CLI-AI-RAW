/**
 * Chunked Upload API - Finalize
 * POST /api/contracts/upload/finalize
 * 
 * Combine all chunks into final file and create contract
 */

import { NextRequest } from 'next/server';
import { readFile, writeFile, mkdir, rm, readdir } from 'fs/promises';
import { join, basename } from 'path';
import { existsSync } from 'fs';
import { prisma } from "@/lib/prisma";
import { contractService } from 'data-orchestration/services';
// TODO: Replace prisma.contract.create with contractService.createContractWithIntegrity
import { triggerArtifactGeneration } from '@/lib/artifact-trigger';
import { sanitizePath, hasPathTraversal } from '@/lib/security/sanitize';
import { publishRealtimeEvent } from '@/lib/realtime/publish';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';

// Using singleton prisma instance from @/lib/prisma

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

  // Get chunks directory
  const chunksDir = join(process.cwd(), 'uploads', 'chunks', uploadId);
  
  if (!existsSync(chunksDir)) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Upload session not found', 404);
  }

  // Create uploads directory
  const uploadsDir = join(process.cwd(), 'uploads', tenantId);
  if (!existsSync(uploadsDir)) {
    await mkdir(uploadsDir, { recursive: true });
  }

  // Combine all chunks
  const finalFilePath = join(uploadsDir, safeFileName);
  
  // Find all chunks
  const files = await readdir(chunksDir);
  const chunks = files
    .filter((f: string) => f.startsWith('chunk-'))
    .map((f: string) => ({
      name: f,
      index: parseInt(f.replace('chunk-', '')),
    }))
    .sort((a: { name: string; index: number }, b: { name: string; index: number }) => a.index - b.index);

  // Combine chunks in order
  const chunkBuffers: Buffer[] = [];
  for (const chunk of chunks) {
    const chunkPath = join(chunksDir, chunk.name);
    const chunkData = await readFile(chunkPath);
    chunkBuffers.push(chunkData);
  }

  // Write combined file
  const finalBuffer = Buffer.concat(chunkBuffers);
  await writeFile(finalFilePath, finalBuffer);

  const fileSize = finalBuffer.length;

  // Detect MIME type
  const ext = safeFileName.toLowerCase().substring(safeFileName.lastIndexOf('.'));
  const mimeTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc': 'application/msword',
    '.txt': 'text/plain',
  };
  const mimeType = mimeTypes[ext] || 'application/octet-stream';

  // Create contract in database
  const contract = await prisma.contract.create({
    data: {
      tenantId,
      status: 'PROCESSING',
      storagePath: finalFilePath,
      fileName: safeFileName,
      fileSize: BigInt(fileSize),
      mimeType,
      originalName: fileName,  // Keep original for display purposes
      uploadedBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

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
    filePath: finalFilePath,
    mimeType,
    useQueue: false,
  });

  // Clean up chunks
  try {
    await rm(chunksDir, { recursive: true, force: true });
  } catch {
    // Silently continue if cleanup fails
  }

  return createSuccessResponse(ctx, {
    contractId: contract.id,
    fileId: contract.id,
    fileName,
    fileSize,
    status: 'PROCESSING',
    message: 'Upload completed successfully',
  });
});
