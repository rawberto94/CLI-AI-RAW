/**
 * AI Renewal Analysis API
 *
 * POST /api/contracts/[id]/renew/ai-analysis
 *
 * Provides genuine AI-powered intelligence for the renewal workflow:
 *  1. Clause-level risk assessment for renewal terms
 *  2. Smart clause improvement suggestions (LLM-generated)
 *  3. Term negotiation recommendations
 *  4. Renewal vs. original comparison insights
 *  5. Missing clause detection with generated content
 */

import { NextRequest } from 'next/server';
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  getAuthenticatedApiContext,
  getApiContext,
  createSuccessResponse,
  createErrorResponse,
} from '@/lib/api-middleware';
import { checkRateLimit, rateLimitResponse, AI_RATE_LIMITS } from '@/lib/ai/rate-limit';
import { logger } from '@/lib/logger';

// ── Schemas ────────────────────────────────────────────────────────────

const RequestSchema = z.object({
  /** Clauses from the renewal draft */
  clauses: z.array(z.object({
    id: z.string(),
    title: z.string(),
    content: z.string(),
    isModified: z.boolean().optional(),
  })),
  /** New terms being proposed */
  renewalTerms: z.object({
    effectiveDate: z.string().optional(),
    expirationDate: z.string().optional(),
    totalValue: z.number().optional(),
    originalValue: z.number().optional(),
    adjustForInflation: z.boolean().optional(),
    inflationRate: z.number().optional(),
  }).optional(),
  /** What kind of analysis to run */
  analysisType: z.enum(['full', 'clauses-only', 'risk-only', 'suggestions-only']).default('full'),
});

const ClauseSuggestionSchema = z.object({
  clauseId: z.string().describe('ID of the clause this applies to, or "new" for new clause suggestions'),
  type: z.enum(['improve', 'warning', 'add', 'update']),
  title: z.string(),
  description: z.string().describe('Explanation of why this suggestion matters'),
  suggestedContent: z.string().optional().describe('Improved/new clause text'),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  category: z.enum(['risk', 'compliance', 'commercial', 'operational', 'legal']),
});

const RenewalAnalysisSchema = z.object({
  overallRiskScore: z.number().min(0).max(100).describe('Overall risk score for the renewal as drafted'),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
  executiveSummary: z.string().describe('2-3 sentence summary of the renewal analysis'),
  clauseSuggestions: z.array(ClauseSuggestionSchema),
  missingClauses: z.array(z.object({
    title: z.string(),
    reason: z.string(),
    priority: z.enum(['critical', 'high', 'medium', 'low']),
    suggestedContent: z.string().describe('Full clause text to add'),
  })),
  termRecommendations: z.array(z.object({
    area: z.string(),
    currentState: z.string(),
    recommendation: z.string(),
    impact: z.enum(['positive', 'neutral', 'negative']),
  })),
  complianceFlags: z.array(z.object({
    regulation: z.string(),
    status: z.enum(['compliant', 'at-risk', 'non-compliant', 'not-applicable']),
    detail: z.string(),
  })),
  negotiationInsights: z.object({
    leveragePoints: z.array(z.string()),
    watchAreas: z.array(z.string()),
    suggestedApproach: z.string(),
  }),
});

export type RenewalAnalysis = z.infer<typeof RenewalAnalysisSchema>;

