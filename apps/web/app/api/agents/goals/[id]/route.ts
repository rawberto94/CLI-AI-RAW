/**
 * Agent Goal Detail API
 * 
 * Fetch a single agent goal with its steps and triggers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthApiHandler, type AuthenticatedApiContext } from '@/lib/api-middleware';

export const GET = withAuthApiHandler(async (
  request: NextRequest,
  ctx: AuthenticatedApiContext
) => {
  try {
    const { tenantId } = ctx;
    // Extract id from the URL since withAuthApiHandler may not pass route params the same way
    const url = new URL(request.url);
    const id = url.pathname.split('/').pop();
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Goal ID required' },
        { status: 400 }
      );
    }

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

    // Verify tenant ownership
    if (goal.tenantId !== tenantId) {
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
});
