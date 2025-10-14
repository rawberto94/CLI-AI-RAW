import { NextRequest, NextResponse } from 'next/server';
import { analyticalIntelligenceService } from '../../../../../packages/data-orchestration/src/services/analytical-intelligence.service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const contractId = searchParams.get('contractId');
    const supplierId = searchParams.get('supplierId');

    const rateCardEngine = analyticalIntelligenceService.getRateCardEngine();

    switch (action) {
      case 'parse':
        if (!contractId) {
          return NextResponse.json({ error: 'Contract ID required' }, { status: 400 });
        }
        const parseResult = await rateCardEngine.parseRateCards(contractId);
        return NextResponse.json(parseResult);

      case 'report':
        if (!supplierId) {
          return NextResponse.json({ error: 'Supplier ID required' }, { status: 400 });
        }
        const report = await rateCardEngine.generateRateCardReport(supplierId);
        return NextResponse.json(report);

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Rate benchmarking API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, rates, cohort, currentRates, benchmarks } = body;

    const rateCardEngine = analyticalIntelligenceService.getRateCardEngine();

    switch (action) {
      case 'calculate-benchmarks':
        if (!rates || !cohort) {
          return NextResponse.json({ error: 'Rates and cohort required' }, { status: 400 });
        }
        const benchmarkResult = await rateCardEngine.calculateBenchmarks(rates, cohort);
        return NextResponse.json(benchmarkResult);

      case 'estimate-savings':
        if (!currentRates || !benchmarks) {
          return NextResponse.json({ error: 'Current rates and benchmarks required' }, { status: 400 });
        }
        const savingsResult = await rateCardEngine.estimateSavings(currentRates, benchmarks);
        return NextResponse.json(savingsResult);

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Rate benchmarking API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}