import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';
import { createOpenAIClient, hasAIClientConfig } from '@/lib/openai-client';
import { aiObligationTrackerService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';
import {
  ObligationStatus,
  ObligationPriority,
  ObligationType,
  ObligationOwner,
  RecurrenceFrequency,
  Prisma,
} from '@prisma/client';

/** Fire-and-forget obligation.created emission (webhook + event log). */
function emitObligationCreated(
  tenantId: string,
  obligationId: string,
  payload: Record<string, unknown>,
): void {
  const fullPayload = { obligationId, ...payload };
  import('@/lib/webhook-triggers')
    .then(({ triggerObligationCreated }) =>
      triggerObligationCreated(tenantId, obligationId, payload),
    )
    .catch(() => {});
  import('@/lib/events/integration-events')
    .then(({ recordIntegrationEvent }) =>
      recordIntegrationEvent({
        tenantId,
        eventType: 'obligation.created',
        resourceId: obligationId,
        payload: fullPayload,
      }),
    )
    .catch(() => {});
}

const openai = createOpenAIClient();

// Type mappings for string to enum conversion
const statusMap: Record<string, ObligationStatus> = {
  pending: 'PENDING',
  in_progress: 'IN_PROGRESS',
  completed: 'COMPLETED',
  overdue: 'OVERDUE',
  at_risk: 'AT_RISK',
  waived: 'WAIVED',
  cancelled: 'CANCELLED',
  disputed: 'DISPUTED',
};

const priorityMap: Record<string, ObligationPriority> = {
  critical: 'CRITICAL',
  high: 'HIGH',
  medium: 'MEDIUM',
  low: 'LOW',
};

const typeMap: Record<string, ObligationType> = {
  payment: 'PAYMENT',
  delivery: 'DELIVERY',
  performance: 'PERFORMANCE',
  reporting: 'REPORTING',
  compliance: 'COMPLIANCE',
  notification: 'NOTIFICATION',
  renewal: 'RENEWAL',
  termination: 'TERMINATION',
  audit: 'AUDIT',
  insurance: 'INSURANCE',
  milestone: 'MILESTONE',
  warranty: 'WARRANTY',
  confidentiality: 'CONFIDENTIALITY',
  indemnification: 'INDEMNIFICATION',
  service_level: 'SERVICE_LEVEL',
  other: 'OTHER',
};

const ownerMap: Record<string, ObligationOwner> = {
  us: 'US',
  counterparty: 'COUNTERPARTY',
  both: 'BOTH',
  third_party: 'THIRD_PARTY',
};

const recurrenceMap: Record<string, RecurrenceFrequency> = {
  once: 'ONCE',
  daily: 'DAILY',
  weekly: 'WEEKLY',
  biweekly: 'BIWEEKLY',
  monthly: 'MONTHLY',
  quarterly: 'QUARTERLY',
  semiannually: 'SEMIANNUALLY',
  annually: 'ANNUALLY',
};

/**
 * GET /api/obligations/v2
 * Retrieve obligations from the dedicated database table
 */
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const { searchParams } = new URL(request.url);
  const contractId = searchParams.get('contractId');
  const status = searchParams.get('status');
  const type = searchParams.get('type');
  const owner = searchParams.get('owner');
  const priority = searchParams.get('priority');
  const dueBefore = searchParams.get('dueBefore');
  const dueAfter = searchParams.get('dueAfter');
  const assignedTo = searchParams.get('assignedTo');
  const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
  const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50') || 50), 200);
  const sortBy = searchParams.get('sortBy') || 'dueDate';
  const sortOrder = searchParams.get('sortOrder') || 'asc';

  // Build where clause
  const where: Prisma.ObligationWhereInput = {
    tenantId: ctx.tenantId,
    ...(contractId && { contractId }),
    ...(status && { status: statusMap[status] || status as ObligationStatus }),
    ...(type && { type: typeMap[type] || type as ObligationType }),
    ...(owner && { owner: ownerMap[owner] || owner as ObligationOwner }),
    ...(priority && { priority: priorityMap[priority] || priority as ObligationPriority }),
    ...(assignedTo && { assignedToUserId: assignedTo }),
    ...(dueBefore || dueAfter ? {
      dueDate: {
        ...(dueBefore && { lte: new Date(dueBefore) }),
        ...(dueAfter && { gte: new Date(dueAfter) }),
      },
    } : {}),
  };

  // Build order by
  const orderBy: Prisma.ObligationOrderByWithRelationInput = {
    [sortBy]: sortOrder,
  };

  // Get total count
  const total = await prisma.obligation.count({ where });

  // Get obligations with pagination
  const obligations = await prisma.obligation.findMany({
    where,
    orderBy,
    skip: (page - 1) * limit,
    take: limit,
    include: {
      contract: {
        select: {
          id: true,
          contractTitle: true,
          supplier: { select: { name: true } },
          client: { select: { name: true } },
        },
      },
      assignedToUser: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  // Transform for frontend compatibility
  const transformedObligations = obligations.map((obl) => ({
    id: obl.id,
    title: obl.title,
    description: obl.description,
    type: obl.type.toLowerCase(),
    status: obl.status.toLowerCase().replace('_', '_'),
    priority: obl.priority.toLowerCase(),
    owner: obl.owner.toLowerCase(),
    dueDate: obl.dueDate?.toISOString(),
    startDate: obl.startDate?.toISOString(),
    endDate: obl.endDate?.toISOString(),
    completedAt: obl.completedAt?.toISOString(),
    completedBy: obl.completedBy,
    contractId: obl.contractId,
    contractTitle: obl.contract?.contractTitle || 'Untitled Contract',
    vendorName: obl.contract?.supplier?.name || obl.contract?.client?.name,
    clauseReference: obl.clauseReference,
    sourceSection: obl.sourceSection,
    sourceExcerpt: obl.sourceExcerpt,
    riskScore: obl.riskScore,
    riskFactors: obl.riskFactors,
    financialImpact: obl.financialImpact?.toString(),
    currency: obl.currency,
    isRecurring: obl.isRecurring,
    recurrenceFrequency: obl.recurrenceFrequency?.toLowerCase(),
    assignedTo: obl.assignedToUser ? {
      id: obl.assignedToUser.id,
      name: `${obl.assignedToUser.firstName || ''} ${obl.assignedToUser.lastName || ''}`.trim() || obl.assignedToUser.email,
      email: obl.assignedToUser.email,
    } : null,
    reminderDays: obl.reminderDays,
    requiredEvidence: obl.requiredEvidence,
    attachedEvidence: obl.attachedEvidence,
    completionCriteria: obl.completionCriteria,
    completionNotes: obl.completionNotes,
    tags: obl.tags,
    customFields: obl.customFields,
    createdAt: obl.createdAt.toISOString(),
    updatedAt: obl.updatedAt.toISOString(),
  }));

  // Calculate metrics
  const now = new Date();
  const allObligations = await prisma.obligation.findMany({
    where: { tenantId: ctx.tenantId },
    select: { status: true, priority: true, type: true, owner: true, dueDate: true },
  });

  const metrics = {
    total: allObligations.length,
    byStatus: {
      pending: allObligations.filter((o) => o.status === 'PENDING').length,
      in_progress: allObligations.filter((o) => o.status === 'IN_PROGRESS').length,
      completed: allObligations.filter((o) => o.status === 'COMPLETED').length,
      overdue: allObligations.filter((o) => 
        o.status === 'OVERDUE' || 
        (!['COMPLETED', 'WAIVED', 'CANCELLED'].includes(o.status) && o.dueDate && o.dueDate < now)
      ).length,
      at_risk: allObligations.filter((o) => o.status === 'AT_RISK').length,
      waived: allObligations.filter((o) => o.status === 'WAIVED').length,
      cancelled: allObligations.filter((o) => o.status === 'CANCELLED').length,
    },
    byPriority: {
      critical: allObligations.filter((o) => o.priority === 'CRITICAL').length,
      high: allObligations.filter((o) => o.priority === 'HIGH').length,
      medium: allObligations.filter((o) => o.priority === 'MEDIUM').length,
      low: allObligations.filter((o) => o.priority === 'LOW').length,
    },
    byType: {} as Record<string, number>,
    byOwner: {
      us: allObligations.filter((o) => o.owner === 'US').length,
      counterparty: allObligations.filter((o) => o.owner === 'COUNTERPARTY').length,
      both: allObligations.filter((o) => o.owner === 'BOTH').length,
    },
  };

  // Calculate byType
  allObligations.forEach((o) => {
    const typeLower = o.type.toLowerCase();
    metrics.byType[typeLower] = (metrics.byType[typeLower] || 0) + 1;
  });

  return createSuccessResponse(ctx, {
    obligations: transformedObligations,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    metrics,
  });
});

/**
 * POST /api/obligations/v2
 * Create obligation or extract from contract
 */
export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const body = await request.json();
  const { action, contractId, obligation, extractionOptions } = body;

  if (action === 'extract') {
    return handleExtraction(contractId, ctx.tenantId, ctx.userId, extractionOptions, ctx);
  }

  if (action === 'create' || !action) {
    return handleCreate(obligation, contractId, ctx.tenantId, ctx.userId, ctx);
  }

  if (action === 'bulk_create') {
    return handleBulkCreate(body.obligations, ctx.tenantId, ctx.userId, ctx);
  }

  return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid action', 400);
});

