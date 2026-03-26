/**
 * RFx Events API
 *
 * GET  /api/rfx           - List RFx events for tenant
 * POST /api/rfx           - Create RFx event with AI-enhanced requirements
 *
 * The POST flow:
 * 1. User provides baseline requirements (title, description, type, user requirements)
 * 2. AI (GPT-4o-mini) expands/refines those requirements into a comprehensive set
 * 3. AI generates evaluation criteria + suggests vendors
 * 4. Returns draft RFx for user to review/edit (HITL)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { createOpenAIClient, hasAIClientConfig } from '@/lib/openai-client';

export const dynamic = 'force-dynamic';

/** Feature flag — when false, RFx endpoints return 503 */
const RFX_ENABLED = process.env.RFX_AGENT_ENABLED !== 'false';

// ============================================================================
// SCHEMAS
// ============================================================================

const CreateRFxSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  type: z.enum(['RFP', 'RFQ', 'RFI', 'Auction', 'RFT']).default('RFP'),
  description: z.string().optional().default(''),
  category: z.string().optional(),
  contractType: z.string().optional(),
  estimatedValue: z.number().optional(),
  currency: z.string().default('USD'),
  deadline: z.string().optional(), // ISO date string
  // User-provided baseline requirements — AI will enhance these
  userRequirements: z.array(z.object({
    title: z.string(),
    description: z.string().optional(),
    category: z.string().optional(),
    priority: z.enum(['must-have', 'should-have', 'nice-to-have']).optional(),
  })).optional().default([]),
  // Standard requirement categories to include
  requirementCategories: z.array(z.enum(['technical', 'commercial', 'sla', 'security', 'legal', 'delivery', 'quality'])).optional().default([]),
  // Pre-selected vendor IDs
  vendors: z.array(z.string()).optional().default([]),
  // Whether to ask AI to enhance requirements
  aiEnhance: z.boolean().default(true),
  // Source opportunity (if created from Scout detection)
  sourceOpportunityId: z.string().optional(),
});

const ListRFxSchema = z.object({
  status: z.string().optional(),
  type: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

// ============================================================================
// GET — List RFx events
// ============================================================================

export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (!RFX_ENABLED) return createErrorResponse(ctx, 'SERVICE_UNAVAILABLE', 'RFx module is disabled', 503);
  const { searchParams } = new URL(request.url);
  const params = ListRFxSchema.parse({
    status: searchParams.get('status') || undefined,
    type: searchParams.get('type') || undefined,
    page: searchParams.get('page') || 1,
    limit: searchParams.get('limit') || 20,
  });

  const where: Record<string, unknown> = { tenantId: ctx.tenantId };
  if (params.status) where.status = params.status;
  if (params.type) where.type = params.type;

  const [events, total] = await Promise.all([
    prisma.rFxEvent.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (params.page - 1) * params.limit,
      take: params.limit,
    }),
    prisma.rFxEvent.count({ where }),
  ]);

  return createSuccessResponse(ctx, {
    events,
    total,
    page: params.page,
    limit: params.limit,
    hasMore: total > params.page * params.limit,
  });
});

