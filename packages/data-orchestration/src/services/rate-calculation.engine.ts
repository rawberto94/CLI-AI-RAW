/**
 * Rate Calculation Engine
 * 
 * Provides comprehensive rate calculation capabilities including:
 * - Rate format conversions (hourly, daily, weekly, monthly, annual)
 * - Geographic adjustments based on cost of living
 * - Skill and certification premiums
 * - Contract terms and volume discount calculations
 * - Escalation calculations for multi-year contracts
 */

import { 
  EnhancedRate, 
  RateStructure, 
  Location, 
  Skill, 
  Certification, 
  ContractTerms, 
  CostAnalysis,
  GeographicAdjustment,
  SkillsRegistry,
  CertificationsRegistry
} from "../types/enhanced-rate-card.types";
import { dbAdaptor } from "../dal/database.adaptor";
import pino from "pino";

const logger = pino({ name: "rate-calculation-engine" });

export class RateCalculationEngine {
  private static instance: RateCalculationEngine;

  // Standard conversion factors
  private readonly CONVERSION_FACTORS = {
    HOURS_PER_DAY: 8,
    DAYS_PER_WEEK: 5,
    WEEKS_PER_MONTH: 4.33, // Average weeks per month
    MONTHS_PER_YEAR: 12,
    WORKING_DAYS_PER_YEAR: 260,
    WORKING_HOURS_PER_YEAR: 2080
  };

  private constructor() {}

  static getInstance(): RateCalculationEngine {
    if (!RateCalculationEngine.instance) {
      RateCalculationEngine.instance = new RateCalculationEngine();
    }
    return RateCalculationEngine.instance;
  }

  // ============================================================================
  // RATE FORMAT CONVERSIONS
  // ============================================================================

  /**
   * Calculate equivalent rates across all formats from a base rate
   */
  calculateEquivalentRates(
    baseRate: number, 
    baseUnit: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'annual',
    billableHours: number = 8
  ): RateStructure {
    try {
      logger.info({ baseRate, baseUnit, billableHours }, "Calculating equivalent rates");

      let hourlyRate: number;

      // Convert base rate to hourly rate first
      switch (baseUnit) {
        case 'hourly':
          hourlyRate = baseRate;
          break;
        case 'daily':
          hourlyRate = baseRate / billableHours;
          break;
        case 'weekly':
          hourlyRate = baseRate / (this.CONVERSION_FACTORS.DAYS_PER_WEEK * billableHours);
          break;
        case 'monthly':
          hourlyRate = baseRate / (this.CONVERSION_FACTORS.WEEKS_PER_MONTH * this.CONVERSION_FACTORS.DAYS_PER_WEEK * billableHours);
          break;
        case 'annual':
          hourlyRate = baseRate / this.CONVERSION_FACTORS.WORKING_HOURS_PER_YEAR;
          break;
        default:
          throw new Error(`Unsupported base unit: ${baseUnit}`);
      }

      // Calculate all other rates from hourly rate
      const rateStructure: RateStructure = {
        hourlyRate: Math.round(hourlyRate * 100) / 100,
        dailyRate: Math.round(hourlyRate * billableHours * 100) / 100,
        weeklyRate: Math.round(hourlyRate * billableHours * this.CONVERSION_FACTORS.DAYS_PER_WEEK * 100) / 100,
        monthlyRate: Math.round(hourlyRate * billableHours * this.CONVERSION_FACTORS.DAYS_PER_WEEK * this.CONVERSION_FACTORS.WEEKS_PER_MONTH * 100) / 100,
        annualRate: Math.round(hourlyRate * this.CONVERSION_FACTORS.WORKING_HOURS_PER_YEAR * 100) / 100,
        conversionFactors: {
          hoursPerDay: billableHours,
          daysPerWeek: this.CONVERSION_FACTORS.DAYS_PER_WEEK,
          weeksPerMonth: this.CONVERSION_FACTORS.WEEKS_PER_MONTH,
          monthsPerYear: this.CONVERSION_FACTORS.MONTHS_PER_YEAR
        }
      };

      logger.info({ rateStructure }, "Calculated equivalent rates");
      return rateStructure;

    } catch (error) {
      logger.error({ error, baseRate, baseUnit }, "Failed to calculate equivalent rates");
      throw error;
    }
  }

