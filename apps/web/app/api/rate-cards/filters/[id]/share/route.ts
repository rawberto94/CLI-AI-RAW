/**
 * Share Filter API
 * 
 * Toggle sharing status of a saved filter
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/rate-cards/filters/[id]/share
 * Toggle sharing status of a saved filter
 */
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const filterId = params.id;

    // Verify ownership
    const filter = await prisma.$queryRaw<any[]>`
      SELECT * FROM "rate_card_filter_presets"
      WHERE "id" = ${filterId} AND "userId" = ${session.user.id}
    `;

    if (filter.length === 0) {
      return NextResponse.json({ error: 'Filter not found' }, { status: 404 });
    }

    // Toggle share status
    const updatedFilter = await prisma.$queryRaw<any>`
      UPDATE "rate_card_filter_presets"
      SET
        "isShared" = NOT "isShared",
        "updatedAt" = NOW()
      WHERE "id" = ${filterId}
      RETURNING *
    `;

    return NextResponse.json({ filter: updatedFilter[0] });
  } catch (error) {
    console.error('Error toggling filter share status:', error);
    return NextResponse.json(
      { error: 'Failed to update filter share status' },
      { status: 500 }
    );
  }
}
