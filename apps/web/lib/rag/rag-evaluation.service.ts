/**
 * RAG Evaluation Pipeline
 * 
 * Automated quality measurement for the RAG retrieval system.
 * Tracks key metrics without requiring human-labeled ground truth:
 * 
 * 1. Retrieval Relevance — Are retrieved chunks relevant to the query?
 * 2. Answer Faithfulness — Is the answer grounded in retrieved context?
 * 3. Context Utilization — How much of the retrieved context is used?
 * 4. Chunk Diversity — Are results diverse or repetitive?
 * 5. Latency Tracking — End-to-end retrieval performance
 * 
 * Evaluation runs automatically on a sample of queries and stores
 * results for dashboard visualization and model improvement.
 */

import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { hybridSearch } from '@/lib/rag/advanced-rag.service';
import { GOLDEN_EVAL_SET, scoreChunkAgainstGolden, type GoldenEvalEntry } from './golden-eval-set';
import pino from 'pino';

const logger = pino({ name: 'rag-eval' });

// ============================================================================
// SCHEMAS
// ============================================================================

const ChunkRelevanceSchema = z.object({
  chunkIndex: z.number(),
  relevanceScore: z.number().min(0).max(1),
  isRelevant: z.boolean(),
  reason: z.string(),
});

const EvalResultSchema = z.object({
  queryRelevance: z.number().min(0).max(1).describe('How relevant are the retrieved chunks to the query overall'),
  answerFaithfulness: z.number().min(0).max(1).describe('How well grounded the answer is in retrieved context'),
  contextUtilization: z.number().min(0).max(1).describe('What fraction of retrieved chunks contributed to the answer'),
  chunkBreakdown: z.array(ChunkRelevanceSchema),
  missingInformation: z.array(z.string()).describe('Information the query asked for that was NOT found in retrieved chunks'),
  hallucinations: z.array(z.string()).describe('Statements in the answer NOT supported by retrieved chunks'),
  overallQuality: z.enum(['excellent', 'good', 'acceptable', 'poor', 'failed']),
  suggestions: z.array(z.string()).describe('Specific improvements for the RAG pipeline'),
});

export type RAGEvalResult = z.infer<typeof EvalResultSchema>;

// ============================================================================
// EVALUATION FUNCTIONS
// ============================================================================

/**
 * Evaluate a single RAG query-response pair.
 */
export async function evaluateRAGResponse(params: {
  query: string;
  answer: string;
  retrievedChunks: Array<{ content: string; score?: number; metadata?: Record<string, unknown> }>;
  tenantId: string;
  latencyMs: number;
}): Promise<RAGEvalResult> {
  const { query, answer, retrievedChunks, latencyMs } = params;

  const chunksContext = retrievedChunks
    .map((c, i) => `[Chunk ${i}] (score: ${c.score?.toFixed(3) || 'N/A'})\n${c.content.slice(0, 500)}`)
    .join('\n\n');

  const { object: evalResult } = await generateObject({
    model: openai('gpt-4o-mini') as any,
    schema: EvalResultSchema,
    system: `You are a RAG system quality evaluator. Assess retrieval and answer quality objectively.

Scoring guide:
- queryRelevance: 1.0 = all chunks directly answer the query, 0.0 = completely irrelevant
- answerFaithfulness: 1.0 = every claim in the answer is supported by chunks, 0.0 = entire answer is hallucinated
- contextUtilization: 1.0 = every chunk contributed to the answer, 0.0 = no chunks were used

Be strict about hallucinations: if the answer makes any claim not supported by the chunks, flag it.`,
    prompt: `Evaluate this RAG interaction:

QUERY: "${query}"

RETRIEVED CHUNKS (${retrievedChunks.length} total):
${chunksContext}

GENERATED ANSWER:
${answer}

Retrieval latency: ${latencyMs}ms

Evaluate relevance, faithfulness, utilization, and identify any hallucinations or missing information.`,
    temperature: 0.05,
  });

  return evalResult;
}

// ============================================================================
// RETRIEVAL METRICS (Recall@K, NDCG@K, MAP, MRR)
// ============================================================================

