#!/usr/bin/env npx tsx
/**
 * Backfill rawText from MinIO/S3 Storage
 * 
 * Reads contract files directly from MinIO storage, extracts text content,
 * and populates the rawText field. Then queues RAG indexing for embedding generation.
 * 
 * Usage:
 *   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/contracts" npx tsx scripts/backfill-rawtext-from-storage.ts
 *   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/contracts" npx tsx scripts/backfill-rawtext-from-storage.ts --dry-run
 *   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/contracts" npx tsx scripts/backfill-rawtext-from-storage.ts --tenant demo --limit 5
 */

import { PrismaClient } from '@prisma/client';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

const prisma = new PrismaClient();

// Parse CLI args
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const forceAll = args.includes('--force');
const tenantIdx = args.indexOf('--tenant');
const tenantFilter = tenantIdx >= 0 ? args[tenantIdx + 1] : undefined;
const limitIdx = args.indexOf('--limit');
const limitNum = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : undefined;
const skipRag = args.includes('--skip-rag');

// MinIO/S3 configuration
const s3Client = new S3Client({
  endpoint: `http://${process.env.MINIO_ENDPOINT || 'localhost'}:${process.env.MINIO_PORT || '9000'}`,
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretAccessKey: process.env.MINIO_SECRET_KEY || 'minioadmin123',
  },
  forcePathStyle: true,
});

const BUCKET = process.env.MINIO_BUCKET || 'contigo-uploads';

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function readFileFromStorage(storagePath: string): Promise<Buffer | null> {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: storagePath,
    });
    const response = await s3Client.send(command);
    if (!response.Body) return null;
    return streamToBuffer(response.Body as Readable);
  } catch (error: any) {
    console.error(`  ❌ Failed to read from storage: ${error.message}`);
    return null;
  }
}

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    // Try pdf-parse first
    const pdfParse = (await import('pdf-parse')).default;
    const result = await pdfParse(buffer);
    return result.text || '';
  } catch (error: any) {
    console.error(`  ⚠️  PDF parse failed: ${error.message}`);
    // Fallback: try to extract any readable text from the buffer
    const raw = buffer.toString('utf-8', 0, Math.min(buffer.length, 100000));
    // Extract text between stream markers (basic PDF text extraction)
    const textParts: string[] = [];
    const regex = /\(([^)]+)\)/g;
    let match;
    while ((match = regex.exec(raw)) !== null) {
      if (match[1].length > 3 && /[a-zA-Z]/.test(match[1])) {
        textParts.push(match[1]);
      }
    }
    return textParts.join(' ');
  }
}

