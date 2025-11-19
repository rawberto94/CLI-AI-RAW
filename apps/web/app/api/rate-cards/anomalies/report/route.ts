import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { AnomalyExplainerService } from 'data-orchestration/services';

// Using singleton prisma instance from @/lib/prisma

/**
 * GET /api/rate-cards/anomalies/report
 * Generate comprehensive anomaly report for all rate cards in a tenant
 */
export async function GET(request: NextRequest) {
  try {
    // Get tenant ID from query params or session
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      );
    }

    // Generate anomaly report
    const anomalyService = new AnomalyExplainerService(prisma);
    const report = await anomalyService.generateAnomalyReport(tenantId);

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error: any) {
    console.error('Error generating anomaly report:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate anomaly report',
        message: error.message 
      },
      { status: 500 }
    );
  }
}
