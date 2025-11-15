/**
 * Chunked Upload API - Finalize
 * POST /api/contracts/upload/finalize
 * 
 * Combine all chunks into final file and create contract
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, mkdir, unlink, rm } from 'fs/promises';
import { join } from 'path';
import { existsSync, createReadStream } from 'fs';
import { PrismaClient } from '@prisma/client';
import { triggerArtifactGeneration } from '@/lib/artifact-trigger';

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const tenantId = req.headers.get('x-tenant-id');
    
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Missing tenant ID' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { uploadId, fileName } = body;

    if (!uploadId || !fileName) {
      return NextResponse.json(
        { error: 'Missing uploadId or fileName' },
        { status: 400 }
      );
    }

    console.log(`🔄 Finalizing upload: ${uploadId}`);

    // Get chunks directory
    const chunksDir = join(process.cwd(), 'uploads', 'chunks', uploadId);
    
    if (!existsSync(chunksDir)) {
      return NextResponse.json(
        { error: 'Upload session not found' },
        { status: 404 }
      );
    }

    // Create uploads directory
    const uploadsDir = join(process.cwd(), 'uploads', tenantId);
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    // Combine all chunks
    const finalFilePath = join(uploadsDir, fileName);
    const chunkFiles: string[] = [];
    
    // Find all chunks
    const fs = require('fs');
    const files = fs.readdirSync(chunksDir);
    const chunks = files
      .filter((f: string) => f.startsWith('chunk-'))
      .map((f: string) => ({
        name: f,
        index: parseInt(f.replace('chunk-', '')),
      }))
      .sort((a: any, b: any) => a.index - b.index);

    console.log(`📦 Combining ${chunks.length} chunks...`);

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
    console.log(`✅ File combined: ${fileSize} bytes`);

    // Detect MIME type
    const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
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
        fileName,
        fileSize: BigInt(fileSize),
        mimeType,
        originalName: fileName,
        uploadedBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    console.log(`✅ Contract created: ${contract.id}`);

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
      console.log(`🧹 Cleaned up chunks directory`);
    } catch (error) {
      console.warn('Failed to clean up chunks:', error);
    }

    return NextResponse.json({
      success: true,
      contractId: contract.id,
      fileId: contract.id,
      fileName,
      fileSize,
      status: 'PROCESSING',
      message: 'Upload completed successfully',
    });
  } catch (error) {
    console.error('Failed to finalize upload:', error);
    return NextResponse.json(
      {
        error: 'Failed to finalize upload',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
