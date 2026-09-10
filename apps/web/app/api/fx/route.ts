import { NextRequest } from 'next/server'
import { withAuthApiHandler, createErrorResponse, createSuccessResponse } from '@/lib/api-middleware'
import { tryConvertCurrency } from '@/lib/fx'

export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const from = (request.nextUrl.searchParams.get('from') || '').trim().toUpperCase()
  const to = (request.nextUrl.searchParams.get('to') || '').trim().toUpperCase()
  if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to) || from === 'XXX' || to === 'XXX') {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'from and to must be real ISO currency codes', 400)
  }

  if (from === to) {
    return createSuccessResponse(ctx, { from, to, rate: 1, asOf: new Date().toISOString(), source: 'identity' })
  }

  try {
    const { currencyAdvancedService } = await import('data-orchestration/services')
    const rate = await currencyAdvancedService.getExchangeRate(from, to)
    if (typeof rate === 'number' && Number.isFinite(rate) && rate > 0) {
      return createSuccessResponse(ctx, {
        from,
        to,
        rate,
        asOf: new Date().toISOString(),
        source: 'live',
      })
    }
  } catch {
    // fall through to static table
  }

  const converted = tryConvertCurrency(1, from, to)
  if (converted == null) {
    return createErrorResponse(ctx, 'NOT_FOUND', `No FX rate for ${from} → ${to}`, 404)
  }
  return createSuccessResponse(ctx, {
    from,
    to,
    rate: converted,
    asOf: null,
    source: 'static',
  })
})
