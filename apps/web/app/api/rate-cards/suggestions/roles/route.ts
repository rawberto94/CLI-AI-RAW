import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { RateCardEntryService } from '@/packages/data-orchestration/src/services/rate-card-entry.service';

const rateCardService = new RateCardEntryService(prisma);

/**
 * GET /api/rate-cards/suggestions/roles
 * Get role suggestions based on partial input
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 10;
    
    // TODO: Get tenantId from session/auth
    const tenantId = searchParams.get('tenantId') || 'default-tenant';

    if (!query || query.length < 2) {
      return NextResponse.json([]);
    }

    const suggestions = await rateCardService.getRoleSuggestions(query, tenantId, limit);

    return NextResponse.json(suggestions);
  } catch (error) {
    console.error('Error getting role suggestions:', error);
    return NextResponse.json(
      { error: 'Failed to get role suggestions', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
