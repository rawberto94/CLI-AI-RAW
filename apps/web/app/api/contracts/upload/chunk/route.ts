/**
 * Chunked Upload API - Upload Chunk
 * POST /api/contracts/upload/chunk
 * 
 * Upload a single chunk of a large file
 */

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function POST(req: NextRequest) {
  try {
    const tenantId = req.headers.get('x-tenant-id');
    
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Missing tenant ID' },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const chunk = formData.get('chunk') as File;
    const uploadId = formData.get('uploadId') as string;
    const chunkIndex = parseInt(formData.get('chunkIndex') as string);
    const totalChunks = parseInt(formData.get('totalChunks') as string);

    if (!chunk || !uploadId || isNaN(chunkIndex) || isNaN(totalChunks)) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
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

    console.log(`✅ Chunk ${chunkIndex + 1}/${totalChunks} uploaded for ${uploadId}`);

    return NextResponse.json({
      success: true,
      chunkIndex,
      uploadId,
      message: `Chunk ${chunkIndex + 1}/${totalChunks} uploaded`,
    });
  } catch (error) {
    console.error('Failed to upload chunk:', error);
    return NextResponse.json(
      {
        error: 'Failed to upload chunk',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
