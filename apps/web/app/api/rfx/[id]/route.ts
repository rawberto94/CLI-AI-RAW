/**
 * RFx Event Detail API
 *
 * GET   /api/rfx/[id]  - Get single RFx event with full details
 * PATCH /api/rfx/[id]  - Update RFx event (HITL workflow actions)
 *
 * PATCH actions:
 * - update_requirements: Edit/add/remove requirements
 * - update_vendors: Modify invited vendor list
 * - publish: Move from draft → published
 * - add_bid: Record a vendor bid/response
 * - evaluate: AI-score all bids
 * - award: Select winner + generate justification
 * - negotiate: Generate negotiation strategy for a vendor
 * - cancel: Cancel the RFx event
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';

/** Feature flag — when false, RFx endpoints return 503 */
const RFX_ENABLED = process.env.RFX_AGENT_ENABLED !== 'false';
import { z } from 'zod';
import { createOpenAIClient, hasAIClientConfig } from '@/lib/openai-client';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// ============================================================================
// SCHEMAS
// ============================================================================

const PatchActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('update_requirements'),
    requirements: z.array(z.object({
      title: z.string(),
      description: z.string().optional(),
      category: z.string().optional(),
      priority: z.enum(['must-have', 'should-have', 'nice-to-have']).optional(),
      source: z.enum(['user', 'ai']).optional(),
    })),
  }),
  z.object({
    action: z.literal('update_vendors'),
    vendors: z.array(z.string()),
  }),
  z.object({
    action: z.literal('update_details'),
    title: z.string().optional(),
    description: z.string().optional(),
    estimatedValue: z.number().optional(),
    deadline: z.string().optional(),
    evaluationCriteria: z.array(z.object({
      name: z.string(),
      description: z.string().optional(),
      weight: z.number(),
      scoringMethod: z.string().optional(),
    })).optional(),
  }),
  z.object({
    action: z.literal('publish'),
  }),
  z.object({
    action: z.literal('add_bid'),
    vendorName: z.string(),
    bid: z.object({
      technicalResponse: z.record(z.unknown()).optional(),
      commercialResponse: z.object({
        totalPrice: z.number(),
        breakdown: z.record(z.number()).optional(),
        paymentTerms: z.string().optional(),
        validUntil: z.string().optional(),
      }).optional(),
      strengths: z.array(z.string()).optional(),
      weaknesses: z.array(z.string()).optional(),
      submittedAt: z.string().optional(),
    }),
  }),
  z.object({
    action: z.literal('evaluate'),
  }),
  z.object({
    action: z.literal('award'),
    winner: z.string(),
  }),
  z.object({
    action: z.literal('negotiate'),
    vendorName: z.string(),
    currentBid: z.number(),
    targetPrice: z.number(),
  }),
  z.object({
    action: z.literal('cancel'),
    reason: z.string().optional(),
  }),
  z.object({
    action: z.literal('ai_enhance_requirements'),
    categories: z.array(z.string()).optional(),
  }),
]);

// ============================================================================
// GET — Single RFx event
// ============================================================================

