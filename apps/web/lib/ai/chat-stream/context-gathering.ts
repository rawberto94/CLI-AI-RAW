/**
 * Context Gathering for AI Chat Stream — STEP 2
 * 
 * Parallel RAG search, episodic memory retrieval, contract profile injection,
 * and cross-conversation learning context.
 */

import { prisma } from '@/lib/prisma';
import { parallelMultiQueryRAG, type ParallelRAGResult } from '@/lib/rag/parallel-rag.service';
import { hybridSearch } from '@/lib/rag/advanced-rag.service';
import { retrieveRelevantMemories } from '@/lib/ai/episodic-memory-integration';
import { shouldUseRAG } from '@/lib/ai/chat/response-builder';
import { getLearningContext, formatLearningContextForPrompt } from '@repo/agents';
import { logger } from '@/lib/logger';

/** Timeout wrapper that falls back to default value on error or timeout. */
function withTimeout<T>(promise: Promise<T>, fallback: T, timeoutMs = 15_000): Promise<T> {
  return Promise.race([
    promise.catch((err) => {
      logger.warn('[Stream v2] RAG/memory call failed', { action: 'rag-memory', error: err instanceof Error ? err.message : String(err) });
      return fallback;
    }),
    new Promise<T>((resolve) => setTimeout(() => {
      logger.warn(`[Stream v2] RAG/memory call timed out after ${timeoutMs}ms`);
      resolve(fallback);
    }, timeoutMs)),
  ]);
}

const emptyRag: ParallelRAGResult = { results: [], queryVariations: [], timingsMs: { total: 0, hyde: 0, expansion: 0, search: 0, fusion: 0 } };

export interface GatheredContext {
  searchResults: Array<{ contractId: string; contractName: string; score: number; text: string; matchType?: string; sources?: string[]; metadata?: Record<string, unknown> }>;
  ragSources: string[];
  ragContext: string;
  memoryContext: string;
  contractProfileContext: string;
  learningContextStr: string;
  memories: Array<{ type: string; content: string }>;
  ragResults: typeof emptyRag;
}

/**
 * Gather all context in parallel: RAG, episodic memory, contract profile, learning context.
 */
export async function gatherContext(
  message: string,
  tenantId: string,
  userId: string,
  effectiveHistory: Array<{ role: string; content: string }>,
  contextContractId?: string,
): Promise<GatheredContext> {
  const [ragResults, contractScopedResults, memories] = await Promise.all([
    shouldUseRAG(message)
      ? withTimeout(parallelMultiQueryRAG(message, { tenantId, k: 7 }), emptyRag)
      : Promise.resolve(emptyRag),
    contextContractId && shouldUseRAG(message)
      ? withTimeout(hybridSearch(message, {
          mode: 'hybrid',
          k: 5,
          rerank: true,
          expandQuery: true,
          filters: { tenantId, contractIds: [contextContractId] },
        }).catch(() => []), [])
      : Promise.resolve([]),
    withTimeout(retrieveRelevantMemories(userId, tenantId, message, effectiveHistory, {
      maxMemories: 5,
      types: ['preference', 'fact', 'decision', 'insight'],
    }), []),
  ]);

  // ── Contract Profile + Artifact Intelligence ──
  let contractProfileContext = '';
  if (contextContractId) {
    contractProfileContext = await buildContractProfile(contextContractId, tenantId);
  }

  // ── Cross-conversation learning context ──
  let learningContextStr = '';
  try {
    const learningCtx = await withTimeout(getLearningContext(tenantId), {
      tenantId,
      correctionPatterns: [],
      historicalPatterns: [],
      qualityThresholds: {},
      builtAt: new Date(),
    } as any);
    learningContextStr = formatLearningContextForPrompt(learningCtx);
  } catch {
    // Learning context unavailable
  }

  const searchResults = ragResults.results || [];
  const ragSources = searchResults.map(r => r.contractName);

  let ragContext = '';
  if (contractScopedResults.length > 0) {
    ragContext += `\n\n**Contract-Specific Information (${contractScopedResults.length} matches):**\n${contractScopedResults
      .map((r, i) => {
        const label = r.metadata?.heading || r.metadata?.section || `Section ${i + 1}`;
        return `[${i + 1}] **${label}** (${Math.round((r.score || 0) * 100)}% match):\n> ${r.text.slice(0, 500)}...`;
      })
      .join('\n\n')}`;
  }
  if (searchResults.length > 0) {
    ragContext += `\n\n**Relevant Contract Information (${searchResults.length} matches):**\n${searchResults
      .map((r, i) => `[${i + 1}] **[${r.contractName}](/contracts/${r.contractId})** (${Math.round(r.score * 100)}% match):\n> ${r.text.slice(0, 400)}...`)
      .join('\n\n')}`;
  }

  let memoryContext = '';
  if (memories.length > 0) {
    memoryContext = `\n\n**Past Interactions:**\n${memories.map(m => `- [${m.type}] ${m.content.slice(0, 200)}`).join('\n')}`;
  }

  return {
    searchResults,
    ragSources,
    ragContext,
    memoryContext,
    contractProfileContext,
    learningContextStr,
    memories,
    ragResults,
  };
}

