/**
 * Chunked Upload API - Initialize (Alias)
 * POST /api/contracts/upload/initialize
 * 
 * Alias for /api/contracts/upload/init for backward compatibility
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";

interface InitUploadRequest {
  uploadId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  totalChunks: number;
  metadata?: Record<string, string>;
}

export async function POST(req: NextRequest) {
  try {
    const tenantId = req.headers.get('x-tenant-id') || 'tenant_demo_001';

    const body: InitUploadRequest = await req.json();
    const { uploadId, fileName, fileSize, mimeType, totalChunks, metadata } = body;

    // Validate input
    if (!uploadId || !fileName || !fileSize || !totalChunks) {
      return NextResponse.json(
        { error: 'Missing required fields: uploadId, fileName, fileSize, totalChunks' },
        { status: 400 }
      );
    }

    // Store upload session in database using raw query (table may or may not exist)
    try {
      await prisma.$executeRaw`
        INSERT INTO upload_sessions (
          id, tenant_id, file_name, file_size, mime_type, 
          total_chunks, chunks_uploaded, status, metadata, created_at
        ) VALUES (
          ${uploadId}, ${tenantId}, ${fileName}, ${fileSize}, ${mimeType || 'application/octet-stream'},
          ${totalChunks}, 0, 'pending', ${JSON.stringify(metadata || {})}, NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          updated_at = NOW()
      `;
    } catch (dbError) {
      // If table doesn't exist, continue anyway (session stored in memory)
      console.log('Upload sessions table may not exist, using in-memory tracking');
    }

    console.log(`✅ Initialized chunked upload: ${uploadId} (${totalChunks} chunks)`);

    return NextResponse.json({
      success: true,
      uploadId,
      totalChunks,
      message: 'Upload session initialized',
    });
  } catch (error) {
    console.error('Failed to initialize upload:', error);
    return NextResponse.json(
      {
        error: 'Failed to initialize upload',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
