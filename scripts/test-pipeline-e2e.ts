#!/usr/bin/env npx tsx
/**
 * End-to-End Pipeline Integration Test
 * Tests: DI OCR → Azure OpenAI artifacts → Mistral fallback → Redis pub/sub → MinIO storage
 * Usage: npx tsx scripts/test-pipeline-e2e.ts [path-to-pdf]
 */

import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Redis from 'ioredis';
import { Client as MinioClient } from 'minio';

// ─── Config ──────────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PDF_PATH = process.argv[2] || path.join(__dirname, '..', 'public', 'realistic_contract.pdf');
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// ─── Helpers ─────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
let skipped = 0;

function ok(label: string, detail?: string) {
  passed++;
  console.log(`  ✅ ${label}${detail ? ` — ${detail}` : ''}`);
}
function fail(label: string, detail?: string) {
  failed++;
  console.error(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`);
}
function skip(label: string, reason?: string) {
  skipped++;
  console.log(`  ⏭️  ${label}${reason ? ` — ${reason}` : ''}`);
}
function section(title: string) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('═'.repeat(60));
}

// ─── 1. Test PDF readable ────────────────────────────────────────────────────
async function testPDFReadable() {
  section('1. Test PDF File');
  if (!fs.existsSync(PDF_PATH)) {
    fail('PDF exists', `Not found: ${PDF_PATH}`);
    return null;
  }
  const stat = fs.statSync(PDF_PATH);
  ok('PDF exists', `${stat.size} bytes`);

  const buf = fs.readFileSync(PDF_PATH);
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) {
    ok('Valid PDF header');
  } else {
    fail('Valid PDF header', 'Does not start with %PDF');
    return null;
  }
  return buf;
}

// ─── 2. Redis connectivity ──────────────────────────────────────────────────
async function testRedis() {
  section('2. Redis Connectivity');
  let redis: Redis | null = null;
  try {
    redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 2, lazyConnect: true, connectTimeout: 5000 });
    await redis.connect();
    const pong = await redis.ping();
    ok('Redis PING', pong);

    // Test pub/sub channel
    const sub = redis.duplicate();
    await sub.connect();
    const channel = 'test:pipeline:e2e';
    let received = false;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => { resolve(); }, 3000);
      sub.subscribe(channel, () => {
        redis!.publish(channel, JSON.stringify({ test: true }));
      });
      sub.on('message', (_ch, msg) => {
        if (JSON.parse(msg).test) received = true;
        clearTimeout(timer);
        resolve();
      });
    });
    if (received) ok('Redis pub/sub', 'Message round-trip OK');
    else fail('Redis pub/sub', 'Message not received');
    await sub.quit().catch(() => {});
  } catch (e: any) {
    fail('Redis connection', e.message);
  } finally {
    if (redis) await redis.quit().catch(() => {});
  }
}

// ─── 3. MinIO / S3 storage ──────────────────────────────────────────────────
async function testMinIO(pdfBuffer: Buffer) {
  section('3. MinIO / S3 Storage');
  const endpoint = process.env.MINIO_ENDPOINT || 'localhost';
  const port = parseInt(process.env.MINIO_PORT || '9000');
  const accessKey = process.env.MINIO_ACCESS_KEY;
  const secretKey = process.env.MINIO_SECRET_KEY;
  const bucket = process.env.MINIO_BUCKET || 'contracts';
  const useSSL = process.env.MINIO_USE_SSL === 'true';

  if (!accessKey || !secretKey) {
    skip('MinIO config', 'MINIO_ACCESS_KEY / MINIO_SECRET_KEY not set');
    return;
  }

  try {
    const minio = new MinioClient({ endPoint: endpoint, port, accessKey, secretKey, useSSL });

    // Check bucket
    const exists = await minio.bucketExists(bucket);
    if (exists) ok('Bucket exists', bucket);
    else { await minio.makeBucket(bucket); ok('Bucket created', bucket); }

    // Upload test file
    const testKey = `e2e-test/${Date.now()}-realistic_contract.pdf`;
    await minio.putObject(bucket, testKey, pdfBuffer, pdfBuffer.length, { 'Content-Type': 'application/pdf' });
    ok('Upload to MinIO', testKey);

    // Download and verify
    const stream = await minio.getObject(bucket, testKey);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const downloaded = Buffer.concat(chunks);
    if (downloaded.length === pdfBuffer.length) ok('Download from MinIO', `${downloaded.length} bytes match`);
    else fail('Download from MinIO', `Size mismatch: ${downloaded.length} vs ${pdfBuffer.length}`);

    // Cleanup
    await minio.removeObject(bucket, testKey);
    ok('Cleanup MinIO test object');
  } catch (e: any) {
    fail('MinIO operations', e.message);
  }
}

// ─── 4. Azure Document Intelligence OCR ─────────────────────────────────────
async function testDIOCR(pdfBuffer: Buffer) {
  section('4. Azure Document Intelligence OCR');
  const diEndpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
  const diKey = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;
  
  if (!diEndpoint || !diKey) {
    skip('DI OCR', 'AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT / KEY not set');
    return null;
  }
  ok('DI configured', diEndpoint.replace(/https?:\/\//, '').split('.')[0]!);

  try {
    // Dynamically import the DI module
    const di = await import('../packages/workers/src/azure-document-intelligence');
    
    if (!di.isDIConfigured()) {
      fail('isDIConfigured()', 'Returns false despite env vars');
      return null;
    }
    ok('isDIConfigured()', 'true');

    if (!di.isDIEnabled()) {
      fail('isDIEnabled()', 'DI is disabled');
      return null;
    }
    ok('isDIEnabled()', 'true');

    // Test layout analysis
    console.log('  ⏳ Running analyzeLayout (this calls Azure DI API)...');
    const startTime = Date.now();
    const layoutResult = await di.analyzeLayout(pdfBuffer);
    const elapsed = Date.now() - startTime;
    
    if (layoutResult.content && layoutResult.content.length > 0) {
      ok('analyzeLayout', `${layoutResult.content.length} chars extracted in ${elapsed}ms`);
      console.log(`     Pages: ${layoutResult.metadata.pageCount}`);
      console.log(`     Tables: ${layoutResult.tables.length}`);
      console.log(`     KV Pairs: ${layoutResult.keyValuePairs.length}`);
      console.log(`     Region: ${layoutResult.metadata.region}`);
      console.log(`     Data Residency: ${layoutResult.metadata.dataResidency}`);
      console.log(`     Preview: "${layoutResult.content.substring(0, 120).replace(/\n/g, ' ')}..."`);
    } else {
      fail('analyzeLayout', 'Empty content returned');
      return null;
    }

    // Test contract analysis (may fail if the model doesn't support certain features)
    console.log('  ⏳ Running analyzeContract...');
    try {
      const contractStart = Date.now();
      const contractResult = await di.analyzeContract(pdfBuffer);
      const contractElapsed = Date.now() - contractStart;
      
      ok('analyzeContract', `${contractElapsed}ms`);
      console.log(`     Parties: ${contractResult.contract.parties.length}`);
      if (contractResult.contract.parties.length > 0) {
        for (const p of contractResult.contract.parties.slice(0, 3)) {
          console.log(`       - ${p.role || 'Party'}: ${p.name}`);
        }
      }
      console.log(`     Effective Date: ${contractResult.contract.dates.effectiveDate || 'N/A'}`);
      console.log(`     Expiration Date: ${contractResult.contract.dates.expirationDate || 'N/A'}`);
      console.log(`     Jurisdiction: ${contractResult.contract.jurisdiction || 'N/A'}`);
    } catch (contractErr: any) {
      // analyzeContract may fail for some DI tiers (e.g. keyValuePairs not supported)
      fail('analyzeContract', contractErr.message?.substring(0, 120));
    }

    return layoutResult.content;
  } catch (e: any) {
    fail('DI OCR analysis', e.message);
    console.error('     Stack:', e.stack?.split('\n').slice(0, 3).join('\n     '));
    return null;
  }
}

// ─── 5. Azure OpenAI artifact generation ─────────────────────────────────────
async function testAzureOpenAI(extractedText: string) {
  section('5. Azure OpenAI Artifact Generation');
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';

  if (!endpoint || !apiKey) {
    skip('Azure OpenAI', 'AZURE_OPENAI_ENDPOINT / AZURE_OPENAI_API_KEY not set');
    return null;
  }
  ok('Azure OpenAI configured', `${deployment} @ ${endpoint.replace(/https?:\/\//, '').split('.')[0]}`);

  // Pre-check: verify endpoint is reachable
  try {
    const hostname = new URL(endpoint).hostname;
    const dns = await import('dns');
    await new Promise<void>((resolve, reject) => {
      dns.lookup(hostname, (err) => err ? reject(err) : resolve());
    });
    ok('Azure OpenAI DNS', `${hostname} resolves`);
  } catch {
    fail('Azure OpenAI DNS', `${new URL(endpoint).hostname} does not resolve — resource may not be provisioned`);
    console.log('     ℹ️  Mistral fallback should handle artifact generation instead');
    return null;
  }

  // Import prompt builder
  const { buildArtifactPrompt, getSystemPrompt } = await import('../packages/workers/src/utils/artifact-prompts');
  const contractProfiles = await import('../packages/workers/src/contract-type-profiles');
  const profile = contractProfiles.getContractProfile('MSA');
  const promptCtx = {
    contractText: extractedText,
    contractType: 'MSA',
    contractTypeDisplayName: profile.displayName,
    contractTypeHints: profile.extractionHints,
    expectedSections: profile.expectedSections,
  };

  const systemPrompt = getSystemPrompt();
  const results: Record<string, any> = {};

  for (const artifactType of ['OVERVIEW', 'FINANCIAL', 'RISK']) {
    const prompt = buildArtifactPrompt(artifactType, promptCtx);
    if (!prompt) {
      skip(`Generate ${artifactType}`, 'No prompt template');
      continue;
    }

    console.log(`  ⏳ Generating ${artifactType} artifact...`);
    const start = Date.now();

    try {
      const url = `${endpoint.replace(/\/$/, '')}/openai/deployments/${deployment}/chat/completions?api-version=2024-06-01`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 90_000);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
          max_tokens: 8192,
          temperature: 0.2,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const errText = await response.text();
        fail(`Azure OpenAI ${artifactType}`, `HTTP ${response.status}: ${errText.substring(0, 150)}`);
        continue;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        fail(`Azure OpenAI ${artifactType}`, 'Empty response');
        continue;
      }

      const parsed = JSON.parse(content);
      const elapsed = Date.now() - start;
      const tokens = data.usage?.total_tokens || 0;
      ok(`Azure OpenAI ${artifactType}`, `${elapsed}ms, ${tokens} tokens, ${Object.keys(parsed).length} fields`);
      results[artifactType] = parsed;

      // Print key fields
      if (artifactType === 'OVERVIEW') {
        console.log(`     Summary: ${(parsed.summary || '').substring(0, 80)}...`);
        console.log(`     Parties: ${parsed.parties?.length || 0}`);
        console.log(`     Value: ${parsed.totalValue || 'N/A'}`);
      } else if (artifactType === 'FINANCIAL') {
        console.log(`     Total Value: ${parsed.totalValue || parsed.totalContractValue || 'N/A'}`);
        console.log(`     Payment Terms: ${parsed.paymentTerms || 'N/A'}`);
      } else if (artifactType === 'RISK') {
        console.log(`     Risk Level: ${parsed.overallRiskLevel || 'N/A'}`);
        console.log(`     Risks Found: ${parsed.riskFactors?.length || parsed.risks?.length || 0}`);
      }
    } catch (e: any) {
      fail(`Azure OpenAI ${artifactType}`, e.message);
    }
  }

  return results;
}

// ─── 6. Mistral fallback test ────────────────────────────────────────────────
async function testMistralFallback(extractedText: string) {
  section('6. Mistral Fallback Test');
  const mistralKey = process.env.MISTRAL_API_KEY;

  if (!mistralKey) {
    skip('Mistral', 'MISTRAL_API_KEY not set');
    return;
  }
  ok('Mistral configured');

  const { buildArtifactPrompt, getSystemPrompt } = await import('../packages/workers/src/utils/artifact-prompts');
  const contractProfiles = await import('../packages/workers/src/contract-type-profiles');
  const profile = contractProfiles.getContractProfile('MSA');
  const prompt = buildArtifactPrompt('COMPLIANCE', {
    contractText: extractedText,
    contractType: 'MSA',
    contractTypeDisplayName: profile.displayName,
  });

  if (!prompt) {
    skip('Mistral COMPLIANCE', 'No prompt template');
    return;
  }

  console.log('  ⏳ Generating COMPLIANCE artifact via Mistral...');
  const start = Date.now();

  try {
    const { Mistral } = await import('@mistralai/mistralai');
    const client = new Mistral({ apiKey: mistralKey });
    const systemPrompt = getSystemPrompt();

    const response = await Promise.race([
      client.chat.complete({
        model: 'mistral-large-latest',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        maxTokens: 8192,
        responseFormat: { type: 'json_object' },
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Mistral timeout (90s)')), 90_000)),
    ]);

    const content = response.choices?.[0]?.message?.content;
    if (!content || typeof content !== 'string') {
      fail('Mistral COMPLIANCE', 'Empty response');
      return;
    }

    const parsed = JSON.parse(content);
    const elapsed = Date.now() - start;
    ok(`Mistral COMPLIANCE`, `${elapsed}ms, ${Object.keys(parsed).length} fields`);
    console.log(`     Requirements: ${parsed.requirements?.length || 0}`);
    console.log(`     Certifications: ${parsed.certifications?.length || 0}`);
  } catch (e: any) {
    fail('Mistral COMPLIANCE', e.message);
  }
}

// ─── 7. Database connectivity ────────────────────────────────────────────────
async function testDatabase() {
  section('7. Database Connectivity');
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    
    // Quick query to test connection
    const count = await prisma.contract.count();
    ok('Database connection', `${count} contracts in DB`);
    
    // Check recent processing
    const recent = await prisma.contract.findMany({
      where: { status: { in: ['COMPLETED', 'PROCESSING', 'QUEUED'] } },
      orderBy: { updatedAt: 'desc' },
      take: 3,
      select: { id: true, contractTitle: true, status: true, updatedAt: true },
    });
    if (recent.length > 0) {
      ok('Recent contracts', `${recent.length} found`);
      for (const c of recent) {
        console.log(`     ${c.status}: ${c.contractTitle || c.id} (${c.updatedAt.toISOString().substring(0, 19)})`);
      }
    }
    
    await prisma.$disconnect();
  } catch (e: any) {
    fail('Database', e.message);
  }
}

// ─── 8. BullMQ queue health ──────────────────────────────────────────────────
async function testBullMQ() {
  section('8. BullMQ Queue Health');
  try {
    const { Queue } = await import('bullmq');
    const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
    
    const queueNames = ['ocr-artifact-generation', 'metadata-extraction', 'rag-indexing', 'categorization'];
    
    for (const name of queueNames) {
      try {
        const queue = new Queue(name, { connection: redis });
        const counts = await queue.getJobCounts();
        const total = Object.values(counts).reduce((a, b) => a + b, 0);
        ok(`Queue: ${name}`, `waiting=${counts.waiting || 0} active=${counts.active || 0} completed=${counts.completed || 0} failed=${counts.failed || 0}`);
        await queue.close();
      } catch (e: any) {
        fail(`Queue: ${name}`, e.message);
      }
    }
    
    await redis.quit();
  } catch (e: any) {
    fail('BullMQ', e.message);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  End-to-End Pipeline Integration Test                       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`  PDF: ${PDF_PATH}`);
  console.log(`  Time: ${new Date().toISOString()}`);

  // 1. PDF
  const pdfBuffer = await testPDFReadable();
  if (!pdfBuffer) {
    console.log('\n⛔ Cannot continue without valid PDF');
    process.exit(1);
  }

  // 2. Redis
  await testRedis();

  // 3. MinIO
  await testMinIO(pdfBuffer);

  // 4. DI OCR
  const extractedText = await testDIOCR(pdfBuffer);

  // 5. Azure OpenAI
  let azureResults: Record<string, any> | null = null;
  if (extractedText) {
    azureResults = await testAzureOpenAI(extractedText);
  } else {
    skip('Azure OpenAI', 'No OCR text available');
  }

  // 6. Mistral fallback
  if (extractedText) {
    await testMistralFallback(extractedText);
  } else {
    skip('Mistral fallback', 'No OCR text available');
  }

  // 7. Database
  await testDatabase();

  // 8. BullMQ
  await testBullMQ();

  // ─── Summary ────────────────────────────────────────────────────────────
  section('Summary');
  console.log(`  ✅ Passed:  ${passed}`);
  console.log(`  ❌ Failed:  ${failed}`);
  console.log(`  ⏭️  Skipped: ${skipped}`);
  console.log('');

  if (failed > 0) {
    console.log('  ⚠️  Some tests failed! Review output above.');
    process.exit(1);
  } else {
    console.log('  🎉 All tests passed!');
    process.exit(0);
  }
}

main().catch((e) => {
  console.error('\n💥 Unhandled error:', e);
  process.exit(1);
});
