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
        return NextResponse.json({ data: externalData });

      case 'metrics':
        const metrics = await supplierEngine.calculateSupplierMetrics(supplierId);
        return NextResponse.json({ data: metrics });

      case 'summary':
        const summary = await supplierEngine.generateExecutiveSummary(supplierId);
        return NextResponse.json({ data: summary });

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