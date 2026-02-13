/**
 * Negotiation Co-Pilot API — AI-powered redline analysis & negotiation chat
 *
 * GET  /api/intelligence/negotiate — Analyze active redlines for a contract
 * POST /api/intelligence/negotiate — Chat with AI negotiation assistant
 *
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, type AuthenticatedApiContext } from '@/lib/api-middleware';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface RedlineChange {
  id: string;
  section: string;
  originalText: string;
  proposedText: string;
  changeType: 'addition' | 'deletion' | 'modification' | 'replacement';
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  status: 'pending' | 'accepted' | 'rejected' | 'negotiating';
  aiAnalysis: string;
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
      status: { in: ['NEGOTIATING', 'REVIEW', 'PENDING', 'IN_REVIEW'] },
    },
    orderBy: { updatedAt: 'desc' },
    take: 20,
    select: {
      id: true,
      contractTitle: true,
      counterparty: true,
      metadata: true,
      contractType: true,
      totalValue: true,
      expirationRisk: true,
    },
  });

  if (contracts.length === 0) {
    return NextResponse.json({ success: true, data: { redlines: [] } });
  }

  // Build redline change objects from contract metadata
  const redlines: RedlineChange[] = [];

  for (const c of contracts) {
    const meta = (c.metadata || {}) as Record<string, unknown>;
    const clauseChanges = (meta.clauseChanges as any[]) || [];

    // If we have recorded clause changes, map them
    for (const change of clauseChanges) {
      redlines.push({
        id: `${c.id}-${change.id || redlines.length}`,
        section: change.section || c.contractType || 'General',
        originalText: change.original || '',
        proposedText: change.proposed || change.text || '',
        changeType: change.type || 'modification',
        riskLevel: mapRiskLevel(change.risk),
        status: change.status || 'pending',
        aiAnalysis: change.analysis || `Clause change in ${c.contractTitle || 'contract'} with ${c.counterparty || 'counterparty'}`,
        suggestedResponse: change.suggestion || '',
        impactAreas: change.impact || [c.contractType || 'general'],
      });
    }

    // If no recorded changes, generate a summary redline for the contract
    if (clauseChanges.length === 0) {
      const riskLevel = c.expirationRisk === 'CRITICAL' ? 'critical' : c.expirationRisk === 'HIGH' ? 'high' : 'medium';
      redlines.push({
        id: c.id,
        section: c.contractType || 'General Terms',
        originalText: '',
        proposedText: `${c.contractTitle || 'Untitled'} — review needed`,
        changeType: 'modification',
        riskLevel: riskLevel as RedlineChange['riskLevel'],
        status: 'pending',
        aiAnalysis: `Contract with ${c.counterparty || 'counterparty'} is in review. Value: $${c.totalValue || 0}`,
        suggestedResponse: 'Request latest redline comparison from counterparty.',
        impactAreas: [c.contractType || 'general'],
      });
    }
  }

  return NextResponse.json({ success: true, data: { redlines } });
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
    return NextResponse.json({ success: false, error: 'Message is required' }, { status: 400 });
  }

  // Optionally fetch contract context
  let contractContext = '';
  if (contractId) {
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: { contractTitle: true, counterparty: true, contractType: true, totalValue: true, metadata: true },
    });
    if (contract) {
      contractContext = `\n\nContract: "${contract.contractTitle}"\nCounterparty: ${contract.counterparty}\nType: ${contract.contractType}\nValue: $${contract.totalValue}`;
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
    return NextResponse.json({ success: true, data: { reply } });
  } catch (error: any) {
    console.error('Negotiation chat error:', error);
    return NextResponse.json({ success: true, data: { reply: 'AI negotiation service is temporarily unavailable.' } });
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
