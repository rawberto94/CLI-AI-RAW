import { NextRequest, NextResponse } from 'next/server';
import { analyticalIntelligenceService } from '@/lib/services/analytical-intelligence.service';

/**
 * Supplier Snapshot API Endpoints
 */

// GET /api/analytics/intelligence/supplier-snapshot - Get supplier intelligence data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId') || 'default';
    const supplierId = searchParams.get('supplierId');
    const includeExternal = searchParams.get('includeExternal') === 'true';
    const view = searchParams.get('view') || 'profile'; // profile, summary, comparison, metrics

    if (!supplierId && view !== 'comparison') {
      return NextResponse.json(
        { success: false, error: 'Supplier ID is required' },
        { status: 400 }
      );
    }

    let result;

    switch (view) {
      case 'profile':
        result = await analyticalIntelligenceService.getSupplierProfile(supplierId!, includeExternal);
        break;
      case 'summary':
        result = await analyticalIntelligenceService.getSupplierExecutiveSummary(supplierId!);
        break;
      case 'comparison':
        const supplierIds = searchParams.get('supplierIds')?.split(',') || [];
        result = await analyticalIntelligenceService.compareSuppliers(supplierIds);
        break;
      case 'metrics':
        result = await analyticalIntelligenceService.getSupplierMetrics(supplierId!);
        break;
      default:
        result = await analyticalIntelligenceService.getSupplierProfile(supplierId!, includeExternal);
    }

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to get supplier snapshot data:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get supplier snapshot data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST /api/analytics/intelligence/supplier-snapshot - Process supplier actions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, supplierId } = body;

    let result;

    switch (action) {
      case 'aggregate_data':
        if (!supplierId) {
          return NextResponse.json(
            { success: false, error: 'Supplier ID is required' },
            { status: 400 }
          );
        }
        result = await analyticalIntelligenceService.aggregateSupplierData(supplierId);
        break;
      
      case 'integrate_external':
        if (!supplierId) {
          return NextResponse.json(
            { success: false, error: 'Supplier ID is required' },
            { status: 400 }
          );
        }
        result = await analyticalIntelligenceService.integrateExternalSupplierData(supplierId);
        break;
      
      case 'calculate_metrics':
        if (!body.profile) {
          return NextResponse.json(
            { success: false, error: 'Supplier profile is required' },
            { status: 400 }
          );
        }
        result = await analyticalIntelligenceService.calculateSupplierMetrics(body.profile);
        break;
      
      case 'generate_summary':
        if (!body.profile) {
          return NextResponse.json(
            { success: false, error: 'Supplier profile is required' },
            { status: 400 }
          );
        }
        result = await analyticalIntelligenceService.generateSupplierExecutiveSummary(body.profile);
        break;
      
      case 'refresh_all':
        const supplierIds = body.supplierIds;
        if (!supplierIds || !Array.isArray(supplierIds)) {
          return NextResponse.json(
            { success: false, error: 'Supplier IDs array is required' },
            { status: 400 }
          );
        }
        result = await analyticalIntelligenceService.refreshSupplierIntelligence(supplierIds);
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
    console.error('Failed to process supplier snapshot action:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process supplier snapshot action',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}