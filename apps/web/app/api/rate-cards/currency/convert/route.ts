/**
 * Currency Conversion API
 * POST /api/rate-cards/currency/convert
 * Converts currency amounts for rate card preview
 */

import { NextRequest, NextResponse } from 'next/server';

// Simple conversion rates (in production, use a real-time FX API)
const EXCHANGE_RATES: Record<string, { usd: number; chf: number }> = {
  USD: { usd: 1.0, chf: 0.88 },
  EUR: { usd: 1.08, chf: 0.95 },
  GBP: { usd: 1.27, chf: 1.12 },
  CHF: { usd: 1.14, chf: 1.0 },
  CAD: { usd: 0.72, chf: 0.63 },
  AUD: { usd: 0.65, chf: 0.57 },
  INR: { usd: 0.012, chf: 0.011 },
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amount, from } = body;

    if (!amount || !from) {
      return NextResponse.json(
        { error: 'amount and from currency are required' },
        { status: 400 }
      );
    }

    const rate = EXCHANGE_RATES[from.toUpperCase()] ?? EXCHANGE_RATES['USD']!;

    const converted = {
      usd: amount * rate.usd,
      chf: amount * rate.chf,
      originalAmount: amount,
      originalCurrency: from,
    };

    return NextResponse.json(converted);
  } catch (error) {
    console.error('Error converting currency:', error);
    return NextResponse.json(
      { error: 'Failed to convert currency' },
      { status: 500 }
    );
  }
}