export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (!RFX_ENABLED) return createErrorResponse(ctx, 'SERVICE_UNAVAILABLE', 'RFx module is disabled', 503);
  const { id } = await (ctx as any).params;

  const event = await prisma.rFxEvent.findFirst({
    where: { id, tenantId: ctx.tenantId },
  });

  if (!event) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'RFx event not found', 404);
  }

  // Enrich with vendor profiles from contract history
  let vendorProfiles: Array<{
    name: string;
    contractCount: number;
    avgValue: number;
    latestContract?: string;
  }> = [];

  if (event.invitedVendors.length > 0) {
    try {
      // Batch query — single DB call instead of N+1
      const allContracts = await prisma.contract.findMany({
        where: { tenantId: ctx.tenantId, supplierName: { in: event.invitedVendors } },
        select: { supplierName: true, contractTitle: true, totalValue: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
      });
      const byVendor = new Map<string, typeof allContracts>();
      for (const c of allContracts) {
        const key = c.supplierName || '';
        if (!byVendor.has(key)) byVendor.set(key, []);
        byVendor.get(key)!.push(c);
      }
      vendorProfiles = event.invitedVendors.map((vendor) => {
        const contracts = (byVendor.get(vendor) || []).slice(0, 5);
        const values = contracts.map((c) => Number(c.totalValue ?? 0));
        return {
          name: vendor,
          contractCount: contracts.length,
          avgValue: values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0,
          latestContract: contracts[0]?.contractTitle ?? undefined,
        };
      });
    } catch (err) {
      logger.warn('[RFx] Vendor profile enrichment failed', { eventId: event.id, error: String(err) });
    }
  }

  return createSuccessResponse(ctx, {
    event,
    vendorProfiles,
    workflow: getWorkflowStatus(event),
  });
});

// ============================================================================
// PATCH — HITL workflow actions
// ============================================================================

