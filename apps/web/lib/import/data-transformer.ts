// @ts-nocheck
/**
 * Data transformation service for rate card normalization
 */

export interface TransformationOptions {
  baseCurrency?: string;
  exchangeRates?: Record<string, number>;
  roleTaxonomy?: Record<string, string>;
  geographyMapping?: Record<string, { region: string; country: string }>;
}

export interface TransformedRate {
  originalRole: string;
  standardizedRole: string;
  roleCategory: string;
  seniorityLevel: string;
  
  originalRate: number;
  originalPeriod: string;
  originalCurrency: string;
  
  hourlyRate: number;
  dailyRate: number;
  monthlyRate: number;
  annualRate: number;
  baseCurrency: string;
  
  originalLocation?: string;
  geography?: string;
  region?: string;
  country?: string;
  
  serviceLine?: string;
  skills?: string[];
  experience?: number;
  
  confidence: number;
  transformations: string[];
}

export class DataTransformer {
  private static readonly DEFAULT_EXCHANGE_RATES: Record<string, number> = {
    'USD': 0.92, // to CHF
    'EUR': 0.98,
    'GBP': 1.14,
    'CHF': 1.00,
    'CAD': 0.68,
    'AUD': 0.60,
    'INR': 0.011,
  };

  private static readonly HOURS_PER_DAY = 8;
  private static readonly DAYS_PER_MONTH = 21;
  private static readonly MONTHS_PER_YEAR = 12;

  /**
   * Transform rate card data
   */
  static transform(
    rows: Record<string, any>[],
    mappings: Record<string, string>,
    options: TransformationOptions = {}
  ): TransformedRate[] {
    const baseCurrency = options.baseCurrency || 'CHF';
    const exchangeRates = { ...this.DEFAULT_EXCHANGE_RATES, ...options.exchangeRates };

    return rows.map(row => this.transformRow(row, mappings, baseCurrency, exchangeRates, options));
  }

  /**
   * Transform a single row
   */
  private static transformRow(
    row: Record<string, any>,
    mappings: Record<string, string>,
    baseCurrency: string,
    exchangeRates: Record<string, number>,
    options: TransformationOptions
  ): TransformedRate {
    const transformations: string[] = [];
    let confidence = 1.0;

    // Extract mapped values
    const getValue = (field: string) => {
      const sourceField = Object.keys(mappings).find(k => mappings[k] === field);
      return sourceField ? row[sourceField] : undefined;
    };

    // Role standardization
    const originalRole = String(getValue('role') || '').trim();
    const { standardizedRole, category, seniority } = this.standardizeRole(originalRole, options.roleTaxonomy);
    if (standardizedRole !== originalRole) {
      transformations.push('role_standardized');
      confidence *= 0.95;
    }

    // Rate normalization
    const originalRate = Number(getValue('rate'));
    const originalPeriod = this.normalizePeriod(String(getValue('period') || 'daily'));
    const originalCurrency = String(getValue('currency') || 'CHF').toUpperCase();

    const normalizedRates = this.normalizeRates(
      originalRate,
      originalPeriod,
      originalCurrency,
      baseCurrency,
      exchangeRates
    );

    if (originalCurrency !== baseCurrency) {
      transformations.push('currency_converted');
      confidence *= 0.98;
    }

    if (originalPeriod !== 'daily') {
      transformations.push('period_normalized');
    }

    // Geography mapping
    const originalLocation = getValue('location');
    const geography = originalLocation ? this.mapGeography(String(originalLocation), options.geographyMapping) : undefined;
    if (geography && geography.country !== originalLocation) {
      transformations.push('geography_mapped');
      confidence *= 0.95;
    }

    // Service line
    const serviceLine = getValue('serviceLine') || this.inferServiceLine(standardizedRole);
    if (!getValue('serviceLine')) {
      transformations.push('service_line_inferred');
      confidence *= 0.9;
    }

    // Skills
    const skillsValue = getValue('skills');
    const skills = skillsValue ? this.parseSkills(skillsValue) : [];

    // Experience
    const experienceValue = getValue('experience');
    const experience = experienceValue ? this.parseExperience(experienceValue) : undefined;

    return {
      originalRole,
      standardizedRole,
      roleCategory: category,
      seniorityLevel: seniority,
      
      originalRate,
      originalPeriod,
      originalCurrency,
      
      ...normalizedRates,
      baseCurrency,
      
      originalLocation: originalLocation ? String(originalLocation) : undefined,
      geography: geography?.country,
      region: geography?.region,
      country: geography?.country,
      
      serviceLine,
      skills,
      experience,
      
      confidence,
      transformations,
    };
  }