  /**
   * Validate rate consistency across different formats
   */
  validateRateConsistency(rate: EnhancedRate): { isConsistent: boolean; discrepancies: string[] } {
    try {
      const discrepancies: string[] = [];
      
      if (!rate.hourlyRate && !rate.dailyRate && !rate.monthlyRate && !rate.annualRate) {
        discrepancies.push("At least one rate format must be specified");
        return { isConsistent: false, discrepancies };
      }

      // Use the first available rate as the base for comparison
      let baseRate: number;
      let baseUnit: 'hourly' | 'daily' | 'monthly' | 'annual';

      if (rate.hourlyRate) {
        baseRate = rate.hourlyRate;
        baseUnit = 'hourly';
      } else if (rate.dailyRate) {
        baseRate = rate.dailyRate;
        baseUnit = 'daily';
      } else if (rate.monthlyRate) {
        baseRate = rate.monthlyRate;
        baseUnit = 'monthly';
      } else {
        baseRate = rate.annualRate!;
        baseUnit = 'annual';
      }

      const calculatedRates = this.calculateEquivalentRates(baseRate, baseUnit, rate.billableHours);
      const tolerance = 0.01; // 1 cent tolerance for rounding

      // Check each specified rate against calculated equivalent
      if (rate.hourlyRate && Math.abs(rate.hourlyRate - calculatedRates.hourlyRate) > tolerance) {
        discrepancies.push(`Hourly rate ${rate.hourlyRate} doesn't match calculated ${calculatedRates.hourlyRate}`);
      }

      if (rate.dailyRate && Math.abs(rate.dailyRate - calculatedRates.dailyRate) > tolerance) {
        discrepancies.push(`Daily rate ${rate.dailyRate} doesn't match calculated ${calculatedRates.dailyRate}`);
      }

      if (rate.weeklyRate && Math.abs(rate.weeklyRate - calculatedRates.weeklyRate) > tolerance) {
        discrepancies.push(`Weekly rate ${rate.weeklyRate} doesn't match calculated ${calculatedRates.weeklyRate}`);
      }

      if (rate.monthlyRate && Math.abs(rate.monthlyRate - calculatedRates.monthlyRate) > tolerance) {
        discrepancies.push(`Monthly rate ${rate.monthlyRate} doesn't match calculated ${calculatedRates.monthlyRate}`);
      }

      if (rate.annualRate && Math.abs(rate.annualRate - calculatedRates.annualRate) > tolerance) {
        discrepancies.push(`Annual rate ${rate.annualRate} doesn't match calculated ${calculatedRates.annualRate}`);
      }

      return { isConsistent: discrepancies.length === 0, discrepancies };

    } catch (error) {
      logger.error({ error, rate }, "Failed to validate rate consistency");
      return { isConsistent: false, discrepancies: ["Validation error occurred"] };
    }
  }

  // ============================================================================
  // GEOGRAPHIC ADJUSTMENTS
  // ============================================================================

  /**
   * Apply geographic cost of living adjustments to rates
   */
  async applyGeographicAdjustment(rate: number, location: Location): Promise<number> {
    try {
      logger.info({ rate, location }, "Applying geographic adjustment");

      // Get geographic adjustment data
      const adjustment = await this.getGeographicAdjustment(location);
      
      if (!adjustment) {
        logger.warn({ location }, "No geographic adjustment data found, using base rate");
        return rate;
      }

      // Apply cost of living adjustment
      const adjustedRate = rate * (adjustment.costOfLivingIndex / 100);
      
      logger.info({ 
        originalRate: rate, 
        adjustedRate, 
        costOfLivingIndex: adjustment.costOfLivingIndex 
      }, "Applied geographic adjustment");

      return Math.round(adjustedRate * 100) / 100;

    } catch (error) {
      logger.error({ error, rate, location }, "Failed to apply geographic adjustment");
      return rate; // Return original rate on error
    }
  }

  /**
   * Get geographic adjustment data for a location
   */
  private async getGeographicAdjustment(location: Location): Promise<GeographicAdjustment | null> {
    try {
      const query = `
        SELECT * FROM geographic_adjustments 
        WHERE country = ? 
        AND (state_province = ? OR state_province IS NULL)
        AND (city = ? OR city IS NULL)
        ORDER BY 
          CASE WHEN city = ? THEN 1 ELSE 2 END,
          CASE WHEN state_province = ? THEN 1 ELSE 2 END
        LIMIT 1
      `;

      const params = [
        location.country,
        location.stateProvince || null,
        location.city || null,
        location.city || null,
        location.stateProvince || null
      ];

      const [adjustment] = await dbAdaptor.prisma.$queryRawUnsafe(query, ...params) as any[];
      return adjustment || null;

    } catch (error) {
      logger.error({ error, location }, "Failed to get geographic adjustment");
      return null;
    }
  }

