/**
 * Negotiation Copilot Service
 * 
 * AI-powered negotiation assistant that:
 * 1. Analyzes contract clauses against a market-standard playbook
 * 2. Identifies one-sided terms and suggests balanced alternatives
 * 3. Generates redline suggestions with track-changes markup
 * 4. Provides real-time negotiation guidance during review
 * 5. Learns from tenant-specific past negotiations
 * 
 * Architecture:
 * - Uses RAG to find similar clauses from the tenant's portfolio
 * - Uses structured outputs for reliable clause-level analysis
 * - Supports streaming for real-time copilot experience
 */

import { getAIModel } from '@/lib/ai/ai-sdk-provider';
import { generateObject, streamText } from 'ai';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { hybridSearch } from '@/lib/rag/advanced-rag.service';
import pino from 'pino';

const logger = pino({ name: 'negotiation-copilot' });

// ============================================================================
// SCHEMAS
// ============================================================================

const ClausePositionSchema = z.object({
  clauseType: z.string(),
  clauseText: z.string(),
  assessment: z.enum(['favorable', 'neutral', 'unfavorable', 'missing', 'non_standard']),
  marketStandard: z.string().describe('What the typical market-standard version looks like'),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
  explanation: z.string(),
  suggestedRedline: z.string().optional().describe('Suggested replacement text'),
  negotiationStrategy: z.string().describe('How to approach negotiating this clause'),
  priority: z.number().min(1).max(10),
  fallbackPosition: z.string().optional().describe('Acceptable compromise if ideal is rejected'),
});

const NegotiationPlaybookSchema = z.object({
  overallPosition: z.enum(['strong', 'moderate', 'weak']),
  overallStrategy: z.string(),
  keyObjectives: z.array(z.string()),
  concessionOrder: z.array(z.string()).describe('Items to concede first (least important) during negotiation'),
  mustHaves: z.array(z.string()).describe('Non-negotiable items'),
  niceToHaves: z.array(z.string()).describe('Items to push for but can concede'),
  dealBreakers: z.array(z.string()).describe('Terms that would make the deal unacceptable'),
  clauses: z.array(ClausePositionSchema),
  openingMessage: z.string().describe('Suggested opening message/email for negotiation'),
  estimatedNegotiationDifficulty: z.enum(['easy', 'moderate', 'difficult', 'very_difficult']),
});

export type NegotiationPlaybook = z.infer<typeof NegotiationPlaybookSchema>;
export type ClausePosition = z.infer<typeof ClausePositionSchema>;

const RedlineSuggestionSchema = z.object({
  originalText: z.string(),
  suggestedText: z.string(),
  rationale: z.string(),
  impactAssessment: z.string(),
  acceptanceLikelihood: z.enum(['likely', 'moderate', 'unlikely']),
});

export type RedlineSuggestion = z.infer<typeof RedlineSuggestionSchema>;

// ============================================================================
// PLAYBOOK GENERATION
// ============================================================================

const PLAYBOOK_SYSTEM_PROMPT = `You are an expert contract negotiation strategist with 20+ years of experience in commercial agreements. You analyze contracts clause-by-clause and generate actionable negotiation playbooks.

Your analysis must be:
- Specific to the ACTUAL clause text (never generic)
- Strategically sequenced (know what to concede vs. fight for)
- Market-aware (reference industry-standard positions)
- Commercially practical (not just legal — consider business relationship impact)

For each clause assessment:
- "favorable": Terms clearly benefit our side
- "neutral": Standard, balanced terms
- "unfavorable": Terms favor the counterparty 
- "missing": Important protective clause is absent
- "non_standard": Unusual language that deviates from market practice

Priority scoring (1=highest priority to negotiate):
- 1-3: Critical — must address before signing
- 4-6: Important — should negotiate but not a deal-breaker
- 7-10: Minor — negotiate if opportunity arises

Concession strategy: Order items from "willing to concede first" to "last resort concessions". This helps during live negotiation.`;

/**
 * Generate a full negotiation playbook for a contract.
 */
export async function generateNegotiationPlaybook(params: {
  contractId: string;
  tenantId: string;
  contractText: string;
  contractType?: string;
  negotiationContext?: string;
  ourRole?: 'buyer' | 'seller' | 'licensor' | 'licensee' | 'auto';
}): Promise<NegotiationPlaybook> {
  const { contractText, contractType, negotiationContext, ourRole } = params;

  // Truncate to fit model context
  const maxChars = 100_000;
  const text = contractText.length > maxChars
    ? contractText.slice(0, maxChars) + '\n[... truncated ...]'
    : contractText;

  // Find similar past clauses from tenant's portfolio for benchmarking
  let portfolioBenchmark = '';
  try {
    const similarClauses = await hybridSearch(
      `key clauses terms conditions ${contractType || 'contract'}`,
      { k: 5, filters: { tenantId: params.tenantId } }
    );
    if (similarClauses.length) {
      portfolioBenchmark = `\n\nBENCHMARK — Similar clauses from your existing portfolio:\n${
        similarClauses.slice(0, 3).map((r, i) => 
          `[${i + 1}] ${r.text?.slice(0, 300)}...`
        ).join('\n')
      }`;
    }
  } catch {
    // Non-critical — proceed without benchmark
  }

  const roleHint = ourRole && ourRole !== 'auto' ? `\nOur role in this deal: ${ourRole}` : '';
  const contextHint = negotiationContext ? `\nNegotiation context: ${negotiationContext}` : '';

  const { object: playbook } = await generateObject({
    model: getAIModel(),
    schema: NegotiationPlaybookSchema,
    system: PLAYBOOK_SYSTEM_PROMPT,
    prompt: `Generate a negotiation playbook for this ${contractType || 'contract'}.${roleHint}${contextHint}${portfolioBenchmark}

--- CONTRACT TEXT ---
${text}
--- END ---

Analyze every significant clause. Generate specific redline suggestions for unfavorable/non-standard clauses. Provide a clear negotiation strategy with concession ordering.`,
    temperature: 0.2,
    maxRetries: 2,
  });

  logger.info({
    contractId: params.contractId,
    position: playbook.overallPosition,
    clausesAnalyzed: playbook.clauses.length,
    mustHaves: playbook.mustHaves.length,
    dealBreakers: playbook.dealBreakers.length,
    difficulty: playbook.estimatedNegotiationDifficulty,
  }, '📋 Negotiation playbook generated');

  return playbook;
}

