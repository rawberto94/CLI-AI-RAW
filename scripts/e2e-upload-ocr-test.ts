/**
 * E2E Upload → OCR → DB Storage Test
 * 
 * Tests the complete contract upload pipeline:
 * 1. Upload file to MinIO
 * 2. Create contract record in PostgreSQL
 * 3. Queue BullMQ job for OCR processing
 * 4. Wait for OCR worker to process (Azure Document Intelligence)
 * 5. Verify rawText, ocrProvider, artifacts stored in DB
 *
 * Usage: npx tsx scripts/e2e-upload-ocr-test.ts [path-to-pdf]
 */

import { readFileSync } from 'fs';
import { join, basename } from 'path';
import { createHash } from 'crypto';

// ── Config ──────────────────────────────────────────────────────────────────
const TEST_FILE = process.argv[2] || join(__dirname, '..', 'public', 'TEST_Advisory_Agreement.pdf');
const TENANT_ID = 'acme';
const USER_ID = 'cmltklcyu00039glubwv4g3cx'; // roberto@acme.com
const POLL_INTERVAL_MS = 3_000;
const MAX_WAIT_MS = 180_000; // 3 minutes max

// ── Helpers ─────────────────────────────────────────────────────────────────
function log(step: string, msg: string, data?: Record<string, unknown>) {
  const ts = new Date().toISOString().slice(11, 23);
  const extra = data ? ' ' + JSON.stringify(data) : '';
  console.log(`[${ts}] [${step}] ${msg}${extra}`);
}

