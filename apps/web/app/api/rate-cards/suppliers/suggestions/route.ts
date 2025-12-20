/**
 * Supplier Suggestions API
 * GET /api/rate-cards/suppliers/suggestions
 * Returns supplier name suggestions for autocomplete
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';

    if (query.length < 2) {
      return NextResponse.json({ suggestions: [] });
    }

    const suppliers = await (prisma as any).rateCardSupplier.findMany({
      where: {
        tenantId,
        name: {
          contains: query,
          mode: 'insensitive',
        },
      },
      select: {
        name: true,
      },
      distinct: ['name'],
      take: 10,
      orderBy: {
        name: 'asc',
      },
    });

    const suggestions = suppliers.map((s: any) => s.name);

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('Error fetching supplier suggestions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch suggestions' },
      { status: 500 }
    );
  }
}
