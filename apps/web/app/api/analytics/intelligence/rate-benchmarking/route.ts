import { NextRequest, NextResponse } from 'next/server';
import { analyticalIntelligenceService } from '@/lib/services/analytical-intelligence.service';
import { getDataProviderFactory } from '../../../../../../packages/data-orchestration/src/providers/data-provider-factory';
import { DataMode } from '../../../../../../packages/data-orchestration/src/types/data-provider.types';

/**
 * Rate Card Benchmarking API Endpoints
 * Now supports both real and mock data modes
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
    const lineOfService = searchParams.get('lineOfService');
    const seniority = searchParams.get('seniority');
    const geography = searchParams.get('geography');
    const currency = searchParams.get('currency');
    
    // Check for data mode parameter (real, mock, or fallback)
    const dataMode = searchParams.get('mode') as 'real' | 'mock' | null;
    const mode = dataMode === 'mock' ? DataMode.MOCK : 
                 dataMode === 'real' ? DataMode.REAL : 
                 DataMode.REAL; // Default to real

    // Use new data provider system
    const factory = getDataProviderFactory();
    const response = await factory.getData('rate-benchmarking', {
      lineOfService: lineOfService || category,
      seniority,
      geography: geography || region,
      currency
    }, mode);

    return NextResponse.json({
      success: true,
      data: response.data,
      metadata: {
        source: response.metadata.source,
        mode: response.metadata.mode,
        lastUpdated: response.metadata.lastUpdated,
        recordCount: response.metadata.recordCount,
        confidence: response.metadata.confidence
      },
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