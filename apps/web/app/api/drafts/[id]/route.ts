/**
 * Contract Draft Detail API - Single draft operations
 * 
 * GET /api/drafts/[id] - Get a single draft
 * PATCH /api/drafts/[id] - Update a draft
 * DELETE /api/drafts/[id] - Delete a draft
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/auth';
import { getApiTenantId } from '@/lib/tenant-server';

export const dynamic = 'force-dynamic';

// GET /api/drafts/[id] - Get a single draft
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const tenantId = await getApiTenantId(request);
    const { id } = await params;

    const draft = await prisma.contractDraft.findFirst({
      where: { id, tenantId },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            category: true,
            clauses: true,
            structure: true,
          },
        },
        sourceContract: {
          select: {
            id: true,
            contractTitle: true,
            supplierName: true,
            clientName: true,
            totalValue: true,
            currency: true,
            startDate: true,
            endDate: true,
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

    if (!draft) {
      return NextResponse.json(
        { success: false, error: 'Draft not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { draft },
    });
  } catch (error) {
    console.error('Error fetching draft:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch draft' },
      { status: 500 }
    );
  }
}

// PATCH /api/drafts/[id] - Update a draft
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const tenantId = await getApiTenantId(request);
    const { id } = await params;
    const body = await request.json();

    // Check if draft exists and belongs to tenant
    const existing = await prisma.contractDraft.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Draft not found' },
        { status: 404 }
      );
    }

    // Check if draft is locked by another user
    if (existing.isLocked && existing.lockedBy !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Draft is locked by another user' },
        { status: 423 }
      );
    }

    const {
      title,
      content,
      clauses,
      variables,
      structure,
      status,
      estimatedValue,
      currency,
      proposedStartDate,
      proposedEndDate,
      externalParties,
      currentStep,
      completionPercent,
      isLocked,
    } = body;

    // Build update data
    const updateData: Record<string, unknown> = {};
    
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (clauses !== undefined) updateData.clauses = clauses;
    if (variables !== undefined) updateData.variables = variables;
    if (structure !== undefined) updateData.structure = structure;
    if (status !== undefined) updateData.status = status;
    if (estimatedValue !== undefined) {
      updateData.estimatedValue = estimatedValue ? parseFloat(estimatedValue) : null;
    }
    if (currency !== undefined) updateData.currency = currency;
    if (proposedStartDate !== undefined) {
      updateData.proposedStartDate = proposedStartDate ? new Date(proposedStartDate) : null;
    }
    if (proposedEndDate !== undefined) {
      updateData.proposedEndDate = proposedEndDate ? new Date(proposedEndDate) : null;
    }
    if (externalParties !== undefined) updateData.externalParties = externalParties;
    if (currentStep !== undefined) updateData.currentStep = currentStep;
    if (completionPercent !== undefined) updateData.completionPercent = completionPercent;
    
    // Handle locking
    if (isLocked !== undefined) {
      updateData.isLocked = isLocked;
      if (isLocked) {
        updateData.lockedBy = session.user.id;
        updateData.lockedAt = new Date();
      } else {
        updateData.lockedBy = null;
        updateData.lockedAt = null;
      }
    }

    // Increment version on content changes
    if (content !== undefined || clauses !== undefined) {
      updateData.version = existing.version + 1;
    }

    const draft = await prisma.contractDraft.update({
      where: { id },
      data: updateData,
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
    console.error('Error updating draft:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update draft' },
      { status: 500 }
    );
  }
}

// DELETE /api/drafts/[id] - Delete a draft
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const tenantId = await getApiTenantId(request);
    const { id } = await params;

    // Check if draft exists and belongs to tenant
    const existing = await prisma.contractDraft.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Draft not found' },
        { status: 404 }
      );
    }

    // Don't allow deleting finalized drafts
    if (existing.status === 'FINALIZED') {
      return NextResponse.json(
        { success: false, error: 'Cannot delete finalized drafts' },
        { status: 400 }
      );
    }

    await prisma.contractDraft.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Draft deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting draft:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete draft' },
      { status: 500 }
    );
  }
}
