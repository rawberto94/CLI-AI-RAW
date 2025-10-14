import { NextRequest, NextResponse } from 'next/server';
import { analyticalIntelligenceService } from '@/lib/services/analytical-intelligence.service';

/**
 * Spend Overlay API Endpoints
 */

// GET /api/analytics/intelligence/spend-overlay - Get spend analysis data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId') || 'default';
    const supplierId = searchParams.get('supplierId');
    const category = searchParams.get('category');
    const period = searchParams.get('period');
    const view = searchParams.get('view') || 'summary'; // summary, variance, efficiency, mapping

    const filters = {
      tenantId,
      ...(supplierId && { supplierId }),
      ...(category && { category }),
      ...(period && { period })
    };

    let result;

    switch (view) {
      case 'summary':
        result = await analyticalIntelligenceService.getSpendSummary(filters);
        break;
      case 'variance':
        result = await analyticalIntelligenceService.getSpendVarianceAnalysis(filters);
        break;
      case 'efficiency':
        if (!supplierId) {
          return NextResponse.json(
            { success: false, error: 'Supplier ID is required for efficiency analysis' },
            { status: 400 }
          );
        }
        result = await analyticalIntelligenceService.getSupplierEfficiency(supplierId);
        break;
      case 'mapping':
        result = await analyticalIntelligenceService.getSpendMappingStatus(filters);
        break;
      case 'report':
        result = await analyticalIntelligenceService.generateSpendReport(filters);
        break;
      default:
        result = await analyticalIntelligenceService.getSpendSummary(filters);
    }

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to get spend overlay data:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get spend overlay data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST /api/analytics/intelligence/spend-overlay - Process spend actions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    let result;

    switch (action) {
      case 'integrate_spend':
        if (!body.source) {
          return NextResponse.json(
            { success: false, error: 'Spend data source is required' },
            { status: 400 }
          );
        }
        result = await analyticalIntelligenceService.integrateSpendData(body.source);
        break;
      
      case 'map_spend':
        if (!body.spendData || !Array.isArray(body.spendData)) {
          return NextResponse.json(
            { success: false, error: 'Spend data array is required' },
            { status: 400 }
          );
        }
        result = await analyticalIntelligenceService.mapSpendToContracts(body.spendData);
        break;
      
      case 'analyze_variance':
        if (!body.mappings || !Array.isArray(body.mappings)) {
          return NextResponse.json(
            { success: false, error: 'Spend mappings array is required' },
            { status: 400 }
          );
        }
        result = await analyticalIntelligenceService.analyzeSpendVariances(body.mappings);
        break;
      
      case 'calculate_efficiency':
        if (!body.supplierId) {
          return NextResponse.json(
            { success: false, error: 'Supplier ID is required' },
            { status: 400 }
          );
        }
        result = await analyticalIntelligenceService.calculateSupplierEfficiency(body.supplierId);
        break;
      
      case 'sync_external':
        const sources = body.sources || ['sievo', 'ariba'];
        result = await analyticalIntelligenceService.syncExternalSpendData(sources);
        break;
      
      case 'refresh_mappings':
        const tenantId = body.tenantId || 'default';
        result = await analyticalIntelligenceService.refreshSpendMappings(tenantId);
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
    console.error('Failed to process spend overlay action:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process spend overlay action',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}