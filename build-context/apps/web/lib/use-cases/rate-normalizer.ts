/**
 * Rate Normalization Utility
 * Converts rates from various periods and currencies to daily CHF
 */

export type RatePeriod = 'hourly' | 'daily' | 'monthly' | 'annual'
export type Currency = 'CHF' | 'USD' | 'EUR' | 'GBP' | 'INR'

export interface NormalizedRate {
  dailyRateCHF: number
  originalRate: number
  originalPeriod: RatePeriod
  originalCurrency: Currency
  exchangeRate?: number
  exchangeRateDate?: Date
}

export interface ConversionFactors {
  hoursPerDay: number
  workingDaysPerMonth: number
  workingDaysPerYear: number
}

export class RateNormalizer {
  // Standard conversion factors
  private static readonly DEFAULT_FACTORS: ConversionFactors = {
    hoursPerDay: 8,
    workingDaysPerMonth: 21.67, // Average working days per month
    workingDaysPerYear: 260 // 52 weeks × 5 days
  }

  // Exchange rates (as of Feb 2025 - in production, fetch from API)
  private static readonly EXCHANGE_RATES: Record<Currency, number> = {
    CHF: 1.0,
    USD: 0.88, // 1 USD = 0.88 CHF
    EUR: 0.94, // 1 EUR = 0.94 CHF
    GBP: 1.10, // 1 GBP = 1.10 CHF
    INR: 0.011 // 1 INR = 0.011 CHF
  }

  private conversionFactors: ConversionFactors

  constructor(customFactors?: Partial<ConversionFactors>) {
    this.conversionFactors = {
      ...RateNormalizer.DEFAULT_FACTORS,
      ...customFactors
    }
  }

  /**
   * Normalize any rate to daily CHF
   */
  normalizeToDailyCHF(
    rate: number,
    period: RatePeriod,
    currency: Currency = 'CHF'
  ): NormalizedRate {
    // First convert to daily in original currency
    const dailyRateOriginalCurrency = this.convertToDaily(rate, period)

    // Then convert to CHF
    const dailyRateCHF = this.convertToCHF(dailyRateOriginalCurrency, currency)

    const exchangeRate = currency !== 'CHF' 
      ? RateNormalizer.EXCHANGE_RATES[currency]
      : undefined

    return {
      dailyRateCHF: Math.round(dailyRateCHF * 100) / 100, // Round to 2 decimals
      originalRate: rate,
      originalPeriod: period,
      originalCurrency: currency,
      exchangeRate,
      exchangeRateDate: exchangeRate ? new Date() : undefined
    }
  }

  /**
   * Convert rate to daily in original currency
   */
  private convertToDaily(rate: number, period: RatePeriod): number {
    switch (period) {
      case 'hourly':
        return rate * this.conversionFactors.hoursPerDay
      case 'daily':
        return rate
      case 'monthly':
        return rate / this.conversionFactors.workingDaysPerMonth
      case 'annual':
        return rate / this.conversionFactors.workingDaysPerYear
      default:
        throw new Error(`Unknown rate period: ${period}`)
    }
  }

  /**
   * Convert currency to CHF
   */
  convertToCHF(amount: number, fromCurrency: Currency): number {
    if (fromCurrency === 'CHF') {
      return amount
    }

    const exchangeRate = RateNormalizer.EXCHANGE_RATES[fromCurrency]
    if (!exchangeRate) {
      throw new Error(`Unknown currency: ${fromCurrency}`)
    }

    return amount * exchangeRate
  }

  /**
   * Convert daily CHF back to original period and currency
   */
  denormalize(
    dailyRateCHF: number,
    targetPeriod: RatePeriod,
    targetCurrency: Currency = 'CHF'
  ): number {
    // First convert from CHF to target currency
    let rate = dailyRateCHF
    if (targetCurrency !== 'CHF') {
      const exchangeRate = RateNormalizer.EXCHANGE_RATES[targetCurrency]
      if (!exchangeRate) {
        throw new Error(`Unknown currency: ${targetCurrency}`)
      }
      rate = rate / exchangeRate
    }

    // Then convert from daily to target period
    switch (targetPeriod) {
      case 'hourly':
        return rate / this.conversionFactors.hoursPerDay
      case 'daily':
        return rate
      case 'monthly':
        return rate * this.conversionFactors.workingDaysPerMonth
      case 'annual':
        return rate * this.conversionFactors.workingDaysPerYear
      default:
        throw new Error(`Unknown rate period: ${targetPeriod}`)
    }
  }

  /**
   * Format CHF amount for display
   */
  static formatCHF(amount: number, options?: {
    showCurrency?: boolean
    decimals?: number
    compact?: boolean
  }): string {
    const {
      showCurrency = true,
      decimals = 2,
      compact = false
    } = options ?? {}

    // Format number with thousand separators
    const formatted = new Intl.NumberFormat('de-CH', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(amount)

    if (compact) {
      return showCurrency ? `CHF ${formatted}` : formatted
    }

    return showCurrency ? `CHF ${formatted}` : formatted
  }

  /**
   * Format daily rate with period indicator
   */
  static formatDailyRate(dailyRateCHF: number, showPeriod: boolean = true): string {
    const formatted = RateNormalizer.formatCHF(dailyRateCHF)
    return showPeriod ? `${formatted} / day` : formatted
  }

  /**
   * Format original rate with period
   */
  static formatOriginalRate(
    rate: number,
    period: RatePeriod,
    currency: Currency
  ): string {
    const currencySymbol = RateNormalizer.getCurrencySymbol(currency)
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(rate)

    const periodLabel = {
      hourly: '/hr',
      daily: '/day',
      monthly: '/mo',
      annual: '/yr'
    }[period]

    return `${currencySymbol}${formatted}${periodLabel}`
  }

  /**
   * Get currency symbol
   */
  private static getCurrencySymbol(currency: Currency): string {
    const symbols: Record<Currency, string> = {
      CHF: 'CHF ',
      USD: '$',
      EUR: '€',
      GBP: '£',
      INR: '₹'
    }
    return symbols[currency] ?? currency
  }

  /**
   * Calculate annual cost from daily rate
   */
  static calculateAnnualCost(
    dailyRateCHF: number,
    fteCount: number = 1,
    workingDaysPerYear: number = 260
  ): number {
    return dailyRateCHF * fteCount * workingDaysPerYear
  }

  /**
   * Calculate monthly cost from daily rate
   */
  static calculateMonthlyCost(
    dailyRateCHF: number,
    fteCount: number = 1,
    workingDaysPerMonth: number = 21.67
  ): number {
    return dailyRateCHF * fteCount * workingDaysPerMonth
  }

  /**
   * Get exchange rate for a currency
   */
  static getExchangeRate(currency: Currency): number {
    return RateNormalizer.EXCHANGE_RATES[currency] ?? 1
  }

  /**
   * Get all supported currencies
   */
  static getSupportedCurrencies(): Currency[] {
    return Object.keys(RateNormalizer.EXCHANGE_RATES) as Currency[]
  }
}

// Export singleton instance with default factors
export const rateNormalizer = new RateNormalizer()

// Export utility functions
export const {
  formatCHF,
  formatDailyRate,
  formatOriginalRate,
  calculateAnnualCost,
  calculateMonthlyCost,
  getExchangeRate,
  getSupportedCurrencies
} = RateNormalizer
