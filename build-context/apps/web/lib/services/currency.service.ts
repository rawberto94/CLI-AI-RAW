/**
 * Currency Service
 * Provides currency conversion and PPP adjustment services
 */

interface ConversionResult {
  success: boolean;
  fromCurrency: string;
  toCurrency: string;
  amount: number;
  convertedAmount: number;
  rate: number;
  timestamp: string;
}

interface PPPAdjustmentResult {
  success: boolean;
  amount: number;
  fromCountry: string;
  toCountry: string;
  adjustedAmount: number;
  pppFactor: number;
  timestamp: string;
}

/**
 * Convert amount from one currency to another
 */
export async function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<ConversionResult> {
  try {
    const response = await fetch('/api/rate-cards/currency/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount,
        fromCurrency: fromCurrency.toUpperCase(),
        toCurrency: toCurrency.toUpperCase(),
      }),
    });

    if (!response.ok) {
      throw new Error(`Currency conversion failed: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      fromCurrency: fromCurrency.toUpperCase(),
      toCurrency: toCurrency.toUpperCase(),
      amount,
      convertedAmount: data.convertedAmount || data.data?.convertedAmount,
      rate: data.rate || data.data?.rate || 1,
      timestamp: new Date().toISOString(),
    };
  } catch {
    return {
      success: false,
      fromCurrency: fromCurrency.toUpperCase(),
      toCurrency: toCurrency.toUpperCase(),
      amount,
      convertedAmount: amount,
      rate: 1,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Adjust amount using PPP (Purchasing Power Parity)
 */
export async function adjustWithPPP(
  amount: number,
  fromCountry: string,
  toCountry: string
): Promise<PPPAdjustmentResult> {
  try {
    const response = await fetch('/api/rate-cards/currency/ppp-adjust', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount,
        fromCountry,
        toCountry,
      }),
    });

    if (!response.ok) {
      throw new Error(`PPP adjustment failed: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      amount,
      fromCountry,
      toCountry,
      adjustedAmount: data.adjustedAmount || data.data?.adjustedAmount,
      pppFactor: data.pppFactor || data.data?.pppFactor || 1,
      timestamp: new Date().toISOString(),
    };
  } catch {
    return {
      success: false,
      amount,
      fromCountry,
      toCountry,
      adjustedAmount: amount,
      pppFactor: 1,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Get current exchange rate
 */
export async function getExchangeRate(
  fromCurrency: string,
  toCurrency: string
): Promise<number> {
  try {
    const response = await fetch(
      `/api/rate-cards/currency/exchange-rate?from=${fromCurrency}&to=${toCurrency}`
    );

    if (!response.ok) {
      throw new Error(`Failed to get exchange rate: ${response.status}`);
    }

    const data = await response.json();
    return data.rate || data.data?.rate || 1;
  } catch {
    return 1;
  }
}

/**
 * Format currency value with symbol
 */
export function formatCurrency(
  amount: number,
  currency: string = 'USD',
  locale: string = 'en-US'
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/**
 * Currency conversion hook for React components
 */
export function useCurrencyConverter() {
  return {
    convert: convertCurrency,
    adjustPPP: adjustWithPPP,
    getRate: getExchangeRate,
    format: formatCurrency,
  };
}

export const currencyService = {
  convert: convertCurrency,
  adjustPPP: adjustWithPPP,
  getRate: getExchangeRate,
  format: formatCurrency,
};
