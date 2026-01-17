import { NextRequest, NextResponse } from 'next/server';
import { getDataProviderFactory } from 'data-orchestration';
import { DataMode } from 'data-orchestration/types';

/**
 * Renewal Radar API Endpoints
 * Supports both real and mock data modes
 */

// GET /api/analytics/renewals - Get renewal radar data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('timeframe') || '12months';
    const riskLevel = searchParams.get('riskLevel');
    
    // Check for data mode parameter
    const dataMode = searchParams.get('mode') as 'real' | 'mock' | null;
    const mode = dataMode === 'mock' ? DataMode.MOCK : 
                 dataMode === 'real' ? DataMode.REAL : 
                 DataMode.REAL;

    // Use data provider system
    const factory = getDataProviderFactory();
    const response = await factory.getData('renewal-radar', {
      timeframe,
      riskLevel: riskLevel as 'high' | 'medium' | 'low' | undefined
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

  } catch (error: unknown) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get renewal radar data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
