// Minimal RAG utilities: chunking, embedding via OpenAI, and retrieval via Prisma with pgvector.

let db: unknown = null;
function getDB(): any {
  if (db) return db;
  try {
    const mod = require('clients-db');
    db = mod.default || mod;
  } catch {
    try {
      const mod = require('../db');
      db = mod.default || mod;
    } catch {
      console.warn('[RAG-client] Failed to load DB client — RAG operations will be unavailable');
    }
  }
  return db;
}

let OpenAIClientCtor: unknown;
try {
  OpenAIClientCtor = require('clients-openai').OpenAIClient;
} catch {
  try { OpenAIClientCtor = require('../openai').OpenAIClient; } catch { OpenAIClientCtor = null; }
}

export type Chunk = { index: number; text: string; embedding?: number[] };

export function chunkText(text: string, size = 1200, overlap = 150): Chunk[] {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  if (!t) return [];
  const chunks: Chunk[] = [];
  let i = 0, idx = 0;
  while (i < t.length) {
    const end = Math.min(t.length, i + size);
    let slice = t.slice(i, end);
    // try to cut at sentence boundary
    const lastPunct = slice.lastIndexOf('. ');
    if (end < t.length && lastPunct > size * 0.6) slice = slice.slice(0, lastPunct + 1);
    chunks.push({ index: idx++, text: slice });
    i = i + (slice.length - Math.min(overlap, slice.length));
  }
  return chunks;
}

export async function embedChunks(docId: string, tenantId: string, chunks: Chunk[], opts?: { model?: string; apiKey?: string }) {
  const apiKey = opts?.apiKey || process.env['OPENAI_API_KEY'];
  const model = opts?.model || process.env['RAG_EMBED_MODEL'] || 'text-embedding-3-small';
  
  if (!apiKey || !OpenAIClientCtor) {
    console.warn(`[RAG-client] embedChunks skipped for ${docId}: ${!apiKey ? 'no API key' : 'no OpenAI client'}`);
    return chunks; // silently skip in demo
  }
  
  // The OpenAI client in this repo exposes chat only; call embeddings via openai SDK directly if available
  let openai: any = null;
  try {
    const OpenAISDK = require('openai').OpenAI;
    openai = new OpenAISDK({ apiKey });
  } catch (err) {
    console.error('[RAG-client] Failed to initialise OpenAI SDK:', (err as Error).message);
  }
  
  if (!openai) {
    console.warn('[RAG-client] embedChunks skipped: OpenAI SDK unavailable');
    return chunks; // can't embed without SDK
  }
  
  // Impose a hard cap on total chunks to embed in one go
  const MAX_CHUNKS = Number(process.env['RAG_MAX_CHUNKS'] || 256);
  const toEmbed = chunks.slice(0, MAX_CHUNKS);
  
  // Batch to smaller groups to limit payload/response size
  const BATCH = Number(process.env['RAG_EMBED_BATCH'] || 32);
  
  for (let start = 0; start < toEmbed.length; start += BATCH) {
    const batch = toEmbed.slice(start, start + BATCH);
    const texts = batch.map(c => c.text);
    
    try {
      const res = await openai.embeddings.create({ model, input: texts });
      
      const vectors = res.data.map((d: any) => d.embedding as number[]);
      for (let i = 0; i < batch.length; i++) {
        if (batch[i]) batch[i].embedding = vectors[i];
      }
    } catch (err) {
      console.error(`[RAG-client] OpenAI embeddings API error (batch ${Math.floor(start / BATCH) + 1}, docId=${docId}):`, (err as Error).message);
      throw new Error('OpenAI embeddings API error');
    }
  }
  
  // persist - use ContractEmbedding table with vector type (not Embedding with Json)
  try {
    const { pgvector } = require('pgvector/utils');
    
    // Use createMany for batch insert (much faster than loop)
    const embeddingsToCreate = toEmbed
      .filter(c => c.embedding && c.embedding.length > 0)
      .map(c => ({
        contractId: docId,
        chunkIndex: c.index,
        chunkText: c.text,
        embedding: pgvector.toSql(c.embedding)
      }));
    
    if (embeddingsToCreate.length > 0) {
      const dbClient = getDB();
      if (!dbClient) throw new Error('Database client not available');
      
      await dbClient.contractEmbedding.deleteMany({ where: { contractId: docId } });
      
      await dbClient.contractEmbedding.createMany({ 
        data: embeddingsToCreate,
        skipDuplicates: true 
      });
    }
  } catch (err) {
    console.error(`[RAG-client] Failed to persist embeddings for docId=${docId}:`, (err as Error).message);
    // RAG embed persistence error - allow artifact generation to continue without RAG
  }
  return toEmbed;
}

export async function retrieve(docId: string, tenantId: string, query: string, k = 6, opts?: { model?: string; apiKey?: string }) {
  const apiKey = opts?.apiKey || process.env['OPENAI_API_KEY'];
  const model = opts?.model || process.env['RAG_EMBED_MODEL'] || 'text-embedding-3-small';
  let openai: any = null;
  try { openai = new (require('openai').OpenAI)({ apiKey }); } catch (err) {
    console.warn('[RAG-client] retrieve: OpenAI SDK unavailable:', (err as Error).message);
  }
  if (!openai) return [] as Array<{ text: string; score: number; chunkIndex: number }>;
  const qvec = (await openai.embeddings.create({ model, input: query })).data[0].embedding as number[];
  
  let rows: Array<{ chunkIndex: number; chunkText: string; score: number }>
  try {
    // Use cosine distance (1 - cosine_similarity) for search with ContractEmbedding table
    const vectorQuery = `[${qvec.join(',')}]`;
    const dbClient = getDB();
    if (!dbClient) throw new Error('Database client not available');
    
    rows = await dbClient.$queryRaw`
      SELECT "chunkIndex", "chunkText", 1 - ("embedding" <=> ${vectorQuery}::vector) as score
      FROM "ContractEmbedding"
      WHERE "contractId" = ${docId}
      ORDER BY score DESC
      LIMIT ${k};
    `;
  } catch (err) {
    console.error(`[RAG-client] retrieve query failed for docId=${docId}:`, (err as Error).message);
    rows = [] as any;
  }
  return rows.map(r => ({ ...r, text: r.chunkText }));
}

export async function getDocChunks(docId: string, tenantId: string, k = 50) {
  try {
    const dbClient = getDB();
    if (!dbClient) {
      console.warn(`[RAG-client] getDocChunks: DB client unavailable for docId=${docId}`);
      return [];
    }
    
    return await dbClient.contractEmbedding.findMany({ 
      where: { contractId: docId }, 
      orderBy: { chunkIndex: 'asc' }, 
      take: k 
    });
  } catch (err) {
    console.error(`[RAG-client] getDocChunks failed for docId=${docId}:`, (err as Error).message);
    return [];
  }
}
