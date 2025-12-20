/**
 * Role Suggestions API
 * GET /api/rate-cards/roles/suggestions
 * Returns role name suggestions for autocomplete
 */

import { NextRequest, NextResponse } from 'next/server';
import { roleStandardizationService } from 'data-orchestration/services';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    const tenantId = request.headers.get('x-tenant-id');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      );
    }

    if (query.length < 2) {
      return NextResponse.json({ suggestions: [] });
    }

    const suggestions = await roleStandardizationService.getRoleSuggestions(
      query,
      tenantId,
      10
    );

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('Error fetching role suggestions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch suggestions' },
      { status: 500 }
    );
  }
}
