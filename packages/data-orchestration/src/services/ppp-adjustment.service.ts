import { prisma } from '../lib/prisma';


interface PPPData {
  country: string;
  pppFactor: number; // Relative to USD
  year: number;
  source: string;
}

interface PPPAdjustedRate {
  originalRate: number;
  originalCurrency: string;
  originalCountry: string;
  pppAdjustedRate: number;
  pppFactor: number;
  adjustmentPercentage: number;
}

/**
 * Purchasing Power Parity (PPP) Adjustment Service
 * Adjusts rates for cost-of-living differences across countries
 */
export class PPPAdjustmentService {
  // PPP factors relative to USD (2024 data from World Bank/OECD)
  // Factor > 1 means higher cost of living, < 1 means lower
  private pppFactors: Map<string, number> = new Map([
    // High cost countries
    ['CHE', 1.35], // Switzerland
    ['NOR', 1.25], // Norway
    ['ISL', 1.22], // Iceland
    ['DNK', 1.18], // Denmark
    ['AUS', 1.15], // Australia
    ['SWE', 1.12], // Sweden
    ['GBR', 1.10], // United Kingdom
    ['FIN', 1.08], // Finland
    ['NLD', 1.07], // Netherlands
    ['AUT', 1.06], // Austria
    ['BEL', 1.05], // Belgium
    ['DEU', 1.04], // Germany
    ['FRA', 1.03], // France
    ['IRL', 1.02], // Ireland
    ['USA', 1.00], // United States (baseline)
    
    // Medium cost countries
    ['CAN', 0.98], // Canada
    ['ITA', 0.95], // Italy
    ['ESP', 0.92], // Spain
    ['JPN', 0.90], // Japan
    ['KOR', 0.88], // South Korea
    ['PRT', 0.85], // Portugal
    ['GRC', 0.82], // Greece
    ['POL', 0.75], // Poland
    ['CZE', 0.72], // Czech Republic
    ['HUN', 0.68], // Hungary
    
    // Lower cost countries
    ['MEX', 0.65], // Mexico
    ['BRA', 0.62], // Brazil
    ['TUR', 0.58], // Turkey
    ['CHN', 0.55], // China
    ['ZAF', 0.52], // South Africa
    ['RUS', 0.50], // Russia
    ['IND', 0.42], // India
    ['PHL', 0.40], // Philippines
    ['VNM', 0.38], // Vietnam
    ['IDN', 0.36], // Indonesia
  ]);

  /**
   * Get PPP factor for a country
   */
  getPPPFactor(countryCode: string): number {
    const factor = this.pppFactors.get(countryCode.toUpperCase());
    if (!factor) {
      // PPP factor not found for country, using 1.0 as default
      return 1.0;
    }
    return factor;
  }

  /**
   * Adjust rate for PPP
   */
  adjustRateForPPP(
    rate: number,
    fromCountry: string,
    toCountry: string = 'USA'
  ): PPPAdjustedRate {
    const fromPPP = this.getPPPFactor(fromCountry);
    const toPPP = this.getPPPFactor(toCountry);
    
    // Adjust rate: rate * (toPPP / fromPPP)
    const adjustmentFactor = toPPP / fromPPP;
    const adjustedRate = rate * adjustmentFactor;
    const adjustmentPercentage = ((adjustedRate - rate) / rate) * 100;

    return {
      originalRate: rate,
      originalCurrency: 'USD', // Assuming rates are in USD
      originalCountry: fromCountry,
      pppAdjustedRate: adjustedRate,
      pppFactor: adjustmentFactor,
      adjustmentPercentage,
    };
  }

  /**
   * Adjust multiple rates for PPP
   */
  adjustRatesForPPP(
    rates: Array<{ rate: number; country: string }>,
    targetCountry: string = 'USA'
  ): PPPAdjustedRate[] {
    return rates.map(({ rate, country }) =>
      this.adjustRateForPPP(rate, country, targetCountry)
    );
  }