export const PATCH = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (!RFX_ENABLED) return createErrorResponse(ctx, 'SERVICE_UNAVAILABLE', 'RFx module is disabled', 503);
  const { id } = await (ctx as any).params;
  const body = await request.json();
  const input = PatchActionSchema.parse(body);

  // Verify event belongs to tenant
  const event = await prisma.rFxEvent.findFirst({
    where: { id, tenantId: ctx.tenantId },
  });

  if (!event) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'RFx event not found', 404);
  }

  switch (input.action) {
    case 'update_requirements': {
      const updated = await prisma.rFxEvent.update({
        where: { id },
        data: { requirements: input.requirements as any },
      });
      return createSuccessResponse(ctx, { event: updated });
    }

    case 'update_vendors': {
      const updated = await prisma.rFxEvent.update({
        where: { id },
        data: { invitedVendors: input.vendors },
      });
      return createSuccessResponse(ctx, { event: updated });
    }

    case 'update_details': {
      const data: Record<string, unknown> = {};
      if (input.title) data.title = input.title;
      if (input.description !== undefined) data.description = input.description;
      if (input.estimatedValue !== undefined) data.estimatedValue = input.estimatedValue;
      if (input.deadline) data.responseDeadline = new Date(input.deadline);
      if (input.evaluationCriteria) data.evaluationCriteria = input.evaluationCriteria as any;

      const updated = await prisma.rFxEvent.update({
        where: { id },
        data,
      });
      return createSuccessResponse(ctx, { event: updated });
    }

    case 'publish': {
      if (event.status !== 'draft') {
        return createErrorResponse(ctx, 'INVALID_STATE', `Cannot publish RFx in ${event.status} status`, 400);
      }
      const updated = await prisma.rFxEvent.update({
        where: { id },
        data: { status: 'published', publishDate: new Date() },
      });
      return createSuccessResponse(ctx, { event: updated });
    }

    case 'add_bid': {
      if (!['published', 'open'].includes(event.status)) {
        return createErrorResponse(ctx, 'INVALID_STATE', `Cannot add bids to RFx in '${event.status}' status (must be published or open)`, 400);
      }
      const currentResponses = (event.responses as any[]) || [];
      const existingIdx = currentResponses.findIndex(
        (r: any) => r.vendorName === input.vendorName
      );
      const bidEntry = {
        vendorName: input.vendorName,
        ...input.bid,
        submittedAt: input.bid.submittedAt || new Date().toISOString(),
      };

      if (existingIdx >= 0) {
        currentResponses[existingIdx] = bidEntry;
      } else {
        currentResponses.push(bidEntry);
      }

      const updated = await prisma.rFxEvent.update({
        where: { id },
        data: {
          responses: currentResponses as any,
          status: event.status === 'published' ? 'open' : event.status,
        },
      });
      return createSuccessResponse(ctx, { event: updated, bidCount: currentResponses.length });
    }

    case 'evaluate': {
      if (!['open', 'published'].includes(event.status)) {
        return createErrorResponse(ctx, 'INVALID_STATE', `Cannot evaluate RFx in '${event.status}' status (must be open or published)`, 400);
      }
      const responses = (event.responses as any[]) || [];
      const minBids = parseInt(process.env.RFX_MIN_BID_COMPARE || '2', 10);
      if (responses.length < minBids) {
        return createErrorResponse(
          ctx,
          'INSUFFICIENT_BIDS',
          `Need at least ${minBids} bids to evaluate (have ${responses.length})`,
          400
        );
      }

      const evaluation = await evaluateBidsWithAI(event, responses);
      const updated = await prisma.rFxEvent.update({
        where: { id },
        data: {
          status: 'closed',
          responses: evaluation.scoredResponses as any,
        },
      });

      return createSuccessResponse(ctx, {
        event: updated,
        evaluation: {
          rankings: evaluation.rankings,
          priceAnalysis: evaluation.priceAnalysis,
          recommendation: evaluation.recommendation,
        },
      });
    }

    case 'award': {
      if (event.status !== 'closed') {
        return createErrorResponse(ctx, 'INVALID_STATE', `Cannot award RFx in '${event.status}' status (must be closed after evaluation)`, 400);
      }
      const justification = await generateAwardJustification(event, input.winner);
      const updated = await prisma.rFxEvent.update({
        where: { id },
        data: {
          status: 'awarded',
          winner: input.winner,
          awardJustification: justification,
          awardDate: new Date(),
        },
      });
      return createSuccessResponse(ctx, { event: updated, justification });
    }

    case 'negotiate': {
      const strategy = await generateNegotiationStrategy(
        input.vendorName,
        input.currentBid,
        input.targetPrice,
        (event.requirements as any[]) || []
      );
      return createSuccessResponse(ctx, { event, strategy });
    }

    case 'cancel': {
      const updated = await prisma.rFxEvent.update({
        where: { id },
        data: { status: 'cancelled' },
      });
      return createSuccessResponse(ctx, { event: updated });
    }

    case 'ai_enhance_requirements': {
      // Take existing requirements and ask AI to enhance them further
      const existingReqs = (event.requirements as any[]) || [];

      const OpenAI = (await import('openai')).default;
      const openai = createOpenAIClient();

      const prompt = `You are a procurement expert. Review these existing requirements for an ${event.type} titled "${event.title}" and suggest additional requirements to strengthen them.

Existing requirements:
${existingReqs.map((r: any, i: number) => `${i + 1}. [${r.source || 'user'}] ${r.title}: ${r.description || 'No description'} (${r.priority || 'should-have'})`).join('\n')}

${input.categories?.length ? `Focus on these categories: ${input.categories.join(', ')}` : ''}

Suggest 3-5 ADDITIONAL requirements that fill gaps. Return JSON:
{
  "suggestions": [
    { "title": "...", "description": "...", "category": "...", "priority": "must-have|should-have|nice-to-have", "source": "ai", "rationale": "Why this requirement matters" }
  ]
}`;

      const response = await openai.chat.completions.create({
        model: process.env.RFX_AI_MODEL || 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const parsed = JSON.parse(response.choices[0]?.message?.content || '{}');
      return createSuccessResponse(ctx, { suggestions: parsed.suggestions || [] });
    }

    default:
      return createErrorResponse(ctx, 'INVALID_ACTION', 'Unknown action', 400);
  }
});

// ============================================================================
// AI HELPERS
// ============================================================================

