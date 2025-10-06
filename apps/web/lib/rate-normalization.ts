// Rate Normalization Service for Procurement Intelligence
// Converts rates to standard units and handles currency conversion

export interface RateInput {
  role: string;
  level: string;
  rate: number;
  unit: RateUnit;
  currency: string;
  hoursPerDay?: number;
  daysPerMonth?: number;
}

export interface NormalizedRate {
  role: string;
  level: string;
  standardizedRole: string; // Normalized role name
  hourlyRate: number;
  dailyRate: number;
  monthlyRate: number;
  annualRate: number;
  currency: string;
  originalRate: number;
  originalUnit: RateUnit;
  confidence: number; // Confidence in normalization accuracy
}

export type RateUnit = 
  | 'hourly' 
  | 'daily' 
  | 'weekly' 
  | 'monthly' 
  | 'annual' 
  | 'per_seat_monthly' 
  | 'per_user_annual'
  | 'fixed_price';

export interface CurrencyRates {
  [currency: string]: number; // Rate relative to USD
}

export interface NormalizationConfig {
  standardHoursPerDay: number;
  standardDaysPerMonth: number;
  standardMonthsPerYear: number;
  baseCurrency: string;
}

export class RateNormalizationService {
  private config: NormalizationConfig;
  private currencyRates: CurrencyRates;
  private roleStandardization: Map<string, string>;

  constructor() {
    this.config = {
      standardHoursPerDay: 8,
      standardDaysPerMonth: 22, // Business days
      standardMonthsPerYear: 12,
      baseCurrency: 'USD'
    };

    // Mock currency rates (in production, fetch from API)
    this.currencyRates = {
      'USD': 1.0,
      'EUR': 1.08,
      'GBP': 1.27,
      'CAD': 0.74,
      'AUD': 0.66,
      'INR': 0.012,
      'JPY': 0.0067
    };

    // Role standardization mapping
    this.roleStandardization = new Map([
      // Senior roles
      ['senior consultant', 'Senior Consultant'],
      ['sr consultant', 'Senior Consultant'],
      ['sr. consultant', 'Senior Consultant'],
      ['senior advisor', 'Senior Consultant'],
      ['principal consultant', 'Principal Consultant'],
      
      // Project management
      ['project manager', 'Project Manager'],
      ['pm', 'Project Manager'],
      ['program manager', 'Program Manager'],
      ['delivery manager', 'Project Manager'],
      
      // Development roles
      ['senior developer', 'Senior Developer'],
      ['sr developer', 'Senior Developer'],
      ['sr. developer', 'Senior Developer'],
      ['senior software engineer', 'Senior Developer'],
      ['lead developer', 'Lead Developer'],
      ['developer', 'Developer'],
      ['software engineer', 'Developer'],
      ['programmer', 'Developer'],
      
      // Architecture roles
      ['technical architect', 'Technical Architect'],
      ['solution architect', 'Solution Architect'],
      ['enterprise architect', 'Enterprise Architect'],
      ['architect', 'Technical Architect'],
      
      // Analysis roles
      ['business analyst', 'Business Analyst'],
      ['ba', 'Business Analyst'],
      ['systems analyst', 'Systems Analyst'],
      ['data analyst', 'Data Analyst'],
      
      // Quality assurance
      ['qa engineer', 'QA Engineer'],
      ['quality assurance', 'QA Engineer'],
      ['test engineer', 'QA Engineer'],
      ['tester', 'QA Engineer'],
      
      // Design roles
      ['ux designer', 'UX Designer'],
      ['ui designer', 'UI Designer'],
      ['designer', 'UX Designer'],
      
      // Operations
      ['devops engineer', 'DevOps Engineer'],
      ['devops', 'DevOps Engineer'],
      ['sre', 'DevOps Engineer'],
      ['site reliability engineer', 'DevOps Engineer']
    ]);
  }

  /**
   * Normalize a single rate to all standard units
   */
  normalizeRate(input: RateInput): NormalizedRate {
    const standardizedRole = this.standardizeRole(input.role);
    const usdRate = this.convertToUSD(input.rate, input.currency);
    
    // Calculate base hourly rate
    const hourlyRate = this.convertToHourly(usdRate, input.unit, input);
    
    // Calculate all standard rates
    const dailyRate = hourlyRate * (input.hoursPerDay || this.config.standardHoursPerDay);
    const monthlyRate = dailyRate * (input.daysPerMonth || this.config.standardDaysPerMonth);
    const annualRate = monthlyRate * this.config.standardMonthsPerYear;

    // Calculate confidence based on conversion complexity
    const confidence = this.calculateConfidence(input.unit, input.currency, input.role);

    return {
      role: input.role,
      level: input.level,
      standardizedRole,
      hourlyRate: Math.round(hourlyRate * 100) / 100,
      dailyRate: Math.round(dailyRate * 100) / 100,
      monthlyRate: Math.round(monthlyRate * 100) / 100,
      annualRate: Math.round(annualRate * 100) / 100,
      currency: this.config.baseCurrency,
      originalRate: input.rate,
      originalUnit: input.unit,
      confidence
    };
  }