  // ============================================================================
  // SKILL AND CERTIFICATION PREMIUMS
  // ============================================================================

  /**
   * Apply skill premiums to base rate
   */
  async applySkillPremiums(baseRate: number, skills: Skill[]): Promise<number> {
    try {
      logger.info({ baseRate, skillCount: skills.length }, "Applying skill premiums");

      let adjustedRate = baseRate;
      const appliedPremiums: { skill: string; premium: number }[] = [];

      for (const skill of skills) {
        if (!skill.required) continue; // Only apply premiums for required skills

        const skillData = await this.getSkillPremiumData(skill.name, skill.level);
        if (skillData && skillData.premiumFactor > 1) {
          const premium = baseRate * (skillData.premiumFactor - 1);
          adjustedRate += premium;
          appliedPremiums.push({ skill: skill.name, premium });
        }
      }

      logger.info({ 
        baseRate, 
        adjustedRate, 
        appliedPremiums 
      }, "Applied skill premiums");

      return Math.round(adjustedRate * 100) / 100;

    } catch (error) {
      logger.error({ error, baseRate, skills }, "Failed to apply skill premiums");
      return baseRate;
    }
  }

  /**
   * Apply certification premiums to base rate
   */
  async applyCertificationPremiums(baseRate: number, certifications: Certification[]): Promise<number> {
    try {
      logger.info({ baseRate, certificationCount: certifications.length }, "Applying certification premiums");

      let adjustedRate = baseRate;
      const appliedPremiums: { certification: string; premium: number }[] = [];

      for (const certification of certifications) {
        if (!certification.required) continue; // Only apply premiums for required certifications

        const certData = await this.getCertificationPremiumData(certification.name, certification.issuingOrganization);
        if (certData && certData.premiumFactor > 1) {
          const premium = baseRate * (certData.premiumFactor - 1);
          adjustedRate += premium;
          appliedPremiums.push({ certification: certification.name, premium });
        }
      }

      logger.info({ 
        baseRate, 
        adjustedRate, 
        appliedPremiums 
      }, "Applied certification premiums");

      return Math.round(adjustedRate * 100) / 100;

    } catch (error) {
      logger.error({ error, baseRate, certifications }, "Failed to apply certification premiums");
      return baseRate;
    }
  }

  /**
   * Get skill premium data from registry
   */
  private async getSkillPremiumData(skillName: string, skillLevel?: string): Promise<SkillsRegistry | null> {
    try {
      const query = `
        SELECT * FROM skills_registry 
        WHERE skill_name = ? 
        AND (skill_level = ? OR skill_level IS NULL)
        ORDER BY CASE WHEN skill_level = ? THEN 1 ELSE 2 END
        LIMIT 1
      `;

      const [skillData] = await dbAdaptor.prisma.$queryRawUnsafe(
        query, 
        skillName, 
        skillLevel || null, 
        skillLevel || null
      ) as any[];

      return skillData || null;

    } catch (error) {
      logger.error({ error, skillName, skillLevel }, "Failed to get skill premium data");
      return null;
    }
  }

  /**
   * Get certification premium data from registry
   */
  private async getCertificationPremiumData(certificationName: string, issuingOrganization: string): Promise<CertificationsRegistry | null> {
    try {
      const query = `
        SELECT * FROM certifications_registry 
        WHERE certification_name = ? AND issuing_organization = ?
        LIMIT 1
      `;

      const [certData] = await dbAdaptor.prisma.$queryRawUnsafe(
        query, 
        certificationName, 
        issuingOrganization
      ) as any[];

      return certData || null;

    } catch (error) {
      logger.error({ error, certificationName, issuingOrganization }, "Failed to get certification premium data");
      return null;
    }
  }

  // ============================================================================
  // CONTRACT TERMS AND EFFECTIVE RATES
  // ============================================================================

  /**
   * Calculate effective rate considering all contract terms
   */
  calculateEffectiveRate(rate: EnhancedRate, terms: ContractTerms, hoursCommitted?: number): number {
    try {
      logger.info({ rateId: rate.id, terms, hoursCommitted }, "Calculating effective rate");

      let effectiveRate = rate.hourlyRate || 0;

      // Apply volume discounts if applicable
      if (terms.volumeDiscounts && hoursCommitted) {
        const applicableDiscount = this.getApplicableVolumeDiscount(terms.volumeDiscounts, hoursCommitted);
        if (applicableDiscount) {
          effectiveRate = effectiveRate * (1 - applicableDiscount.discountPercentage / 100);
          logger.info({ 
            discount: applicableDiscount.discountPercentage, 
            newRate: effectiveRate 
          }, "Applied volume discount");
        }
      }

      // Apply markup if specified
      if (rate.markupPercentage) {
        effectiveRate = effectiveRate * (1 + rate.markupPercentage / 100);
      }

      return Math.round(effectiveRate * 100) / 100;

    } catch (error) {
      logger.error({ error, rate, terms }, "Failed to calculate effective rate");
      return rate.hourlyRate || 0;
    }
  }

