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
  const useScopedContractRag = Boolean(contextContractId) && shouldUseRAG(message);
  const scopedContractId = useScopedContractRag ? contextContractId : undefined;
  const [ragResults, initialContractScopedResults, memories] = await Promise.all([
    shouldUseRAG(message) && !useScopedContractRag
      ? withTimeout(parallelMultiQueryRAG(message, { tenantId, k: 7 }), emptyRag)
      : Promise.resolve(emptyRag),
    scopedContractId
      ? withTimeout(hybridSearch(message, {
          mode: 'hybrid',
          k: 5,
          rerank: true,
          expandQuery: true,
          filters: { tenantId, contractIds: [scopedContractId] },
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

  const contractScopedResults = useScopedContractRag && initialContractScopedResults.length === 0 && contextContractId
    ? await buildScopedFallbackResults(message, contextContractId, tenantId)
    : initialContractScopedResults;

  const scopedSearchResults = contractScopedResults.map((result) => ({
    ...result,
    sources: ['active-contract'],
  }));

  const searchResults = useScopedContractRag
    ? scopedSearchResults
    : (ragResults.results || []);
  const ragSources = [...new Set(searchResults.map(r => r.contractName))];

  let ragContext = '';
  if (useScopedContractRag && scopedSearchResults.length > 0) {
    ragContext += `\n\n**Contract-Specific Information (${scopedSearchResults.length} matches):**\n${scopedSearchResults
      .map((r, i) => {
        const label = r.metadata?.heading || r.metadata?.section || `Section ${i + 1}`;
        return `[${i + 1}] **${label}** (${Math.round((r.score || 0) * 100)}% match):\n> ${r.text.slice(0, 500)}...`;
      })
      .join('\n\n')}`;
  }
  if (!useScopedContractRag && searchResults.length > 0) {
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
    const [contractProfile, artifacts, contractClauses, contractObligations] = await Promise.all([
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
          rawText: true,
        },
      }),
      prisma.artifact.findMany({
        where: { contractId, tenantId },
        select: { type: true, data: true, confidence: true, validationStatus: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.clause.findMany({
        where: { contractId, contract: { tenantId } },
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

      // Include raw document text for direct AI analysis when artifacts are stubs
      if (cp.rawText && artifacts.length === 0) {
        context += `\n**📄 Full Document Text:**\n\`\`\`\n${cp.rawText.substring(0, 8000)}${cp.rawText.length > 8000 ? '\n...[truncated]' : ''}\n\`\`\`\n`;
      } else if (cp.rawText) {
        context += `\n**📄 Document Text Preview (first 3000 chars):**\n\`\`\`\n${cp.rawText.substring(0, 3000)}${cp.rawText.length > 3000 ? '\n...[see full text via tools]' : ''}\n\`\`\`\n`;
      }
    }

    if (artifacts.length > 0) {
      context += `\n**🔍 AI-Generated Artifacts (${artifacts.length} types):**\n`;
      for (const a of artifacts) {
        const dataObj = a.data as Record<string, unknown>;
        const confidenceStr = a.confidence ? ` (${Math.round(Number(a.confidence) * 100)}% confidence)` : '';
        const statusStr = a.validationStatus === 'needs_review' ? ' ⚠️ needs review' : '';
        // Serialize artifact data, capping per-artifact context at 1500 chars to stay within token budget
        const dataStr = JSON.stringify(dataObj, null, 1);
        const truncatedData = dataStr.length > 1500 ? dataStr.substring(0, 1500) + '...' : dataStr;
        context += `\n### ${a.type}${confidenceStr}${statusStr}\n\`\`\`json\n${truncatedData}\n\`\`\`\n`;
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

async function buildScopedFallbackResults(
  message: string,
  contractId: string,
  tenantId: string,
): Promise<Array<{ contractId: string; contractName: string; score: number; text: string; matchType?: string; sources?: string[]; metadata?: Record<string, unknown> }>> {
  try {
    const [contract, artifacts, clauses] = await Promise.all([
      prisma.contract.findFirst({
        where: { id: contractId, tenantId },
        select: {
          id: true,
          contractTitle: true,
          fileName: true,
          rawText: true,
          searchableText: true,
        },
      }),
      prisma.artifact.findMany({
        where: { contractId, tenantId },
        select: { type: true, data: true },
        orderBy: { updatedAt: 'desc' },
        take: 8,
      }),
      prisma.clause.findMany({
        where: { contractId, contract: { tenantId } },
        select: { category: true, text: true, riskLevel: true },
        orderBy: { position: 'asc' },
        take: 20,
      }),
    ]);

    if (!contract) {
      return [];
    }

    const queryTerms = extractQueryTerms(message);
    const contractName = contract.contractTitle || contract.fileName || 'Active Contract';
    const rawText = contract.searchableText || contract.rawText || '';
    const candidates: Array<{ heading: string; text: string; weight: number; section?: string; startChar?: number; endChar?: number }> = [];

    for (const artifact of artifacts) {
      const serialized = serializeArtifactData(artifact.type, artifact.data);
      if (!serialized) continue;
      candidates.push({
        heading: `${artifact.type} artifact`,
        section: artifact.type,
        text: serialized,
        weight: 0.22,
      });
    }

    for (const clause of clauses) {
      const clauseRange = locateTextRangeInSource(rawText, clause.text);
      candidates.push({
        heading: `${clause.category} clause`,
        section: clause.category,
        text: clause.text,
        weight: clause.riskLevel === 'high' ? 0.14 : 0.1,
        startChar: clauseRange?.startChar,
        endChar: clauseRange?.endChar,
      });
    }

    for (const paragraph of splitIntoSearchParagraphs(rawText)) {
      const paragraphRange = locateTextRangeInSource(rawText, paragraph);
      candidates.push({
        heading: 'Document text',
        section: 'rawText',
        text: paragraph,
        weight: 0.06,
        startChar: paragraphRange?.startChar,
        endChar: paragraphRange?.endChar,
      });
    }

    const ranked = candidates
      .map((candidate) => {
        const overlap = scoreTextOverlap(queryTerms, candidate.text);
        const fallbackBoost = queryTerms.length === 0 ? 0.18 : 0;
        return {
          contractId,
          contractName,
          score: Math.min(0.92, overlap + candidate.weight + fallbackBoost),
          text: buildRelevantSnippet(candidate.text, queryTerms),
          matchType: 'keyword' as const,
          metadata: {
            heading: candidate.heading,
            section: candidate.section,
            retrievalMode: 'same-contract-fallback',
            startChar: candidate.startChar,
            endChar: candidate.endChar,
          },
        };
      })
      .filter((candidate) => candidate.score >= 0.18)
      .sort((left, right) => right.score - left.score);

    return dedupeFallbackResults(ranked).slice(0, 5);
  } catch (error) {
    logger.warn('[Stream v2] Scoped fallback retrieval failed', {
      action: 'scoped-fallback',
      error: error instanceof Error ? error.message : String(error),
      contractId,
    });
    return [];
  }
}

function locateTextRangeInSource(source: string, text: string): { startChar: number; endChar: number } | null {
  if (!source || !text) return null;

  const normalized = text.trim();
  if (!normalized) return null;

  const candidates = [normalized, normalized.replace(/\s+/g, ' '), normalized.slice(0, 160)].filter(Boolean);
  for (const candidate of candidates) {
    const index = source.indexOf(candidate);
    if (index !== -1) {
      return {
        startChar: index,
        endChar: index + candidate.length,
      };
    }
  }

  return null;
}

function extractQueryTerms(message: string): string[] {
  const stopWords = new Set([
    'what', 'which', 'when', 'where', 'who', 'why', 'how', 'this', 'that', 'with', 'from', 'into',
    'about', 'there', 'their', 'they', 'them', 'have', 'will', 'would', 'could', 'should', 'your',
    'ours', 'ourselves', 'contract', 'agreement', 'please', 'tell', 'summarize', 'summary',
  ]);

  return message
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((term) => term.length >= 3 && !stopWords.has(term));
}

function serializeArtifactData(type: string, data: unknown): string {
  if (!data || typeof data !== 'object') {
    return '';
  }

  const serialized = JSON.stringify(data);
  return `${type} ${serialized}`.slice(0, 2200);
}

function splitIntoSearchParagraphs(text: string): string[] {
  if (!text) {
    return [];
  }

  return text
    .split(/\n\s*\n|\n(?=[A-Z][A-Za-z\s]{2,}:)/)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter((part) => part.length >= 80)
    .slice(0, 20);
}

function scoreTextOverlap(queryTerms: string[], text: string): number {
  if (!text) {
    return 0;
  }

  const normalizedText = text.toLowerCase();
  if (queryTerms.length === 0) {
    return 0.12;
  }

  let score = 0;
  for (const term of queryTerms) {
    if (normalizedText.includes(term)) {
      score += 0.18;
    } else if (term === 'sla' && (normalizedText.includes('service level') || normalizedText.includes('uptime') || normalizedText.includes('performance'))) {
      score += 0.16;
    } else if (term.startsWith('penalt') && (normalizedText.includes('credit') || normalizedText.includes('reduction') || normalizedText.includes('liquidated damages'))) {
      score += 0.14;
    }
  }

  if (normalizedText.includes('penalt') || normalizedText.includes('service level')) {
    score += 0.05;
  }

  return Math.min(score, 0.7);
}

function buildRelevantSnippet(text: string, queryTerms: string[]): string {
  const compactText = text.replace(/\s+/g, ' ').trim();
  if (compactText.length <= 500 || queryTerms.length === 0) {
    return compactText.slice(0, 500);
  }

  const lower = compactText.toLowerCase();
  const firstMatchIndex = queryTerms
    .map((term) => lower.indexOf(term))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0];

  if (firstMatchIndex == null) {
    return compactText.slice(0, 500);
  }

  const start = Math.max(0, firstMatchIndex - 140);
  const end = Math.min(compactText.length, start + 500);
  return compactText.slice(start, end);
}

function dedupeFallbackResults<T extends { text: string }>(results: T[]): T[] {
  const seen = new Set<string>();
  const deduped: T[] = [];
  for (const result of results) {
    const key = result.text.slice(0, 180).toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(result);
  }
  return deduped;
}
