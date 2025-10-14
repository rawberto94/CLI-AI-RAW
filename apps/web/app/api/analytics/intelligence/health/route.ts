import { NextRequest, NextResponse } from 'next/server';
import { analyticalIntelligenceService } from '@/lib/services/analytical-intelligence.service';

/**
 * Health Check API for Analytical Intelligence
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const detailed = searchParams.get('detailed') === 'true';

    const healthCheck = await analyticalIntelligenceService.healthCheck(detailed);

    const status = healthCheck.overall ? 200 : 503;

    return NextResponse.json({
      success: healthCheck.overall,
      data: healthCheck,
      timestamp: new Date().toISOString()
    }, { status });

  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Health check failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 503 }
    );
  }
}