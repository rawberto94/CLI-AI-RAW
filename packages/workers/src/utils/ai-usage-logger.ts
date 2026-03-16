/**
 * AI Usage Logger for Workers
 *
 * Persists token usage to the ai_usage_logs table so the dashboard
 * and cost-alert service can track worker-side AI consumption
 * (OCR, artifact generation, RAG indexing, classification, etc.).
 */

import { estimateTokenCost } from './artifact-prompts';

interface AIUsageEntry {
  model: string;
  endpoint: string;   // e.g. 'openai', 'mistral', 'cohere'
  feature: string;    // e.g. 'ocr-enhancement', 'artifact-generation', 'rag-indexing'
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  success: boolean;
  errorType?: string;
  tenantId?: string;
  contractId?: string;
  metadata?: Record<string, unknown>;
}

let _prisma: any = null;

function getPrisma(): any {
  if (_prisma) return _prisma;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const clientsDb = require('clients-db');
    const getClient = typeof clientsDb === 'function' ? clientsDb : clientsDb.default;
    _prisma = getClient();
    return _prisma;
  } catch {
    return null;
  }
}

/**
 * Log an AI usage event to the database.
 * Fire-and-forget — errors are caught and logged, never thrown.
 */
export async function logAIUsage(entry: AIUsageEntry): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) return;

  const cost = estimateTokenCost(
    entry.model,
    entry.inputTokens,
    entry.outputTokens
  );

  try {
    await prisma.aIUsageLog.create({
      data: {
        model: entry.model,
        endpoint: entry.endpoint,
        feature: entry.feature,
        inputTokens: entry.inputTokens,
        outputTokens: entry.outputTokens,
        totalTokens: entry.inputTokens + entry.outputTokens,
        latencyMs: entry.latencyMs,
        cost,
        success: entry.success,
        errorType: entry.errorType || null,
        tenantId: entry.tenantId || null,
        contractId: entry.contractId || null,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
        createdAt: new Date(),
      },
    });
  } catch (err) {
    // Never let usage logging break the main pipeline
    console.error('[AIUsageLogger] Failed to persist usage:', (err as Error).message);
  }
}

/**
 * Batch-log multiple AI usage events in a single transaction.
 */
export async function logAIUsageBatch(entries: AIUsageEntry[]): Promise<void> {
  if (entries.length === 0) return;
  const prisma = getPrisma();
  if (!prisma) return;

  try {
    await prisma.aIUsageLog.createMany({
      data: entries.map((entry) => {
        const cost = estimateTokenCost(entry.model, entry.inputTokens, entry.outputTokens);
        return {
          model: entry.model,
          endpoint: entry.endpoint,
          feature: entry.feature,
          inputTokens: entry.inputTokens,
          outputTokens: entry.outputTokens,
          totalTokens: entry.inputTokens + entry.outputTokens,
          latencyMs: entry.latencyMs,
          cost,
          success: entry.success,
          errorType: entry.errorType || null,
          tenantId: entry.tenantId || null,
          contractId: entry.contractId || null,
          metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
          createdAt: new Date(),
        };
      }),
    });
  } catch (err) {
    console.error('[AIUsageLogger] Failed to persist batch usage:', (err as Error).message);
  }
}

/**
 * Get total cost for a tenant today from the DB.
 * Used for cross-worker budget enforcement.
 */
export async function getTenantDailyCost(tenantId: string): Promise<number> {
  const prisma = getPrisma();
  if (!prisma) return 0;

  try {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const result = await prisma.aIUsageLog.aggregate({
      where: {
        tenantId,
        createdAt: { gte: todayStart },
      },
      _sum: { cost: true },
    });
    return result._sum.cost || 0;
  } catch {
    return 0;
  }
}
