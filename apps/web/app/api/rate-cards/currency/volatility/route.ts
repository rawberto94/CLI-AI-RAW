import { NextRequest, NextResponse } from 'next/server';
import { CurrencyAdvancedService } from 'data-orchestration/services';

const currencyAdvancedService = new CurrencyAdvancedService();

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const baseCurrency = searchParams.get('baseCurrency') || 'USD';
    const tenantId = searchParams.get('tenantId');

    // Detect currency volatility
    const volatilityAlerts = await currencyAdvancedService.detectVolatility(baseCurrency);

    // If tenantId provided, get affected rates
    let affectedRates = [];
    if (tenantId) {
      affectedRates = await currencyAdvancedService.getRatesAffectedByVolatility(tenantId);
    }

    return NextResponse.json({
      baseCurrency,
      alertCount: volatilityAlerts.length,
      alerts: volatilityAlerts,
      affectedRates: affectedRates.length,
      affectedRateDetails: tenantId ? affectedRates : undefined,
    });
  } catch (error: any) {
    console.error('Error detecting currency volatility:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to detect currency volatility' },
      { status: 500 }
    );
  }
}