// ============================================================================
// CLAUSE-LEVEL REDLINE GENERATION
// ============================================================================

/**
 * Generate specific redline suggestions for a selected clause.
 * Used for interactive clause-by-clause review.
 */
export async function generateRedlineSuggestion(params: {
  clauseText: string;
  clauseType?: string;
  contractType?: string;
  tenantId: string;
  objective?: string;
}): Promise<RedlineSuggestion> {
  const { clauseText, clauseType, contractType, objective } = params;

  const { object: redline } = await generateObject({
    model: getAIModel(),
    schema: RedlineSuggestionSchema,
    system: `You are an expert contract editor. Generate specific, word-for-word redline suggestions that improve the clause for our side while remaining commercially reasonable. The suggested text should be a complete replacement that could be sent to the counterparty.`,
    prompt: `Generate a redline suggestion for this ${clauseType || 'clause'} from a ${contractType || 'contract'}.
${objective ? `Objective: ${objective}` : ''}

Original clause:
"${clauseText}"

Provide the exact replacement text, rationale, and likelihood the counterparty will accept.`,
    temperature: 0.15,
  });

  return redline;
}

// ============================================================================
// REAL-TIME NEGOTIATION ASSISTANT (Streaming)
// ============================================================================

/**
 * Stream real-time negotiation advice for a specific question or scenario.
 * Returns a ReadableStream for SSE consumption.
 */
export async function streamNegotiationAdvice(params: {
  question: string;
  contractId: string;
  tenantId: string;
  contractText?: string;
  playbook?: NegotiationPlaybook;
}): Promise<ReturnType<typeof streamText>> {
  const { question, contractText, playbook } = params;

  // Build context from playbook if available
  let playbookContext = '';
  if (playbook) {
    playbookContext = `\n\nEXISTING PLAYBOOK SUMMARY:
- Position: ${playbook.overallPosition}
- Strategy: ${playbook.overallStrategy}
- Must-haves: ${playbook.mustHaves.join(', ')}
- Deal-breakers: ${playbook.dealBreakers.join(', ')}
- Difficulty: ${playbook.estimatedNegotiationDifficulty}`;
  }

  const contractContext = contractText 
    ? `\n\n--- RELEVANT CONTRACT EXCERPT ---\n${contractText.slice(0, 30_000)}\n--- END ---`
    : '';

  const stream = streamText({
    model: getAIModel(),
    system: `You are a real-time negotiation advisor embedded in a contract management platform. Your role is to help the user navigate active negotiations with practical, specific advice.

Be concise and actionable. Use bullet points. Reference specific contract terms when relevant.${playbookContext}`,
    prompt: `${question}${contractContext}`,
    temperature: 0.3,
  });

  return stream;
}

// ============================================================================
// PLAYBOOK STORAGE
// ============================================================================

/**
 * Generate and persist a negotiation playbook for a contract.
 */
export async function generateAndStorePlaybook(params: {
  contractId: string;
  tenantId: string;
  ourRole?: 'buyer' | 'seller' | 'licensor' | 'licensee' | 'auto';
  negotiationContext?: string;
}): Promise<NegotiationPlaybook> {
  const { contractId, tenantId, ourRole, negotiationContext } = params;

  // Fetch contract text
  const contract = await prisma.contract.findUnique({
    where: { id: contractId, tenantId },
    select: { rawText: true, contractType: true },
  });

  if (!contract?.rawText) {
    throw new Error('Contract text not available');
  }

  // Generate playbook
  const playbook = await generateNegotiationPlaybook({
    contractId,
    tenantId,
    contractText: contract.rawText,
    contractType: contract.contractType || undefined,
    negotiationContext,
    ourRole,
  });

  // Store as artifact
  await prisma.artifact.upsert({
    where: {
      contractId_type: {
        contractId,
        type: 'NEGOTIATION_PLAYBOOK' as any,
      },
    },
    update: {
      data: {
        playbook,
        generatedAt: new Date().toISOString(),
        ourRole,
        negotiationContext,
      } as any,
      updatedAt: new Date(),
    },
    create: {
      contractId,
      tenantId,
      type: 'NEGOTIATION_PLAYBOOK' as any,
      data: {
        playbook,
        generatedAt: new Date().toISOString(),
        ourRole,
        negotiationContext,
      } as any,
    },
  });

  return playbook;
}