/**
 * Calculate Recall@K — proportion of relevant documents found in top-K results.
 * @param retrievedIds - Ordered list of retrieved document identifiers
 * @param relevantIds - Set of ground-truth relevant document identifiers
 * @param k - Cutoff rank
 */
export function calculateRecallAtK(
  retrievedIds: string[],
  relevantIds: Set<string>,
  k: number,
): number {
  if (relevantIds.size === 0) return 1.0; // vacuous case
  const topK = retrievedIds.slice(0, k);
  const hits = topK.filter(id => relevantIds.has(id)).length;
  return hits / relevantIds.size;
}

/**
 * Calculate Precision@K — proportion of top-K results that are relevant.
 */
export function calculatePrecisionAtK(
  retrievedIds: string[],
  relevantIds: Set<string>,
  k: number,
): number {
  const topK = retrievedIds.slice(0, k);
  if (topK.length === 0) return 0;
  const hits = topK.filter(id => relevantIds.has(id)).length;
  return hits / topK.length;
}

/**
 * Calculate NDCG@K — Normalized Discounted Cumulative Gain.
 * Uses graded relevance scores (0-1) when available, binary (0/1) otherwise.
 * @param retrievedIds - Ordered list of retrieved document identifiers
 * @param relevanceMap - Map from document id → relevance score (0-1)
 * @param k - Cutoff rank
 */
export function calculateNDCGAtK(
  retrievedIds: string[],
  relevanceMap: Map<string, number>,
  k: number,
): number {
  const topK = retrievedIds.slice(0, k);

  // DCG: sum of (2^rel - 1) / log2(rank + 1) for each position
  let dcg = 0;
  for (let i = 0; i < topK.length; i++) {
    const rel = relevanceMap.get(topK[i]!) ?? 0;
    dcg += (Math.pow(2, rel) - 1) / Math.log2(i + 2); // rank is 1-indexed
  }

  // Ideal DCG: sort relevance scores descending and compute same formula
  const idealRels = [...relevanceMap.values()].sort((a, b) => b - a).slice(0, k);
  let idcg = 0;
  for (let i = 0; i < idealRels.length; i++) {
    idcg += (Math.pow(2, idealRels[i]!) - 1) / Math.log2(i + 2);
  }

  return idcg === 0 ? 0 : dcg / idcg;
}

/**
 * Calculate Mean Average Precision (MAP) for a single query.
 * Computes average of Precision@K at each rank where a relevant doc appears.
 */
export function calculateAveragePrecision(
  retrievedIds: string[],
  relevantIds: Set<string>,
): number {
  if (relevantIds.size === 0) return 1.0;
  let hits = 0;
  let sumPrecision = 0;

  for (let i = 0; i < retrievedIds.length; i++) {
    if (relevantIds.has(retrievedIds[i]!)) {
      hits++;
      sumPrecision += hits / (i + 1); // Precision@(i+1)
    }
  }

  return hits === 0 ? 0 : sumPrecision / relevantIds.size;
}

/**
 * Calculate Mean Reciprocal Rank (MRR) — 1/rank of first relevant result.
 */
export function calculateMRR(
  retrievedIds: string[],
  relevantIds: Set<string>,
): number {
  for (let i = 0; i < retrievedIds.length; i++) {
    if (relevantIds.has(retrievedIds[i]!)) {
      return 1 / (i + 1);
    }
  }
  return 0;
}

/**
 * Derive retrieval metrics from LLM-judged chunk relevance scores.
 * Uses per-chunk relevance from the evaluation as graded ground truth.
 */
