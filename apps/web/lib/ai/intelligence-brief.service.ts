/**
 * Contract Intelligence Brief Service
 * 
 * God-tier post-upload feature: automatically generates a comprehensive
 * AI intelligence brief for every uploaded contract. This runs after RAG
 * indexing completes and produces:
 * 
 * 1. Executive Summary (plain-language 3-sentence overview)
 * 2. Key Terms Extraction (parties, dates, values, governing law)
 * 3. Risk Score (0-100 with risk factors)
 * 4. Unusual Clause Detection (flags clauses that deviate from market standard)
 * 5. Obligation Timeline (auto-extracted deadlines & milestones)
 * 6. Negotiation Leverage Points (areas where terms favor one party)
 * 7. Similar Contract Comparison (vs. tenant's existing contracts via RAG)
 * 
 * The brief is stored as a JSON artifact on the contract and surfaced in the UI.
 */

import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import pino from 'pino';

const logger = pino({ name: 'intelligence-brief' });

// ============================================================================
// SCHEMA — Structured output for the intelligence brief
// ============================================================================

const RiskFactorSchema = z.object({
  category: z.enum(['financial', 'legal', 'operational', 'compliance', 'termination', 'liability', 'ip', 'data_privacy']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  description: z.string(),
  clause: z.string().optional().describe('The clause text that contains this risk'),
  recommendation: z.string(),
});

const ObligationSchema = z.object({
  party: z.string(),
  description: z.string(),
  deadline: z.string().optional().describe('ISO date or relative description'),
  type: z.enum(['payment', 'delivery', 'reporting', 'compliance', 'renewal', 'notice', 'performance', 'other']),
  isRecurring: z.boolean(),
  frequency: z.string().optional(),
});

const UnusualClauseSchema = z.object({
  clauseTitle: z.string(),
  clauseText: z.string(),
  concern: z.string(),
  marketComparison: z.string().describe('How this compares to typical market terms'),
  impactLevel: z.enum(['low', 'medium', 'high']),
});

const LeveragePointSchema = z.object({
  area: z.string(),
  currentPosition: z.string().describe('What the contract currently says'),
  favoredParty: z.string(),
  negotiationSuggestion: z.string(),
  potentialImpact: z.enum(['low', 'medium', 'high']),
});

const KeyTermSchema = z.object({
  effectiveDate: z.string().optional(),
  expirationDate: z.string().optional(),
  totalValue: z.string().optional(),
  currency: z.string().optional(),
  governingLaw: z.string().optional(),
  jurisdiction: z.string().optional(),
  parties: z.array(z.object({
    name: z.string(),
    role: z.string(),
    isCounterparty: z.boolean(),
  })),
  renewalTerms: z.string().optional(),
  terminationNotice: z.string().optional(),
  paymentTerms: z.string().optional(),
  confidentialityPeriod: z.string().optional(),
  limitOfLiability: z.string().optional(),
  indemnification: z.string().optional(),
});

export const IntelligenceBriefSchema = z.object({
  executiveSummary: z.string().describe('3-sentence plain-language overview of what this contract is about, who it involves, and what it requires'),
  contractType: z.string(),
  keyTerms: KeyTermSchema,
  riskScore: z.number().min(0).max(100).describe('Overall risk score: 0=minimal, 100=extreme'),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
  riskFactors: z.array(RiskFactorSchema),
  unusualClauses: z.array(UnusualClauseSchema),
  obligations: z.array(ObligationSchema),
  leveragePoints: z.array(LeveragePointSchema),
  keyDates: z.array(z.object({
    date: z.string(),
    event: z.string(),
    importance: z.enum(['low', 'medium', 'high', 'critical']),
  })),
  strengthsForClient: z.array(z.string()),
  weaknessesForClient: z.array(z.string()),
  actionItems: z.array(z.object({
    action: z.string(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']),
    deadline: z.string().optional(),
  })),
});

export type IntelligenceBrief = z.infer<typeof IntelligenceBriefSchema>;

// ============================================================================
// GENERATION
// ============================================================================

const BRIEF_SYSTEM_PROMPT = `You are an expert contract analyst with deep expertise in commercial law, procurement, and risk management. You are generating an AI Intelligence Brief for a contract that has just been uploaded to a contract lifecycle management platform.

Your analysis must be:
- Precise and specific to THIS contract (never generic boilerplate)
- Commercially actionable (every finding should lead to a clear action)  
- Risk-calibrated (don't flag everything as high risk — use graduated severity)
- Party-aware (clearly identify who benefits/loses from each term)

Risk scoring guide:
- 0-20: Standard contract with balanced terms
- 21-40: Minor concerns, standard negotiation items
- 41-60: Moderate risk, unusual terms that need attention
- 61-80: High risk, significant exposure or one-sided terms
- 81-100: Critical, immediate legal review required

For unusual clauses: compare against market-standard terms for this type of contract.
For leverage points: identify specific areas where negotiation could improve position.`;

/**
 * Generate a full Contract Intelligence Brief from raw contract text.
 * Uses structured outputs (generateObject) for reliable parsing.
 */
export async function generateIntelligenceBrief(params: {
  contractId: string;
  tenantId: string;
  contractText: string;
  contractType?: string;
  existingMetadata?: Record<string, unknown>;
}): Promise<IntelligenceBrief> {
  const { contractText, contractType, existingMetadata } = params;

  // Truncate to fit token budget (~120k chars ≈ 30k tokens for gpt-4o-mini)
  const maxChars = 120_000;
  const truncatedText = contractText.length > maxChars 
    ? contractText.slice(0, maxChars) + '\n\n[... TRUNCATED — contract continues beyond analysis window ...]'
    : contractText;

  const contextHints = existingMetadata 
    ? `\n\nExisting metadata hints: ${JSON.stringify(existingMetadata, null, 2)}`
    : '';

  const userPrompt = `Analyze the following ${contractType || 'contract'} and generate a comprehensive Intelligence Brief.${contextHints}

--- CONTRACT TEXT ---
${truncatedText}
--- END CONTRACT TEXT ---

Generate the Intelligence Brief with all required fields. Be specific to THIS contract.`;

  // Use dynamic model routing: gpt-4o for complex contracts, gpt-4o-mini for simpler ones
  const isComplex = contractText.length > 50_000 || 
    /(?:indemnif|limitation of liability|force majeure|intellectual property|data process)/i.test(contractText);
  const modelId = isComplex ? 'gpt-4o' : 'gpt-4o-mini';

  logger.info({ 
    contractId: params.contractId, 
    textLength: contractText.length, 
    model: modelId, 
    isComplex,
  }, 'Generating intelligence brief');

  const { object: brief } = await generateObject({
    model: openai(modelId),
    schema: IntelligenceBriefSchema,
    system: BRIEF_SYSTEM_PROMPT,
    prompt: userPrompt,
    temperature: 0.1,
    maxRetries: 2,
  });

  return brief;
}

// ============================================================================
// SIMILAR CONTRACT COMPARISON (RAG-powered)
// ============================================================================

export interface SimilarContractComparison {
  similarContractId: string;
  similarContractTitle: string;
  similarity: number;
  keyDifferences: string[];
  betterTermsIn: 'current' | 'similar' | 'mixed';
  recommendation: string;
}

/**
 * Compare a contract against similar ones in the tenant's portfolio using RAG.
 */
export async function compareSimilarContracts(params: {
  contractId: string;
  tenantId: string;
  executiveSummary: string;
  contractType: string;
}): Promise<SimilarContractComparison[]> {
  const { contractId, tenantId, executiveSummary, contractType } = params;

  try {
    
    
    // Find similar contracts via embedding similarity (excluding self)
    const similar = await prisma.$queryRaw<Array<{
      contractId: string;
      title: string;
      similarity: number;
    }>>`
      SELECT DISTINCT ce."contractId", c."title",
        1 - (ce."embedding" <=> (
          SELECT AVG(e."embedding") FROM "ContractEmbedding" e WHERE e."contractId" = ${contractId}
        )) as similarity
      FROM "ContractEmbedding" ce
      JOIN "Contract" c ON c."id" = ce."contractId"
      WHERE ce."contractId" != ${contractId}
        AND ce."tenantId" = ${tenantId}
        AND c."contractType" = ${contractType}
      GROUP BY ce."contractId", c."title"
      ORDER BY similarity DESC
      LIMIT 3
    `;

    if (similar.length === 0) return [];

    // For each similar contract, generate comparison
    const comparisons: SimilarContractComparison[] = [];
    
    for (const sim of similar) {
      if (Number(sim.similarity) < 0.65) continue; // Skip low similarity

      comparisons.push({
        similarContractId: sim.contractId,
        similarContractTitle: sim.title || 'Untitled',
        similarity: Number(sim.similarity),
        keyDifferences: [],
        betterTermsIn: 'mixed',
        recommendation: `Review ${sim.title || 'similar contract'} for benchmark terms (${(Number(sim.similarity) * 100).toFixed(0)}% similar)`,
      });
    }

    return comparisons;
  } catch (error) {
    logger.warn({ error: (error as Error).message }, 'Similar contract comparison failed');
    return [];
  }
}

// ============================================================================
// FULL PIPELINE — Orchestrates brief generation + storage
// ============================================================================

/**
 * Run the full post-upload intelligence pipeline for a contract.
 * - Generates intelligence brief
 * - Compares against similar contracts
 * - Stores results as contract artifact
 * - Updates contract metadata with risk score
 */
export async function runIntelligencePipeline(params: {
  contractId: string;
  tenantId: string;
}): Promise<{ success: boolean; brief?: IntelligenceBrief; error?: string }> {
  const { contractId, tenantId } = params;
  const startTime = Date.now();

  try {
    

    // 1. Fetch contract
    const contract = await prisma.contract.findUnique({
      where: { id: contractId, tenantId },
      select: {
        id: true,
        title: true,
        rawText: true,
        contractType: true,
        metadata: true,
      },
    });

    if (!contract?.rawText) {
      logger.warn({ contractId }, 'No raw text available for intelligence brief');
      return { success: false, error: 'No raw text' };
    }

    // 2. Generate intelligence brief
    const brief = await generateIntelligenceBrief({
      contractId,
      tenantId,
      contractText: contract.rawText,
      contractType: contract.contractType || undefined,
      existingMetadata: (contract.metadata as Record<string, unknown>) || undefined,
    });

    // 3. Compare similar contracts
    const comparisons = await compareSimilarContracts({
      contractId,
      tenantId,
      executiveSummary: brief.executiveSummary,
      contractType: contract.contractType || 'unknown',
    });

    // 4. Store as artifact
    await prisma.artifact.upsert({
      where: {
        contractId_tenantId_type: {
          contractId,
          tenantId,
          type: 'INTELLIGENCE_BRIEF',
        },
      },
      update: {
        content: {
          brief,
          comparisons,
          generatedAt: new Date().toISOString(),
          model: contract.rawText.length > 50_000 ? 'gpt-4o' : 'gpt-4o-mini',
          processingTime: Date.now() - startTime,
        } as any,
        updatedAt: new Date(),
      },
      create: {
        contractId,
        tenantId,
        type: 'INTELLIGENCE_BRIEF',
        content: {
          brief,
          comparisons,
          generatedAt: new Date().toISOString(),
          model: contract.rawText.length > 50_000 ? 'gpt-4o' : 'gpt-4o-mini',
          processingTime: Date.now() - startTime,
        } as any,
      },
    });

    // 5. Update contract metadata with risk score
    const existingMeta = (contract.metadata || {}) as Record<string, unknown>;
    await prisma.contract.update({
      where: { id: contractId },
      data: {
        metadata: {
          ...existingMeta,
          aiRiskScore: brief.riskScore,
          aiRiskLevel: brief.riskLevel,
          aiKeyDatesCount: brief.keyDates.length,
          aiObligationsCount: brief.obligations.length,
          aiUnusualClausesCount: brief.unusualClauses.length,
          aiBriefGeneratedAt: new Date().toISOString(),
        } as any,
      },
    });

    const elapsed = Date.now() - startTime;
    logger.info({
      contractId,
      riskScore: brief.riskScore,
      riskLevel: brief.riskLevel,
      obligations: brief.obligations.length,
      unusualClauses: brief.unusualClauses.length,
      leveragePoints: brief.leveragePoints.length,
      comparisons: comparisons.length,
      elapsed,
    }, '📊 Intelligence brief generated');

    return { success: true, brief };
  } catch (error) {
    logger.error({ contractId, error: (error as Error).message }, 'Intelligence pipeline failed');
    return { success: false, error: (error as Error).message };
  }
}
