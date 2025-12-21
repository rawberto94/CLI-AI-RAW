import { NextRequest, NextResponse } from 'next/server';
import { PPPAdjustmentService } from 'data-orchestration/services';

const pppAdjustmentService = new PPPAdjustmentService();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rate, fromCountry, toCountry } = body;

    if (!rate || !fromCountry) {
      return NextResponse.json(
        { error: 'Missing required parameters: rate, fromCountry' },
        { status: 400 }
      );
    }

    const adjusted = pppAdjustmentService.adjustRateForPPP(
      rate,
      fromCountry,
      toCountry || 'USA'
    );

    return NextResponse.json(adjusted);
  } catch (error: unknown) {
    console.error('Error adjusting rate for PPP:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to adjust rate for PPP' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');

    if (action === 'factors') {
      // Get all PPP factors
      const factors = pppAdjustmentService.getAllPPPFactors();
      return NextResponse.json({ factors });
    }

    if (action === 'compare') {
      // Compare two rates with PPP adjustment
      const rate1 = parseFloat(searchParams.get('rate1') || '0');
      const country1 = searchParams.get('country1');
      const rate2 = parseFloat(searchParams.get('rate2') || '0');
      const country2 = searchParams.get('country2');

      if (!rate1 || !country1 || !rate2 || !country2) {
        return NextResponse.json(
          { error: 'Missing required parameters for comparison' },
          { status: 400 }
        );
      }

      const comparison = pppAdjustmentService.compareRatesWithPPP(
        { value: rate1, country: country1 },
        { value: rate2, country: country2 }
      );

      return NextResponse.json(comparison);
    }

    return NextResponse.json(
      { error: 'Invalid action parameter' },
      { status: 400 }
    );
  } catch (error: unknown) {
    console.error('Error in PPP adjustment endpoint:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process PPP adjustment request' },
      { status: 500 }
    );
  }
}
