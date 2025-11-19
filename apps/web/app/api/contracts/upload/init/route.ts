/**
 * Chunked Upload API - Initialize
 * POST /api/contracts/upload/init
 * 
 * Initialize a chunked upload session for large files
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";

// Using singleton prisma instance from @/lib/prisma

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
    const tenantId = req.headers.get('x-tenant-id');
    
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Missing tenant ID' },
        { status: 400 }
      );
    }

    const body: InitUploadRequest = await req.json();
    const { uploadId, fileName, fileSize, mimeType, totalChunks, metadata } = body;

    // Validate input
    if (!uploadId || !fileName || !fileSize || !totalChunks) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
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

    console.log(`✅ Initialized chunked upload: ${uploadId} (${totalChunks} chunks)`);

    return NextResponse.json({
      success: true,
      uploadId,
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