  /**
   * Get applicable volume discount for committed hours
   */
  private getApplicableVolumeDiscount(volumeDiscounts: any[], hoursCommitted: number) {
    // Sort discounts by minimum hours (descending) to get the highest applicable discount
    const sortedDiscounts = volumeDiscounts
      .filter(discount => hoursCommitted >= discount.minimumHours)
      .sort((a, b) => b.minimumHours - a.minimumHours);

    return sortedDiscounts[0] || null;
  }

  // ============================================================================
  // ESCALATION CALCULATIONS
  // ============================================================================

  /**
   * Calculate escalated rate for multi-year contracts
   */
  calculateEscalatedRate(
    baseRate: number, 
    escalationPercentage: number, 
    periods: number,
    compounding: boolean = true
  ): number {
    try {
      logger.info({ baseRate, escalationPercentage, periods, compounding }, "Calculating escalated rate");

      let escalatedRate: number;

      if (compounding) {
        // Compound escalation: rate * (1 + escalation)^periods
        escalatedRate = baseRate * Math.pow(1 + escalationPercentage / 100, periods);
      } else {
        // Simple escalation: rate * (1 + escalation * periods)
        escalatedRate = baseRate * (1 + (escalationPercentage / 100) * periods);
      }

      const result = Math.round(escalatedRate * 100) / 100;
      
      logger.info({ 
        baseRate, 
        escalatedRate: result, 
        totalIncrease: result - baseRate 
      }, "Calculated escalated rate");

      return result;

    } catch (error) {
      logger.error({ error, baseRate, escalationPercentage, periods }, "Failed to calculate escalated rate");
      return baseRate;
    }
  }

  /**
   * Calculate escalation schedule for multi-year contract
   */
  calculateEscalationSchedule(
    baseRate: number,
    escalationPercentage: number,
    startDate: Date,
    endDate: Date,
    frequency: 'Annual' | 'Quarterly' | 'Semi-Annual'
  ): Array<{ date: Date; rate: number; period: number }> {
    try {
      const schedule: Array<{ date: Date; rate: number; period: number }> = [];
      
      let currentDate = new Date(startDate);
      let period = 0;
      let currentRate = baseRate;

      // Determine increment based on frequency
      const incrementMonths = frequency === 'Annual' ? 12 : frequency === 'Semi-Annual' ? 6 : 3;

      while (currentDate <= endDate) {
        schedule.push({
          date: new Date(currentDate),
          rate: Math.round(currentRate * 100) / 100,
          period
        });

        // Move to next period
        currentDate.setMonth(currentDate.getMonth() + incrementMonths);
        period++;
        currentRate = this.calculateEscalatedRate(baseRate, escalationPercentage, period);
      }

      logger.info({ 
        baseRate, 
        scheduleLength: schedule.length, 
        finalRate: schedule[schedule.length - 1]?.rate 
      }, "Generated escalation schedule");

      return schedule;

    } catch (error) {
      logger.error({ error, baseRate, escalationPercentage, startDate, endDate }, "Failed to calculate escalation schedule");
      return [];
    }
  }

  // ============================================================================
  // COMPREHENSIVE COST ANALYSIS
  // ============================================================================