export function computeRetrievalMetrics(
  chunkBreakdown: Array<{ chunkIndex: number; relevanceScore: number; isRelevant: boolean }>,
): {
  recallAt3: number;
  recallAt5: number;
  recallAt10: number;
  ndcgAt5: number;
  ndcgAt10: number;
  map: number;
  mrr: number;
  precisionAt5: number;
} {
  // Build IDs and relevance maps from the chunk breakdown
  const retrievedIds = chunkBreakdown.map((_, i) => `chunk_${i}`);
  const relevantIds = new Set(
    chunkBreakdown
      .filter(c => c.isRelevant)
      .map((_, i) => `chunk_${chunkBreakdown.findIndex(c2 => c2 === chunkBreakdown.filter(c3 => c3.isRelevant)[i]!)}`)
  );
  // Simpler: map index to ID consistently
  const relevant = new Set(
    chunkBreakdown
      .map((c, i) => ({ id: `chunk_${i}`, rel: c.isRelevant }))
      .filter(c => c.rel)
      .map(c => c.id)
  );
  const relevanceMap = new Map(
    chunkBreakdown.map((c, i) => [`chunk_${i}`, c.relevanceScore])
  );

  return {
    recallAt3: calculateRecallAtK(retrievedIds, relevant, 3),
    recallAt5: calculateRecallAtK(retrievedIds, relevant, 5),
    recallAt10: calculateRecallAtK(retrievedIds, relevant, 10),
    ndcgAt5: calculateNDCGAtK(retrievedIds, relevanceMap, 5),
    ndcgAt10: calculateNDCGAtK(retrievedIds, relevanceMap, 10),
    map: calculateAveragePrecision(retrievedIds, relevant),
    mrr: calculateMRR(retrievedIds, relevant),
    precisionAt5: calculatePrecisionAtK(retrievedIds, relevant, 5),
  };
}

// ============================================================================
// CHUNK DIVERSITY
// ============================================================================

/**
 * Calculate chunk diversity score using pairwise Jaccard distance.
 */