function fail(msg: string): never {
  console.error(`\n❌ FAIL: ${msg}`);
  process.exit(1);
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  E2E Test: Upload → OCR → Database Storage');
  console.log('═══════════════════════════════════════════════════════════\n');

  // ── Step 1: Read test file ──────────────────────────────────────────────
  log('FILE', `Reading ${TEST_FILE}...`);
  let buffer: Buffer;
  try {
    buffer = readFileSync(TEST_FILE);
  } catch {
    fail(`Cannot read test file: ${TEST_FILE}`);
  }
  const fileName = basename(TEST_FILE);
  const fileSize = buffer.length;
  const checksum = createHash('sha256').update(buffer).digest('hex');
  log('FILE', `Loaded ${fileName}`, { size: fileSize, checksum: checksum.slice(0, 16) + '...' });

  // ── Step 2: Upload to MinIO ─────────────────────────────────────────────
  log('MINIO', 'Uploading to object storage...');
  const Minio = await import('minio');
  const minioClient = new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT || '9000'),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
  });

  const bucket = process.env.MINIO_BUCKET || 'contigo-uploads';
  // Ensure bucket exists
  const bucketExists = await minioClient.bucketExists(bucket);
  if (!bucketExists) {
    await minioClient.makeBucket(bucket, 'us-east-1');
    log('MINIO', `Created bucket: ${bucket}`);
  }

  const timestamp = Date.now();
  const sanitized = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const objectKey = `contracts/${TENANT_ID}/${timestamp}-${sanitized}`;

  await minioClient.putObject(bucket, objectKey, buffer, buffer.length, {
    'Content-Type': 'application/pdf',
    'x-amz-meta-tenantid': TENANT_ID,
    'x-amz-meta-originalname': fileName,
  });
  log('MINIO', `Uploaded to ${bucket}/${objectKey}`, { size: fileSize });

  // ── Step 3: Create contract record in PostgreSQL ────────────────────────
  log('DB', 'Creating contract record...');
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  let contractId: string;
  try {
    const contract = await prisma.contract.create({
      data: {
        tenantId: TENANT_ID,
        fileName: `${timestamp}-${sanitized}`,
        originalName: fileName,
        fileSize: BigInt(fileSize),
        mimeType: 'application/pdf',
        storagePath: objectKey,
        storageProvider: 's3',
        checksum,
        status: 'PROCESSING',
        uploadedBy: USER_ID,
        contractTitle: `E2E Test - ${fileName}`,
        contractType: 'Advisory Agreement',
      },
    });
    contractId = contract.id;
    log('DB', `Contract created`, { id: contractId, status: 'PROCESSING' });
  } catch (err: any) {
    await prisma.$disconnect();
    fail(`Failed to create contract: ${err.message}`);
  }

  // ── Step 4: Queue BullMQ job ────────────────────────────────────────────
  log('QUEUE', 'Queuing contract for OCR processing...');
  const bullmq = await import('bullmq');

  const connection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: null as any,
  };

  const queue = new bullmq.Queue('contract-processing', { connection });

  const job = await queue.add(
    'process-contract',
    {
      contractId,
      tenantId: TENANT_ID,
      filePath: objectKey,
      originalName: fileName,
      ocrMode: 'layout',
    },
    {
      priority: 1, // Urgent
      jobId: `e2e-test-${contractId}-${timestamp}`,
    }
  );

  log('QUEUE', `Job queued`, { jobId: job.id, queue: 'contract-processing' });

  const waiting = await queue.getWaitingCount();
  const active = await queue.getActiveCount();
  log('QUEUE', `Queue status`, { waiting, active });

  // ── Step 5: Poll DB for completion ──────────────────────────────────────
  log('POLL', `Waiting for OCR processing (max ${MAX_WAIT_MS / 1000}s)...`);
  const pollStart = Date.now();
  let finalContract: any = null;
  let lastStatus = 'PROCESSING';

  while (Date.now() - pollStart < MAX_WAIT_MS) {
    await sleep(POLL_INTERVAL_MS);

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: {
        id: true,
        status: true,
        rawText: true,
        ocrProvider: true,
        ocrModel: true,
        ocrProcessedAt: true,
        contractType: true,
        contractTitle: true,
        supplierName: true,
        clientName: true,
        startDate: true,
        endDate: true,
        updatedAt: true,
      },
    });

    if (!contract) {
      fail('Contract record disappeared from DB!');
    }

    if (contract.status !== lastStatus) {
      lastStatus = contract.status;
      log('POLL', `Status changed → ${contract.status}`, {
        elapsed: `${((Date.now() - pollStart) / 1000).toFixed(1)}s`,
      });
    }

    if (contract.status === 'COMPLETED' || contract.status === 'ACTIVE') {
      finalContract = contract;
      break;
    }

    if (contract.status === 'FAILED') {
      // Check for error details
      const fullContract = await prisma.contract.findUnique({
        where: { id: contractId },
      });
      log('POLL', `Processing failed`, { contract: JSON.stringify(fullContract, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2).slice(0, 500) });
      fail(`OCR processing failed for contract ${contractId}`);
    }

    const elapsed = ((Date.now() - pollStart) / 1000).toFixed(0);
    process.stdout.write(`\r  ⏳ Waiting... ${elapsed}s elapsed (status: ${contract.status})`);
  }

  if (!finalContract) {
    fail(`Timed out after ${MAX_WAIT_MS / 1000}s — contract still in ${lastStatus} status`);
  }

  console.log(''); // newline after progress indicator

  // ── Step 6: Verification ────────────────────────────────────────────────
  const totalTime = ((Date.now() - pollStart) / 1000).toFixed(1);
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  RESULTS');
  console.log('═══════════════════════════════════════════════════════════\n');

  const checks: { name: string; pass: boolean; detail: string }[] = [];

  // Check 1: Status is COMPLETED/ACTIVE
  checks.push({
    name: 'Contract status',
    pass: ['COMPLETED', 'ACTIVE'].includes(finalContract.status),
    detail: finalContract.status,
  });

  // Check 2: rawText is populated
  const hasRawText = !!finalContract.rawText && finalContract.rawText.length > 50;
  checks.push({
    name: 'OCR text extracted',
    pass: hasRawText,
    detail: hasRawText
      ? `${finalContract.rawText.length} chars (preview: "${finalContract.rawText.slice(0, 100).replace(/\n/g, ' ')}...")`
      : 'No text extracted',
  });

  // Check 3: ocrProvider is set
  checks.push({
    name: 'OCR provider recorded',
    pass: !!finalContract.ocrProvider,
    detail: finalContract.ocrProvider || 'not set',
  });

  // Check 4: ocrModel is set
  checks.push({
    name: 'OCR model recorded',
    pass: !!finalContract.ocrModel,
    detail: finalContract.ocrModel || 'not set',
  });

  // Check 5: ocrProcessedAt is set
  checks.push({
    name: 'OCR timestamp recorded',
    pass: !!finalContract.ocrProcessedAt,
    detail: finalContract.ocrProcessedAt?.toISOString() || 'not set',
  });

  // Check 6: Check for artifacts
  const artifacts = await prisma.artifact.findMany({
    where: { contractId },
    select: { id: true, type: true, createdAt: true },
  });
  checks.push({
    name: 'Artifacts generated',
    pass: artifacts.length > 0,
    detail: artifacts.length > 0
      ? `${artifacts.length} artifacts: ${artifacts.map(a => a.type).join(', ')}`
      : 'No artifacts found',
  });

  // Check 7: Check for embeddings (RAG)
  let embeddingCount = 0;
  try {
    const embResult = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM "ContractEmbedding" WHERE "contractId" = ${contractId}
    `;
    embeddingCount = Number(embResult[0]?.count || 0);
  } catch {
    // Table may not exist
  }
  checks.push({
    name: 'RAG embeddings created',
    pass: embeddingCount > 0,
    detail: `${embeddingCount} embedding chunks`,
  });

  // Check 8: Check for metadata extraction
  let metadataCount = 0;
  try {
    const metaResult = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM "ContractMetadata" WHERE "contractId" = ${contractId}
    `;
    metadataCount = Number(metaResult[0]?.count || 0);
  } catch {
    // Table may not exist
  }
  checks.push({
    name: 'Metadata extracted',
    pass: metadataCount > 0 || !!finalContract.supplierName || !!finalContract.clientName,
    detail: metadataCount > 0
      ? `${metadataCount} metadata records`
      : finalContract.supplierName
        ? `supplier: ${finalContract.supplierName}`
        : 'Checking via contract fields...',
  });

  // Print results
  let allPassed = true;
  for (const check of checks) {
    const icon = check.pass ? '✅' : '❌';
    if (!check.pass) allPassed = false;
    console.log(`  ${icon} ${check.name}: ${check.detail}`);
  }

  console.log(`\n  ⏱  Total processing time: ${totalTime}s`);
  console.log(`  📄 Contract ID: ${contractId}`);
  console.log(`  🗂  Storage: ${bucket}/${objectKey}`);

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════');
  if (allPassed) {
    console.log('  ✅ ALL CHECKS PASSED — E2E upload pipeline working!');
  } else {
    const passed = checks.filter(c => c.pass).length;
    const failed = checks.filter(c => !c.pass).length;
    console.log(`  ⚠️  ${passed} passed, ${failed} failed`);
    console.log('  Some downstream jobs may still be processing...');
  }
  console.log('═══════════════════════════════════════════════════════════\n');

  // Cleanup
  await queue.close();
  await prisma.$disconnect();

  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error('\n💥 Unexpected error:', err);
  process.exit(1);
});