/**
 * Handle creating a single obligation
 */
async function handleCreate(
  obligation: Record<string, unknown>,
  contractId: string,
  tenantId: string,
  userId: string,
  ctx: any
) {
  if (!obligation || !contractId) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'obligation and contractId are required', 400);
  }

  // Verify contract exists
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId },
  });

  if (!contract) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
  }

  // Create obligation in database
  const newObligation = await prisma.obligation.create({
    data: {
      tenantId,
      contractId,
      title: obligation.title as string,
      description: obligation.description as string || null,
      type: typeMap[obligation.type as string] || 'OTHER',
      owner: ownerMap[obligation.owner as string] || 'US',
      priority: priorityMap[obligation.priority as string] || 'MEDIUM',
      status: statusMap[obligation.status as string] || 'PENDING',
      dueDate: obligation.dueDate ? new Date(obligation.dueDate as string) : null,
      startDate: obligation.startDate ? new Date(obligation.startDate as string) : null,
      endDate: obligation.endDate ? new Date(obligation.endDate as string) : null,
      clauseReference: obligation.clauseReference as string || null,
      sourceSection: obligation.sourceSection as string || null,
      sourceExcerpt: obligation.sourceExcerpt as string || null,
      extractionMethod: 'MANUAL',
      riskScore: obligation.riskScore as number || 50,
      riskFactors: obligation.riskFactors as string[] || [],
      penaltyForMissing: obligation.penaltyForMissing as string || null,
      financialImpact: obligation.financialImpact ? new Prisma.Decimal(obligation.financialImpact as number) : null,
      currency: obligation.currency as string || null,
      completionCriteria: obligation.completionCriteria as string || null,
      requiredEvidence: obligation.requiredEvidence as string[] || [],
      reminderDays: obligation.reminderDays as number[] || [14, 7, 1],
      isRecurring: obligation.isRecurring as boolean || false,
      recurrenceFrequency: obligation.recurrenceFrequency 
        ? recurrenceMap[obligation.recurrenceFrequency as string] || null 
        : null,
      assignedToUserId: obligation.assignedToUserId as string || null,
      tags: obligation.tags as string[] || [],
      customFields: obligation.customFields as object || {},
      createdBy: userId,
    },
    include: {
      contract: {
        select: { contractTitle: true },
      },
    },
  });

  // Create history entry
  await prisma.obligationHistory.create({
    data: {
      obligationId: newObligation.id,
      action: 'CREATED',
      description: 'Obligation created manually',
      performedBy: userId,
    },
  });

  emitObligationCreated(tenantId, newObligation.id, {
    contractId: newObligation.contractId,
    title: newObligation.title,
    type: newObligation.type,
    priority: newObligation.priority,
    dueDate: newObligation.dueDate,
    extractionMethod: 'MANUAL',
  });

  return createSuccessResponse(ctx, {
    obligation: {
      ...newObligation,
      type: newObligation.type.toLowerCase(),
      status: newObligation.status.toLowerCase(),
      priority: newObligation.priority.toLowerCase(),
      owner: newObligation.owner.toLowerCase(),
    },
  });
}

