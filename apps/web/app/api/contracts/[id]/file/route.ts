/**
 * Contract File API
 * 
 * GET: Serve the original contract file (PDF, DOCX, etc.)
 * Used by the PDF viewer to display the original document
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs/promises';
import path from 'path';
import { getApiTenantId } from '@/lib/tenant-server';
import { sanitizePath, hasPathTraversal } from '@/lib/security/sanitize';
import cors from '@/lib/security/cors';

// Initialize S3 client for MinIO
const s3Client = new S3Client({
  endpoint: `http://${process.env.MINIO_ENDPOINT || 'localhost'}:${process.env.MINIO_PORT || '9000'}`,
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretAccessKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
  },
  forcePathStyle: true,
});

const BUCKET_NAME = process.env.MINIO_BUCKET || 'contracts';

// ============================================================================
// GET - Serve contract file
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const contractId = resolvedParams.id;

    if (!contractId) {
      return NextResponse.json(
        { success: false, error: 'Contract ID is required' },
        { status: 400 }
      );
    }

    const tenantId = await getApiTenantId(request);
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant ID is required' },
        { status: 400 }
      );
    }

    // Get contract from database with tenant isolation
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: {
        id: true,
        fileName: true,
        storagePath: true,
        mimeType: true,
        fileSize: true,
        originalName: true,
      },
    });

    if (!contract) {
      return NextResponse.json(
        { success: false, error: 'Contract not found' },
        { status: 404 }
      );
    }

    // Determine content type
    const contentType = contract.mimeType || getMimeType(contract.fileName || '');

    // Try to get file from storage
    let fileBuffer: Buffer | undefined;

    // First, try MinIO/S3 storage if storagePath exists
    if (contract.storagePath) {
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
        return NextResponse.json(
          { success: false, error: 'Invalid file path' },
          { status: 400 }
        );
      }
      
      const localPath = safeStoragePath || path.join(process.cwd(), 'uploads', safeFileName);
      
      try {
        // Check if file exists
        await fs.access(localPath);
        fileBuffer = await fs.readFile(localPath);
      } catch (localError) {
        // Try alternate paths with sanitized filename
        const alternatePaths = [
          path.join(process.cwd(), 'uploads', contractId, safeFileName),
          path.join(process.cwd(), 'data', 'contracts', safeFileName),
          path.join('/tmp', 'uploads', safeFileName),
        ];

        let found = false;
        for (const altPath of alternatePaths) {
          try {
            await fs.access(altPath);
            fileBuffer = await fs.readFile(altPath);
            found = true;
            break;
          } catch {
            // Continue to next path
          }
        }

        if (!found) {
          return NextResponse.json(
            { 
              success: false, 
              error: 'File not found on server',
              details: 'The original file may have been moved or deleted'
            },
            { status: 404 }
          );
        }
      }
    }

    // Return file with appropriate headers
    if (!fileBuffer) {
      return NextResponse.json(
        { success: false, error: 'File not found' },
        { status: 404 }
      );
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
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to retrieve file',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
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
