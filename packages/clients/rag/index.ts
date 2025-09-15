// Minimal RAG utilities: chunking, embedding via OpenAI, and retrieval via Prisma with pgvector.

let db: any;
try {
  const mod = require('clients-db');
  db = mod.default || mod;
} catch {
  const mod = require('../db');
  db = mod.default || mod;
}

let OpenAIClientCtor: any;
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
  if (!apiKey || !OpenAIClientCtor) return chunks; // silently skip in demo
  // const client = new OpenAIClientCtor(apiKey); // unused variable
  // The OpenAI client in this repo exposes chat only; call embeddings via openai SDK directly if available
  let openai: any = null;
  try {
    openai = new (require('openai').OpenAI)({ apiKey });
  } catch {}
  if (!openai) return chunks; // can't embed without SDK
  // Impose a hard cap on total chunks to embed in one go
  const MAX_CHUNKS = Number(process.env['RAG_MAX_CHUNKS'] || 256);
  const toEmbed = chunks.slice(0, MAX_CHUNKS);
  // Batch to smaller groups to limit payload/response size
  const BATCH = Number(process.env['RAG_EMBED_BATCH'] || 32);
  for (let start = 0; start < toEmbed.length; start += BATCH) {
    const batch = toEmbed.slice(start, start + BATCH);
    const texts = batch.map(c => c.text);
    const res = await openai.embeddings.create({ model, input: texts });
    const vectors = res.data.map((d: any) => d.embedding as number[]);
    for (let i = 0; i < batch.length; i++) {
      if (batch[i]) batch[i].embedding = vectors[i];
    }
  }
  // persist
  try {
    // const { Prisma } = require('@prisma/client'); // unused variable
    const { pgvector } = require('pgvector/utils');
    for (const c of toEmbed) {
      await db.embedding.create({ data: { contractId: docId, tenantId, chunkIndex: c.index, text: c.text, embedding: pgvector.toSql(c.embedding) } });
    }
  } catch (e) {
    console.error('RAG embed persistence error', e);
  }
  return toEmbed;
}

export async function retrieve(docId: string, tenantId: string, query: string, k = 6, opts?: { model?: string; apiKey?: string }) {
  const apiKey = opts?.apiKey || process.env['OPENAI_API_KEY'];
  const model = opts?.model || process.env['RAG_EMBED_MODEL'] || 'text-embedding-3-small';
  let openai: any = null;
  try { openai = new (require('openai').OpenAI)({ apiKey }); } catch {}
  if (!openai) return [] as Array<{ text: string; score: number; chunkIndex: number }>;
  const qvec = (await openai.embeddings.create({ model, input: query })).data[0].embedding as number[];
  
  let rows: Array<{ chunkIndex: number; text: string; score: number }>
  try {
    // Use cosine distance (1 - cosine_similarity) for search; can also use l2_distance <-> or inner_product <#>
    const vectorQuery = `[${qvec.join(',')}]`;
    rows = await db.$queryRaw`
      SELECT "chunkIndex", "text", 1 - ("embedding" <=> ${vectorQuery}::vector) as score
      FROM "Embedding"
      WHERE "contractId" = ${docId} AND "tenantId" = ${tenantId}
      ORDER BY score DESC
      LIMIT ${k};
    `;
  } catch (e) {
    console.error('RAG retrieval error', e);
    rows = [] as any;
  }
  return rows;
}

export async function getDocChunks(docId: string, tenantId: string, k = 50) {
  try {
    return await db.embedding.findMany({ where: { contractId: docId, tenantId }, orderBy: { chunkIndex: 'asc' }, take: k });
  } catch {
    return [];
  }
}
