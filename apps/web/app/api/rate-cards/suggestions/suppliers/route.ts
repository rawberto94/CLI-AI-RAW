import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rateCardEntryService } from 'data-orchestration/services';
import { getServerSession as _getServerSession } from '@/lib/auth';

const rateCardService = new rateCardEntryService(prisma);

/**
 * GET /api/rate-cards/suggestions/suppliers
 * Get supplier suggestions based on partial input
 */
export async function GET(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 10;

    if (!query || query.length < 2) {
      return NextResponse.json([]);
    }

    const suggestions = await rateCardService.getSupplierSuggestions(query, tenantId, limit);

    return NextResponse.json(suggestions);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: 'Failed to get supplier suggestions', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