  /**
   * Standardize role name
   */
  private static standardizeRole(
    role: string,
    taxonomy?: Record<string, string>
  ): { standardizedRole: string; category: string; seniority: string } {
    // Use taxonomy if provided
    if (taxonomy && taxonomy[role.toLowerCase()]) {
      const standardized = taxonomy[role.toLowerCase()];
      return {
        standardizedRole: standardized,
        category: this.inferCategory(standardized),
        seniority: this.inferSeniority(standardized),
      };
    }

    // Basic standardization
    let standardized = role
      .replace(/\b(sr|snr)\b/gi, 'Senior')
      .replace(/\b(jr|jnr)\b/gi, 'Junior')
      .replace(/\b(mgr|mngr)\b/gi, 'Manager')
      .replace(/\b(dev|developer)\b/gi, 'Developer')
      .replace(/\b(eng|engineer)\b/gi, 'Engineer')
      .replace(/\b(cons|consultant)\b/gi, 'Consultant')
      .replace(/\b(arch|architect)\b/gi, 'Architect')
      .trim();

    // Capitalize properly
    standardized = standardized
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    return {
      standardizedRole: standardized,
      category: this.inferCategory(standardized),
      seniority: this.inferSeniority(standardized),
    };
  }

  /**
   * Infer role category
   */
  private static inferCategory(role: string): string {
    const roleLower = role.toLowerCase();

    if (roleLower.includes('developer') || roleLower.includes('engineer') || roleLower.includes('programmer')) {
      return 'Engineering';
    }
    if (roleLower.includes('consultant') || roleLower.includes('advisor')) {
      return 'Consulting';
    }
    if (roleLower.includes('manager') || roleLower.includes('director') || roleLower.includes('lead')) {
      return 'Management';
    }
    if (roleLower.includes('analyst') || roleLower.includes('researcher')) {
      return 'Analysis';
    }
    if (roleLower.includes('architect') || roleLower.includes('designer')) {
      return 'Architecture';
    }

    return 'General';
  }

  /**
   * Infer seniority level
   */
  private static inferSeniority(role: string): string {
    const roleLower = role.toLowerCase();

    if (roleLower.includes('junior') || roleLower.includes('jr') || roleLower.includes('entry')) {
      return 'Junior';
    }
    if (roleLower.includes('senior') || roleLower.includes('sr') || roleLower.includes('lead')) {
      return 'Senior';
    }
    if (roleLower.includes('principal') || roleLower.includes('staff') || roleLower.includes('expert')) {
      return 'Principal';
    }
    if (roleLower.includes('director') || roleLower.includes('vp') || roleLower.includes('head')) {
      return 'Director';
    }
    if (roleLower.includes('partner') || roleLower.includes('executive')) {
      return 'Partner';
    }

    return 'Mid';
  }

  /**
   * Normalize rate period
   */
  private static normalizePeriod(period: string): string {
    const periodLower = period.toLowerCase();

    if (periodLower.includes('hour')) return 'hourly';
    if (periodLower.includes('day')) return 'daily';
    if (periodLower.includes('month')) return 'monthly';
    if (periodLower.includes('year') || periodLower.includes('annual')) return 'annual';

    return 'daily'; // Default
  }

