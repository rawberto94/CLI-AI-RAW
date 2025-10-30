import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ExchangeRate {
  from: string;
  to: string;
  rate: number;
  timestamp: Date;
}

interface CurrencyConversionResult {
  originalAmount: number;
  originalCurrency: string;
  convertedAmount: number;
  targetCurrency: string;
  exchangeRate: number;
  timestamp: Date;
}

interface CurrencyVolatilityAlert {
  currency: string;
  baseCurrency: string;
  changePercent: number;
  previousRate: number;
  currentRate: number;
  timestamp: Date;
}

export class CurrencyAdvancedService {
  private cache: Map<string, { rate: number; timestamp: Date }> = new Map();
  private readonly CACHE_TTL_MS = 3600000; // 1 hour
  private readonly API_URL = 'https://api.exchangerate-api.io/v4/latest';
  private readonly VOLATILITY_THRESHOLD = 5; // 5% change threshold

  /**
   * Get real-time exchange rate from API or cache
   */
  async getExchangeRate(from: string, to: string): Promise<number> {
    if (from === to) return 1;

    const cacheKey = `${from}_${to}`;
    const cached = this.cache.get(cacheKey);

    // Return cached rate if still valid
    if (cached && Date.now() - cached.timestamp.getTime() < this.CACHE_TTL_MS) {
      return cached.rate;
    }

    // Fetch fresh rate from API
    const rate = await this.fetchExchangeRate(from, to);
    
    // Cache the rate
    this.cache.set(cacheKey, { rate, timestamp: new Date() });

    // Store in database for historical tracking
    await this.storeExchangeRate(from, to, rate);

    return rate;
  }

  /**
   * Fetch exchange rate from external API
   */
  private async fetchExchangeRate(from: string, to: string): Promise<number> {
    try {
      // Using exchangerate-api.io (free tier available)
      const response = await fetch(`${this.API_URL}/${from}`);
      
      if (!response.ok) {
        throw new Error(`Exchange rate API error: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.rates || !data.rates[to]) {
        throw new Error(`Exchange rate not found for ${from} to ${to}`);
      }

      return data.rates[to];
    } catch (error) {
      console.error('Error fetching exchange rate:', error);
      
      // Fallback to last known rate from database
      const lastKnown = await this.getLastKnownRate(from, to);
      if (lastKnown) {
        return lastKnown;
      }

      throw new Error(`Unable to fetch exchange rate for ${from} to ${to}`);
    }
  }

  /**
   * Store exchange rate in database for historical tracking
   */
  private async storeExchangeRate(from: string, to: string, rate: number): Promise<void> {
    try {
      await prisma.exchangeRate.create({
        data: {
          fromCurrency: from,
          toCurrency: to,
          rate,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      console.error('Error storing exchange rate:', error);
      // Non-critical error, continue
    }
  }

  /**
   * Get last known exchange rate from database
   */
  private async getLastKnownRate(from: string, to: string): Promise<number | null> {
    try {
      const lastRate = await prisma.exchangeRate.findFirst({
        where: {
          fromCurrency: from,
          toCurrency: to,
        },
        orderBy: {
          timestamp: 'desc',
        },
      });

      return lastRate?.rate || null;
    } catch (error) {
      console.error('Error fetching last known rate:', error);
      return null;
    }
  }

  /**
   * Convert amount from one currency to another
   */
  async convertCurrency(
    amount: number,
    from: string,
    to: string
  ): Promise<CurrencyConversionResult> {
    const rate = await this.getExchangeRate(from, to);
    const convertedAmount = amount * rate;

    return {
      originalAmount: amount,
      originalCurrency: from,
      convertedAmount,
      targetCurrency: to,
      exchangeRate: rate,
      timestamp: new Date(),
    };
  }

  /**
   * Detect currency volatility and generate alerts
   */
  async detectVolatility(baseCurrency: string = 'USD'): Promise<CurrencyVolatilityAlert[]> {
    const alerts: CurrencyVolatilityAlert[] = [];
    const currencies = ['EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR'];

    for (const currency of currencies) {
      if (currency === baseCurrency) continue;

      try {
        // Get current rate
        const currentRate = await this.getExchangeRate(baseCurrency, currency);

        // Get rate from 24 hours ago
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const historicalRate = await prisma.exchangeRate.findFirst({
          where: {
            fromCurrency: baseCurrency,
            toCurrency: currency,
            timestamp: {
              gte: yesterday,
            },
          },
          orderBy: {
            timestamp: 'asc',
          },
        });

        if (historicalRate) {
          const changePercent = ((currentRate - historicalRate.rate) / historicalRate.rate) * 100;

          if (Math.abs(changePercent) >= this.VOLATILITY_THRESHOLD) {
            alerts.push({
              currency,
              baseCurrency,
              changePercent,
              previousRate: historicalRate.rate,
              currentRate,
              timestamp: new Date(),
            });
          }
        }
      } catch (error) {
        console.error(`Error checking volatility for ${currency}:`, error);
      }
    }

    return alerts;
  }

  /**
   * Get historical exchange rate for a specific date
   */
  async getHistoricalRate(from: string, to: string, date: Date): Promise<number> {
    if (from === to) return 1;

    // Find closest rate to the requested date
    const historicalRate = await prisma.exchangeRate.findFirst({
      where: {
        fromCurrency: from,
        toCurrency: to,
        timestamp: {
          lte: date,
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
    });

    if (historicalRate) {
      return historicalRate.rate;
    }

    // If no historical rate found, use current rate
    console.warn(`No historical rate found for ${from} to ${to} on ${date}, using current rate`);
    return await this.getExchangeRate(from, to);
  }

  /**
   * Convert historical amount using historical exchange rate
   */
  async convertHistoricalCurrency(
    amount: number,
    from: string,
    to: string,
    date: Date
  ): Promise<CurrencyConversionResult> {
    const rate = await this.getHistoricalRate(from, to, date);
    const convertedAmount = amount * rate;

    return {
      originalAmount: amount,
      originalCurrency: from,
      convertedAmount,
      targetCurrency: to,
      exchangeRate: rate,
      timestamp: date,
    };
  }

  /**
   * Update all exchange rates (called by scheduled job)
   */
  async updateAllRates(baseCurrency: string = 'USD'): Promise<void> {
    const currencies = ['EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR', 'BRL', 'MXN'];

    for (const currency of currencies) {
      if (currency === baseCurrency) continue;

      try {
        await this.getExchangeRate(baseCurrency, currency);
        console.log(`Updated exchange rate: ${baseCurrency} to ${currency}`);
      } catch (error) {
        console.error(`Failed to update rate for ${currency}:`, error);
      }
    }
  }

  /**
   * Get rates affected by volatility for a tenant
   */
  async getRatesAffectedByVolatility(tenantId: string): Promise<any[]> {
    const volatilityAlerts = await this.detectVolatility();
    
    if (volatilityAlerts.length === 0) {
      return [];
    }

    const affectedCurrencies = volatilityAlerts.map(alert => alert.currency);

    // Find rate cards using these currencies
    const affectedRates = await prisma.rateCardEntry.findMany({
      where: {
        tenantId,
        currency: {
          in: affectedCurrencies,
        },
      },
      include: {
        supplier: true,
      },
    });

    return affectedRates.map(rate => {
      const alert = volatilityAlerts.find(a => a.currency === rate.currency);
      return {
        ...rate,
        volatilityAlert: alert,
      };
    });
  }

  /**
   * Clear cache (useful for testing or forced refresh)
   */
  clearCache(): void {
    this.cache.clear();
  }
}

export const currencyAdvancedService = new CurrencyAdvancedService();
