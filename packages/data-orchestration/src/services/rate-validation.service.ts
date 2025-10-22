/**
 * Rate Validation Service
 */

export interface RateValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

class RateValidationService {
  private static instance: RateValidationService;

  private constructor() {}

  public static getInstance(): RateValidationService {
    if (!RateValidationService.instance) {
      RateValidationService.instance = new RateValidationService();
    }
    return RateValidationService.instance;
  }

  async validateRate(rate: any): Promise<RateValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!rate.rate || rate.rate <= 0) {
      errors.push('Rate must be greater than 0');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

export const rateValidationService = RateValidationService.getInstance();
