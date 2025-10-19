import { NextRequest, NextResponse } from 'next/server';
import { getDataProviderFactory } from '../../../../../packages/data-orchestration/src/providers/data-provider-factory';
import { DataMode } from '../../../../../packages/data-orchestration/src/types/data-provider.types';

/**
 * Supplier Analytics API Endpoints
 * Supports both real and mock data modes
 */

// GET /api/analytics/suppliers - Get supplier analytics overview
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get('supplierId');
    const timeframe = searchParams.get('timeframe') || '12months';
    const metrics = searchParams.get('metrics')?.split(',');
    
    // Check for data mode parameter
    const dataMode = searchParams.get('mode') as 'real' | 'mock' | null;
    const mode = dataMode === 'mock' ? DataMode.MOCK : 
                 dataMode === 'real' ? DataMode.REAL : 
                 DataMode.REAL;

    // Use data provider system
    const factory = getDataProviderFactory();
    const response = await factory.getData('supplier-analytics', {
      supplierId: supplierId || undefined,
      timeframe,
      metrics
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
    console.error('Failed to get supplier analytics data:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get supplier analytics data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
