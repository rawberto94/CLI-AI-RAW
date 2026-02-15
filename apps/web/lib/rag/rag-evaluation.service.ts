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
    model: openai('gpt-4o-mini'),
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

interface EvalSummary {
  totalQueries: number;
  avgRelevance: number;
  avgFaithfulness: number;
  avgUtilization: number;
  avgDiversity: number;
  avgLatencyMs: number;
  qualityDistribution: Record<string, number>;
  commonIssues: string[];
  overallGrade: string;
}

/**
 * Run evaluation on a batch of recent RAG queries.
 * Pulls from query logs or runs test queries against the system.
 */
export async function runBatchEvaluation(params: {
  tenantId: string;
  sampleSize?: number;
  testQueries?: string[];
}): Promise<EvalSummary> {
  const { tenantId, sampleSize = 10, testQueries: userQueries } = params;

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
  const results: Array<RAGEvalResult & { diversity: number; latencyMs: number }> = [];

  for (const query of queries) {
    try {
      const startTime = Date.now();
      const searchResult = await hybridSearch({
        query,
        tenantId,
        topK: 5,
      });
      const latencyMs = Date.now() - startTime;

      const chunks = (searchResult.results || []).map((r: any) => ({
        content: r.content || '',
        score: r.score,
        metadata: r.metadata,
      }));

      if (chunks.length === 0) {
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

      results.push({ ...evalResult, diversity, latencyMs });
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

  const summary: EvalSummary = {
    totalQueries: results.length,
    avgRelevance: Number(avgRelevance.toFixed(3)),
    avgFaithfulness: Number(avg(results.map(r => r.answerFaithfulness)).toFixed(3)),
    avgUtilization: Number(avg(results.map(r => r.contextUtilization)).toFixed(3)),
    avgDiversity: Number(avg(results.map(r => r.diversity)).toFixed(3)),
    avgLatencyMs: Math.round(avg(results.map(r => r.latencyMs))),
    qualityDistribution: qualityDist,
    commonIssues,
    overallGrade,
  };

  // Store evaluation results
  try {
    await prisma.contractMetadata.upsert({
      where: { contractId_tenantId: { contractId: 'system-rag-eval', tenantId } },
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
  }, '📊 RAG batch evaluation complete');

  return summary;
}
