/**
 * Negotiation Co-Pilot API — AI-powered redline analysis & negotiation chat
 *
 * GET  /api/intelligence/negotiate — Analyze active redlines for a contract
 * POST /api/intelligence/negotiate — Chat with AI negotiation assistant
 *
 * @version 1.0.0
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, type AuthenticatedApiContext, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import OpenAI from 'openai';
import { createOpenAIClient, hasAIClientConfig } from '@/lib/openai-client';
import { logger } from '@/lib/logger';

const openai = createOpenAIClient();

interface RedlineChange {
  id: string;
  type: 'addition' | 'deletion' | 'modification' | 'replacement';
  clause: string;
  section: string;
  originalText: string;
  proposedText: string;
  category: 'liability' | 'termination' | 'payment' | 'confidentiality' | 'ip' | 'compliance' | 'other';
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  status: 'pending' | 'accepted' | 'rejected' | 'negotiating';
  aiAnalysis: {
    summary: string;
    marketPosition: 'favorable' | 'neutral' | 'unfavorable';
    recommendation: 'accept' | 'negotiate' | 'reject';
    rationale: string;
    fallbackSuggestion?: string;
  };
  suggestedResponse: string;
  impactAreas: string[];
}

/**
 * GET — Analyse the latest contract revisions and produce redline insights
 */
export const GET = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const { tenantId } = ctx;
  const contractId = request.nextUrl.searchParams.get('contractId');

  // Fetch contracts with amendment / version history
  const contracts = await prisma.contract.findMany({
    where: {
      tenantId,
      ...(contractId ? { id: contractId } : {}),
      status: { in: ['ACTIVE', 'PENDING', 'DRAFT'] },
    },
    orderBy: { updatedAt: 'desc' },
    take: 20,
    select: {
      id: true,
      contractTitle: true,
      supplierName: true,
      metadata: true,
      contractType: true,
      totalValue: true,
      expirationRisk: true,
    },
  });

  if (contracts.length === 0) {
    return createSuccessResponse(ctx, { redlines: [] });
  }

  // Build redline change objects from contract metadata
  const redlines: RedlineChange[] = [];

  for (const c of contracts) {
    const meta = (c.metadata || {}) as Record<string, unknown>;
    const clauseChanges = (meta.clauseChanges as any[]) || [];

    // If we have recorded clause changes, map them
    for (const change of clauseChanges) {
      const analysisStr = change.analysis || `Clause change in ${c.contractTitle || 'contract'} with ${c.supplierName || 'counterparty'}`;
      redlines.push({
        id: `${c.id}-${change.id || redlines.length}`,
        type: change.type || 'modification',
        clause: change.clause || change.section || c.contractType || 'General',
        section: change.section || c.contractType || 'General',
        originalText: change.original || '',
        proposedText: change.proposed || change.text || '',
        category: inferCategory(change.section || change.clause || ''),
        riskLevel: mapRiskLevel(change.risk),
        status: change.status || 'pending',
        aiAnalysis: {
          summary: analysisStr,
          marketPosition: change.marketPosition || 'neutral',
          recommendation: change.recommendation || 'negotiate',
          rationale: change.rationale || analysisStr,
          fallbackSuggestion: change.suggestion || undefined,
        },
        suggestedResponse: change.suggestion || '',
        impactAreas: change.impact || [c.contractType || 'general'],
      });
    }

    // If no recorded changes, generate a summary redline for the contract
    if (clauseChanges.length === 0) {
      const riskLevel = c.expirationRisk === 'CRITICAL' ? 'critical' : c.expirationRisk === 'HIGH' ? 'high' : 'medium';
      const summaryText = `Contract with ${c.supplierName || 'counterparty'} is in review. Value: $${c.totalValue || 0}`;
      redlines.push({
        id: c.id,
        type: 'modification',
        clause: c.contractTitle || 'Untitled',
        section: c.contractType || 'General Terms',
        originalText: '',
        proposedText: `${c.contractTitle || 'Untitled'} — review needed`,
        category: inferCategory(c.contractType || ''),
        riskLevel: riskLevel as RedlineChange['riskLevel'],
        status: 'pending',
        aiAnalysis: {
          summary: summaryText,
          marketPosition: 'neutral',
          recommendation: 'negotiate',
          rationale: summaryText,
        },
        suggestedResponse: 'Request latest redline comparison from counterparty.',
        impactAreas: [c.contractType || 'general'],
      });
    }
  }

  return createSuccessResponse(ctx, { redlines });
});

/**
 * POST — Chat with AI negotiation assistant
 * Body: { message: string, contractId?: string, context?: object }
 */
export const POST = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const { tenantId } = ctx;
  const body = await request.json();
  const { message, contractId, context: extraContext } = body;

  if (!message) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Message is required', 400);
  }

  // Optionally fetch contract context
  let contractContext = '';
  if (contractId) {
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: { contractTitle: true, supplierName: true, contractType: true, totalValue: true, metadata: true },
    });
    if (contract) {
      contractContext = `\n\nContract: "${contract.contractTitle}"\nCounterparty: ${contract.supplierName}\nType: ${contract.contractType}\nValue: $${contract.totalValue}`;
    }
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.4,
      messages: [
        {
          role: 'system',
          content: `You are a senior contract negotiation advisor. Provide strategic, actionable advice.
Be concise but thorough. Reference specific clause types when relevant.
If the user asks about a clause, analyze risk, suggest counter-positions, and note leverage points.${contractContext}`,
        },
        { role: 'user', content: message },
      ],
    });

    const reply = response.choices[0]?.message?.content || 'I could not generate a response.';
    return createSuccessResponse(ctx, { reply });
  } catch (error: any) {
    logger.error('Negotiation chat error:', error);
    return createSuccessResponse(ctx, { reply: 'AI negotiation service is temporarily unavailable.' });
  }
});

function mapRiskLevel(risk: string | undefined): RedlineChange['riskLevel'] {
  if (!risk) return 'medium';
  const r = risk.toLowerCase();
  if (r === 'critical') return 'critical';
  if (r === 'high') return 'high';
  if (r === 'low') return 'low';
  return 'medium';
}

function inferCategory(text: string): RedlineChange['category'] {
  const t = text.toLowerCase();
  if (t.includes('liab') || t.includes('indemn')) return 'liability';
  if (t.includes('terminat') || t.includes('cancel')) return 'termination';
  if (t.includes('payment') || t.includes('invoice') || t.includes('fee')) return 'payment';
  if (t.includes('confiden') || t.includes('nda') || t.includes('secret')) return 'confidentiality';
  if (t.includes('ip') || t.includes('intellectual') || t.includes('patent')) return 'ip';
  if (t.includes('complian') || t.includes('regulat')) return 'compliance';
  return 'other';
}