function extractTextFromContent(buffer: Buffer, contentType: string, filename: string): Promise<string> {
  const ext = filename.toLowerCase().split('.').pop();
  
  if (contentType === 'text/plain' || ext === 'txt') {
    return Promise.resolve(buffer.toString('utf-8'));
  }
  
  if (contentType === 'application/pdf' || ext === 'pdf') {
    return extractTextFromPDF(buffer);
  }
  
  if (contentType?.includes('html') || ext === 'html' || ext === 'htm') {
    // Strip HTML tags
    const html = buffer.toString('utf-8');
    return Promise.resolve(html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
  }
  
  // For other types, try reading as text
  return Promise.resolve(buffer.toString('utf-8'));
}

async function queueRAGIndexing(contractId: string, tenantId: string): Promise<boolean> {
  try {
    // Connect to Redis and queue RAG job via BullMQ
    const { Queue } = await import('bullmq');
    const connection = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    };
    const ragQueue = new Queue('rag-indexing', { connection });
    await ragQueue.add('index-contract', {
      contractId,
      tenantId,
      artifactIds: [],
      traceId: `backfill-${Date.now()}`,
    }, {
      delay: 1000,
      jobId: `rag-backfill-${contractId}`,
    });
    await ragQueue.close();
    return true;
  } catch (error: any) {
    console.error(`  ⚠️  Failed to queue RAG: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🔄 Backfill rawText from MinIO Storage');
  console.log('='.repeat(50));
  if (dryRun) console.log('  🏷️  DRY RUN - no changes will be made');
  if (tenantFilter) console.log(`  🏢 Tenant: ${tenantFilter}`);
  if (limitNum) console.log(`  📊 Limit: ${limitNum}`);
  if (skipRag) console.log(`  ⏭️  Skipping RAG queue`);
  console.log();

  // Find contracts needing rawText
  const where: any = {};
  if (!forceAll) {
    where.OR = [{ rawText: null }, { rawText: '' }];
  }
  if (tenantFilter) {
    where.tenantId = tenantFilter;
  }

  const contracts = await prisma.contract.findMany({
    where,
    select: {
      id: true,
      tenantId: true,
      fileName: true,
      storagePath: true,
      mimeType: true,
      fileSize: true,
      rawText: true,
      status: true,
    },
    take: limitNum,
    orderBy: { createdAt: 'desc' },
  });

  console.log(`📄 Found ${contracts.length} contracts to process\n`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;
  let ragQueued = 0;

  for (const contract of contracts) {
    const name = contract.fileName || contract.id;
    console.log(`📝 ${name}`);
    console.log(`   Storage: ${contract.storagePath || 'N/A'}`);
    console.log(`   Type: ${contract.mimeType || 'unknown'}, Size: ${contract.fileSize || 0} bytes`);

    if (!contract.storagePath) {
      console.log('   ⚠️  No storage path - skipping');
      skipped++;
      continue;
    }

    // Read file from MinIO
    const buffer = await readFileFromStorage(contract.storagePath);
    if (!buffer || buffer.length === 0) {
      console.log('   ❌ Could not read file from storage');
      failed++;
      continue;
    }

    console.log(`   📦 Read ${buffer.length} bytes from MinIO`);

    // Extract text
    const text = await extractTextFromContent(
      buffer,
      contract.mimeType || '',
      contract.fileName || ''
    );

    if (!text || text.trim().length < 10) {
      console.log(`   ⚠️  Extracted text too short (${text?.length || 0} chars) - skipping`);
      skipped++;
      continue;
    }

    console.log(`   📜 Extracted ${text.trim().length} chars of text`);

    if (dryRun) {
      console.log(`   🏷️  DRY RUN - would update rawText`);
      console.log(`   Preview: "${text.trim().substring(0, 100)}..."`);
      updated++;
      continue;
    }

    // Save rawText
    await prisma.contract.update({
      where: { id: contract.id },
      data: {
        rawText: text.trim(),
        searchableText: text.trim().toLowerCase().substring(0, 100000),
        updatedAt: new Date(),
      },
    });
    console.log(`   ✅ Updated rawText`);
    updated++;

    // Queue RAG indexing (only if text is substantial enough)
    if (!skipRag && text.trim().length > 500) {
      const queued = await queueRAGIndexing(contract.id, contract.tenantId);
      if (queued) {
        console.log(`   🔗 Queued RAG indexing`);
        ragQueued++;
      }
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 Backfill Summary');
  console.log('='.repeat(50));
  console.log(`   Updated:    ${updated}`);
  console.log(`   Skipped:    ${skipped}`);
  console.log(`   Failed:     ${failed}`);
  console.log(`   RAG Queued: ${ragQueued}`);

  // Show final coverage
  const total = await prisma.contract.count();
  const withText = await prisma.contract.count({
    where: { rawText: { not: null }, NOT: { rawText: '' } },
  });
  const withEmbeddings = await prisma.contractEmbedding.groupBy({
    by: ['contractId'],
  });
  console.log(`\n📈 Coverage After Backfill:`);
  console.log(`   rawText: ${withText}/${total} (${total > 0 ? Math.round(withText / total * 100) : 0}%)`);
  console.log(`   Embeddings: ${withEmbeddings.length}/${total} (${total > 0 ? Math.round(withEmbeddings.length / total * 100) : 0}%)`);

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('❌ Fatal error:', error);
  await prisma.$disconnect();
  process.exit(1);
});
