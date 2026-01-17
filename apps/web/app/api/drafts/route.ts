/**
 * Contract Drafts API - CRUD operations for contract generation drafts
 * 
 * GET /api/drafts - List all drafts for tenant
 * POST /api/drafts - Create a new draft
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/auth';
import { getApiTenantId } from '@/lib/tenant-server';

export const dynamic = 'force-dynamic';

// GET /api/drafts - List all drafts
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const tenantId = await getApiTenantId(request);
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

    return NextResponse.json({
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
  } catch (error) {
    console.error('Error fetching drafts:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch drafts' },
      { status: 500 }
    );
  }
}

// POST /api/drafts - Create a new draft
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const tenantId = await getApiTenantId(request);
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
      return NextResponse.json(
        { success: false, error: 'Title is required' },
        { status: 400 }
      );
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

    return NextResponse.json({
      success: true,
      data: { draft },
    });
  } catch (error) {
    console.error('Error creating draft:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create draft' },
      { status: 500 }
    );
  }
}