  /**
   * Normalize multiple rates
   */
  normalizeRates(inputs: RateInput[]): NormalizedRate[] {
    return inputs.map(input => this.normalizeRate(input));
  }

  /**
   * Convert rate to hourly in original currency
   */
  private convertToHourly(rate: number, unit: RateUnit, input: RateInput): number {
    const hoursPerDay = input.hoursPerDay || this.config.standardHoursPerDay;
    const daysPerMonth = input.daysPerMonth || this.config.standardDaysPerMonth;

    switch (unit) {
      case 'hourly':
        return rate;
      
      case 'daily':
        return rate / hoursPerDay;
      
      case 'weekly':
        return rate / (hoursPerDay * 5); // Assume 5-day work week
      
      case 'monthly':
      case 'per_seat_monthly':
        return rate / (hoursPerDay * daysPerMonth);
      
      case 'annual':
      case 'per_user_annual':
        return rate / (hoursPerDay * daysPerMonth * this.config.standardMonthsPerYear);
      
      case 'fixed_price':
        // For fixed price, assume it's for a standard project duration
        // This is an approximation and should be refined based on project scope
        return rate / (hoursPerDay * daysPerMonth * 6); // Assume 6-month project
      
      default:
        throw new Error(`Unsupported rate unit: ${unit}`);
    }
  }

  /**
   * Convert currency to USD
   */
  private convertToUSD(amount: number, currency: string): number {
    const rate = this.currencyRates[currency.toUpperCase()];
    if (!rate) {
      console.warn(`Currency ${currency} not supported, assuming USD`);
      return amount;
    }
    return amount * rate;
  }

  /**
   * Standardize role names for consistent comparison
   */
  private standardizeRole(role: string): string {
    const normalized = role.toLowerCase().trim();
    return this.roleStandardization.get(normalized) || this.titleCase(role);
  }

  /**
   * Calculate confidence score for the normalization
   */
  private calculateConfidence(unit: RateUnit, currency: string, role: string): number {
    let confidence = 1.0;

    // Reduce confidence for complex conversions
    if (unit === 'fixed_price') confidence *= 0.6;
    if (unit === 'weekly') confidence *= 0.8;
    if (unit === 'annual' || unit === 'per_user_annual') confidence *= 0.9;

    // Reduce confidence for non-USD currencies
    if (currency.toUpperCase() !== 'USD') confidence *= 0.95;

    // Reduce confidence for non-standard roles
    if (!this.roleStandardization.has(role.toLowerCase().trim())) {
      confidence *= 0.85;
    }

    return Math.round(confidence * 100) / 100;
  }

  /**
   * Convert string to title case
   */
  private titleCase(str: string): string {
    return str.replace(/\w\S*/g, (txt) => 
      txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
  }

  /**
   * Get supported currencies
   */
  getSupportedCurrencies(): string[] {
    return Object.keys(this.currencyRates);
  }

  /**
   * Get standardized role mappings
   */
  getStandardizedRoles(): string[] {
    return Array.from(new Set(this.roleStandardization.values()));
  }

  /**
   * Update currency rates (for real-time updates)
   */
  updateCurrencyRates(rates: CurrencyRates): void {
    this.currencyRates = { ...this.currencyRates, ...rates };
  }

  /**
   * Add custom role standardization
   */
  addRoleMapping(variations: string[], standardRole: string): void {
    variations.forEach(variation => {
      this.roleStandardization.set(variation.toLowerCase().trim(), standardRole);
    });
  }

  /**
   * Validate rate input
   */
  validateRateInput(input: RateInput): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!input.role || input.role.trim().length === 0) {
      errors.push('Role is required');
    }

    if (!input.rate || input.rate <= 0) {
      errors.push('Rate must be a positive number');
    }

    if (!input.unit) {
      errors.push('Rate unit is required');
    }

    if (!input.currency || input.currency.length !== 3) {
      errors.push('Currency must be a 3-letter code (e.g., USD, EUR)');
    }

    if (input.hoursPerDay && (input.hoursPerDay <= 0 || input.hoursPerDay > 24)) {
      errors.push('Hours per day must be between 1 and 24');
    }

    if (input.daysPerMonth && (input.daysPerMonth <= 0 || input.daysPerMonth > 31)) {
      errors.push('Days per month must be between 1 and 31');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Export singleton instance
export const rateNormalizer = new RateNormalizationService();

// Utility functions for common operations
export function normalizeRateCard(rates: RateInput[]): NormalizedRate[] {
  return rateNormalizer.normalizeRates(rates);
}

export function convertRate(
  rate: number, 
  fromUnit: RateUnit, 
  toUnit: RateUnit, 
  currency: string = 'USD'
): number {
  const input: RateInput = {
    role: 'temp',
    level: 'temp',
    rate,
    unit: fromUnit,
    currency
  };
  
  const normalized = rateNormalizer.normalizeRate(input);
  
  switch (toUnit) {
    case 'hourly': return normalized.hourlyRate;
    case 'daily': return normalized.dailyRate;
    case 'monthly': return normalized.monthlyRate;
    case 'annual': return normalized.annualRate;
    default: return normalized.hourlyRate;
  }
}

export function standardizeRoleName(role: string): string {
  return rateNormalizer['standardizeRole'](role);
}