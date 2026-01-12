import { NextRequest, NextResponse } from 'next/server';
import { currencyAdvancedService } from 'data-orchestration/services';
import { getApiTenantId } from '@/lib/security/tenant';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const baseCurrency = searchParams.get('baseCurrency') || 'USD';
    const tenantId = await getApiTenantId(request);

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
    }

    // Detect currency volatility
    const volatilityAlerts = await currencyAdvancedService.detectVolatility(baseCurrency);

    // Get affected rates for tenant
    const affectedRates = await currencyAdvancedService.getRatesAffectedByVolatility(tenantId);

    return NextResponse.json({
      baseCurrency,
      alertCount: volatilityAlerts.length,
      alerts: volatilityAlerts,
      affectedRates: affectedRates.length,
      affectedRateDetails: affectedRates,
    });
  } catch (error: unknown) {
    console.error('Error detecting currency volatility:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to detect currency volatility' },
      { status: 500 }
    );
  }
}