/**
 * Handle bulk creating obligations
 */
async function handleBulkCreate(
  obligations: Record<string, unknown>[],
  tenantId: string,
  userId: string,
  ctx: any
) {
  if (!obligations || !Array.isArray(obligations) || obligations.length === 0) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'obligations array is required', 400);
  }

  const created: any[] = [];
  const errors: any[] = [];

  for (const obl of obligations) {
    try {
      const newObligation = await prisma.obligation.create({
        data: {
          tenantId,
          contractId: obl.contractId as string,
          title: obl.title as string,
          description: obl.description as string || null,
          type: typeMap[obl.type as string] || 'OTHER',
          owner: ownerMap[obl.owner as string] || 'US',
          priority: priorityMap[obl.priority as string] || 'MEDIUM',
          status: 'PENDING',
          dueDate: obl.dueDate ? new Date(obl.dueDate as string) : null,
          clauseReference: obl.clauseReference as string || null,
          sourceExcerpt: obl.sourceExcerpt as string || null,
          extractionMethod: obl.extractionMethod as string || 'AI',
          extractionConfidence: obl.extractionConfidence as number || null,
          riskScore: obl.riskScore as number || 50,
          riskFactors: obl.riskFactors as string[] || [],
          reminderDays: obl.reminderDays as number[] || [14, 7, 1],
          createdBy: userId,
        },
      });

      await prisma.obligationHistory.create({
        data: {
          obligationId: newObligation.id,
          action: 'CREATED',
          description: 'Obligation created via bulk operation',
          performedBy: userId,
        },
      });

      emitObligationCreated(tenantId, newObligation.id, {
        contractId: newObligation.contractId,
        title: newObligation.title,
        type: newObligation.type,
        priority: newObligation.priority,
        dueDate: newObligation.dueDate,
        extractionMethod: newObligation.extractionMethod,
      });

      created.push(newObligation);
    } catch (err) {
      errors.push({ obligation: obl.title, error: (err as Error).message });
    }
  }

  return createSuccessResponse(ctx, {
    created: created.length,
    errors: errors.length > 0 ? errors : undefined,
    message: `Created ${created.length} obligations${errors.length > 0 ? `, ${errors.length} failed` : ''}`,
  });
}

