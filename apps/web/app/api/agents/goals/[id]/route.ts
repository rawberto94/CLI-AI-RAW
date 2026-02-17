/**
 * Agent Goal Detail API
 * 
 * Fetch a single agent goal with its steps and triggers.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { prisma } = await import('@/lib/prisma');

    const goal = await prisma.agentGoal.findUnique({
      where: { id },
      include: {
        steps: { orderBy: { order: 'asc' } },
        triggers: true,
      },
    });

    if (!goal) {
      return NextResponse.json(
        { success: false, error: 'Goal not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: goal });
  } catch (error) {
    console.error('[Goal Detail] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch goal' },
      { status: 500 }
    );
  }
}
