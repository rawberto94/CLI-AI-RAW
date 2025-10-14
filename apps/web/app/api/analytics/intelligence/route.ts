import { NextRequest, NextResponse } from 'next/server';
import { analyticalIntelligenceService } from '@/lib/services/analytical-intelligence.service';

/**
 * Analytical Intelligence API Endpoints
 * Provides access to all analytical engines and intelligence features
 */

// GET /api/analytics/intelligence - Get analytical intelligence overview
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId') || 'default';
    const includeEngines = searchParams.get('engines')?.split(',') || ['all'];

    const overview = await analyticalIntelligenceService.getOverview(tenantId, includeEngines);

    return NextResponse.json({
      success: true,
      data: overview,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to get analytical intelligence overview:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get analytical intelligence overview',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST /api/analytics/intelligence - Trigger analytical intelligence processing
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, parameters } = body;

    let result;

    switch (action) {
      case 'refresh_all':
        result = await analyticalIntelligenceService.refreshAllEngines(parameters.tenantId);
        break;
      case 'process_contract':
        result = await analyticalIntelligenceService.processContract(parameters.contractId);
        break;
      case 'update_benchmarks':
        result = await analyticalIntelligenceService.updateBenchmarks(parameters.tenantId);
        break;
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action specified' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to process analytical intelligence action:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process action',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}