/**
 * Handle AI extraction of obligations from contract
 */
async function handleExtraction(
  contractId: string,
  tenantId: string,
  userId: string,
  options: Record<string, unknown> = {},
  ctx: any
) {
  if (!contractId) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'contractId is required for extraction', 400);
  }

  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId },
    select: {
      id: true,
      contractType: true,
      contractTitle: true,
      startDate: true,
      endDate: true,
      rawText: true,
      aiMetadata: true,
      clientName: true,
      supplierName: true,
    },
  });

  if (!contract) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
  }

  const contractText = contract.rawText || 
    ((contract.aiMetadata as Record<string, unknown>)?.fullText as string) || '';

  if (!contractText || contractText.length < 100) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'No contract text available for extraction', 400);
  }

  // Extract using AI
  const extractedObligations = await extractObligationsWithAI(
    contractText,
    {
      contractType: contract.contractType || undefined,
      startDate: contract.startDate || undefined,
      endDate: contract.endDate || undefined,
      parties: {
        us: contract.clientName || 'Company',
        counterparty: contract.supplierName || 'Vendor',
      },
      ...options,
    }
  );

  // Save to database
  const created: any[] = [];
  for (const obl of extractedObligations.obligations) {
    const newObligation = await prisma.obligation.create({
      data: {
        tenantId,
        contractId,
        title: obl.title,
        description: obl.description || null,
        type: typeMap[obl.type] || 'OTHER',
        owner: ownerMap[obl.owner] || 'US',
        priority: priorityMap[obl.priority] || 'MEDIUM',
        status: 'PENDING',
        dueDate: obl.dueDate ? new Date(obl.dueDate) : null,
        clauseReference: obl.sourceClause || null,
        sourceSection: obl.sourceSection || null,
        sourceExcerpt: obl.sourceClause || null,
        extractionMethod: 'AI',
        extractionConfidence: extractedObligations.confidence,
        riskScore: obl.riskScore || 50,
        riskFactors: obl.riskFactors || [],
        penaltyForMissing: obl.penaltyForMissing || null,
        requiredEvidence: obl.requiredEvidence || [],
        reminderDays: obl.reminderDays || [14, 7, 1],
        isRecurring: !!obl.recurrence,
        recurrenceFrequency: obl.recurrence?.frequency 
          ? recurrenceMap[obl.recurrence.frequency] || null 
          : null,
        recurrenceInterval: obl.recurrence?.interval || null,
        createdBy: userId,
      },
    });

    await prisma.obligationHistory.create({
      data: {
        obligationId: newObligation.id,
        action: 'CREATED',
        description: 'Obligation extracted from contract by AI',
        performedBy: userId,
        metadata: { confidence: extractedObligations.confidence },
      },
    });

    emitObligationCreated(tenantId, newObligation.id, {
      contractId: newObligation.contractId,
      title: newObligation.title,
      type: newObligation.type,
      priority: newObligation.priority,
      dueDate: newObligation.dueDate,
      extractionMethod: 'AI',
      extractionConfidence: extractedObligations.confidence,
    });

    created.push(newObligation);
  }

  return createSuccessResponse(ctx, {
    extraction: {
      obligations: created,
      summary: extractedObligations.summary,
      confidence: extractedObligations.confidence,
      warnings: extractedObligations.warnings,
    },
    message: `Extracted ${created.length} obligations`,
  });
}