async function evaluateBidsWithAI(
  event: any,
  responses: any[]
) {
  const OpenAI = (await import('openai')).default;
  const openai = createOpenAIClient();

  const criteria = (event.evaluationCriteria as any[]) || [];
  const criteriaText = criteria.map((c: any) => `- ${c.name} (weight: ${c.weight}): ${c.description}`).join('\n');

  const prompt = `Score these vendor bids for ${event.type} "${event.title}":

Evaluation Criteria:
${criteriaText}

Vendor Bids:
${responses.map((r: any) => `
Vendor: ${r.vendorName}
Price: $${r.commercialResponse?.totalPrice || 'Not provided'}
Strengths: ${r.strengths?.join(', ') || 'N/A'}
Weaknesses: ${r.weaknesses?.join(', ') || 'N/A'}
`).join('\n---\n')}

Score each vendor on each criterion (0-10). Return JSON:
{
  "scores": {
    "VendorName": { "CriterionName": 8.5 }
  },
  "recommendation": {
    "winner": "vendor name",
    "confidence": 0.85,
    "justification": "...",
    "alternatives": ["vendor"],
    "risks": ["risk"]
  }
}`;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.RFX_AI_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    const parsed = JSON.parse(response.choices[0]?.message?.content || '{}');
    const scores = parsed.scores || {};

    // Calculate weighted totals
    const totalScores: Record<string, number> = {};
    for (const [vendor, vendorScores] of Object.entries(scores)) {
      let total = 0;
      for (const criterion of criteria) {
        const score = (vendorScores as Record<string, number>)[criterion.name] || 0;
        total += score * (criterion.weight || 0.2);
      }
      totalScores[vendor] = total;
    }

    const rankings = Object.entries(totalScores)
      .sort(([, a], [, b]) => b - a)
      .map(([vendor, score], index) => ({
        vendor,
        score: Math.round(score * 100) / 100,
        rank: index + 1,
      }));

    // Price analysis
    const prices = responses
      .filter((r: any) => r.commercialResponse?.totalPrice)
      .map((r: any) => ({ vendor: r.vendorName, price: r.commercialResponse.totalPrice }));
    const priceValues = prices.map((p) => p.price);

    const priceAnalysis = {
      lowest: prices.sort((a, b) => a.price - b.price)[0]?.vendor || '',
      highest: prices.sort((a, b) => b.price - a.price)[0]?.vendor || '',
      average: priceValues.length > 0 ? priceValues.reduce((a, b) => a + b, 0) / priceValues.length : 0,
      spread: priceValues.length > 0 ? Math.max(...priceValues) - Math.min(...priceValues) : 0,
    };

    // Tag scored responses
    const scoredResponses = responses.map((r: any) => ({
      ...r,
      scores: scores[r.vendorName] || {},
      totalScore: totalScores[r.vendorName] || 0,
    }));

    return {
      scoredResponses,
      rankings,
      priceAnalysis,
      recommendation: parsed.recommendation || {
        winner: rankings[0]?.vendor || '',
        confidence: 0.7,
        justification: 'Based on weighted scoring',
        alternatives: rankings.slice(1, 3).map((r) => r.vendor),
        risks: ['Manual review recommended'],
      },
    };
  } catch (error) {
    // Fallback: price-only ranking
    const priceRanked = responses
      .filter((r: any) => r.commercialResponse?.totalPrice)
      .sort((a: any, b: any) => a.commercialResponse.totalPrice - b.commercialResponse.totalPrice);

    return {
      scoredResponses: responses,
      rankings: priceRanked.map((r: any, i: number) => ({
        vendor: r.vendorName,
        score: 10 - i,
        rank: i + 1,
      })),
      priceAnalysis: {
        lowest: priceRanked[0]?.vendorName || '',
        highest: priceRanked[priceRanked.length - 1]?.vendorName || '',
        average: 0,
        spread: 0,
      },
      recommendation: {
        winner: priceRanked[0]?.vendorName || '',
        confidence: 0.5,
        justification: 'Ranked by price only — AI evaluation failed',
        alternatives: priceRanked.slice(1, 3).map((r: any) => r.vendorName),
        risks: ['AI evaluation failed — manual review required'],
      },
    };
  }
}

