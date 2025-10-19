/**
 * Enhanced Savings Opportunities Service
 * 
 * Integrates with rate card intelligence to provide comprehensive savings analysis
 */

import pino from 'pino';
import { rateCardIntelligenceService } from './rate-card-intelligence.service';
import { enhancedRateAnalyticsService } from './enhanced-rate-analytics.service';
import { RateCardBenchmarkingEngineImpl } from './analytical-engines/rate-card-benchmarking.engine';

const logger = pino({ name: 'enhanced-savings-opportunities-service' });

export interface EnhancedSavingsOpportunity {
  id: string;
  category: 'rate-optimization' | 'payment-terms' | 'volume-discount' | 'supplier-consolidation';
  title: string;
  description: string;
  
  // Current vs Target
  currentState: {
    description: string;
    cost: number;
  };
  targetState: {
    description: string;
    cost: number;
  };
  
  // Savings calculation
  savings: {
    amount: number;
    percentage: number;
    confidence: number;
  };
  
  // Implementation
  implementation: {
    effort: 'low' | 'medium' | 'high';
    timeline: string;
    steps: string[];
  };
  
  // Priority
  priority: {
    score: number;
    recommendation: 'immediate' | 'short-term' | 'long-term';
  };
  
  // Rate card intelligence (if applicable)
  rateCardIntelligence?: {
    role: string;
    currentRate: number;
    benchmarkRate: number;
    marketPosition: string;
    competitorRates?: number[];
  };
}

export interface SavingsAnalysisResult {
  totalPotentialSavings: number;
  opportunities: EnhancedSavingsOpportunity[];
  summary: {
    quickWins: EnhancedSavingsOpportunity[];
    strategicInitiatives: EnhancedSavingsOpportunity[];
    totalOpportunities: number;
  };
}

export class EnhancedSavingsOpportunitiesService {
  private static instance: EnhancedSavingsOpportunitiesService;
  private rateCardEngine: RateCardBenchmarkingEngineImpl;

  private constructor() {
    this.rateCardEngine = new RateCardBenchmarkingEngineImpl();
  }

  static getInstance(): EnhancedSavingsOpportunitiesService {
    if (!EnhancedSavingsOpportunitiesService.instance) {
      EnhancedSavingsOpportunitiesService.instance = new EnhancedSavingsOpportunitiesService();
    }
    return EnhancedSavingsOpportunitiesService.instance;
  }

  /**
   * Analyze contract for savings opportunities using rate card intelligence
   */
  async analyzeSavingsOpportunities(
    contractId: string,
    tenantId: string,
    financialData: any
  ): Promise<SavingsAnalysisResult> {
    try {
      logger.info({ contractId, tenantId }, 'Analyzing savings opportunities');

      const opportunities: EnhancedSavingsOpportunity[] = [];

      // 1. Rate optimization opportunities (using rate card intelligence)
      const rateOpportunities = await this.analyzeRateOptimization(contractId, tenantId, financialData);
      opportunities.push(...rateOpportunities);

      // 2. Payment terms optimization
      const paymentOpportunities = await this.analyzePaymentTerms(financialData);
      opportunities.push(...paymentOpportunities);

      // 3. Volume discount opportunities
      const volumeOpportunities = await this.analyzeVolumeDiscounts(financialData);
      opportunities.push(...volumeOpportunities);

      // 4. Supplier consolidation opportunities
      const consolidationOpportunities = await this.analyzeSupplierConsolidation(tenantId, financialData);
      opportunities.push(...consolidationOpportunities);

      // Calculate total savings
      const totalPotentialSavings = opportunities.reduce((sum, opp) => sum + opp.savings.amount, 0);

      // Categorize opportunities
      const quickWins = opportunities.filter(opp => 
        opp.implementation.effort === 'low' && opp.priority.recommendation === 'immediate'
      );
      
      const strategicInitiatives = opportunities.filter(opp => 
        opp.implementation.effort !== 'low' || opp.priority.recommendation !== 'immediate'
      );

      const result: SavingsAnalysisResult = {
        totalPotentialSavings,
        opportunities,
        summary: {
          quickWins,
          strategicInitiatives,
          totalOpportunities: opportunities.length,
        },
      };

      logger.info({ 
        contractId, 
        totalSavings: totalPotentialSavings,
        opportunityCount: opportunities.length 
      }, 'Savings analysis completed');

      return result;
    } catch (error) {
      logger.error({ error, contractId }, 'Failed to analyze savings opportunities');
      throw error;
    }
  }