  /**
   * Normalize rates to all periods
   */
  private static normalizeRates(
    rate: number,
    period: string,
    currency: string,
    baseCurrency: string,
    exchangeRates: Record<string, number>
  ): {
    hourlyRate: number;
    dailyRate: number;
    monthlyRate: number;
    annualRate: number;
  } {
    // Convert to base currency
    const exchangeRate = exchangeRates[currency] || 1;
    const rateInBaseCurrency = rate * exchangeRate;

    // Convert to daily rate first
    let dailyRate: number;

    switch (period) {
      case 'hourly':
        dailyRate = rateInBaseCurrency * this.HOURS_PER_DAY;
        break;
      case 'monthly':
        dailyRate = rateInBaseCurrency / this.DAYS_PER_MONTH;
        break;
      case 'annual':
        dailyRate = rateInBaseCurrency / (this.DAYS_PER_MONTH * this.MONTHS_PER_YEAR);
        break;
      case 'daily':
      default:
        dailyRate = rateInBaseCurrency;
    }

    // Calculate all periods from daily rate
    return {
      hourlyRate: Math.round(dailyRate / this.HOURS_PER_DAY * 100) / 100,
      dailyRate: Math.round(dailyRate * 100) / 100,
      monthlyRate: Math.round(dailyRate * this.DAYS_PER_MONTH * 100) / 100,
      annualRate: Math.round(dailyRate * this.DAYS_PER_MONTH * this.MONTHS_PER_YEAR * 100) / 100,
    };
  }

  /**
   * Map geography
   */
  private static mapGeography(
    location: string,
    mapping?: Record<string, { region: string; country: string }>
  ): { region: string; country: string } | undefined {
    if (mapping && mapping[location.toLowerCase()]) {
      return mapping[location.toLowerCase()];
    }

    // Basic geography inference
    const locationLower = location.toLowerCase();

    // Countries
    if (locationLower.includes('usa') || locationLower.includes('united states') || locationLower.includes('us')) {
      return { region: 'North America', country: 'USA' };
    }
    if (locationLower.includes('uk') || locationLower.includes('united kingdom') || locationLower.includes('london')) {
      return { region: 'Europe', country: 'UK' };
    }
    if (locationLower.includes('switzerland') || locationLower.includes('zurich') || locationLower.includes('geneva')) {
      return { region: 'Europe', country: 'Switzerland' };
    }
    if (locationLower.includes('germany') || locationLower.includes('berlin') || locationLower.includes('munich')) {
      return { region: 'Europe', country: 'Germany' };
    }
    if (locationLower.includes('india') || locationLower.includes('bangalore') || locationLower.includes('mumbai')) {
      return { region: 'Asia', country: 'India' };
    }

    return undefined;
  }

  /**
   * Infer service line from role
   */
  private static inferServiceLine(role: string): string {
    const roleLower = role.toLowerCase();

    if (roleLower.includes('sap') || roleLower.includes('erp')) {
      return 'ERP';
    }
    if (roleLower.includes('cloud') || roleLower.includes('aws') || roleLower.includes('azure')) {
      return 'Cloud';
    }
    if (roleLower.includes('data') || roleLower.includes('analytics') || roleLower.includes('bi')) {
      return 'Data & Analytics';
    }
    if (roleLower.includes('security') || roleLower.includes('cyber')) {
      return 'Cybersecurity';
    }
    if (roleLower.includes('developer') || roleLower.includes('engineer')) {
      return 'Software Development';
    }

    return 'General Consulting';
  }

  /**
   * Parse skills from string or array
   */
  private static parseSkills(value: any): string[] {
    if (Array.isArray(value)) {
      return value.map(v => String(v).trim());
    }

    const str = String(value);
    return str
      .split(/[,;|]/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  /**
   * Parse experience from string or number
   */
  private static parseExperience(value: any): number | undefined {
    if (typeof value === 'number') {
      return value;
    }

    const str = String(value);
    const match = str.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : undefined;
  }

  /**
   * Get transformation summary
   */
  static getSummary(transformed: TransformedRate[]): {
    totalRows: number;
    avgConfidence: number;
    transformationCounts: Record<string, number>;
  } {
    const transformationCounts: Record<string, number> = {};

    for (const row of transformed) {
      for (const transformation of row.transformations) {
        transformationCounts[transformation] = (transformationCounts[transformation] || 0) + 1;
      }
    }

    const avgConfidence = transformed.reduce((sum, r) => sum + r.confidence, 0) / transformed.length;

    return {
      totalRows: transformed.length,
      avgConfidence: Math.round(avgConfidence * 100) / 100,
      transformationCounts,
    };
  }
}
