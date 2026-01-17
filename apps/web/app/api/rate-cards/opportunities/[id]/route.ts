import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { getApiTenantId } from '@/lib/tenant-server';

// Using singleton prisma instance from @/lib/prisma

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const tenantId = await getApiTenantId(request);
  
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
        rateCardEntry: true,
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
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const tenantId = await getApiTenantId(request);
  
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

    // Build update data
    const updateData: any = {};
    if (status) updateData.status = status;
    if (notes) updateData.recommendedAction = notes;
    if (assignedTo) updateData.assignedTo = assignedTo;
    if (actualSavings !== undefined) {
      updateData.actualSavingsRealized = actualSavings;
      updateData.implementedAt = new Date();
    }

    const updated = await prisma.rateSavingsOpportunity.update({
      where: { id: existing.id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      opportunity: updated,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const tenantId = await getApiTenantId(request);
  
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
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
