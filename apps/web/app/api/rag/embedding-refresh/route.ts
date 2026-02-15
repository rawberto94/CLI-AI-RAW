/**
 * Admin endpoint: Trigger embedding refresh scan
 *
 * POST /api/rag/embedding-refresh
 *   Triggers an immediate scan for stale embeddings and queues re-indexing.
 *
 * GET /api/rag/embedding-refresh
 *   Returns the current embedding model and a summary of stale counts.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const currentModel = process.env.RAG_EMBED_MODEL || 'text-embedding-3-small';

    const [total, current, stale, textOnly, noEmbedding] = await Promise.all([
      prisma.contractMetadata.count(),
      prisma.contractMetadata.count({ where: { embeddingVersion: currentModel } }),
      prisma.contractMetadata.count({
        where: {
          embeddingVersion: { not: currentModel, notIn: ['text-only'] },
          embeddingCount: { gt: 0 },
        },
      }),
      prisma.contractMetadata.count({ where: { embeddingVersion: 'text-only' } }),
      prisma.contractMetadata.count({ where: { embeddingVersion: null } }),
    ]);

    return NextResponse.json({
      currentModel,
      counts: {
        total,
        current,
        staleModel: stale,
        textOnly,
        noEmbedding,
      },
      refreshEnabled: process.env.EMBEDDING_REFRESH_ENABLED !== 'false',
      refreshCron: process.env.EMBEDDING_REFRESH_CRON || '0 3 * * *',
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch embedding status' },
      { status: 500 },
    );
  }
}

export async function POST() {
  try {
    // Dynamic import to avoid bundling worker code in the web app
    const { triggerEmbeddingRefresh } = await import(
      /* webpackIgnore: true */
      '@repo/workers/embedding-refresh-scheduler'
    );

    const result = await triggerEmbeddingRefresh();

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    // If the worker module isn't available (e.g. web-only deploy), queue the
    // job via BullMQ directly as a fallback.
    try {
      const { getQueueService } = await import('@repo/utils/queue/queue-service');
      const qs = getQueueService();
      await qs.addJob('embedding-refresh', 'refresh-embeddings', {}, {
        jobId: 'embedding-refresh-manual',
        priority: 10,
      });
      return NextResponse.json({
        success: true,
        message: 'Embedding refresh job queued (worker will process)',
      });
    } catch {
      return NextResponse.json(
        { error: error.message || 'Failed to trigger embedding refresh' },
        { status: 500 },
      );
    }
  }
}
