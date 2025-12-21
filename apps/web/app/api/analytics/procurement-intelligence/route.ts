import { NextRequest, NextResponse } from 'next/server';
import { generateSupplierAnalyticsMock } from '@/lib/mock-data/supplier-analytics-mock';
import { generateNegotiationPrepMock } from '@/lib/mock-data/negotiation-prep-mock';
import { generateSavingsPipelineMock } from '@/lib/mock-data/savings-pipeline-mock';
import { generateRenewalRadarMock } from '@/lib/mock-data/renewal-radar-mock';

type DataMode = 'real' | 'mock';
type ProviderType = 
  | 'rate-benchmarking'
  | 'supplier-analytics'
  | 'negotiation-prep'
  | 'savings-pipeline'
  | 'renewal-radar';

/**
 * Unified Procurement Intelligence API
 * Single endpoint for all procurement intelligence modules
 */

// GET /api/analytics/procurement-intelligence - Get data from any module
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const moduleName = searchParams.get('module') as ProviderType | null;
    
    if (!moduleName) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Module parameter is required',
          availableModules: [
            'rate-benchmarking',
            'supplier-analytics',
            'negotiation-prep',
            'savings-pipeline',
            'renewal-radar'
          ]
        },
        { status: 400 }
      );
    }

    // Validate moduleName
    const validModules: ProviderType[] = [
      'rate-benchmarking',
      'supplier-analytics',
      'negotiation-prep',
      'savings-pipeline',
      'renewal-radar'
    ];

    if (!validModules.includes(moduleName)) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Invalid moduleName: ${moduleName}`,
          availableModules: validModules
        },
        { status: 400 }
      );
    }

    // Check for data mode parameter
    const dataMode = searchParams.get('mode') as DataMode | null;
    const mode: DataMode = dataMode === 'mock' ? 'mock' : 'real';

    // Build params object from all query parameters
    const params: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      if (key !== 'moduleName' && key !== 'mode') {
        params[key] = value;
      }
    });

    // Get data based on moduleName and mode
    let data: unknown;
    let source: string;
    
    if (mode === 'mock') {
      // Use mock data
      switch (moduleName) {
        case 'supplier-analytics':
          data = generateSupplierAnalyticsMock(params);
          source = 'mock-data-generator';
          break;
        case 'negotiation-prep':
          data = generateNegotiationPrepMock(params);
          source = 'mock-data-generator';
          break;
        case 'savings-pipeline':
          data = generateSavingsPipelineMock(params);
          source = 'mock-data-generator';
          break;
        case 'renewal-radar':
          data = generateRenewalRadarMock(params);
          source = 'mock-data-generator';
          break;
        case 'rate-benchmarking':
          // Rate benchmarking uses JSON file
          const rateCards = await import('@/lib/mock-data/rate-cards.json');
          data = rateCards.default;
          source = 'mock-data-file';
          break;
        default:
          throw new Error(`Mock data not implemented for moduleName: ${moduleName}`);
      }
    } else {
      // Real data mode - return mock for now with a note
      // TODO: Implement real data providers
      switch (moduleName) {
        case 'supplier-analytics':
          data = generateSupplierAnalyticsMock(params);
          source = 'mock-fallback';
          break;
        case 'negotiation-prep':
          data = generateNegotiationPrepMock(params);
          source = 'mock-fallback';
          break;
        case 'savings-pipeline':
          data = generateSavingsPipelineMock(params);
          source = 'mock-fallback';
          break;
        case 'renewal-radar':
          data = generateRenewalRadarMock(params);
          source = 'mock-fallback';
          break;
        case 'rate-benchmarking':
          const rateCards = await import('@/lib/mock-data/rate-cards.json');
          data = rateCards.default;
          source = 'mock-fallback';
          break;
        default:
          throw new Error(`Real data not implemented for moduleName: ${moduleName}`);
      }
    }

    return NextResponse.json({
      success: true,
      moduleName,
      data,
      metadata: {
        source,
        mode,
        lastUpdated: new Date().toISOString(),
        recordCount: Array.isArray(data) ? data.length : 1,
        confidence: mode === 'real' ? 0.95 : 0.75,
        description: mode === 'mock' ? 'Mock data for testing' : 'Real data (fallback to mock)'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to get procurement intelligence data:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get procurement intelligence data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST /api/analytics/procurement-intelligence - Handle actions like health checks
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'health-check') {
      // Return health status for all modules
      const status = {
        'rate-benchmarking': { real: false, mock: true },
        'supplier-analytics': { real: false, mock: true },
        'negotiation-prep': { real: false, mock: true },
        'savings-pipeline': { real: false, mock: true },
        'renewal-radar': { real: false, mock: true }
      };

      return NextResponse.json({
        success: true,
        data: status,
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'get-metadata') {
      const { moduleName, mode } = body;
      
      if (!moduleName) {
        return NextResponse.json(
          { success: false, error: 'Module parameter is required' },
          { status: 400 }
        );
      }

      const metadata = {
        source: mode === 'mock' ? 'mock-data-generator' : 'mock-fallback',
        mode: mode || 'real',
        lastUpdated: new Date().toISOString(),
        recordCount: 0,
        confidence: mode === 'mock' ? 0.75 : 0.95,
        description: `${moduleName} data provider`
      };

      return NextResponse.json({
        success: true,
        data: metadata,
        timestamp: new Date().toISOString()
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action specified' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Failed to process procurement intelligence action:', error);
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
