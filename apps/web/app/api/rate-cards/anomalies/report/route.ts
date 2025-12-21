import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { AnomalyExplainerService } from 'data-orchestration/services';
import { getApiTenantId } from '@/lib/security/tenant';

// Using singleton prisma instance from @/lib/prisma

/**
 * GET /api/rate-cards/anomalies/report
 * Generate comprehensive anomaly report for all rate cards in a tenant
 */
export async function GET(request: NextRequest) {
  try {
    // Get tenant ID from secure session
    const tenantId = await getApiTenantId(request);
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
    }

    // Generate anomaly report
    const anomalyService = new AnomalyExplainerService(prisma);
    const report = await anomalyService.generateAnomalyReport(tenantId);

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error: unknown) {
    console.error('Error generating anomaly report:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate anomaly report',
        message: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
