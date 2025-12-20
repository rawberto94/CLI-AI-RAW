import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AdvancedFilterService } from 'data-orchestration/services';
import { getServerSession } from '@/lib/auth';

const advancedFilterService = new AdvancedFilterService(prisma);

/**
 * POST /api/rate-cards/filter/validate
 * Validate an advanced filter and get match count
 */
export async function POST(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    const body = await request.json();
    const filter = body.filter;

    if (!filter) {
      return NextResponse.json(
        { error: 'Filter is required' },
        { status: 400 }
      );
    }

    // Validate filter structure
    const validation = advancedFilterService.validateFilter(filter);

    if (!validation.valid) {
      return NextResponse.json({
        valid: false,
        errors: validation.errors,
      });
    }

    // Calculate match count
    const matchCount = await advancedFilterService.calculateMatchCount(
      tenantId,
      filter
    );

    // Get filter summary
    const summary = advancedFilterService.getFilterSummary(filter);

    return NextResponse.json({
      valid: true,
      errors: [],
      matchCount: matchCount.count,
      executionTime: matchCount.executionTime,
      summary,
    });
  } catch (error) {
    console.error('Error validating filter:', error);
    return NextResponse.json(
      { error: 'Failed to validate filter', details: error instanceof Error ? error.message : String(error) },
      { status: 400 }
    );
  }
}
