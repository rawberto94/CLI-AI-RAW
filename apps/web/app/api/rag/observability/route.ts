/**
 * RAG Observability Endpoint
 *
 * GET /api/rag/observability
 *
 * Returns live health and statistics for every subsystem in the RAG pipeline:
 *  - Semantic cache (hit rate, entry count, Redis connectivity)
 *  - Chunk relationship graph (node/edge count, Redis connectivity)
 *  - Embedding coverage (total embeddings, model distribution)
 *  - Pipeline configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSemanticCache } from '@/lib/rag/semantic-cache.service';
import { getChunkGraph } from '@/lib/rag/chunk-graph.service';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedApiContext } from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

// Simple in-memory rate limiter (1 req/s per IP)
const lastRequestByIp = new Map<string, number>();

export async function GET(request: NextRequest) {
  // Auth check (defense-in-depth)
  const authCtx = getAuthenticatedApiContext(request);
  if (!authCtx) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  // Rate limit
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const now = Date.now();
  const last = lastRequestByIp.get(ip) || 0;
  if (now - last < 1000) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
  }
  lastRequestByIp.set(ip, now);
  // Prevent memory leak
  if (lastRequestByIp.size > 500) {
    const oldest = lastRequestByIp.keys().next().value;
    if (oldest) lastRequestByIp.delete(oldest);
  }

  try {
    // ── Cache stats ───────────────────────────────────────────────────────
    let cacheStats: Record<string, unknown> = {};
    try {
      cacheStats = getSemanticCache().getStats();
    } catch {
      cacheStats = { error: 'Cache unavailable' };
    }

    // ── Graph stats ───────────────────────────────────────────────────────
    let graphStats: Record<string, unknown> = {};
    try {
      graphStats = getChunkGraph().getStats();
    } catch {
      graphStats = { error: 'Graph unavailable' };
    }

    // ── Embedding coverage ────────────────────────────────────────────────
    let embeddingStats: Record<string, unknown> = {};
    try {
      const [totalEmbeddings, totalContracts, withEmbeddings] = await Promise.all([
        prisma.contractEmbedding.count(),
        prisma.contract.count(),
        prisma.contractEmbedding.groupBy({
          by: ['contractId'],
          _count: true,
        }),
      ]);

      // Model distribution from ContractMetadata
      const modelDistribution: Record<string, number> = {};
      try {
        const metaRows = await prisma.contractMetadata.findMany({
          where: { embeddingVersion: { not: null } },
          select: { embeddingVersion: true },
        });
        for (const row of metaRows) {
          const v = row.embeddingVersion || 'unknown';
          modelDistribution[v] = (modelDistribution[v] || 0) + 1;
        }
      } catch {
        // Non-critical
      }

      embeddingStats = {
        totalChunks: totalEmbeddings,
        contractsWithEmbeddings: withEmbeddings.length,
        totalContracts,
        coveragePercent: totalContracts > 0
          ? Math.round((withEmbeddings.length / totalContracts) * 100)
          : 0,
        modelDistribution,
      };
    } catch {
      embeddingStats = { error: 'Database unavailable' };
    }

    // ── Pipeline config ───────────────────────────────────────────────────
    const config = {
      embedModel: process.env.RAG_EMBED_MODEL || 'text-embedding-3-small',
      cragEnabled: process.env.RAG_CRAG_ENABLED !== 'false',
      graphEnabled: process.env.RAG_GRAPH_ENABLED !== 'false',
      parentDocEnabled: process.env.RAG_PARENT_DOC_ENABLED !== 'false',
      hnswEfSearch: 100,
      rrfK: 60,
      mmrLambda: 0.7,
    };

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      cache: cacheStats,
      graph: graphStats,
      embeddings: embeddingStats,
      config,
    });
  } catch (error) {
    console.error('[RAG Observability] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Internal error gathering RAG stats' },
      { status: 500 },
    );
  }
}