// ============================================================================
// POST — Create RFx with AI-enhanced requirements
// ============================================================================

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (!RFX_ENABLED) return createErrorResponse(ctx, 'SERVICE_UNAVAILABLE', 'RFx module is disabled', 503);
  const body = await request.json();
  const input = CreateRFxSchema.parse(body);

  // Calculate response deadline
  const defaultDeadlineDays = parseInt(process.env.RFX_DEFAULT_DEADLINE_DAYS || '30', 10);
  const responseDeadline = input.deadline
    ? new Date(input.deadline)
    : new Date(Date.now() + defaultDeadlineDays * 24 * 60 * 60 * 1000);

  // ── AI Enhancement ──────────────────────────────────────────────────────
  let aiRequirements: Array<{
    title: string;
    description: string;
    category: string;
    priority: string;
    source: 'ai';
  }> = [];
  let evaluationCriteria: Array<{
    name: string;
    description: string;
    weight: number;
    scoringMethod: string;
  }> = [];
  let suggestedVendors: string[] = [];

  if (input.aiEnhance) {
    try {
      const aiResult = await generateAIEnhancedRequirements({
        title: input.title,
        type: input.type,
        description: input.description,
        category: input.category,
        contractType: input.contractType,
        estimatedValue: input.estimatedValue,
        userRequirements: input.userRequirements,
        requirementCategories: input.requirementCategories,
      });
      aiRequirements = aiResult.requirements;
      evaluationCriteria = aiResult.evaluationCriteria;
    } catch (err) {
      logger.warn('[RFx] AI enhancement failed, using user requirements only:', err);
    }
  }

  // Merge: user-provided baseline first, then AI-generated
  const userReqs = input.userRequirements.map((r) => ({
    ...r,
    source: 'user' as const,
    priority: r.priority || 'should-have',
    category: r.category || 'general',
    description: r.description || '',
  }));
  const mergedRequirements = [...userReqs, ...aiRequirements];

  // Default evaluation criteria if AI didn't produce any
  if (evaluationCriteria.length === 0) {
    evaluationCriteria = getDefaultEvaluationCriteria(input.type);
  }

  // Suggest vendors from existing contract data
  try {
    suggestedVendors = await suggestVendorsFromHistory(ctx.tenantId, input.category);
  } catch (err) {
    logger.warn('[RFx] Vendor suggestion from history failed', { tenantId: ctx.tenantId, error: String(err) });
  }
  const allVendors = [...new Set([...input.vendors, ...suggestedVendors])];

  // ── Persist ─────────────────────────────────────────────────────────────

  const rfxEvent = await prisma.rFxEvent.create({
    data: {
      tenantId: ctx.tenantId,
      title: input.title,
      description: input.description || null,
      type: input.type,
      status: 'draft',
      category: input.category || null,
      contractType: input.contractType || null,
      estimatedValue: input.estimatedValue || null,
      currency: input.currency,
      responseDeadline,
      requirements: mergedRequirements as any,
      evaluationCriteria: evaluationCriteria as any,
      invitedVendors: allVendors,
      createdBy: ctx.userId,
    },
  });

  // Link source opportunity if provided
  if (input.sourceOpportunityId) {
    await prisma.rFxOpportunity.update({
      where: { id: input.sourceOpportunityId },
      data: {
        status: 'IMPLEMENTED',
        rfxId: rfxEvent.id,
        convertedAt: new Date(),
      },
    }).catch(() => { /* opportunity may not exist — ok */ });
  }

  return createSuccessResponse(ctx, {
    rfxEvent,
    aiEnhanced: input.aiEnhance && aiRequirements.length > 0,
    requirementsSummary: {
      userProvided: userReqs.length,
      aiGenerated: aiRequirements.length,
      total: mergedRequirements.length,
    },
    suggestedVendors,
  }, { status: 201 });
});

// ============================================================================
// AI Requirement Enhancement
// ============================================================================

interface AIEnhancementInput {
  title: string;
  type: string;
  description: string;
  category?: string;
  contractType?: string;
  estimatedValue?: number;
  userRequirements: Array<{ title: string; description?: string; category?: string; priority?: string }>;
  requirementCategories: string[];
}