export function calculateChunkDiversity(chunks: Array<{ content: string }>): number {
  if (chunks.length <= 1) return 1.0;

  const tokenize = (text: string) => new Set(text.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  
  let totalDistance = 0;
  let pairs = 0;

  for (let i = 0; i < chunks.length; i++) {
    for (let j = i + 1; j < chunks.length; j++) {
      const set1 = tokenize(chunks[i].content);
      const set2 = tokenize(chunks[j].content);
      const intersection = [...set1].filter(w => set2.has(w)).length;
      const union = new Set([...set1, ...set2]).size;
      const distance = union > 0 ? 1 - (intersection / union) : 1;
      totalDistance += distance;
      pairs++;
    }
  }

  return pairs > 0 ? totalDistance / pairs : 1.0;
}

// ============================================================================
// BATCH EVALUATION (for periodic quality checks)
// ============================================================================

interface RetrievalMetricsSummary {
  avgRecallAt3: number;
  avgRecallAt5: number;
  avgRecallAt10: number;
  avgNDCGAt5: number;
  avgNDCGAt10: number;
  avgMAP: number;
  avgMRR: number;
  avgPrecisionAt5: number;
}

interface EvalSummary {
  totalQueries: number;
  avgRelevance: number;
  avgFaithfulness: number;
  avgUtilization: number;
  avgDiversity: number;
  avgLatencyMs: number;
  retrievalMetrics: RetrievalMetricsSummary;
  qualityDistribution: Record<string, number>;
  commonIssues: string[];
  overallGrade: string;
}

/**
 * Run evaluation on a batch of RAG queries.
 * Supports three modes:
 *   1. Default test queries (quick sanity check)
 *   2. Custom test queries from caller
 *   3. Golden evaluation set with keyword-based ground truth (most rigorous)
 */
export async function runBatchEvaluation(params: {
  tenantId: string;
  sampleSize?: number;
  testQueries?: string[];
  /** If true, use the golden evaluation test set with keyword matching for ground-truth metrics */
  useGoldenSet?: boolean;
  /** Filter golden set by difficulty */
  goldenDifficulties?: ('easy' | 'medium' | 'hard')[];
}): Promise<EvalSummary> {
  const { tenantId, sampleSize = 10, testQueries: userQueries, useGoldenSet = false, goldenDifficulties } = params;

  // Default test queries covering different query types
  const defaultQueries = [
    'What are the payment terms?',
    'When does this contract expire?',
    'What are the termination conditions?',
    'List all obligations and deadlines',
    'What is the liability cap?',
    'Are there any auto-renewal clauses?',
    'What are the confidentiality requirements?',
    'What is the governing law?',
    'What insurance requirements exist?',
    'What are the SLA requirements?',
  ];

  const queries = (userQueries || defaultQueries).slice(0, sampleSize);

  // Build golden entries lookup when using golden set
  let goldenEntries: GoldenEvalEntry[] = [];
  let goldenByQuery: Map<string, GoldenEvalEntry> = new Map();
  if (useGoldenSet && !userQueries) {
    goldenEntries = GOLDEN_EVAL_SET.filter(e =>
      !goldenDifficulties?.length || goldenDifficulties.includes(e.difficulty)
    ).slice(0, sampleSize);
    goldenByQuery = new Map(goldenEntries.map(e => [e.query, e]));
  }

  const effectiveQueries = useGoldenSet && goldenEntries.length > 0
    ? goldenEntries.map(e => e.query)
    : queries;

  const results: Array<RAGEvalResult & { diversity: number; latencyMs: number; retrieval: ReturnType<typeof computeRetrievalMetrics> }> = [];

  for (const query of effectiveQueries) {
    try {
      const startTime = Date.now();
      const searchResults = await hybridSearch(query, {
        k: 5,
        filters: { tenantId },
      });
      const latencyMs = Date.now() - startTime;

      const chunks = searchResults.map((r) => ({
        content: r.text || '',
        score: r.score,
        metadata: r.metadata as unknown as Record<string, unknown>,
      }));

      if (chunks.length === 0) {
        const emptyRetrieval = computeRetrievalMetrics([]);
        results.push({
          queryRelevance: 0,
          answerFaithfulness: 0,
          contextUtilization: 0,
          chunkBreakdown: [],
          missingInformation: ['No chunks retrieved'],
          hallucinations: [],
          overallQuality: 'failed',
          suggestions: ['No embeddings found — check RAG indexing'],
          diversity: 0,
          latencyMs,
          retrieval: emptyRetrieval,
        });
        continue;
      }

      const diversity = calculateChunkDiversity(chunks);

      // Create a simulated answer from chunks for evaluation
      const simulatedAnswer = chunks.slice(0, 3).map((c: any) => c.content).join(' ').slice(0, 1000);

      const evalResult = await evaluateRAGResponse({
        query,
        answer: simulatedAnswer,
        retrievedChunks: chunks,
        tenantId,
        latencyMs,
      });

      // Compute retrieval metrics from per-chunk LLM relevance grades
      // When golden set is available, enhance with keyword-based ground truth
      const goldenEntry = goldenByQuery.get(query);
      let retrieval: ReturnType<typeof computeRetrievalMetrics>;

      if (goldenEntry) {
        // Use keyword matching as ground truth — more reliable than LLM self-judging
        const chunkIds = chunks.map((_: any, i: number) => `chunk_${i}`);
        const relevantIds = new Set<string>();
        const relevanceMap = new Map<string, number>();

        chunks.forEach((c: any, i: number) => {
          const kwScore = scoreChunkAgainstGolden(c.content, goldenEntry);
          relevanceMap.set(`chunk_${i}`, kwScore);
          if (kwScore >= 0.3) { // At least 30% keyword overlap = relevant
            relevantIds.add(`chunk_${i}`);
          }
        });

        retrieval = {
          recallAt3: calculateRecallAtK(chunkIds, relevantIds, 3),
          recallAt5: calculateRecallAtK(chunkIds, relevantIds, 5),
          recallAt10: calculateRecallAtK(chunkIds, relevantIds, 10),
          ndcgAt5: calculateNDCGAtK(chunkIds, relevanceMap, 5),
          ndcgAt10: calculateNDCGAtK(chunkIds, relevanceMap, 10),
          map: calculateAveragePrecision(chunkIds, relevantIds),
          mrr: calculateMRR(chunkIds, relevantIds),
          precisionAt5: calculatePrecisionAtK(chunkIds, relevantIds, 5),
        };
      } else {
        retrieval = computeRetrievalMetrics(evalResult.chunkBreakdown);
      }

      results.push({ ...evalResult, diversity, latencyMs, retrieval });
    } catch (error) {
      logger.warn({ query, error: (error as Error).message }, 'Eval query failed');
    }
  }

  if (results.length === 0) {
    return {
      totalQueries: 0,
      avgRelevance: 0,
      avgFaithfulness: 0,
      avgUtilization: 0,
      avgDiversity: 0,
      avgLatencyMs: 0,
      retrievalMetrics: {
        avgRecallAt3: 0, avgRecallAt5: 0, avgRecallAt10: 0,
        avgNDCGAt5: 0, avgNDCGAt10: 0, avgMAP: 0, avgMRR: 0, avgPrecisionAt5: 0,
      },
      qualityDistribution: {},
      commonIssues: ['No evaluation results'],
      overallGrade: 'F',
    };
  }

  // Aggregate results
  const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
  
  const qualityDist: Record<string, number> = {};
  const allIssues: string[] = [];

  for (const r of results) {
    qualityDist[r.overallQuality] = (qualityDist[r.overallQuality] || 0) + 1;
    allIssues.push(...r.missingInformation, ...r.suggestions);
  }

  // Deduplicate and count issues
  const issueCount = new Map<string, number>();
  for (const issue of allIssues) {
    const normalized = issue.toLowerCase().trim();
    issueCount.set(normalized, (issueCount.get(normalized) || 0) + 1);
  }
  const commonIssues = [...issueCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([issue, count]) => `${issue} (${count}x)`);

  const avgRelevance = avg(results.map(r => r.queryRelevance));
  const overallGrade = avgRelevance >= 0.9 ? 'A' :
    avgRelevance >= 0.75 ? 'B' :
    avgRelevance >= 0.6 ? 'C' :
    avgRelevance >= 0.4 ? 'D' : 'F';

  // Aggregate retrieval metrics across all evaluated queries
  const retrievalMetrics: RetrievalMetricsSummary = {
    avgRecallAt3: Number(avg(results.map(r => r.retrieval.recallAt3)).toFixed(3)),
    avgRecallAt5: Number(avg(results.map(r => r.retrieval.recallAt5)).toFixed(3)),
    avgRecallAt10: Number(avg(results.map(r => r.retrieval.recallAt10)).toFixed(3)),
    avgNDCGAt5: Number(avg(results.map(r => r.retrieval.ndcgAt5)).toFixed(3)),
    avgNDCGAt10: Number(avg(results.map(r => r.retrieval.ndcgAt10)).toFixed(3)),
    avgMAP: Number(avg(results.map(r => r.retrieval.map)).toFixed(3)),
    avgMRR: Number(avg(results.map(r => r.retrieval.mrr)).toFixed(3)),
    avgPrecisionAt5: Number(avg(results.map(r => r.retrieval.precisionAt5)).toFixed(3)),
  };

  const summary: EvalSummary = {
    totalQueries: results.length,
    avgRelevance: Number(avgRelevance.toFixed(3)),
    avgFaithfulness: Number(avg(results.map(r => r.answerFaithfulness)).toFixed(3)),
    avgUtilization: Number(avg(results.map(r => r.contextUtilization)).toFixed(3)),
    avgDiversity: Number(avg(results.map(r => r.diversity)).toFixed(3)),
    avgLatencyMs: Math.round(avg(results.map(r => r.latencyMs))),
    retrievalMetrics,
    qualityDistribution: qualityDist,
    commonIssues,
    overallGrade,
  };

  // Store evaluation results
  try {
    await prisma.contractMetadata.upsert({
      where: { contractId: 'system-rag-eval' },
      update: {
        systemFields: {
          lastEvaluation: summary,
          evaluatedAt: new Date().toISOString(),
        } as any,
      },
      create: {
        contractId: 'system-rag-eval',
        tenantId,
        updatedBy: 'system',
        systemFields: {
          lastEvaluation: summary,
          evaluatedAt: new Date().toISOString(),
        } as any,
      },
    });
  } catch {
    // Non-critical
  }

  logger.info({
    tenantId,
    totalQueries: summary.totalQueries,
    avgRelevance: summary.avgRelevance,
    avgFaithfulness: summary.avgFaithfulness,
    grade: summary.overallGrade,
    latency: summary.avgLatencyMs,
    recallAt5: summary.retrievalMetrics.avgRecallAt5,
    ndcgAt10: summary.retrievalMetrics.avgNDCGAt10,
    map: summary.retrievalMetrics.avgMAP,
    mrr: summary.retrievalMetrics.avgMRR,
  }, '📊 RAG batch evaluation complete');

  return summary;
}
