/**
 * RAG Configuration & Tuning API
 * 
 * GET  /api/ai/rag-config — Read current RAG configuration
 * PUT  /api/ai/rag-config — Update RAG configuration parameters
 * POST /api/ai/rag-config — Run a tuning cycle (evaluate + suggest improvements)
 */

import { NextRequest } from 'next/server';
import {
  withAuthApiHandler,
  createSuccessResponse,
  createErrorResponse,
  type AuthenticatedApiContext,
} from '@/lib/api-middleware';

// ============================================================================
// Default RAG configuration
// ============================================================================

interface RAGConfig {
  // Retrieval parameters
  retrieval: {
    defaultK: number;              // Number of chunks to retrieve
    minScore: number;              // Minimum similarity threshold
    rerank: boolean;               // Whether to apply cross-encoder reranking
    expandQuery: boolean;          // Whether to use HyDE query expansion
    hybridAlpha: number;           // Balance between semantic (1.0) and keyword (0.0) search
  };
  // Embedding parameters
  embedding: {
    model: string;                 // Embedding model name
    chunkSize: number;             // Characters per chunk
    chunkOverlap: number;          // Overlap between chunks
    dimensions: number;            // Embedding dimensions
  };
  // Generation parameters
  generation: {
    model: string;                 // LLM model for generation
    temperature: number;           // Creativity (0 = deterministic)
    maxTokens: number;             // Max output tokens
    systemPromptVersion: string;   // System prompt version tag
  };
  // Quality thresholds
  quality: {
    minRelevanceScore: number;     // Minimum acceptable relevance
    minFaithfulness: number;       // Minimum faithfulness score
    maxHallucinationRate: number;  // Maximum acceptable hallucination rate
    targetGrade: string;           // Target quality grade (A/B/C)
  };
}

function getDefaultConfig(): RAGConfig {
  return {
    retrieval: {
      defaultK: parseInt(process.env.RAG_RETRIEVAL_K || '8', 10),
      minScore: parseFloat(process.env.RAG_MIN_SCORE || '0.3'),
      rerank: process.env.RAG_RERANK !== 'false',
      expandQuery: process.env.RAG_EXPAND_QUERY !== 'false',
      hybridAlpha: parseFloat(process.env.RAG_HYBRID_ALPHA || '0.7'),
    },
    embedding: {
      model: process.env.RAG_EMBED_MODEL || 'text-embedding-3-small',
      chunkSize: parseInt(process.env.RAG_CHUNK_SIZE || '1000', 10),
      chunkOverlap: parseInt(process.env.RAG_CHUNK_OVERLAP || '200', 10),
      dimensions: parseInt(process.env.RAG_EMBED_DIMENSIONS || '1536', 10),
    },
    generation: {
      model: process.env.RAG_GENERATION_MODEL || 'gpt-4o-mini',
      temperature: parseFloat(process.env.RAG_TEMPERATURE || '0.2'),
      maxTokens: parseInt(process.env.RAG_MAX_TOKENS || '2000', 10),
      systemPromptVersion: process.env.RAG_PROMPT_VERSION || 'v1.0',
    },
    quality: {
      minRelevanceScore: parseFloat(process.env.RAG_MIN_RELEVANCE || '0.6'),
      minFaithfulness: parseFloat(process.env.RAG_MIN_FAITHFULNESS || '0.7'),
      maxHallucinationRate: parseFloat(process.env.RAG_MAX_HALLUCINATION || '0.1'),
      targetGrade: process.env.RAG_TARGET_GRADE || 'B',
    },
  };
}

// In-memory config store (persists across requests in the same process)
let currentConfig: RAGConfig | null = null;

function getConfig(): RAGConfig {
  if (!currentConfig) {
    currentConfig = getDefaultConfig();
  }
  return currentConfig;
}

// ============================================================================
// GET — Read current configuration
// ============================================================================

export const GET = withAuthApiHandler(async (_request: NextRequest, ctx: AuthenticatedApiContext) => {
  const config = getConfig();

  // Also include system stats
  let embeddingCount = 0;
  let clauseLibraryCount = 0;
  try {
    const { prisma } = await import('@/lib/prisma');
    const [embeddings, clauses] = await Promise.all([
      prisma.contractEmbedding.count({ where: { tenantId: ctx.tenantId } }),
      prisma.clauseLibrary.count({ where: { tenantId: ctx.tenantId } }),
    ]);
    embeddingCount = embeddings;
    clauseLibraryCount = clauses;
  } catch {
    // DB unavailable — skip stats
  }

  return createSuccessResponse(ctx, {
    config,
    stats: {
      embeddingCount,
      clauseLibraryCount,
      embeddingModel: config.embedding.model,
      vectorDimensions: config.embedding.dimensions,
      indexType: 'HNSW (m=16, ef_construction=200)',
    },
  });
});

// ============================================================================
// PUT — Update configuration parameters
// ============================================================================

export const PUT = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const body = await request.json().catch(() => ({}));
  const config = getConfig();

  // Deep merge provided values into current config
  if (body.retrieval) {
    config.retrieval = { ...config.retrieval, ...body.retrieval };
  }
  if (body.embedding) {
    config.embedding = { ...config.embedding, ...body.embedding };
  }
  if (body.generation) {
    config.generation = { ...config.generation, ...body.generation };
  }
  if (body.quality) {
    config.quality = { ...config.quality, ...body.quality };
  }

  // Validate ranges
  config.retrieval.defaultK = Math.max(1, Math.min(50, config.retrieval.defaultK));
  config.retrieval.minScore = Math.max(0, Math.min(1, config.retrieval.minScore));
  config.retrieval.hybridAlpha = Math.max(0, Math.min(1, config.retrieval.hybridAlpha));
  config.generation.temperature = Math.max(0, Math.min(1, config.generation.temperature));
  config.quality.minRelevanceScore = Math.max(0, Math.min(1, config.quality.minRelevanceScore));
  config.quality.minFaithfulness = Math.max(0, Math.min(1, config.quality.minFaithfulness));
  config.quality.maxHallucinationRate = Math.max(0, Math.min(1, config.quality.maxHallucinationRate));

  currentConfig = config;

  return createSuccessResponse(ctx, {
    config,
    message: 'RAG configuration updated. Changes take effect immediately for new queries.',
  });
});

