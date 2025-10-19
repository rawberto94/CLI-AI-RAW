import { NextRequest, NextResponse } from 'next/server';
import { getDataProviderFactory } from '../../../../../packages/data-orchestration/src/providers/data-provider-factory';
import { DataMode } from '../../../../../packages/data-orchestration/src/types/data-provider.types';

/**
 * Negotiation Preparation API Endpoints
 * Supports both real and mock data modes
 */

// GET /api/analytics/negotiation - Get negotiation preparation data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get('contractId');
    const supplierId = searchParams.get('supplierId');
    const category = searchParams.get('category');
    
    // Check for data mode parameter
    const dataMode = searchParams.get('mode') as 'real' | 'mock' | null;
    const mode = dataMode === 'mock' ? DataMode.MOCK : 
                 dataMode === 'real' ? DataMode.REAL : 
                 DataMode.REAL;

    // Use data provider system
    const factory = getDataProviderFactory();
    const response = await factory.getData('negotiation-prep', {
      contractId: contractId || undefined,
      supplierId: supplierId || undefined,
      category: category || undefined
    }, mode);

    return NextResponse.json({
      success: true,
      data: response.data,
      metadata: {
        source: response.metadata.source,
        mode: response.metadata.mode,
        lastUpdated: response.metadata.lastUpdated,
        confidence: response.metadata.confidence
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to get negotiation prep data:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get negotiation prep data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST /api/analytics/negotiation/generate-pack - Generate negotiation pack
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contractId, supplierId, category, mode: dataMode } = body;
    
    const mode = dataMode === 'mock' ? DataMode.MOCK : 
                 dataMode === 'real' ? DataMode.REAL : 
                 DataMode.REAL;

    const factory = getDataProviderFactory();
    const response = await factory.getData('negotiation-prep', {
      contractId,
      supplierId,
      category
    }, mode);

    return NextResponse.json({
      success: true,
      data: response.data,
      metadata: response.metadata,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to generate negotiation pack:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to generate negotiation pack',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
