/**
 * Word Add-in Clause Alternatives API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedApiContext } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthenticatedApiContext(req);
    if (!ctx) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const { id } = await params;

    const clause = await prisma.clause.findFirst({
      where: {
        id,
        tenantId: ctx.tenantId,
      },
      select: {
        alternatives: true,
      },
    });

    if (!clause) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Clause not found' } },
        { status: 404 }
      );
    }

    // Parse alternatives if stored as JSON
    const alternatives = Array.isArray(clause.alternatives)
      ? clause.alternatives
      : [];

    return NextResponse.json({ success: true, data: alternatives });
  } catch (error) {
    console.error('Word Add-in clause alternatives error:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Failed to fetch alternatives' } },
      { status: 500 }
    );
  }
}
