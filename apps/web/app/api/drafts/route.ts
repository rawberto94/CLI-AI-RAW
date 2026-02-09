/**
 * Contract Drafts API - CRUD operations for contract generation drafts
 * 
 * GET /api/drafts - List all drafts for tenant
 * POST /api/drafts - Create a new draft
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';
import { contractService } from 'data-orchestration/services';
export const dynamic = 'force-dynamic';

// GET /api/drafts - List all drafts
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (!session?.user?.id) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
  }

  const tenantId = await ctx.tenantId;
  const { searchParams } = new URL(request.url);

  const status = searchParams.get('status');
  const type = searchParams.get('type');
  const sourceType = searchParams.get('sourceType');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');
  const sortBy = searchParams.get('sortBy') || 'updatedAt';
  const sortOrder = searchParams.get('sortOrder') || 'desc';

  // Build where clause
  const where: Record<string, unknown> = { tenantId };

  if (status) {
    where.status = status;
  }
  if (type) {
    where.type = type;
  }
  if (sourceType) {
    where.sourceType = sourceType;
  }

  // Get drafts
  const drafts = await prisma.contractDraft.findMany({
    where,
    orderBy: { [sortBy]: sortOrder },
    take: limit,
    skip: offset,
    include: {
      template: {
        select: {
          id: true,
          name: true,
          category: true,
        },
      },
      sourceContract: {
        select: {
          id: true,
          contractTitle: true,
          supplierName: true,
        },
      },
      createdByUser: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  const total = await prisma.contractDraft.count({ where });

  // Calculate metrics
  const metrics = await prisma.contractDraft.groupBy({
    by: ['status'],
    where: { tenantId },
    _count: { id: true },
  });

  const statusCounts = metrics.reduce((acc, m) => {
    acc[m.status] = m._count.id;
    return acc;
  }, {} as Record<string, number>);

  return createSuccessResponse(ctx, {
    success: true,
    data: {
      drafts,
      total,
      limit,
      offset,
      metrics: {
        total,
        draft: statusCounts['DRAFT'] || 0,
        inReview: statusCounts['IN_REVIEW'] || 0,
        pendingApproval: statusCounts['PENDING_APPROVAL'] || 0,
        approved: statusCounts['APPROVED'] || 0,
        finalized: statusCounts['FINALIZED'] || 0,
      },
    },
  });
});

// POST /api/drafts - Create a new draft
export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (!session?.user?.id) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
  }

  const tenantId = await ctx.tenantId;
  const body = await request.json();

  const {
    title,
    type = 'MSA',
    sourceType = 'NEW',
    templateId,
    sourceContractId,
    content,
    clauses = [],
    variables = {},
    structure = {},
    estimatedValue,
    currency = 'USD',
    proposedStartDate,
    proposedEndDate,
    externalParties = [],
    aiPrompt,
    aiModel,
    generationParams = {},
  } = body;

  if (!title) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Title is required', 400);
  }

  const draft = await prisma.contractDraft.create({
    data: {
      tenantId,
      title,
      type,
      sourceType,
      templateId: templateId || null,
      sourceContractId: sourceContractId || null,
      content,
      clauses,
      variables,
      structure,
      estimatedValue: estimatedValue ? parseFloat(estimatedValue) : null,
      currency,
      proposedStartDate: proposedStartDate ? new Date(proposedStartDate) : null,
      proposedEndDate: proposedEndDate ? new Date(proposedEndDate) : null,
      externalParties,
      aiPrompt,
      aiModel,
      generationParams,
      createdBy: session.user.id,
      status: 'DRAFT',
      version: 1,
    },
    include: {
      template: {
        select: {
          id: true,
          name: true,
          category: true,
        },
      },
      createdByUser: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  return createSuccessResponse(ctx, {
    success: true,
    data: { draft },
  });
});
