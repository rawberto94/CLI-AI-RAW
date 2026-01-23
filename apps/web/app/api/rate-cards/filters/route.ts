/**
 * Saved Filters API
 * 
 * Manage saved filter presets
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';

import { prisma } from '@/lib/prisma';

/**
 * GET /api/rate-cards/filters
 * Get all saved filters for the user
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id || !session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's own filters and shared filters
    const filters = await prisma.$queryRaw<any[]>`
      SELECT *
      FROM "rate_card_filter_presets"
      WHERE "tenantId" = ${session.user.tenantId}
        AND ("userId" = ${session.user.id} OR "isShared" = true)
      ORDER BY "updatedAt" DESC
    `;

    return NextResponse.json({ filters });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch saved filters' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/rate-cards/filters
 * Create a new saved filter
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id || !session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, filters } = body;

    if (!name || !filters) {
      return NextResponse.json(
        { error: 'Name and filters are required' },
        { status: 400 }
      );
    }

    const savedFilter = await prisma.$queryRaw<any>`
      INSERT INTO "rate_card_filter_presets" (
        "id",
        "tenantId",
        "userId",
        "name",
        "description",
        "filters",
        "isShared",
        "createdAt",
        "updatedAt"
      ) VALUES (
        gen_random_uuid()::text,
        ${session.user.tenantId},
        ${session.user.id},
        ${name},
        ${description || null},
        ${JSON.stringify(filters)}::jsonb,
        false,
        NOW(),
        NOW()
      )
      RETURNING *
    `;

    return NextResponse.json({ filter: savedFilter[0] });
  } catch {
    return NextResponse.json(
      { error: 'Failed to create saved filter' },
      { status: 500 }
    );
  }
}