  /**
   * Analyze rate optimization using rate card intelligence
   */
  private async analyzeRateOptimization(
    contractId: string,
    tenantId: string,
    financialData: any
  ): Promise<EnhancedSavingsOpportunity[]> {
    const opportunities: EnhancedSavingsOpportunity[] = [];

    try {
      // Parse rate cards from contract
      const rateCardResult = await this.rateCardEngine.parseRateCards(contractId);
      
      if (!rateCardResult.success || rateCardResult.rates.length === 0) {
        return opportunities;
      }

      // Get benchmarks for each rate
      for (const rate of rateCardResult.rates) {
        try {
          const cohort = {
            role: rate.role,
            level: rate.level,
            region: rate.region,
            deliveryModel: rate.deliveryModel,
            tenantId,
          };

          // Get benchmark data
          const benchmark = await this.rateCardEngine.calculateBenchmarks([rate], cohort);
          
          // Calculate savings if rate is above benchmark
          if (rate.rate > benchmark.statistics.p75) {
            const targetRate = benchmark.statistics.p75;
            const annualVolume = rate.billableHours * 250 || 2000; // Assume 250 days/year
            const savingsAmount = (rate.rate - targetRate) * annualVolume;
            const savingsPercentage = ((rate.rate - targetRate) / rate.rate) * 100;

            opportunities.push({
              id: `rate-opt-${rate.role}-${Date.now()}`,
              category: 'rate-optimization',
              title: `Optimize ${rate.role} Rate`,
              description: `Current rate is ${savingsPercentage.toFixed(1)}% above market benchmark`,
              
              currentState: {
                description: `${rate.role} at $${rate.rate}/hr`,
                cost: rate.rate * annualVolume,
              },
              targetState: {
                description: `${rate.role} at $${targetRate.toFixed(2)}/hr (P75 benchmark)`,
                cost: targetRate * annualVolume,
              },
              
              savings: {
                amount: savingsAmount,
                percentage: savingsPercentage,
                confidence: benchmark.confidence * 100,
              },
              
              implementation: {
                effort: savingsPercentage > 20 ? 'medium' : 'low',
                timeline: savingsPercentage > 20 ? '2-3 months' : '2-4 weeks',
                steps: [
                  'Present market benchmark data to supplier',
                  `Propose rate adjustment to $${targetRate.toFixed(2)}/hr`,
                  'Negotiate based on market positioning',
                  'Execute contract amendment',
                ],
              },
              
              priority: {
                score: Math.min(100, savingsAmount / 1000 + savingsPercentage),
                recommendation: savingsPercentage > 20 ? 'immediate' : 'short-term',
              },
              
              rateCardIntelligence: {
                role: rate.role,
                currentRate: rate.rate,
                benchmarkRate: targetRate,
                marketPosition: `${Math.round((rate.rate / benchmark.statistics.p50) * 100)}th percentile`,
              },
            });
          }
        } catch (error) {
          logger.warn({ error, rate: rate.role }, 'Failed to analyze rate optimization');
        }
      }
    } catch (error) {
      logger.warn({ error, contractId }, 'Rate optimization analysis failed');
    }

    return opportunities;
  }

  /**
   * Analyze payment terms for optimization
   */
  private async analyzePaymentTerms(financialData: any): Promise<EnhancedSavingsOpportunity[]> {
    const opportunities: EnhancedSavingsOpportunity[] = [];

    // Check for early payment discount opportunity
    const totalValue = financialData.totalValue || 0;
    if (totalValue > 0 && !financialData.earlyPaymentDiscount) {
      const discountRate = 0.02; // 2% standard
      const annualSavings = totalValue * discountRate;

      opportunities.push({
        id: `payment-early-discount-${Date.now()}`,
        category: 'payment-terms',
        title: 'Early Payment Discount',
        description: 'Negotiate 2% discount for payment within 10 days',
        
        currentState: {
          description: 'Net 30 payment terms with no incentives',
          cost: totalValue,
        },
        targetState: {
          description: 'Net 30 with 2% discount for 10-day payment',
          cost: totalValue * (1 - discountRate),
        },
        
        savings: {
          amount: annualSavings,
          percentage: discountRate * 100,
          confidence: 85,
        },
        
        implementation: {
          effort: 'low',
          timeline: '1-2 weeks',
          steps: [
            'Confirm cash flow allows 10-day payment',
            'Prepare market data showing 2% is standard',
            'Propose discount program to supplier',
            'Execute contract amendment',
          ],
        },
        
        priority: {
          score: 95,
          recommendation: 'immediate',
        },
      });
    }

    return opportunities;
  }

  /**
   * Analyze volume discount opportunities
   */
  private async analyzeVolumeDiscounts(financialData: any): Promise<EnhancedSavingsOpportunity[]> {
    const opportunities: EnhancedSavingsOpportunity[] = [];

    const totalValue = financialData.totalValue || 0;
    if (totalValue > 100000 && !financialData.volumeDiscount) {
      const discountRate = 0.05; // 5% for high volume
      const annualSavings = totalValue * discountRate;

      opportunities.push({
        id: `volume-discount-${Date.now()}`,
        category: 'volume-discount',
        title: 'Volume Discount Negotiation',
        description: 'Negotiate 5% discount for high contract value',
        
        currentState: {
          description: `$${totalValue.toLocaleString()} contract with no volume discount`,
          cost: totalValue,
        },
        targetState: {
          description: `$${totalValue.toLocaleString()} contract with 5% volume discount`,
          cost: totalValue * (1 - discountRate),
        },
        
        savings: {
          amount: annualSavings,
          percentage: discountRate * 100,
          confidence: 75,
        },
        
        implementation: {
          effort: 'medium',
          timeline: '1-2 months',
          steps: [
            'Analyze total spend with supplier',
            'Benchmark volume discount rates in industry',
            'Propose tiered discount structure',
            'Negotiate and execute amendment',
          ],
        },
        
        priority: {
          score: 80,
          recommendation: 'short-term',
        },
      });
    }

    return opportunities;
  }

  /**
   * Analyze supplier consolidation opportunities
   */
  private async analyzeSupplierConsolidation(
    tenantId: string,
    financialData: any
  ): Promise<EnhancedSavingsOpportunity[]> {
    const opportunities: EnhancedSavingsOpportunity[] = [];

    // This would analyze across multiple contracts
    // For now, return empty array as it requires cross-contract analysis
    
    return opportunities;
  }
}

export const enhancedSavingsOpportunitiesService = EnhancedSavingsOpportunitiesService.getInstance();
