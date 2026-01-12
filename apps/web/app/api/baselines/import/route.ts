/**
 * POST /api/baselines/import
 * 
 * Import baseline rates from CSV/JSON
 */

import { NextRequest, NextResponse } from 'next/server';
import { baselineManagementService } from 'data-orchestration';
import { prisma } from "@/lib/prisma";
import { getServerTenantId } from "@/lib/tenant-server";

// Using singleton prisma instance from @/lib/prisma

export async function POST(req: NextRequest) {
  try {
    const tenantId = await getServerTenantId();
    const body = await req.json();

    const { baselines, updateExisting = true, autoApprove = false } = body;

    if (!baselines || !Array.isArray(baselines) || baselines.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: baselines array required' },
        { status: 400 }
      );
    }

    // Validate baseline data
    for (const baseline of baselines) {
      if (!baseline.baselineName || !baseline.baselineType || !baseline.role || !baseline.dailyRateUSD) {
        return NextResponse.json(
          {
            error: 'Invalid baseline data: baselineName, baselineType, role, and dailyRateUSD required',
          },
          { status: 400 }
        );
      }

      const validTypes = ['TARGET_RATE', 'MARKET_BENCHMARK', 'HISTORICAL_BEST', 'COMPETITIVE_BID', 'NEGOTIATED_CAP', 'INDUSTRY_STANDARD', 'REGULATORY_LIMIT', 'CUSTOM'];
      if (!validTypes.includes(baseline.baselineType)) {
        return NextResponse.json(
          { error: `Invalid baseline type: ${baseline.baselineType}. Valid types: ${validTypes.join(', ')}` },
          { status: 400 }
        );
      }
    }

    const service = new baselineManagementService(prisma);
    const result = await service.importBaselines(tenantId, baselines, {
      updateExisting,
      autoApprove,
    });

    return NextResponse.json({
      success: true,
      result,
      message: `Imported ${result.imported}, updated ${result.updated}, failed ${result.failed}`,
    });
  } catch (error) {
    console.error('Baseline import error:', error);
    return NextResponse.json(
      {
        error: 'Failed to import baselines',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/baselines/import
 * 
 * Get baseline import statistics
 */
export async function GET(req: NextRequest) {
  try {
    const tenantId = await getServerTenantId();

    const service = new baselineManagementService(prisma);
    const statistics = await service.getBaselineStatistics(tenantId);

    return NextResponse.json({
      success: true,
      statistics,
    });
  } catch (error) {
    console.error('Get baseline statistics error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get baseline statistics',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
