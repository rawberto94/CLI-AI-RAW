import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';
import { aiObligationTrackerService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * GET /api/obligations
 * Retrieve obligations for a tenant with filtering
 */
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (!session?.user?.tenantId) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
  }

  const { searchParams } = new URL(request.url);
  const contractId = searchParams.get('contractId');
  const status = searchParams.get('status');
  const type = searchParams.get('type');
  const owner = searchParams.get('owner');
  const priority = searchParams.get('priority');
  const dueBefore = searchParams.get('dueBefore');
  const dueAfter = searchParams.get('dueAfter');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');

  // Query contracts with their metadata (which contains obligations)
  const contracts = await prisma.contract.findMany({
    where: {
      tenantId: session.user.tenantId,
      ...(contractId && { id: contractId }),
    },
    select: {
      id: true,
      contractTitle: true,
      metadata: true,
      supplier: { select: { name: true } },
      client: { select: { name: true } },
    },
  });

  // Extract and filter obligations from contract metadata
  const allObligations: Array<{
    id: string;
    contractId: string;
    contractTitle: string;
    vendorName?: string;
    [key: string]: unknown;
  }> = [];

  contracts.forEach((contract) => {
    const meta = contract.metadata as Record<string, unknown> | null;
    const obligations = (meta?.obligations as unknown[]) || [];

    obligations.forEach((obligation: unknown) => {
      const obl = obligation as Record<string, unknown>;

      // Apply filters
      if (status && obl.status !== status) return;
      if (type && obl.type !== type) return;
      if (owner && obl.owner !== owner) return;
      if (priority && obl.priority !== priority) return;
      if (dueBefore && new Date(obl.dueDate as string) > new Date(dueBefore)) return;
      if (dueAfter && new Date(obl.dueDate as string) < new Date(dueAfter)) return;

      allObligations.push({
        ...obl,
        id: obl.id as string,
        contractId: contract.id,
        contractTitle: contract.contractTitle || 'Untitled Contract',
        vendorName: contract.supplier?.name || contract.client?.name,
      });
    });
  });

  // Sort by due date
  allObligations.sort((a, b) => {
    const dateA = new Date(a.dueDate as string);
    const dateB = new Date(b.dueDate as string);
    return dateA.getTime() - dateB.getTime();
  });

  // Paginate
  const start = (page - 1) * limit;
  const paginatedObligations = allObligations.slice(start, start + limit);

  // Calculate metrics
  const now = new Date();
  const metrics = {
    total: allObligations.length,
    byStatus: {
      pending: allObligations.filter((o) => o.status === 'pending').length,
      in_progress: allObligations.filter((o) => o.status === 'in_progress').length,
      completed: allObligations.filter((o) => o.status === 'completed').length,
      overdue: allObligations.filter((o) => o.status === 'overdue' || 
        (o.status !== 'completed' && new Date(o.dueDate as string) < now)).length,
      at_risk: allObligations.filter((o) => o.status === 'at_risk').length,
    },
    byPriority: {
      critical: allObligations.filter((o) => o.priority === 'critical').length,
      high: allObligations.filter((o) => o.priority === 'high').length,
      medium: allObligations.filter((o) => o.priority === 'medium').length,
      low: allObligations.filter((o) => o.priority === 'low').length,
    },
  };

  return createSuccessResponse(ctx, {
    obligations: paginatedObligations,
    pagination: {
      page,
      limit,
      total: allObligations.length,
      totalPages: Math.ceil(allObligations.length / limit),
    },
    metrics,
  });
});

/**
 * POST /api/obligations
 * Extract obligations from a contract or create manually
 */
