/**
 * Individual Saved Filter API
 * 
 * Manage individual saved filter presets
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * DELETE /api/rate-cards/filters/[id]
 * Delete a saved filter
 */
export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
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

    await prisma.$executeRaw`
      DELETE FROM "rate_card_filter_presets"
      WHERE "id" = ${filterId}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting saved filter:', error);
    return NextResponse.json(
      { error: 'Failed to delete saved filter' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/rate-cards/filters/[id]
 * Update a saved filter
 */
export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const filterId = params.id;
    const body = await request.json();
    const { name, description, filters } = body;

    // Verify ownership
    const existingFilter = await prisma.$queryRaw<any[]>`
      SELECT * FROM "rate_card_filter_presets"
      WHERE "id" = ${filterId} AND "userId" = ${session.user.id}
    `;

    if (existingFilter.length === 0) {
      return NextResponse.json({ error: 'Filter not found' }, { status: 404 });
    }

    const updatedFilter = await prisma.$queryRaw<any>`
      UPDATE "rate_card_filter_presets"
      SET
        "name" = COALESCE(${name}, "name"),
        "description" = COALESCE(${description}, "description"),
        "filters" = COALESCE(${filters ? JSON.stringify(filters) : null}::jsonb, "filters"),
        "updatedAt" = NOW()
      WHERE "id" = ${filterId}
      RETURNING *
    `;

    return NextResponse.json({ filter: updatedFilter[0] });
  } catch (error) {
    console.error('Error updating saved filter:', error);
    return NextResponse.json(
      { error: 'Failed to update saved filter' },
      { status: 500 }
    );
  }
}