/** Build a rich contract profile string for system prompt injection. */
async function buildContractProfile(contractId: string, tenantId: string): Promise<string> {
  let context = '';
  try {
    const [contractProfile, contractArtifacts, contractClauses, contractObligations] = await Promise.all([
      prisma.contract.findFirst({
        where: { id: contractId, tenantId },
        select: {
          id: true, contractTitle: true, contractType: true, status: true,
          supplierName: true, clientName: true, totalValue: true, currency: true,
          effectiveDate: true, expirationDate: true, jurisdiction: true,
          paymentTerms: true, terminationClause: true, renewalTerms: true,
          noticePeriodDays: true, autoRenewalEnabled: true, expirationRisk: true,
          daysUntilExpiry: true, riskFlags: true, category: true,
          signatureStatus: true, documentClassification: true,
          description: true, categoryL1: true, categoryL2: true,
        },
      }),
      prisma.contractArtifact.findMany({
        where: { contractId },
        select: { type: true, key: true, value: true, confidence: true },
        orderBy: { confidence: 'desc' },
        take: 30,
      }),
      prisma.clause.findMany({
        where: { contractId },
        select: { category: true, text: true, riskLevel: true },
        orderBy: { position: 'asc' },
        take: 20,
      }),
      prisma.obligation.findMany({
        where: { contractId, tenantId },
        select: { title: true, type: true, status: true, priority: true, dueDate: true, owner: true },
        orderBy: { dueDate: 'asc' },
        take: 10,
      }).catch(() => []),
    ]);

    if (contractProfile) {
      const cp = contractProfile;
      context += `\n\n**📋 Active Contract Profile — ${cp.contractTitle || 'Untitled'}:**\n`;
      context += `| Field | Value |\n|-------|-------|\n`;
      if (cp.supplierName) context += `| Supplier | ${cp.supplierName} |\n`;
      if (cp.clientName) context += `| Client | ${cp.clientName} |\n`;
      if (cp.contractType) context += `| Type | ${cp.contractType} |\n`;
      if (cp.status) context += `| Status | ${cp.status} |\n`;
      if (cp.totalValue) context += `| Value | ${cp.currency || 'USD'} ${Number(cp.totalValue).toLocaleString()} |\n`;
      if (cp.effectiveDate) context += `| Effective | ${new Date(cp.effectiveDate).toLocaleDateString()} |\n`;
      if (cp.expirationDate) context += `| Expires | ${new Date(cp.expirationDate).toLocaleDateString()} |\n`;
      if (cp.daysUntilExpiry != null) context += `| Days Until Expiry | ${cp.daysUntilExpiry} |\n`;
      if (cp.jurisdiction) context += `| Jurisdiction | ${cp.jurisdiction} |\n`;
      if (cp.paymentTerms) context += `| Payment Terms | ${cp.paymentTerms} |\n`;
      if (cp.terminationClause) context += `| Termination | ${cp.terminationClause} |\n`;
      if (cp.renewalTerms) context += `| Renewal Terms | ${cp.renewalTerms} |\n`;
      if (cp.noticePeriodDays) context += `| Notice Period | ${cp.noticePeriodDays} days |\n`;
      if (cp.autoRenewalEnabled) context += `| Auto-Renewal | Yes |\n`;
      if (cp.expirationRisk) context += `| Expiration Risk | ${cp.expirationRisk} |\n`;
      if (cp.signatureStatus) context += `| Signature | ${cp.signatureStatus} |\n`;
      if (cp.riskFlags && typeof cp.riskFlags === 'object' && Array.isArray(cp.riskFlags) && (cp.riskFlags as string[]).length > 0) {
        context += `| Risk Flags | ${(cp.riskFlags as string[]).join(', ')} |\n`;
      }
      if (cp.categoryL1) context += `| Category | ${cp.categoryL1}${cp.categoryL2 ? ' > ' + cp.categoryL2 : ''} |\n`;
    }

    if (contractArtifacts.length > 0) {
      const byType = new Map<string, Array<{ key: string; value: unknown; confidence: number }>>();
      for (const a of contractArtifacts) {
        if (!byType.has(a.type)) byType.set(a.type, []);
        byType.get(a.type)!.push({ key: a.key, value: a.value, confidence: a.confidence });
      }
      context += `\n**🔍 Extracted Artifacts (${contractArtifacts.length} items):**\n`;
      for (const [type, items] of byType) {
        context += `- **${type}** (${items.length}): ${items.slice(0, 3).map(i => {
          const val = typeof i.value === 'string' ? i.value.slice(0, 100) : JSON.stringify(i.value).slice(0, 100);
          return `${i.key}: ${val} (${Math.round(i.confidence * 100)}%)`;
        }).join('; ')}${items.length > 3 ? ` + ${items.length - 3} more` : ''}\n`;
      }
    }

    if (contractClauses.length > 0) {
      context += `\n**⚖️ Extracted Clauses (${contractClauses.length}):**\n`;
      for (const c of contractClauses.slice(0, 10)) {
        const riskBadge = c.riskLevel === 'high' ? '🔴' : c.riskLevel === 'medium' ? '🟡' : '🟢';
        context += `- ${riskBadge} **${c.category}**: ${c.text.slice(0, 150)}${c.text.length > 150 ? '...' : ''}\n`;
      }
      if (contractClauses.length > 10) {
        context += `  _(${contractClauses.length - 10} more clauses available via extract_clauses tool)_\n`;
      }
    }

    if (contractObligations.length > 0) {
      context += `\n**📅 Obligations (${contractObligations.length}):**\n`;
      for (const o of contractObligations.slice(0, 5)) {
        const priorityIcon = o.priority === 'CRITICAL' ? '🔴' : o.priority === 'HIGH' ? '🟠' : o.priority === 'MEDIUM' ? '🟡' : '🟢';
        const dueDateStr = o.dueDate ? new Date(o.dueDate).toLocaleDateString() : 'No due date';
        context += `- ${priorityIcon} **${o.title}** [${o.status}] — ${o.type}, ${o.owner}, Due: ${dueDateStr}\n`;
      }
    }
  } catch (err) {
    logger.warn('[Stream v2] Contract profile injection failed', { action: 'contract-profile', error: err instanceof Error ? err.message : String(err) });
  }
  return context;
}