/**
 * AI extraction helper
 */
async function extractObligationsWithAI(
  contractText: string,
  options: {
    contractType?: string;
    startDate?: Date | null;
    endDate?: Date | null;
    parties?: { us: string; counterparty: string };
  } = {}
): Promise<{
  obligations: Array<{
    title: string;
    description?: string;
    type: string;
    owner: string;
    priority: string;
    dueDate?: string;
    reminderDays?: number[];
    sourceClause?: string;
    sourceSection?: string;
    penaltyForMissing?: string;
    riskScore?: number;
    riskFactors?: string[];
    requiredEvidence?: string[];
    recurrence?: { frequency: string; interval: number };
  }>;
  summary: {
    total: number;
    byType: Record<string, number>;
    byOwner: Record<string, number>;
    byPriority: Record<string, number>;
  };
  confidence: number;
  warnings: string[];
}> {
  const prompt = `You are a legal AI assistant specialized in contract analysis. Extract all contractual obligations from the following contract text.

Contract Type: ${options.contractType || 'Unknown'}
Our Party: ${options.parties?.us || 'Company'}
Counterparty: ${options.parties?.counterparty || 'Vendor'}
Contract Start: ${options.startDate?.toISOString() || 'Not specified'}
Contract End: ${options.endDate?.toISOString() || 'Not specified'}

For each obligation, provide:
1. title: Brief title (max 100 chars)
2. description: Detailed description
3. type: One of: payment, delivery, performance, reporting, compliance, notification, renewal, termination, audit, insurance, milestone, warranty, confidentiality, indemnification, service_level, other
4. owner: Who is responsible - "us", "counterparty", or "both"
5. priority: critical, high, medium, or low based on business impact
6. dueDate: ISO date string if specific date mentioned, or null
7. reminderDays: Array of days before due date [14, 7, 1]
8. sourceClause: The exact text that defines this obligation (first 200 chars)
9. sourceSection: Section number/name if identifiable
10. penaltyForMissing: What happens if obligation is missed
11. riskScore: 0-100 based on business impact
12. riskFactors: Array of risk factor strings
13. requiredEvidence: What evidence is needed to prove completion
14. recurrence: If recurring, { frequency: "monthly"|"quarterly"|"annually", interval: number }

CONTRACT TEXT (truncated to 30000 chars):
${contractText.slice(0, 30000)}

Return a JSON object with:
{
  "obligations": [...],
  "summary": { "total": number, "byType": {...}, "byOwner": {...}, "byPriority": {...} },
  "confidence": number (0-1),
  "warnings": [...]
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: 'You are an expert legal analyst. Return only valid JSON.' },
      { role: 'user', content: prompt }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 8000
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from AI');
  }

  return JSON.parse(content);
}