async function generateAwardJustification(event: any, winner: string): Promise<string> {
  try {
    const OpenAI = (await import('openai')).default;
    const openai = createOpenAIClient();

    const responses = (event.responses as any[]) || [];
    const winnerBid = responses.find((r: any) => r.vendorName === winner);

    const prompt = `Generate a formal 2-3 paragraph procurement award justification:

RFx: ${event.title} (${event.type})
Winner: ${winner}
${winnerBid?.totalScore ? `Score: ${winnerBid.totalScore}` : ''}
${winnerBid?.commercialResponse?.totalPrice ? `Price: $${winnerBid.commercialResponse.totalPrice}` : ''}
${winnerBid?.strengths ? `Strengths: ${winnerBid.strengths.join(', ')}` : ''}

Total bidders: ${responses.length}

Generate a professional justification suitable for procurement records.`;

    const response = await openai.chat.completions.create({
      model: process.env.RFX_AI_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
    });

    return response.choices[0]?.message?.content || `Award to ${winner} based on best-value evaluation.`;
  } catch (err) {
    logger.warn('[RFx] AI award justification failed, using fallback', { error: String(err) });
    return `Award to ${winner} based on evaluation scoring. Formal justification pending.`;
  }
}

async function generateNegotiationStrategy(
  vendorName: string,
  currentBid: number,
  targetPrice: number,
  requirements: any[]
) {
  try {
    const OpenAI = (await import('openai')).default;
    const openai = createOpenAIClient();

    const gap = ((1 - targetPrice / currentBid) * 100).toFixed(1);

    const prompt = `As a negotiation expert, provide strategy for this procurement negotiation:

Vendor: ${vendorName}
Current Bid: $${currentBid.toLocaleString()}
Target Price: $${targetPrice.toLocaleString()}
Gap: ${gap}%

Key Requirements:
${requirements.slice(0, 10).map((r: any) => `- ${r.title}`).join('\n')}

Provide as JSON:
{
  "openingPosition": "...",
  "keyLevers": ["..."],
  "concessionStrategy": "...",
  "walkAwayPrice": ${Math.round(targetPrice * 1.1)},
  "counterOffers": [{"amount": 0, "justification": "..."}],
  "estimatedSavings": ${currentBid - targetPrice},
  "suggestedTimeline": "..."
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o', // Full model for negotiation strategy
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    return JSON.parse(response.choices[0]?.message?.content || '{}');
  } catch (err) {
    logger.warn('[RFx] AI negotiation strategy failed, using fallback', { error: String(err) });
    return {
      openingPosition: `Open at $${targetPrice.toLocaleString()} with justification based on market rates`,
      keyLevers: ['Volume commitment', 'Multi-year deal', 'Early payment terms'],
      concessionStrategy: 'Start at target, concede in small increments with value-adds',
      walkAwayPrice: Math.round(targetPrice * 1.1),
      counterOffers: [{ amount: targetPrice, justification: 'Market rate benchmark' }],
      estimatedSavings: currentBid - targetPrice,
      suggestedTimeline: '2-3 rounds over 1-2 weeks',
    };
  }
}

// ============================================================================
// Workflow status helper
// ============================================================================

function getWorkflowStatus(event: any) {
  const stages = [
    { key: 'draft', label: 'Draft', icon: 'edit' },
    { key: 'published', label: 'Published', icon: 'send' },
    { key: 'open', label: 'Bids Open', icon: 'inbox' },
    { key: 'closed', label: 'Evaluation', icon: 'bar-chart' },
    { key: 'awarded', label: 'Awarded', icon: 'trophy' },
  ];

  const statusOrder = ['draft', 'published', 'open', 'closed', 'awarded'];
  const currentIdx = statusOrder.indexOf(event.status);

  return stages.map((stage, idx) => ({
    ...stage,
    status: idx < currentIdx ? 'completed' : idx === currentIdx ? 'current' : 'pending',
  }));
}
