import { NextRequest, NextResponse } from 'next/server';
import { analyticalIntelligenceService } from '@/lib/services/analytical-intelligence.service';

/**
 * Rate Card Benchmarking API Endpoints
 */

// GET /api/analytics/intelligence/rate-benchmarking - Get rate benchmarking data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId') || 'default';
    const supplierId = searchParams.get('supplierId');
    const category = searchParams.get('category');
    const region = searchParams.get('region');
    const deliveryModel = searchParams.get('deliveryModel');

    const filters = {
      tenantId,
      ...(supplierId && { supplierId }),
      ...(category && { category }),
      ...(region && { region }),
      ...(deliveryModel && { deliveryModel })
    };

    const benchmarkData = await analyticalIntelligenceService.getRateBenchmarks(filters);

    return NextResponse.json({
      success: true,
      data: benchmarkData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to get rate benchmarking data:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get rate benchmarking data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST /api/analytics/intelligence/rate-benchmarking - Parse rate cards or update benchmarks
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, contractId, rateCardData } = body;

    let result;

    switch (action) {
      case 'parse_contract':
        if (!contractId) {
          return NextResponse.json(
            { success: false, error: 'Contract ID is required' },
            { status: 400 }
          );
        }
        result = await analyticalIntelligenceService.parseRateCard(contractId);
        break;
      
      case 'calculate_benchmarks':
        result = await analyticalIntelligenceService.calculateBenchmarks(body.cohort, body.rates);
        break;
      
      case 'estimate_savings':
        result = await analyticalIntelligenceService.estimateSavings(body.currentRates, body.benchmarks);
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
    console.error('Failed to process rate benchmarking action:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process rate benchmarking action',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}