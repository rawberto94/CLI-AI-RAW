/**
 * Contract File API
 * 
 * GET: Serve the original contract file (PDF, DOCX, etc.)
 * Used by the PDF viewer to display the original document
 * 
 * Supports multiple fetch strategies:
 * 1. Local storage (MinIO/S3/filesystem)
 * 2. Client source (SharePoint, Google Drive, etc.) - on-demand fetch
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { contractService } from 'data-orchestration/services';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs/promises';
import path from 'path';
import { getApiTenantId } from '@/lib/tenant-server';
import { sanitizePath, hasPathTraversal } from '@/lib/security/sanitize';
import cors from '@/lib/security/cors';
import { getStorageConfig, isDocumentAccessible } from '@/lib/storage/retention-config';
import { createConnector } from '@/lib/integrations/connectors/factory';
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';
import { logger } from '@/lib/logger';

// Initialize S3 client for MinIO - credentials required in production
const getS3Client = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  // In production, require explicit credentials
  if (isProduction && (!process.env.MINIO_ACCESS_KEY || !process.env.MINIO_SECRET_KEY)) {
    throw new Error('MINIO_ACCESS_KEY and MINIO_SECRET_KEY are required in production');
  }
  
  return new S3Client({
    endpoint: `http://${process.env.MINIO_ENDPOINT || 'localhost'}:${process.env.MINIO_PORT || '9000'}`,
    region: 'us-east-1',
    credentials: {
      accessKeyId: process.env.MINIO_ACCESS_KEY || (isProduction ? '' : 'minioadmin'),
      secretAccessKey: process.env.MINIO_SECRET_KEY || (isProduction ? '' : 'minioadmin'),
    },
    forcePathStyle: true,
  });
};

const BUCKET_NAME = process.env.MINIO_BUCKET || 'contracts';

// ============================================================================
// GET - Serve contract file
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const resolvedParams = await params;
    const contractId = resolvedParams.id;

    if (!contractId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Contract ID is required', 400);
    }

    const tenantId = await getApiTenantId(request);
    if (!tenantId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant ID is required', 400);
    }

    // Check query params for fetch strategy
    const { searchParams } = new URL(request.url);
    const fetchFromSource = searchParams.get('source') === 'true';

    // Get contract from database with tenant isolation and source info
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: {
        id: true,
        fileName: true,
        storagePath: true,
        mimeType: true,
        fileSize: true,
        originalName: true,
        uploadedAt: true,
        externalId: true,
        // Include synced file info if exists
        syncedFiles: {
          select: {
            id: true,
            remoteId: true,
            remotePath: true,
            source: {
              select: {
                id: true,
                provider: true,
                credentials: true,
              },
            },
          },
          take: 1,
        },
      },
    });

    if (!contract) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
    }

    // Determine content type
    const contentType = contract.mimeType || getMimeType(contract.fileName || '');

    // Try to get file
    let fileBuffer: Buffer | undefined;
    const storageConfig = getStorageConfig();
    
    // Strategy 1: Fetch from client source (if requested or no local copy)
    const syncedFile = contract.syncedFiles?.[0];
    const shouldFetchFromSource = fetchFromSource || 
      (!contract.storagePath && syncedFile) ||
      (storageConfig.mode === 'minimal' && syncedFile);
    
    if (shouldFetchFromSource && syncedFile?.source) {
      try {
        // Fetching from client source
        const connector = createConnector(
          syncedFile.source.provider as any,
          syncedFile.source.credentials as any
        );
        
        await (connector as any).connect?.();
        const downloaded = await connector.downloadFile(syncedFile.remoteId);
        
        // Convert stream/buffer to Buffer
        if (downloaded.content instanceof Buffer) {
          fileBuffer = downloaded.content;
        } else if (Buffer.isBuffer(downloaded.content)) {
          fileBuffer = downloaded.content;
        } else {
          // Assume it's binary data that can be converted
          fileBuffer = Buffer.from(downloaded.content as ArrayBuffer);
        }
        
        await (connector as any).disconnect?.();
        
        if (fileBuffer) {
          // Successfully fetched from source
        }
      } catch (sourceError) {
        logger.error('[File API] Failed to fetch from source:', sourceError);
        // Fall through to try local storage
      }
    }
    
    // Strategy 2: Check retention policy for local storage
    if (!fileBuffer && contract.storagePath) {
      if (!isDocumentAccessible(contract.uploadedAt, storageConfig)) {
        // Document expired but might have source
        if (syncedFile?.source && !shouldFetchFromSource) {
          return createSuccessResponse(ctx, { 
              success: false, 
              error: 'Document expired from local storage',
              canFetchFromSource: true,
              message: 'Try adding ?source=true to fetch from original location'
            },
            { status: 410 }) // Gone
        }
        return createSuccessResponse(ctx, { 
            success: false, 
            error: 'Document has expired and is no longer available',
            retentionDays: storageConfig.retentionDays
          },
          { status: 410 }) // Gone
      }
    }

    // Strategy 3: Try local storage (MinIO/S3)
    if (!fileBuffer && contract.storagePath) {
      try {
        // Handle both s3:// prefix and direct key paths
        let s3Key = contract.storagePath;
        if (s3Key.startsWith('s3://')) {
          s3Key = s3Key.replace(`s3://${BUCKET_NAME}/`, '');
        }
        
        const command = new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: s3Key,
        });
        
        const s3Client = getS3Client();
        const response = await s3Client.send(command);
        const bodyBytes = await response.Body?.transformToByteArray();
        
        if (!bodyBytes) {
          throw new Error('Empty file body from S3');
        }
        
        fileBuffer = Buffer.from(bodyBytes);
      } catch {
        // Fall through to try local file
      }
    }

    // If S3 failed or not S3 path, try local file system
    if (!fileBuffer) {
      // Sanitize file paths to prevent path traversal
      const safeFileName = contract.fileName ? sanitizePath(contract.fileName) : '';
      const safeStoragePath = contract.storagePath ? sanitizePath(contract.storagePath) : '';
      
      // Check for path traversal attempts
      if (hasPathTraversal(contract.fileName || '') || hasPathTraversal(contract.storagePath || '')) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid file path', 400);
      }
      
      const localPath = safeStoragePath || path.join(process.cwd(), 'uploads', safeFileName);
      
      try {
        // Check if file exists
        await fs.access(localPath);
        fileBuffer = await fs.readFile(localPath);
      } catch (_localError) {
        return handleApiError(ctx, _localError);
      }
    }

    // Return file with appropriate headers
    if (!fileBuffer) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'File not found', 404);
    }
    
    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Content-Length', fileBuffer.length.toString());
    headers.set('Content-Disposition', `inline; filename="${encodeURIComponent(contract.fileName || contract.originalName || 'document')}"`);
    headers.set('Cache-Control', 'private, max-age=3600'); // Cache for 1 hour
    headers.set('X-Content-Type-Options', 'nosniff');
    // Allow embedding - don't set X-Frame-Options to allow PDF viewing
    // CORS handled by cors utility for production security
    const corsOrigin = cors.getCorsOrigin(request);
    if (corsOrigin) {
      headers.set('Access-Control-Allow-Origin', corsOrigin);
    }
    headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Type');

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers,
    });
  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function getMimeType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  
  const mimeTypes: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain',
    rtf: 'application/rtf',
    html: 'text/html',
    htm: 'text/html',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    tiff: 'image/tiff',
    tif: 'image/tiff',
    bmp: 'image/bmp',
  };

  return mimeTypes[ext || ''] || 'application/octet-stream';
}