  /**
   * Calculate total cost of engagement with all adjustments
   */
  async calculateTotalCostOfEngagement(
    rate: EnhancedRate,
    terms: ContractTerms,
    location: Location,
    duration: number, // in hours
    skills?: Skill[],
    certifications?: Certification[]
  ): Promise<CostAnalysis> {
    try {
      logger.info({ 
        rateId: rate.id, 
        duration, 
        location 
      }, "Calculating total cost of engagement");

      let baseCost = (rate.hourlyRate || 0) * duration;
      let adjustedCost = baseCost;
      
      const adjustments = {
        geographic: 0,
        skills: 0,
        certifications: 0,
        volumeDiscounts: 0,
        escalations: 0
      };

      // Apply geographic adjustment
      const geographicRate = await this.applyGeographicAdjustment(rate.hourlyRate || 0, location);
      const geographicAdjustment = (geographicRate - (rate.hourlyRate || 0)) * duration;
      adjustments.geographic = geographicAdjustment;
      adjustedCost += geographicAdjustment;

      // Apply skill premiums
      if (skills && skills.length > 0) {
        const skillAdjustedRate = await this.applySkillPremiums(rate.hourlyRate || 0, skills);
        const skillAdjustment = (skillAdjustedRate - (rate.hourlyRate || 0)) * duration;
        adjustments.skills = skillAdjustment;
        adjustedCost += skillAdjustment;
      }

      // Apply certification premiums
      if (certifications && certifications.length > 0) {
        const certAdjustedRate = await this.applyCertificationPremiums(rate.hourlyRate || 0, certifications);
        const certAdjustment = (certAdjustedRate - (rate.hourlyRate || 0)) * duration;
        adjustments.certifications = certAdjustment;
        adjustedCost += certAdjustment;
      }

      // Apply volume discounts
      if (terms.volumeDiscounts) {
        const discount = this.getApplicableVolumeDiscount(terms.volumeDiscounts, duration);
        if (discount) {
          const discountAmount = adjustedCost * (discount.discountPercentage / 100);
          adjustments.volumeDiscounts = -discountAmount;
          adjustedCost -= discountAmount;
        }
      }

      // Apply escalations (simplified - assumes average escalation over period)
      if (terms.escalationPercentage) {
        const escalationAdjustment = adjustedCost * (terms.escalationPercentage / 100) * 0.5; // Average over period
        adjustments.escalations = escalationAdjustment;
        adjustedCost += escalationAdjustment;
      }

      const totalCost = Math.round(adjustedCost * 100) / 100;

      const costAnalysis: CostAnalysis = {
        baseCost: Math.round(baseCost * 100) / 100,
        adjustedCost: totalCost,
        totalCost,
        adjustments,
        breakdown: [
          { category: 'Base Rate', amount: baseCost, percentage: (baseCost / totalCost) * 100, description: 'Base hourly rate × hours' },
          { category: 'Geographic Adjustment', amount: adjustments.geographic, percentage: (adjustments.geographic / totalCost) * 100, description: 'Cost of living adjustment' },
          { category: 'Skill Premiums', amount: adjustments.skills, percentage: (adjustments.skills / totalCost) * 100, description: 'Premium for required skills' },
          { category: 'Certification Premiums', amount: adjustments.certifications, percentage: (adjustments.certifications / totalCost) * 100, description: 'Premium for certifications' },
          { category: 'Volume Discounts', amount: adjustments.volumeDiscounts, percentage: (adjustments.volumeDiscounts / totalCost) * 100, description: 'Discount for volume commitment' },
          { category: 'Escalations', amount: adjustments.escalations, percentage: (adjustments.escalations / totalCost) * 100, description: 'Average escalation over period' }
        ]
      };

      logger.info({ costAnalysis }, "Calculated total cost of engagement");
      return costAnalysis;

    } catch (error) {
      logger.error({ error, rate, terms, location, duration }, "Failed to calculate total cost of engagement");
      throw error;
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Normalize rates to a common time unit for comparison
   */
  normalizeRateToHourly(rate: Partial<EnhancedRate>): number {
    if (rate.hourlyRate) return rate.hourlyRate;
    if (rate.dailyRate) return rate.dailyRate / (rate.billableHours || 8);
    if (rate.weeklyRate) return rate.weeklyRate / (5 * (rate.billableHours || 8));
    if (rate.monthlyRate) return rate.monthlyRate / (this.CONVERSION_FACTORS.WEEKS_PER_MONTH * 5 * (rate.billableHours || 8));
    if (rate.annualRate) return rate.annualRate / this.CONVERSION_FACTORS.WORKING_HOURS_PER_YEAR;
    return 0;
  }

  /**
   * Calculate blended rate for multiple resources
   */
  calculateBlendedRate(rates: Array<{ rate: number; hours: number }>): number {
    const totalCost = rates.reduce((sum, item) => sum + (item.rate * item.hours), 0);
    const totalHours = rates.reduce((sum, item) => sum + item.hours, 0);
    
    return totalHours > 0 ? Math.round((totalCost / totalHours) * 100) / 100 : 0;
  }

  /**
   * Health check for the calculation engine
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Test basic rate calculation
      const testRate = this.calculateEquivalentRates(100, 'hourly');
      return testRate.hourlyRate === 100 && testRate.dailyRate === 800;
    } catch (error) {
      logger.error({ error }, "Rate calculation engine health check failed");
      return false;
    }
  }
}

export const rateCalculationEngine = RateCalculationEngine.getInstance();