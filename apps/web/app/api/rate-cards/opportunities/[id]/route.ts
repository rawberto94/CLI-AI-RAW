import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { SavingsOpportunityService } from 'data-orchestration/services';
import { getApiTenantId } from '@/lib/tenant-server';

// Using singleton prisma instance from @/lib/prisma

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const tenantId = getApiTenantId(request);
  
  if (!tenantId) {
    return NextResponse.json(
      { success: false, error: 'Tenant ID required' },
      { status: 400 }
    );
  }
  
  try {
    // Verify opportunity belongs to tenant
    const opportunity = await prisma.rateSavingsOpportunity.findFirst({
      where: { id: params.id, tenantId },
      include: {
        rateCard: true,
        targetRole: true,
      },
    });

    if (!opportunity) {
      return NextResponse.json(
        { success: false, error: 'Opportunity not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      opportunity,
    });
  } catch (error: any) {
    console.error('Error fetching opportunity details:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const tenantId = getApiTenantId(request);
  
  if (!tenantId) {
    return NextResponse.json(
      { success: false, error: 'Tenant ID required' },
      { status: 400 }
    );
  }
  
  try {
    // Verify opportunity belongs to tenant before updating
    const existing = await prisma.rateSavingsOpportunity.findFirst({
      where: { id: params.id, tenantId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Opportunity not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { status, notes, assignedTo, actualSavings } = body;

    const service = new SavingsOpportunityService(prisma);

    if (actualSavings !== undefined) {
      await service.trackRealizedSavings(existing.id, actualSavings);
    } else {
      await service.updateOpportunityStatus(existing.id, status, notes, assignedTo);
    }

    const updated = await service.getOpportunityDetails(existing.id);

    return NextResponse.json({
      success: true,
      opportunity: updated,
    });
  } catch (error: any) {
    console.error('Error updating opportunity:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const tenantId = getApiTenantId(request);
  
  if (!tenantId) {
    return NextResponse.json(
      { success: false, error: 'Tenant ID required' },
      { status: 400 }
    );
  }
  
  try {
    // Verify opportunity belongs to tenant before deleting
    const existing = await prisma.rateSavingsOpportunity.findFirst({
      where: { id: params.id, tenantId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Opportunity not found' },
        { status: 404 }
      );
    }

    await prisma.rateSavingsOpportunity.delete({
      where: { id: existing.id },
    });

    return NextResponse.json({
      success: true,
      message: 'Opportunity deleted',
    });
  } catch (error: any) {
    console.error('Error deleting opportunity:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