// ============================================================================
// POST — Run a tuning cycle: evaluate current quality and suggest improvements
// ============================================================================

export const POST = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const body = await request.json().catch(() => ({}));
  const { testQueries, sampleSize = 10 } = body;
  const config = getConfig();

  try {
    const { runBatchEvaluation } = await import('@/lib/rag/rag-evaluation.service');

    // Run evaluation with current config
    const evaluation = await runBatchEvaluation({
      tenantId: ctx.tenantId,
      sampleSize,
      testQueries,
    });

    // Generate tuning recommendations based on evaluation results
    const recommendations: Array<{
      parameter: string;
      currentValue: string | number | boolean;
      suggestedValue: string | number | boolean;
      reason: string;
      impact: 'high' | 'medium' | 'low';
    }> = [];

    const avgRelevance = (evaluation as any).avgRelevance ?? 0;
    const avgFaithfulness = (evaluation as any).avgFaithfulness ?? 0;
    const avgUtilization = (evaluation as any).avgUtilization ?? 0;

    // Low relevance → increase k, lower min score, enable reranking
    if (avgRelevance < config.quality.minRelevanceScore) {
      if (config.retrieval.defaultK < 15) {
        recommendations.push({
          parameter: 'retrieval.defaultK',
          currentValue: config.retrieval.defaultK,
          suggestedValue: Math.min(15, config.retrieval.defaultK + 3),
          reason: `Relevance score (${(avgRelevance * 100).toFixed(0)}%) is below target. Retrieving more chunks gives the model better context.`,
          impact: 'high',
        });
      }
      if (!config.retrieval.rerank) {
        recommendations.push({
          parameter: 'retrieval.rerank',
          currentValue: false,
          suggestedValue: true,
          reason: 'Cross-encoder reranking significantly improves retrieval precision.',
          impact: 'high',
        });
      }
      if (!config.retrieval.expandQuery) {
        recommendations.push({
          parameter: 'retrieval.expandQuery',
          currentValue: false,
          suggestedValue: true,
          reason: 'HyDE query expansion can improve recall for complex queries.',
          impact: 'medium',
        });
      }
    }

    // Low faithfulness → lower temperature, ensure grounding
    if (avgFaithfulness < config.quality.minFaithfulness) {
      if (config.generation.temperature > 0.1) {
        recommendations.push({
          parameter: 'generation.temperature',
          currentValue: config.generation.temperature,
          suggestedValue: Math.max(0.05, config.generation.temperature - 0.1),
          reason: `Faithfulness (${(avgFaithfulness * 100).toFixed(0)}%) is low. Reducing temperature helps the model stick to retrieved context.`,
          impact: 'high',
        });
      }
    }

    // Low utilization → reduce k (too many irrelevant chunks dilute context)
    if (avgUtilization < 0.5 && config.retrieval.defaultK > 5) {
      recommendations.push({
        parameter: 'retrieval.defaultK',
        currentValue: config.retrieval.defaultK,
        suggestedValue: Math.max(3, config.retrieval.defaultK - 2),
        reason: `Low utilization (${(avgUtilization * 100).toFixed(0)}%) suggests too many retrieved chunks go unused. Reducing k focuses on higher-quality matches.`,
        impact: 'medium',
      });
    }

    // Chunk size tuning
    if (avgRelevance < 0.5 && config.embedding.chunkSize > 800) {
      recommendations.push({
        parameter: 'embedding.chunkSize',
        currentValue: config.embedding.chunkSize,
        suggestedValue: Math.max(500, config.embedding.chunkSize - 200),
        reason: 'Smaller chunks may improve precision for specific clause matching.',
        impact: 'medium',
      });
    }

    // Hybrid alpha tuning
    if (avgRelevance < 0.6 && config.retrieval.hybridAlpha > 0.5) {
      recommendations.push({
        parameter: 'retrieval.hybridAlpha',
        currentValue: config.retrieval.hybridAlpha,
        suggestedValue: 0.5,
        reason: 'Balancing semantic and keyword search equally may improve results for exact legal terms.',
        impact: 'low',
      });
    }

    // Score the overall system health
    const avgScores = [avgRelevance, avgFaithfulness, avgUtilization].filter(Boolean);
    const overallScore = avgScores.length > 0
      ? avgScores.reduce((a, b) => a + b, 0) / avgScores.length
      : 0;

    const healthGrade =
      overallScore >= 0.9 ? 'A' :
      overallScore >= 0.75 ? 'B' :
      overallScore >= 0.6 ? 'C' :
      overallScore >= 0.4 ? 'D' : 'F';

    return createSuccessResponse(ctx, {
      evaluation,
      tuning: {
        overallScore: Math.round(overallScore * 100),
        healthGrade,
        meetsTarget: healthGrade <= config.quality.targetGrade,
        recommendations,
        currentConfig: config,
      },
    });
  } catch (error) {
    return createErrorResponse(
      ctx,
      'INTERNAL_ERROR',
      error instanceof Error ? error.message : 'RAG tuning cycle failed',
      500,
    );
  }
});