async function generateAIEnhancedRequirements(input: AIEnhancementInput) {
  const OpenAI = (await import('openai')).default;
  const openai = createOpenAIClient();

  const userReqText = input.userRequirements.length > 0
    ? `\n\nUser-provided baseline requirements:\n${input.userRequirements.map((r, i) => `${i + 1}. ${r.title}${r.description ? ': ' + r.description : ''} [${r.priority || 'should-have'}]`).join('\n')}`
    : '';

  const categoriesText = input.requirementCategories.length > 0
    ? `\nRequirement categories to cover: ${input.requirementCategories.join(', ')}`
    : '';

  const prompt = `You are an expert procurement specialist. Generate comprehensive requirements for this ${input.type}:

Title: ${input.title}
Type: ${input.type}
${input.description ? `Description: ${input.description}` : ''}
${input.category ? `Category: ${input.category}` : ''}
${input.contractType ? `Contract Type: ${input.contractType}` : ''}
${input.estimatedValue ? `Estimated Value: $${input.estimatedValue.toLocaleString()}` : ''}
${userReqText}
${categoriesText}

IMPORTANT: The user has provided baseline requirements above. Your job is to:
1. Keep ALL user-provided requirements as-is (they represent the user's core needs)
2. Add ADDITIONAL requirements that complement and strengthen the user's baseline
3. Cover any gaps in: technical specs, commercial terms, legal/compliance, delivery/timeline, quality/SLA, security
4. For each category the user flagged, ensure thorough coverage

Generate 6-10 ADDITIONAL requirements (beyond what the user already provided) as JSON:
{
  "requirements": [
    {
      "title": "Requirement title",
      "description": "Detailed description of the requirement",
      "category": "technical|commercial|legal|delivery|quality|security|sla",
      "priority": "must-have|should-have|nice-to-have"
    }
  ],
  "evaluationCriteria": [
    {
      "name": "Criterion name",
      "description": "How this will be evaluated",
      "weight": 0.25,
      "scoringMethod": "numeric|pass-fail|ranking"
    }
  ]
}

Ensure weights sum to 1.0. Be specific and actionable.`;

  const response = await openai.chat.completions.create({
    model: process.env.RFX_AI_MODEL || 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.4,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('Empty AI response');

  const parsed = JSON.parse(content);

  return {
    requirements: (parsed.requirements || []).map((r: any) => ({
      title: r.title || 'Untitled',
      description: r.description || '',
      category: r.category || 'general',
      priority: r.priority || 'should-have',
      source: 'ai' as const,
    })),
    evaluationCriteria: (parsed.evaluationCriteria || []).map((c: any) => ({
      name: c.name || 'Unnamed',
      description: c.description || '',
      weight: typeof c.weight === 'number' ? c.weight : 0.2,
      scoringMethod: c.scoringMethod || 'numeric',
    })),
  };
}

// ============================================================================
// Default evaluation criteria by RFx type
// ============================================================================

function getDefaultEvaluationCriteria(type: string) {
  const base = [
    { name: 'Technical Capability', description: 'Meets technical requirements', weight: 0.3, scoringMethod: 'numeric' },
    { name: 'Pricing', description: 'Cost competitiveness', weight: 0.25, scoringMethod: 'numeric' },
    { name: 'Experience & References', description: 'Relevant experience and track record', weight: 0.2, scoringMethod: 'numeric' },
    { name: 'Compliance', description: 'Regulatory and security compliance', weight: 0.15, scoringMethod: 'pass-fail' },
    { name: 'Timeline', description: 'Ability to meet delivery schedule', weight: 0.1, scoringMethod: 'numeric' },
  ];

  if (type === 'RFQ') {
    return [
      { name: 'Unit Price', description: 'Price per unit or service', weight: 0.4, scoringMethod: 'numeric' },
      { name: 'Delivery Time', description: 'Speed of delivery', weight: 0.25, scoringMethod: 'numeric' },
      { name: 'Quality Standards', description: 'Meets quality requirements', weight: 0.2, scoringMethod: 'pass-fail' },
      { name: 'Payment Terms', description: 'Favorable payment conditions', weight: 0.15, scoringMethod: 'numeric' },
    ];
  }

  return base;
}

// ============================================================================
// Vendor suggestion from history
// ============================================================================

async function suggestVendorsFromHistory(tenantId: string, category?: string): Promise<string[]> {
  // Find vendors with good track records from completed contracts
  const contracts = await prisma.contract.findMany({
    where: {
      tenantId,
      status: 'COMPLETED',
      ...(category ? { category } : {}),
    },
    select: { supplierName: true },
    distinct: ['supplierName'],
    take: 10,
  });

  return contracts.map((c) => c.supplierName).filter((s): s is string => Boolean(s));
}
