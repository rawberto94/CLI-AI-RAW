// Savings Calculation Engine for Procurement Intelligence
// Calculates potential savings with confidence intervals and recommendations

import { type NormalizedRate } from './rate-normalization';
import { type BenchmarkMatch } from './benchmark-matching';

export interface SavingsCalculation {
  currentAnnualCost: number;
  benchmarkAnnualCost: number;
  annualSavings: number;
  savingsPercentage: number;
  confidence: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  implementationEffort: 'Low' | 'Medium' | 'High';
  timeframe: string;
  recommendations: string[];
}

export interface PortfolioSavings {
  totalCurrentCost: number;
  totalBenchmarkCost: number;
  totalAnnualSavings: number;
  averageSavingsPercentage: number;
  quickWins: SavingsOpportunity[];
  strategicInitiatives: SavingsOpportunity[];
  overallConfidence: number;
}

export interface SavingsOpportunity {
  type: 'Rate Optimization' | 'Volume Bundling' | 'Supplier Consolidation' | 'Contract Renegotiation' | 'Market Arbitrage';
  description: string;
  roles: string[];
  currentCost: number;
  targetCost: number;
  annualSavings: number;
  savingsPercentage: number;
  confidence: number;
  implementationEffort: 'Low' | 'Medium' | 'High';
  riskLevel: 'Low' | 'Medium' | 'High';
  timeframe: string;
  prerequisites: string[];
  successFactors: string[];
}

export interface SavingsProjection {
  year1: number;
  year2: number;
  year3: number;
  totalThreeYear: number;
  npv: number; // Net Present Value
  roi: number; // Return on Investment
  paybackPeriod: number; // In months
}

export class SavingsCalculationEngine {
  private standardWorkingHours: number = 2080; // Annual working hours
  private discountRate: number = 0.08; // 8% discount rate for NPV
  private implementationCosts: Map<string, number>;
  private riskFactors: Map<string, number>;

  constructor() {
    this.initializeImplementationCosts();
    this.initializeRiskFactors();
  }

  /**
   * Calculate savings for a single rate comparison
   */
  calculateRateSavings(
    rate: NormalizedRate,
    benchmark: BenchmarkMatch,
    annualHours: number = this.standardWorkingHours
  ): SavingsCalculation {
    const currentAnnualCost = rate.hourlyRate * annualHours;
    const benchmarkAnnualCost = benchmark.medianRate * annualHours;
    const annualSavings = currentAnnualCost - benchmarkAnnualCost;
    const savingsPercentage = (annualSavings / currentAnnualCost) * 100;

    // Calculate confidence based on benchmark quality and rate normalization confidence
    const confidence = Math.min(rate.confidence * benchmark.confidence, 1.0);

    // Assess risk level
    const riskLevel = this.assessRiskLevel(savingsPercentage, benchmark.sampleSize, confidence);

    // Determine implementation effort
    const implementationEffort = this.assessImplementationEffort(savingsPercentage, rate.role);

    // Estimate timeframe
    const timeframe = this.estimateTimeframe(implementationEffort, savingsPercentage);

    // Generate recommendations
    const recommendations = this.generateRecommendations(rate, benchmark, savingsPercentage);

    return {
      currentAnnualCost: Math.round(currentAnnualCost),
      benchmarkAnnualCost: Math.round(benchmarkAnnualCost),
      annualSavings: Math.round(annualSavings),
      savingsPercentage: Math.round(savingsPercentage * 100) / 100,
      confidence: Math.round(confidence * 100) / 100,
      riskLevel,
      implementationEffort,
      timeframe,
      recommendations
    };
  }