  /**
   * Compare rates across countries with PPP adjustment
   */
  compareRatesWithPPP(
    rate1: { value: number; country: string },
    rate2: { value: number; country: string }
  ): {
    nominalDifference: number;
    nominalDifferencePercent: number;
    pppAdjustedDifference: number;
    pppAdjustedDifferencePercent: number;
    recommendation: string;
  } {
    // Nominal comparison
    const nominalDifference = rate2.value - rate1.value;
    const nominalDifferencePercent = (nominalDifference / rate1.value) * 100;

    // PPP adjusted comparison
    const adjusted1 = this.adjustRateForPPP(rate1.value, rate1.country);
    const adjusted2 = this.adjustRateForPPP(rate2.value, rate2.country);
    const pppAdjustedDifference = adjusted2.pppAdjustedRate - adjusted1.pppAdjustedRate;
    const pppAdjustedDifferencePercent =
      (pppAdjustedDifference / adjusted1.pppAdjustedRate) * 100;

    // Generate recommendation
    let recommendation = '';
    if (Math.abs(nominalDifferencePercent - pppAdjustedDifferencePercent) > 10) {
      recommendation = `PPP adjustment significantly changes the comparison. `;
      if (pppAdjustedDifferencePercent < nominalDifferencePercent) {
        recommendation += `${rate2.country} is more competitive when adjusted for cost of living.`;
      } else {
        recommendation += `${rate1.country} is more competitive when adjusted for cost of living.`;
      }
    } else {
      recommendation = 'PPP adjustment has minimal impact on the comparison.';
    }

    return {
      nominalDifference,
      nominalDifferencePercent,
      pppAdjustedDifference,
      pppAdjustedDifferencePercent,
      recommendation,
    };
  }

  /**
   * Get all PPP factors
   */
  getAllPPPFactors(): PPPData[] {
    const factors: PPPData[] = [];
    this.pppFactors.forEach((factor, country) => {
      factors.push({
        country,
        pppFactor: factor,
        year: 2024,
        source: 'World Bank/OECD',
      });
    });
    return factors.sort((a, b) => b.pppFactor - a.pppFactor);
  }

  /**
   * Calculate PPP-adjusted benchmarks for rate cards
   */
  async calculatePPPAdjustedBenchmarks(
    tenantId: string,
    roleStandardized: string,
    seniority: string,
    targetCountry: string = 'USA'
  ): Promise<{
    nominalBenchmark: { median: number; mean: number; p25: number; p75: number };
    pppAdjustedBenchmark: { median: number; mean: number; p25: number; p75: number };
    sampleSize: number;
    countries: string[];
  }> {
    // Fetch rate cards for the role
    const rateCards = await prisma.rateCardEntry.findMany({
      where: {
        tenantId,
        roleStandardized,
        seniority: seniority as any,
      },
      select: {
        dailyRateUSD: true,
        country: true,
      },
    });

    if (rateCards.length === 0) {
      throw new Error('No rate cards found for the specified criteria');
    }

    // Calculate nominal benchmarks
    const nominalRates = rateCards.map(rc => Number(rc.dailyRateUSD));
    const nominalSorted = nominalRates.sort((a, b) => a - b);
    
    const nominalBenchmark = {
      median: this.calculateMedian(nominalSorted),
      mean: this.calculateMean(nominalSorted),
      p25: this.calculatePercentile(nominalSorted, 25),
      p75: this.calculatePercentile(nominalSorted, 75),
    };

    // Calculate PPP-adjusted benchmarks
    const pppAdjustedRates = rateCards.map(rc => {
      const adjusted = this.adjustRateForPPP(Number(rc.dailyRateUSD), rc.country, targetCountry);
      return adjusted.pppAdjustedRate;
    });
    const pppSorted = pppAdjustedRates.sort((a, b) => a - b);
    
    const pppAdjustedBenchmark = {
      median: this.calculateMedian(pppSorted),
      mean: this.calculateMean(pppSorted),
      p25: this.calculatePercentile(pppSorted, 25),
      p75: this.calculatePercentile(pppSorted, 75),
    };

    const countries = [...new Set(rateCards.map(rc => rc.country))];

    return {
      nominalBenchmark,
      pppAdjustedBenchmark,
      sampleSize: rateCards.length,
      countries,
    };
  }

  /**
   * Helper: Calculate median
   */
  private calculateMedian(sortedArray: number[]): number {
    const mid = Math.floor(sortedArray.length / 2);
    return sortedArray.length % 2 === 0
      ? (sortedArray[mid - 1] + sortedArray[mid]) / 2
      : sortedArray[mid];
  }

  /**
   * Helper: Calculate mean
   */
  private calculateMean(array: number[]): number {
    return array.reduce((sum, val) => sum + val, 0) / array.length;
  }

  /**
   * Helper: Calculate percentile
   */
  private calculatePercentile(sortedArray: number[], percentile: number): number {
    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    
    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }

  /**
   * Add PPP factor to country (for admin use)
   */
  addPPPFactor(countryCode: string, factor: number): void {
    this.pppFactors.set(countryCode.toUpperCase(), factor);
  }

  /**
   * Update PPP factor for country (for admin use)
   */
  updatePPPFactor(countryCode: string, factor: number): void {
    if (!this.pppFactors.has(countryCode.toUpperCase())) {
      throw new Error(`PPP factor not found for country: ${countryCode}`);
    }
    this.pppFactors.set(countryCode.toUpperCase(), factor);
  }
}

export const pppAdjustmentService = new PPPAdjustmentService();
