import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiTenantId } from '@/lib/tenant-server';

/**
 * GET /api/rate-cards/comparisons/[id]
 * Get a specific comparison
 */
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const tenantId = await getApiTenantId(request);
  
  if (!tenantId) {
    return NextResponse.json(
      { error: 'Tenant ID required' },
      { status: 400 }
    );
  }
  
  try {
    const comparison = await prisma.rateComparison.findFirst({
      where: { id: params.id, tenantId },
      include: {
        targetRate: true,
      },
    });

    if (!comparison) {
      return NextResponse.json(
        { error: 'Comparison not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ comparison });
  } catch (error) {
    console.error('Error fetching comparison:', error);
    return NextResponse.json(
      { error: 'Failed to fetch comparison', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/rate-cards/comparisons/[id]
 * Update a comparison
 */
export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const tenantId = await getApiTenantId(request);
  
  if (!tenantId) {
    return NextResponse.json(
      { error: 'Tenant ID required' },
      { status: 400 }
    );
  }
  
  try {
    // Verify comparison belongs to tenant
    const existing = await prisma.rateComparison.findFirst({
      where: { id: params.id, tenantId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Comparison not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { name, description, isShared } = body;

    const comparison = await prisma.rateComparison.update({
      where: { id: existing.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(isShared !== undefined && { isShared }),
      },
      include: {
        targetRate: true,
      },
    });

    return NextResponse.json({ comparison });
  } catch (error) {
    console.error('Error updating comparison:', error);
    return NextResponse.json(
      { error: 'Failed to update comparison', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/rate-cards/comparisons/[id]
 * Delete a comparison
 */
export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const tenantId = await getApiTenantId(request);
  
  if (!tenantId) {
    return NextResponse.json(
      { error: 'Tenant ID required' },
      { status: 400 }
    );
  }
  
  try {
    // Verify comparison belongs to tenant
    const existing = await prisma.rateComparison.findFirst({
      where: { id: params.id, tenantId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Comparison not found' },
        { status: 404 }
      );
    }

    await prisma.rateComparison.delete({
      where: { id: existing.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting comparison:', error);
    return NextResponse.json(
      { error: 'Failed to delete comparison', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