export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (!session?.user?.tenantId) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
  }

  const body = await request.json();
  const { action, contractId, obligation, extractionOptions } = body;

  if (action === 'extract') {
    // Extract obligations from contract
    if (!contractId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'contractId is required for extraction', 400);
    }

    const contract = await prisma.contract.findFirst({
      where: {
        id: contractId,
        tenantId: session.user.tenantId,
      },
      select: {
        id: true,
        contractType: true,
        startDate: true,
        endDate: true,
        rawText: true,
        metadata: true,
        aiMetadata: true,
        clientName: true,
        supplierName: true,
      },
    });

    if (!contract) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
    }

    // Get contract text from rawText or aiMetadata
    const contractText = contract.rawText || 
      ((contract.aiMetadata as Record<string, unknown>)?.fullText as string) || '';

    if (!contractText || contractText.length < 100) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'No contract text available for extraction. Please upload or extract the contract text first.', 400);
    }

    // Extract obligations using AI
    const result = await extractObligationsWithAI(
      contractId,
      contractText,
      session.user.tenantId,
      {
        contractType: contract.contractType || undefined,
        startDate: contract.startDate || undefined,
        endDate: contract.endDate || undefined,
        parties: {
          us: contract.clientName || 'Company',
          counterparty: contract.supplierName || 'Vendor',
        },
        ...extractionOptions,
      }
    );

    // Save obligations to contract metadata
    const currentMeta = (contract.metadata as Record<string, unknown>) || {};
    await prisma.contract.update({
      where: { id: contractId },
      data: {
        metadata: JSON.parse(JSON.stringify({
          ...currentMeta,
          obligations: result.obligations,
          obligationsExtractedAt: new Date().toISOString(),
        })),
        updatedAt: new Date(),
      },
    });

    return createSuccessResponse(ctx, {
      success: true,
      extraction: result,
      message: `Extracted ${result.obligations.length} obligations`,
    });
  } else if (action === 'create') {
    // Create manual obligation
    if (!obligation || !contractId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'obligation and contractId are required', 400);
    }

    const contract = await prisma.contract.findFirst({
      where: {
        id: contractId,
        tenantId: session.user.tenantId,
      },
      select: {
        id: true,
        metadata: true,
      },
    });

    if (!contract) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
    }

    const now = new Date();
    const newObligation = {
      ...obligation,
      id: crypto.randomUUID(),
      tenantId: session.user.tenantId,
      contractId,
      status: obligation.status || 'pending',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      createdBy: session.user.id,
      history: [{
        id: crypto.randomUUID(),
        action: 'created',
        description: 'Obligation created manually',
        performedBy: session.user.id,
        performedAt: now.toISOString(),
      }],
    };

    // Add to contract metadata
    const currentMeta = (contract.metadata as Record<string, unknown>) || {};
    const existingObligations = (currentMeta.obligations as unknown[]) || [];

    await prisma.contract.update({
      where: { id: contractId },
      data: {
        metadata: JSON.parse(JSON.stringify({
          ...currentMeta,
          obligations: [...existingObligations, newObligation],
        })),
        updatedAt: now,
      },
    });

    return createSuccessResponse(ctx, {
      success: true,
      obligation: newObligation,
    });
  }

  return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid action. Use "extract" or "create"', 400);
});

// Helper function to extract obligations using AI
async function extractObligationsWithAI(
  contractId: string,
  contractText: string,
  tenantId: string,
  options: {
    contractType?: string;
    startDate?: Date | null;
    endDate?: Date | null;
    parties?: { us: string; counterparty: string };
  } = {}
): Promise<{
  obligations: Array<Record<string, unknown>>;
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
3. type: One of: payment, delivery, performance, reporting, compliance, notification, renewal, termination, audit, insurance, milestone, other
4. owner: Who is responsible - "us", "counterparty", or "both"
5. priority: critical, high, medium, or low based on business impact
6. dueDate: ISO date string (if specific date) or null. Calculate based on contract dates if relative.
7. reminderDays: Array of days before due date to send reminders, e.g., [14, 7, 1]
8. sourceClause: The exact text that defines this obligation (first 200 chars)
9. sourceSection: Section number/name if identifiable
10. penaltyForMissing: What happens if obligation is missed (if specified)
11. riskFactors: Array of risk factors
12. requiredEvidence: What evidence is needed to prove completion
13. recurrence: If recurring, specify { frequency: "monthly"|"quarterly"|"annually", interval: number }

CONTRACT TEXT (truncated to 30000 chars):
${contractText.slice(0, 30000)}

Return a JSON object with:
{
  "obligations": [...],
  "summary": { "total": number, "byType": {...}, "byOwner": {...}, "byPriority": {...} },
  "confidence": number (0-1),
  "warnings": [...any issues or ambiguities found...]
}`;

  try {
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

    const result = JSON.parse(content);

    // Add IDs and metadata to each obligation
    const processedObligations = (result.obligations || []).map((obl: Record<string, unknown>) => ({
      ...obl,
      id: crypto.randomUUID(),
      tenantId,
      contractId,
      status: 'pending',
      riskScore: calculateRiskScore(obl),
      dependencies: [],
      blockedBy: [],
      attachedEvidence: [],
      tags: [],
      customFields: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      history: [{
        id: crypto.randomUUID(),
        action: 'created',
        description: 'Obligation extracted from contract by AI',
        performedAt: new Date().toISOString(),
      }],
    }));

    return {
      obligations: processedObligations,
      summary: result.summary || {
        total: processedObligations.length,
        byType: {},
        byOwner: {},
        byPriority: {},
      },
      confidence: result.confidence || 0.8,
      warnings: result.warnings || [],
    };
  } catch (error) {
    console.error('AI extraction failed:', error);
    throw error;
  }
}

function calculateRiskScore(obligation: Record<string, unknown>): number {
  let score = 50;

  switch (obligation.priority) {
    case 'critical': score += 30; break;
    case 'high': score += 20; break;
    case 'medium': score += 10; break;
  }

  if (['payment', 'compliance', 'termination'].includes(obligation.type as string)) {
    score += 10;
  }

  if (obligation.owner === 'us') {
    score += 5;
  }

  if (obligation.penaltyForMissing) {
    score += 15;
  }

  const riskFactors = (obligation.riskFactors as string[]) || [];
  score += riskFactors.length * 5;

  return Math.min(100, Math.max(0, score));
}
