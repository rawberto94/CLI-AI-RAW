import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/rate-cards/comparisons/[id]
 * Get a specific comparison
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const comparison = await prisma.rateComparison.findUnique({
      where: { id: params.id },
      include: {
        rateCardEntries: {
          include: {
            rateCardEntry: true,
          },
          orderBy: { displayOrder: 'asc' },
        },
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
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { name, description, isShared } = body;

    const comparison = await prisma.rateComparison.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(isShared !== undefined && { isShared }),
      },
      include: {
        rateCardEntries: {
          include: {
            rateCardEntry: true,
          },
        },
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
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.rateComparison.delete({
      where: { id: params.id },
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
