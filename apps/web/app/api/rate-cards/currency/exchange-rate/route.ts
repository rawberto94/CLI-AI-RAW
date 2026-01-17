import { NextRequest, NextResponse } from 'next/server';
import { currencyAdvancedService } from 'data-orchestration/services';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const date = searchParams.get('date');

    if (!from || !to) {
      return NextResponse.json(
        { error: 'Missing required parameters: from, to' },
        { status: 400 }
      );
    }

    let rate: number;
    let timestamp: Date;

    if (date) {
      // Historical rate
      const historicalDate = new Date(date);
      rate = await currencyAdvancedService.getHistoricalRate(from, to, historicalDate);
      timestamp = historicalDate;
    } else {
      // Current rate
      rate = await currencyAdvancedService.getExchangeRate(from, to);
      timestamp = new Date();
    }

    return NextResponse.json({
      from,
      to,
      rate,
      timestamp,
      source: 'exchangerate-api.io',
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch exchange rate' },
      { status: 500 }
    );
  }
}