  /**
   * Calculate portfolio-wide savings across multiple rates
   */
  calculatePortfolioSavings(
    rates: NormalizedRate[],
    benchmarks: BenchmarkMatch[],
    annualHours: number = this.standardWorkingHours
  ): PortfolioSavings {
    const calculations = rates.map((rate, index) => {
      const benchmark = benchmarks[index];
      return this.calculateRateSavings(rate, benchmark, annualHours);
    });

    const totalCurrentCost = calculations.reduce((sum, calc) => sum + calc.currentAnnualCost, 0);
    const totalBenchmarkCost = calculations.reduce((sum, calc) => sum + calc.benchmarkAnnualCost, 0);
    const totalAnnualSavings = totalCurrentCost - totalBenchmarkCost;
    const averageSavingsPercentage = (totalAnnualSavings / totalCurrentCost) * 100;

    // Categorize opportunities
    const quickWins = this.identifyQuickWins(rates, benchmarks, calculations);
    const strategicInitiatives = this.identifyStrategicInitiatives(rates, benchmarks, calculations);

    // Calculate overall confidence
    const overallConfidence = calculations.reduce((sum, calc) => sum + calc.confidence, 0) / calculations.length;

    return {
      totalCurrentCost: Math.round(totalCurrentCost),
      totalBenchmarkCost: Math.round(totalBenchmarkCost),
      totalAnnualSavings: Math.round(totalAnnualSavings),
      averageSavingsPercentage: Math.round(averageSavingsPercentage * 100) / 100,
      quickWins,
      strategicInitiatives,
      overallConfidence: Math.round(overallConfidence * 100) / 100
    };
  }

  /**
   * Project savings over multiple years with NPV calculation
   */
  projectSavings(
    annualSavings: number,
    implementationCost: number = 0,
    growthRate: number = 0.03 // 3% annual growth
  ): SavingsProjection {
    const year1 = annualSavings * 0.7; // 70% realization in year 1
    const year2 = annualSavings * (1 + growthRate);
    const year3 = annualSavings * Math.pow(1 + growthRate, 2);
    const totalThreeYear = year1 + year2 + year3;

    // Calculate NPV
    const npv = this.calculateNPV([year1, year2, year3], implementationCost, this.discountRate);

    // Calculate ROI
    const roi = ((totalThreeYear - implementationCost) / implementationCost) * 100;

    // Calculate payback period
    const paybackPeriod = implementationCost / (annualSavings / 12);

    return {
      year1: Math.round(year1),
      year2: Math.round(year2),
      year3: Math.round(year3),
      totalThreeYear: Math.round(totalThreeYear),
      npv: Math.round(npv),
      roi: Math.round(roi * 100) / 100,
      paybackPeriod: Math.round(paybackPeriod * 10) / 10
    };
  }

  /**
   * Identify quick win opportunities (low effort, high impact)
   */
  private identifyQuickWins(
    rates: NormalizedRate[],
    benchmarks: BenchmarkMatch[],
    calculations: SavingsCalculation[]
  ): SavingsOpportunity[] {
    const quickWins: SavingsOpportunity[] = [];

    calculations.forEach((calc, index) => {
      if (calc.implementationEffort === 'Low' && calc.annualSavings > 10000) {
        quickWins.push({
          type: 'Rate Optimization',
          description: `Negotiate ${rates[index].role} rate to market median`,
          roles: [rates[index].role],
          currentCost: calc.currentAnnualCost,
          targetCost: calc.benchmarkAnnualCost,
          annualSavings: calc.annualSavings,
          savingsPercentage: calc.savingsPercentage,
          confidence: calc.confidence,
          implementationEffort: calc.implementationEffort,
          riskLevel: calc.riskLevel,
          timeframe: calc.timeframe,
          prerequisites: ['Market data validation', 'Supplier relationship assessment'],
          successFactors: ['Strong negotiation position', 'Alternative supplier options', 'Volume leverage']
        });
      }
    });

    // Add volume bundling opportunities
    if (rates.length >= 3) {
      const totalSavings = calculations.reduce((sum, calc) => sum + calc.annualSavings, 0);
      const volumeDiscount = totalSavings * 0.15; // Additional 15% from volume

      quickWins.push({
        type: 'Volume Bundling',
        description: 'Leverage multi-role engagement for volume discounts',
        roles: rates.map(r => r.role),
        currentCost: calculations.reduce((sum, calc) => sum + calc.currentAnnualCost, 0),
        targetCost: calculations.reduce((sum, calc) => sum + calc.benchmarkAnnualCost, 0) * 0.85,
        annualSavings: Math.round(volumeDiscount),
        savingsPercentage: 15,
        confidence: 0.8,
        implementationEffort: 'Low',
        riskLevel: 'Low',
        timeframe: '1-3 months',
        prerequisites: ['Multi-role contract structure', 'Supplier capability assessment'],
        successFactors: ['Long-term commitment', 'Consolidated billing', 'Performance guarantees']
      });
    }

    return quickWins.sort((a, b) => b.annualSavings - a.annualSavings);
  }

