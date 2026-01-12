/**
 * POST /api/baselines/bulk-compare
 * 
 * Compare all rate card entries against baselines
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

    const {
      minVariancePercentage = 5,
      baselineTypes,
      categoryL1,
      categoryL2,
    } = body;

    const service = new baselineManagementService(prisma);
    const result = await service.bulkCompareAgainstBaselines(tenantId, {
      minVariancePercentage,
      baselineTypes,
      categoryL1,
      categoryL2,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Bulk baseline comparison error:', error);
    return NextResponse.json(
      {
        error: 'Failed to perform bulk baseline comparison',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
