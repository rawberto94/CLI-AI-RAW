#!/usr/bin/env npx tsx
/**
 * Generate Embeddings Script
 * 
 * Run this script to process all contracts and generate embeddings for RAG search.
 * 
 * Usage:
 *   pnpm tsx scripts/generate-embeddings.ts
 *   pnpm tsx scripts/generate-embeddings.ts --limit 10
 *   pnpm tsx scripts/generate-embeddings.ts --force
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ProcessResult {
  contractId: string;
  fileName: string;
  success: boolean;
  chunksCreated?: number;
  error?: string;
}

async function processContractWithSemanticChunking(
  contractId: string,
  text: string,
  options: { apiKey: string; model?: string }
): Promise<{ chunksCreated: number; embeddingsGenerated: number }> {
  const { apiKey, model = process.env.RAG_EMBED_MODEL || 'text-embedding-3-large' } = options;
  const embDims = parseInt(process.env.RAG_EMBED_DIMENSIONS || '1024', 10);
  
  // Semantic chunking - split by sections and paragraphs
  const chunks = semanticChunk(text);
  
  if (chunks.length === 0) {
    return { chunksCreated: 0, embeddingsGenerated: 0 };
  }

  // Generate embeddings in batches
  const OpenAI = (await import('openai')).OpenAI;
  const openai = new OpenAI({ apiKey });

  const BATCH_SIZE = 32;
  const embeddings: number[][] = [];

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const texts = batch.map(c => c.text);

    console.log(`  🌐 Embedding batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)}`);

    const createParams: Record<string, unknown> = { model, input: texts };
    if (embDims > 0 && model.includes('text-embedding-3')) {
      createParams.dimensions = embDims;
    }
    const response = await openai.embeddings.create(createParams as any);
    embeddings.push(...response.data.map(d => d.embedding));
  }

  // Store in database
  const { toSql } = await import('pgvector');

  // Delete existing document chunks only (preserve artifact/metadata chunks at 9900+)
  await prisma.$executeRaw`
    DELETE FROM "ContractEmbedding"
    WHERE "contractId" = ${contractId} AND "chunkIndex" < 9900
  `;

  // Create new embeddings
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = embeddings[i];
    
    await prisma.$executeRaw`
      INSERT INTO "ContractEmbedding" ("id", "contractId", "chunkIndex", "chunkText", "embedding", "chunkType", "section", "createdAt", "updatedAt")
      VALUES (
        gen_random_uuid(), 
        ${contractId}, 
        ${chunk.index}, 
        ${chunk.text}, 
        ${toSql(embedding)}::vector, 
        ${chunk.metadata.chunkType}, 
        ${chunk.metadata.section ?? null}, 
        NOW(), 
        NOW()
      )
    `;
  }

  return {
    chunksCreated: chunks.length,
    embeddingsGenerated: embeddings.length,
  };
}

interface SemanticChunk {
  index: number;
  text: string;
  metadata: {
    section?: string;
    chunkType: 'heading' | 'paragraph' | 'list' | 'table' | 'clause';
  };
}

function semanticChunk(text: string, maxChunkSize = 1500): SemanticChunk[] {
  const chunks: SemanticChunk[] = [];
  let chunkIndex = 0;

  const headingPattern = /^(?:#{1,6}\s+|(?:\d+\.)+\s+|[A-Z][A-Z\s]{2,}:?\s*$|Article\s+\d+|Section\s+\d+|ARTICLE\s+[IVXLCDM]+)/gm;
  const listPattern = /^(?:\s*[-•*]\s+|\s*\d+[.)]\s+)/gm;
  const tablePattern = /\|.*\|/g;

  // Split by major sections first
  const sections = text.split(/\n(?=(?:#{1,3}\s+|Article\s+\d+|Section\s+\d+|ARTICLE\s+[IVXLCDM]+))/i);

  for (const section of sections) {
    if (!section.trim()) continue;

    const headingMatch = section.match(headingPattern);
    const heading = headingMatch ? headingMatch[0].trim() : undefined;

    let chunkType: SemanticChunk['metadata']['chunkType'] = 'paragraph';
    if (heading) chunkType = 'heading';
    else if (listPattern.test(section)) chunkType = 'list';
    else if (tablePattern.test(section)) chunkType = 'table';
    else if (/clause|term|condition|obligation/i.test(section)) chunkType = 'clause';

    // If section is small enough, keep as single chunk
    if (section.length <= maxChunkSize) {
      chunks.push({
        index: chunkIndex++,
        text: section.trim(),
        metadata: { section: heading, chunkType },
      });
      continue;
    }

    // Split large sections by paragraphs
    const paragraphs = section.split(/\n\n+/);
    let currentChunk = '';

    for (const para of paragraphs) {
      if (!para.trim()) continue;

      if (currentChunk.length + para.length > maxChunkSize && currentChunk.length >= 200) {
        chunks.push({
          index: chunkIndex++,
          text: currentChunk.trim(),
          metadata: { section: heading, chunkType },
        });
        currentChunk = para;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + para;
      }
    }

    if (currentChunk.trim().length >= 200) {
      chunks.push({
        index: chunkIndex++,
        text: currentChunk.trim(),
        metadata: { section: heading, chunkType },
      });
    }
  }

  return chunks;
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const limitArg = args.find(a => a.startsWith('--limit'));
  const limit = limitArg ? parseInt(limitArg.split('=')[1] || args[args.indexOf('--limit') + 1] || '50') : 50;

  console.log('🚀 Starting embedding generation');
  console.log(`   Force reprocess: ${force}`);
  console.log(`   Limit: ${limit}`);
  console.log('');

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY not found in environment');
    process.exit(1);
  }

  // Find contracts to process
  const whereClause: any = {};
  
  if (!force) {
    // Only process contracts without embeddings
    whereClause.contractEmbeddings = { none: {} };
  }

  const contracts = await prisma.contract.findMany({
    where: whereClause,
    select: {
      id: true,
      fileName: true,
      rawText: true,
      _count: { select: { contractEmbeddings: true } },
    },
    take: limit,
    orderBy: { createdAt: 'desc' },
  });

  console.log(`📄 Found ${contracts.length} contracts to process`);

  const results: ProcessResult[] = [];
  let successCount = 0;
  let failCount = 0;

  for (const contract of contracts) {
    console.log(`\n📄 Processing: ${contract.fileName}`);

    if (!contract.rawText || contract.rawText.length < 100) {
      console.log(`   ⚠️  Skipping - no/short text content (${contract.rawText?.length || 0} chars)`);
      results.push({
        contractId: contract.id,
        fileName: contract.fileName,
        success: false,
        error: 'No text content',
      });
      failCount++;
      continue;
    }

    try {
      const result = await processContractWithSemanticChunking(
        contract.id,
        contract.rawText,
        { apiKey }
      );

      console.log(`   ✅ Created ${result.chunksCreated} chunks with embeddings`);
      results.push({
        contractId: contract.id,
        fileName: contract.fileName,
        success: true,
        chunksCreated: result.chunksCreated,
      });
      successCount++;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.log(`   ❌ Failed: ${errorMsg}`);
      results.push({
        contractId: contract.id,
        fileName: contract.fileName,
        success: false,
        error: errorMsg,
      });
      failCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary');
  console.log('='.repeat(60));
  console.log(`   Total processed: ${contracts.length}`);
  console.log(`   Successful: ${successCount}`);
  console.log(`   Failed: ${failCount}`);

  // Check final count
  const totalEmbeddings = await prisma.contractEmbedding.count();
  console.log(`\n📈 Total embeddings in database: ${totalEmbeddings}`);

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('Fatal error:', error);
  await prisma.$disconnect();
  process.exit(1);
});