  /**
   * Identify strategic initiatives (higher effort, transformational impact)
   */
  private identifyStrategicInitiatives(
    rates: NormalizedRate[],
    benchmarks: BenchmarkMatch[],
    calculations: SavingsCalculation[]
  ): SavingsOpportunity[] {
    const strategic: SavingsOpportunity[] = [];

    // Supplier consolidation opportunity
    if (rates.length >= 5) {
      const consolidationSavings = calculations.reduce((sum, calc) => sum + calc.annualSavings, 0) * 0.25;
      
      strategic.push({
        type: 'Supplier Consolidation',
        description: 'Consolidate suppliers to reduce management overhead and increase leverage',
        roles: rates.map(r => r.role),
        currentCost: calculations.reduce((sum, calc) => sum + calc.currentAnnualCost, 0),
        targetCost: calculations.reduce((sum, calc) => sum + calc.benchmarkAnnualCost, 0) * 0.75,
        annualSavings: Math.round(consolidationSavings),
        savingsPercentage: 25,
        confidence: 0.7,
        implementationEffort: 'High',
        riskLevel: 'Medium',
        timeframe: '6-12 months',
        prerequisites: ['Supplier capability mapping', 'Risk assessment', 'Transition planning'],
        successFactors: ['Preferred supplier agreements', 'Service level guarantees', 'Change management']
      });
    }

    // Market arbitrage opportunity
    const highVarianceRoles = calculations.filter(calc => calc.savingsPercentage > 15);
    if (highVarianceRoles.length > 0) {
      const arbitrageSavings = highVarianceRoles.reduce((sum, calc) => sum + calc.annualSavings, 0);
      
      strategic.push({
        type: 'Market Arbitrage',
        description: 'Leverage geographic or market differences for cost optimization',
        roles: highVarianceRoles.map((_, index) => rates[index].role),
        currentCost: highVarianceRoles.reduce((sum, calc) => sum + calc.currentAnnualCost, 0),
        targetCost: highVarianceRoles.reduce((sum, calc) => sum + calc.benchmarkAnnualCost, 0),
        annualSavings: Math.round(arbitrageSavings),
        savingsPercentage: 20,
        confidence: 0.75,
        implementationEffort: 'Medium',
        riskLevel: 'Medium',
        timeframe: '3-6 months',
        prerequisites: ['Market research', 'Supplier identification', 'Quality assessment'],
        successFactors: ['Cultural fit', 'Communication protocols', 'Quality standards']
      });
    }

    return strategic.sort((a, b) => b.annualSavings - a.annualSavings);
  }

  /**
   * Assess risk level based on savings percentage and data quality
   */
  private assessRiskLevel(savingsPercentage: number, sampleSize: number, confidence: number): 'Low' | 'Medium' | 'High' {
    if (savingsPercentage > 25 || sampleSize < 10 || confidence < 0.6) {
      return 'High';
    } else if (savingsPercentage > 10 || sampleSize < 50 || confidence < 0.8) {
      return 'Medium';
    } else {
      return 'Low';
    }
  }

