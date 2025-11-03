import { NextRequest, NextResponse } from 'next/server';
import { analyticalIntelligenceService } from 'data-orchestration/services';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const supplierId = searchParams.get('supplierId');

    if (!supplierId) {
      return NextResponse.json({ error: 'Supplier ID required' }, { status: 400 });
    }

    const supplierEngine = analyticalIntelligenceService.getSupplierEngine();

    switch (action) {
      case 'profile':
        const profile = await supplierEngine.aggregateSupplierData(supplierId);
        return NextResponse.json(profile);

      case 'external-data':
        const externalData = await supplierEngine.integrateExternalData(supplierId);
        return NextResponse.json(externalData);

      case 'metrics':
        const profileForMetrics = await supplierEngine.aggregateSupplierData(supplierId);
        const metrics = await supplierEngine.calculateSupplierMetrics(profileForMetrics);
        return NextResponse.json(metrics);

      case 'summary':
        const profileForSummary = await supplierEngine.aggregateSupplierData(supplierId);
        const summary = await supplierEngine.generateExecutiveSummary(profileForSummary);
        return NextResponse.json(summary);

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Supplier snapshot API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}