// ── POST handler ───────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(
      getApiContext(request),
      'UNAUTHORIZED',
      'Authentication required',
      401,
      { retryable: false },
    );
  }

  // Rate-limit: standard AI tier (30 req/min)
  const rl = checkRateLimit(ctx.tenantId, ctx.userId, '/api/contracts/renew/ai-analysis', AI_RATE_LIMITS.standard);
  if (!rl.allowed) return rateLimitResponse(rl, ctx.requestId);

  try {
    const { id: contractId } = await params;
    const body = await request.json();
    const input = RequestSchema.parse(body);

    // Fetch the original contract for context
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId: ctx.tenantId, isDeleted: false },
      select: {
        id: true,
        contractTitle: true,
        contractType: true,
        totalValue: true,
        currency: true,
        effectiveDate: true,
        expirationDate: true,
        rawText: true,
        renewalStatus: true,
        autoRenewalEnabled: true,
        noticePeriodDays: true,
        supplierName: true,
        clientName: true,
      },
    });

    if (!contract) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
    }

    // Build prompt context
    const clausesSummary = input.clauses
      .map((c, i) => `[Clause ${i + 1}: "${c.title}"]\n${c.content}`)
      .join('\n\n');

    const termsContext = input.renewalTerms
      ? `
Renewal Terms:
- New effective date: ${input.renewalTerms.effectiveDate || 'Same as original'}
- New expiration date: ${input.renewalTerms.expirationDate || 'Same as original'}
- Original value: ${contract.currency || 'USD'} ${input.renewalTerms.originalValue ?? contract.totalValue ?? 'N/A'}
- Proposed value: ${contract.currency || 'USD'} ${input.renewalTerms.totalValue ?? 'Same'}
- Inflation adjustment: ${input.renewalTerms.adjustForInflation ? `Yes (${input.renewalTerms.inflationRate}%)` : 'No'}
`
      : '';

    const originalContext = `
Original Contract: "${contract.contractTitle || 'Untitled'}"
Type: ${contract.contractType || 'Unknown'}
Supplier: ${contract.supplierName || 'Unknown'}
Client: ${contract.clientName || 'Unknown'}
Original Value: ${contract.currency || 'USD'} ${contract.totalValue ?? 'N/A'}
Effective: ${contract.effectiveDate ? new Date(contract.effectiveDate).toISOString().split('T')[0] : 'N/A'}
Expiration: ${contract.expirationDate ? new Date(contract.expirationDate).toISOString().split('T')[0] : 'N/A'}
Auto-renewal: ${contract.autoRenewalEnabled ? 'Yes' : 'No'}
Notice period: ${contract.noticePeriodDays ?? 'N/A'} days
`;

    // Generate AI analysis
    const { object: analysis } = await generateObject({
      model: openai('gpt-4o-mini') as any,
      schema: RenewalAnalysisSchema,
      prompt: `You are an expert contract analyst specializing in enterprise procurement and contract renewals.

Analyze the following contract renewal draft and provide a thorough assessment.

${originalContext}
${termsContext}

=== RENEWAL DRAFT CLAUSES ===
${clausesSummary || '(No clauses provided)'}

Provide:
1. An overall risk score (0-100) for the renewal as currently drafted
2. Specific clause-level suggestions — improvements, warnings, and missing protections
3. Identification of important missing clauses with full suggested text
4. Term recommendations (value, dates, conditions)
5. Compliance flags for GDPR, CCPA, SOX, and other relevant regulations
6. Negotiation insights — leverage points and areas to watch

Be specific and actionable. Reference clause titles by name. For missing clauses, provide complete, production-ready clause text.
For clause IDs in suggestions, use the actual clause IDs provided (e.g., the id field from each clause). Use "new" for brand-new clause suggestions.`,
      temperature: 0.3,
    });

    logger.info('AI renewal analysis completed', { contractId, riskScore: analysis.overallRiskScore });

    return createSuccessResponse(ctx, { analysis });
  } catch (err) {
    logger.error('AI renewal analysis failed', { error: err instanceof Error ? err.message : String(err) });

    if (err instanceof z.ZodError) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Invalid request body', 400, {
        details: err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; '),
      });
    }

    // Graceful degradation — if AI call fails, return a fallback
    const errorMessage = err instanceof Error ? err.message : 'AI analysis unavailable';
    if (errorMessage.includes('API key') || errorMessage.includes('quota') || errorMessage.includes('rate')) {
      return createErrorResponse(ctx, 'SERVICE_UNAVAILABLE', 'AI service temporarily unavailable. Please try again later.', 503, { retryable: true });
    }

    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to generate analysis', 500, { retryable: true });
  }
}
