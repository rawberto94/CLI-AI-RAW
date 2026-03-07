/**
 * Rate Calculation Engine
 */

export class RateCalculationEngine {
  private static instance: RateCalculationEngine;

  private constructor() {}

  public static getInstance(): RateCalculationEngine {
    if (!RateCalculationEngine.instance) {
      RateCalculationEngine.instance = new RateCalculationEngine();
    }
    return RateCalculationEngine.instance;
  }

  calculateRate(hours: number, rate: number): number {
    return hours * rate;
  }

  calculateTotalCost(rates: Array<{ hours: number; rate: number }>): number {
    return rates.reduce((sum, r) => sum + this.calculateRate(r.hours, r.rate), 0);
  }
}

export const rateCalculationEngine = RateCalculationEngine.getInstance();
