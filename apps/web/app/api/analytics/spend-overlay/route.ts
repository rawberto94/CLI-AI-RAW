import { NextRequest, NextResponse } from 'next/server';
import { analyticalIntelligenceService } from 'data-orchestration/services';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const supplierId = searchParams.get('supplierId');

    const spendEngine = analyticalIntelligenceService.getSpendEngine();

    switch (action) {
      case 'efficiency':
        if (!supplierId) {
          return NextResponse.json({ error: 'Supplier ID required' }, { status: 400 });
        }
        const efficiency = await spendEngine.calculateEfficiency(supplierId);
        return NextResponse.json(efficiency);

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, source, spendData, mappings } = body;

    const spendEngine = analyticalIntelligenceService.getSpendEngine();

    switch (action) {
      case 'integrate':
        if (!source) {
          return NextResponse.json({ error: 'Data source required' }, { status: 400 });
        }
        const integrationResult = await spendEngine.integrateSpendData(source);
        return NextResponse.json(integrationResult);

      case 'map':
        if (!spendData) {
          return NextResponse.json({ error: 'Spend data required' }, { status: 400 });
        }
        const mappingResult = await spendEngine.mapSpendToContracts(spendData);
        return NextResponse.json(mappingResult);

      case 'analyze':
        if (!mappings) {
          return NextResponse.json({ error: 'Mappings required' }, { status: 400 });
        }
        const analysisResult = await spendEngine.analyzeVariances(mappings);
        return NextResponse.json(analysisResult);

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}