  /**
   * Assess implementation effort based on savings and role complexity
   */
  private assessImplementationEffort(savingsPercentage: number, role: string): 'Low' | 'Medium' | 'High' {
    const complexRoles = ['Technical Architect', 'Principal Consultant', 'Program Manager'];
    const isComplexRole = complexRoles.some(complexRole => role.includes(complexRole));

    if (savingsPercentage > 20 || isComplexRole) {
      return 'High';
    } else if (savingsPercentage > 10) {
      return 'Medium';
    } else {
      return 'Low';
    }
  }

  /**
   * Estimate implementation timeframe
   */
  private estimateTimeframe(effort: string, savingsPercentage: number): string {
    if (effort === 'High' || savingsPercentage > 20) {
      return '6-12 months';
    } else if (effort === 'Medium' || savingsPercentage > 10) {
      return '3-6 months';
    } else {
      return '1-3 months';
    }
  }

  /**
   * Generate specific recommendations based on analysis
   */
  private generateRecommendations(rate: NormalizedRate, benchmark: BenchmarkMatch, savingsPercentage: number): string[] {
    const recommendations: string[] = [];

    if (savingsPercentage > 15) {
      recommendations.push('Immediate renegotiation recommended - significant above-market premium');
      recommendations.push('Consider alternative suppliers for competitive leverage');
    } else if (savingsPercentage > 5) {
      recommendations.push('Negotiate rate reduction during next renewal cycle');
      recommendations.push('Benchmark against additional suppliers for validation');
    } else if (savingsPercentage > 0) {
      recommendations.push('Minor optimization opportunity - consider during contract amendments');
    } else {
      recommendations.push('Rate is at or below market - maintain current terms');
    }

    if (benchmark.confidence < 0.8) {
      recommendations.push('Gather additional market data to improve benchmark confidence');
    }

    if (rate.confidence < 0.8) {
      recommendations.push('Validate rate normalization assumptions with supplier');
    }

    return recommendations;
  }

  /**
   * Calculate Net Present Value
   */
  private calculateNPV(cashFlows: number[], initialInvestment: number, discountRate: number): number {
    let npv = -initialInvestment;
    
    cashFlows.forEach((cashFlow, year) => {
      npv += cashFlow / Math.pow(1 + discountRate, year + 1);
    });
    
    return npv;
  }

  /**
   * Initialize implementation costs by opportunity type
   */
  private initializeImplementationCosts(): void {
    this.implementationCosts = new Map([
      ['Rate Optimization', 5000],
      ['Volume Bundling', 10000],
      ['Supplier Consolidation', 50000],
      ['Contract Renegotiation', 15000],
      ['Market Arbitrage', 25000]
    ]);
  }

  /**
   * Initialize risk factors by scenario
   */
  private initializeRiskFactors(): void {
    this.riskFactors = new Map([
      ['High Savings', 1.5], // Higher risk for aggressive savings targets
      ['Low Sample Size', 1.3], // Higher risk with limited benchmark data
      ['Complex Role', 1.2], // Higher risk for specialized roles
      ['New Supplier', 1.4], // Higher risk with untested suppliers
      ['Geographic Arbitrage', 1.3] // Higher risk for offshore/nearshore
    ]);
  }

  /**
   * Get implementation cost estimate
   */
  getImplementationCost(opportunityType: string): number {
    return this.implementationCosts.get(opportunityType) || 10000;
  }

  /**
   * Update discount rate for NPV calculations
   */
  setDiscountRate(rate: number): void {
    this.discountRate = rate;
  }

  /**
   * Update standard working hours
   */
  setStandardWorkingHours(hours: number): void {
    this.standardWorkingHours = hours;
  }
}

// Export singleton instance
export const savingsCalculator = new SavingsCalculationEngine();

// Utility functions
export function calculateQuickSavings(currentRate: number, benchmarkRate: number, annualHours: number = 2080): number {
  return (currentRate - benchmarkRate) * annualHours;
}

export function calculateSavingsPercentage(currentCost: number, targetCost: number): number {
  return ((currentCost - targetCost) / currentCost) * 100;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}