/**
 * Cost Savings Analyzer Service
 * 
 * Specialized service for identifying cost savings opportunities in indirect procurement
 * Focuses on rate optimization, payment terms, volume discounts, and supplier consolidation
 */

import pino from 'pino';

const logger = pino({ name: 'cost-savings-analyzer' });

export interface CostSavingsOpportunity {
  id: string;
  category: 'rate_optimization' | 'payment_terms' | 'volume_discount' | 'supplier_consolidation' | 'contract_optimization';
  title: string;
  description: string;
  potentialSavings: {
    amount: number;
    currency: string;
    percentage: number;
    timeframe: 'monthly' | 'quarterly' | 'annual';
  };
  confidence: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  priority: number; // 1-5, 5 being highest
  actionItems: string[];
  implementationTimeline: string;
  risks: string[];
}

export interface CostSavingsAnalysis {
  totalPotentialSavings: {
    amount: number;
    currency: string;
    percentage: number;
  };
  opportunities: CostSavingsOpportunity[];
  quickWins: CostSavingsOpportunity[]; // High confidence, low effort
  strategicInitiatives: CostSavingsOpportunity[]; // High value, higher effort
  summary: {
    opportunityCount: number;
    averageSavingsPerOpportunity: number;
    highConfidenceOpportunities: number;
  };
}

export class CostSavingsAnalyzerService {
  private static instance: CostSavingsAnalyzerService;

  private constructor() {}

  static getInstance(): CostSavingsAnalyzerService {
    if (!CostSavingsAnalyzerService.instance) {
      CostSavingsAnalyzerService.instance = new CostSavingsAnalyzerService();
    }
    return CostSavingsAnalyzerService.instance;
  }

  /**
   * Analyze contract artifacts for cost savings opportunities
   */
  async analyzeCostSavings(artifacts: {
    overview?: any;
    financial?: any;
    rates?: any;
    clauses?: any;
    risk?: any;
  }): Promise<CostSavingsAnalysis> {
    try {
      logger.info('Analyzing cost savings opportunities from artifacts');

      const opportunities: CostSavingsOpportunity[] = [];

      // 1. Rate optimization opportunities
      if (artifacts.rates) {
        opportunities.push(...this.analyzeRateOptimization(artifacts.rates, artifacts.financial));
      }

      // 2. Payment terms optimization
      if (artifacts.financial) {
        opportunities.push(...this.analyzePaymentTerms(artifacts.financial));
      }

      // 3. Volume discount opportunities
      if (artifacts.financial && artifacts.overview) {
        opportunities.push(...this.analyzeVolumeDiscounts(artifacts.financial, artifacts.overview));
      }

      // 4. Contract structure optimization
      if (artifacts.clauses) {
        opportunities.push(...this.analyzeContractOptimization(artifacts.clauses, artifacts.financial));
      }

      // Calculate totals
      const totalSavings = opportunities.reduce((sum, opp) => sum + opp.potentialSavings.amount, 0);
      const currency = artifacts.financial?.currency || 'USD';

      // Categorize opportunities
      const quickWins = opportunities.filter(
        opp => opp.confidence === 'high' && opp.effort === 'low'
      ).sort((a, b) => b.priority - a.priority);

      const strategicInitiatives = opportunities.filter(
        opp => opp.potentialSavings.amount > 10000 || opp.effort === 'high'
      ).sort((a, b) => b.potentialSavings.amount - a.potentialSavings.amount);

      const highConfidenceCount = opportunities.filter(opp => opp.confidence === 'high').length;

      return {
        totalPotentialSavings: {
          amount: totalSavings,
          currency,
          percentage: artifacts.financial?.totalValue 
            ? (totalSavings / artifacts.financial.totalValue) * 100 
            : 0
        },
        opportunities: opportunities.sort((a, b) => b.priority - a.priority),
        quickWins,
        strategicInitiatives,
        summary: {
          opportunityCount: opportunities.length,
          averageSavingsPerOpportunity: opportunities.length > 0 ? totalSavings / opportunities.length : 0,
          highConfidenceOpportunities: highConfidenceCount
        }
      };
    } catch (error) {
      logger.error({ error }, 'Failed to analyze cost savings');
      throw error;
    }
  }

  /**
   * Analyze rate optimization opportunities
   */
  private analyzeRateOptimization(rates: any, financial: any): CostSavingsOpportunity[] {
    const opportunities: CostSavingsOpportunity[] = [];

    if (!rates.rateCards || rates.rateCards.length === 0) {
      return opportunities;
    }

    // Check for above-market rates (simplified - would use benchmarking in production)
    const avgRate = rates.rateCards.reduce((sum: number, r: any) => sum + r.rate, 0) / rates.rateCards.length;
    
    if (avgRate > 150) { // Example threshold
      const potentialSavings = financial?.totalValue ? financial.totalValue * 0.08 : avgRate * 1000 * 0.08;
      
      opportunities.push({
        id: `savings-rate-opt-${Date.now()}`,
        category: 'rate_optimization',
        title: 'Rate Card Benchmarking Opportunity',
        description: 'Current rates appear above market average. Benchmarking against industry standards could yield significant savings.',
        potentialSavings: {
          amount: potentialSavings,
          currency: financial?.currency || 'USD',
          percentage: 8,
          timeframe: 'annual'
        },
        confidence: 'medium',
        effort: 'medium',
        priority: 4,
        actionItems: [
          'Conduct market rate benchmarking study',
          'Identify comparable suppliers with lower rates',
          'Negotiate rate reduction based on market data',
          'Consider blended rate structures'
        ],
        implementationTimeline: '2-3 months',
        risks: ['Supplier may resist rate changes', 'Quality concerns with lower-cost alternatives']
      });
    }

    // Check for location-based optimization
    if (rates.locations && rates.locations.length > 1) {
      const hasOffshore = rates.locations.some((loc: string) => 
        loc.toLowerCase().includes('offshore') || loc.toLowerCase().includes('nearshore')
      );
      
      if (!hasOffshore && financial?.totalValue > 100000) {
        opportunities.push({
          id: `savings-location-${Date.now()}`,
          category: 'rate_optimization',
          title: 'Location-Based Rate Optimization',
          description: 'Consider offshore/nearshore resources for suitable work to reduce costs by 30-40%.',
          potentialSavings: {
            amount: financial.totalValue * 0.25,
            currency: financial?.currency || 'USD',
            percentage: 25,
            timeframe: 'annual'
          },
          confidence: 'high',
          effort: 'medium',
          priority: 5,
          actionItems: [
            'Identify work suitable for offshore delivery',
            'Request offshore rate cards from supplier',
            'Pilot offshore resources on non-critical work',
            'Establish quality controls and communication protocols'
          ],
          implementationTimeline: '3-4 months',
          risks: ['Communication challenges', 'Time zone differences', 'Quality control']
        });
      }
    }

    return opportunities;
  }

  /**
   * Analyze payment terms for optimization
   */
  private analyzePaymentTerms(financial: any): CostSavingsOpportunity[] {
    const opportunities: CostSavingsOpportunity[] = [];

    if (!financial.paymentTerms) {
      return opportunities;
    }

    const paymentTermsStr = financial.paymentTerms.join(' ').toLowerCase();

    // Check for early payment discount opportunity
    if (!paymentTermsStr.includes('discount') && financial.totalValue > 50000) {
      opportunities.push({
        id: `savings-early-payment-${Date.now()}`,
        category: 'payment_terms',
        title: 'Early Payment Discount Negotiation',
        description: 'Negotiate 2-3% discount for payment within 10-15 days instead of standard terms.',
        potentialSavings: {
          amount: financial.totalValue * 0.025,
          currency: financial.currency,
          percentage: 2.5,
          timeframe: 'annual'
        },
        confidence: 'high',
        effort: 'low',
        priority: 5,
        actionItems: [
          'Propose early payment discount to supplier',
          'Ensure cash flow supports early payment',
          'Update payment processing to capture discount',
          'Track discount realization'
        ],
        implementationTimeline: '1 month',
        risks: ['Cash flow impact', 'Supplier may decline']
      });
    }

    // Check for extended payment terms
    if (paymentTermsStr.includes('net 15') || paymentTermsStr.includes('net 7')) {
      opportunities.push({
        id: `savings-extended-terms-${Date.now()}`,
        category: 'payment_terms',
        title: 'Extended Payment Terms',
        description: 'Negotiate extended payment terms (Net 45-60) to improve cash flow without cost increase.',
        potentialSavings: {
          amount: financial.totalValue * 0.01, // Cash flow benefit
          currency: financial.currency,
          percentage: 1,
          timeframe: 'annual'
        },
        confidence: 'medium',
        effort: 'low',
        priority: 3,
        actionItems: [
          'Request extended payment terms',
          'Highlight strong payment history',
          'Offer other concessions if needed'
        ],
        implementationTimeline: '1 month',
        risks: ['Supplier may request rate increase in exchange']
      });
    }

    return opportunities;
  }

  /**
   * Analyze volume discount opportunities
   */
  private analyzeVolumeDiscounts(financial: any, overview: any): CostSavingsOpportunity[] {
    const opportunities: CostSavingsOpportunity[] = [];

    if (!financial.totalValue || financial.totalValue < 100000) {
      return opportunities;
    }

    const hasVolumeDiscount = financial.discounts?.some((d: any) => 
      d.type === 'volume' || d.description?.toLowerCase().includes('volume')
    );

    if (!hasVolumeDiscount) {
      opportunities.push({
        id: `savings-volume-${Date.now()}`,
        category: 'volume_discount',
        title: 'Volume Commitment Discount',
        description: 'Negotiate volume-based discounts by committing to minimum spend levels.',
        potentialSavings: {
          amount: financial.totalValue * 0.05,
          currency: financial.currency,
          percentage: 5,
          timeframe: 'annual'
        },
        confidence: 'high',
        effort: 'low',
        priority: 4,
        actionItems: [
          'Analyze historical spend patterns',
          'Propose tiered volume discount structure',
          'Commit to minimum annual spend',
          'Include volume tracking mechanism'
        ],
        implementationTimeline: '1-2 months',
        risks: ['Commitment may reduce flexibility', 'Actual volume may fall short']
      });
    }

    return opportunities;
  }

  /**
   * Analyze contract structure optimization
   */
  private analyzeContractOptimization(clauses: any, financial: any): CostSavingsOpportunity[] {
    const opportunities: CostSavingsOpportunity[] = [];

    if (!clauses.clauses) {
      return opportunities;
    }

    // Check for auto-renewal without rate protection
    const hasAutoRenewal = clauses.clauses.some((c: any) => 
      c.type?.toLowerCase().includes('renewal') || c.content?.toLowerCase().includes('auto-renew')
    );

    const hasRateCap = clauses.clauses.some((c: any) => 
      c.content?.toLowerCase().includes('rate increase') && 
      (c.content?.toLowerCase().includes('cap') || c.content?.toLowerCase().includes('limit'))
    );

    if (hasAutoRenewal && !hasRateCap && financial?.totalValue > 50000) {
      opportunities.push({
        id: `savings-rate-cap-${Date.now()}`,
        category: 'contract_optimization',
        title: 'Rate Increase Cap Protection',
        description: 'Add rate increase cap (e.g., CPI + 2%) to protect against excessive price increases on renewal.',
        potentialSavings: {
          amount: financial.totalValue * 0.03,
          currency: financial.currency,
          percentage: 3,
          timeframe: 'annual'
        },
        confidence: 'medium',
        effort: 'low',
        priority: 4,
        actionItems: [
          'Propose rate increase cap clause',
          'Benchmark against CPI or industry indices',
          'Include in renewal negotiations',
          'Document rate protection terms'
        ],
        implementationTimeline: '1 month',
        risks: ['Supplier may resist caps', 'May need to offer longer commitment']
      });
    }

    return opportunities;
  }

  /**
   * Generate cost savings summary for artifact
   */
  generateSavingsSummary(analysis: CostSavingsAnalysis): string {
    const { totalPotentialSavings, quickWins, strategicInitiatives } = analysis;

    return `
Cost Savings Analysis Summary:
- Total Potential Savings: ${totalPotentialSavings.currency} ${totalPotentialSavings.amount.toLocaleString()} (${totalPotentialSavings.percentage.toFixed(1)}%)
- Quick Wins: ${quickWins.length} opportunities worth ${totalPotentialSavings.currency} ${quickWins.reduce((sum, opp) => sum + opp.potentialSavings.amount, 0).toLocaleString()}
- Strategic Initiatives: ${strategicInitiatives.length} opportunities worth ${totalPotentialSavings.currency} ${strategicInitiatives.reduce((sum, opp) => sum + opp.potentialSavings.amount, 0).toLocaleString()}

Top 3 Opportunities:
${analysis.opportunities.slice(0, 3).map((opp, idx) => 
  `${idx + 1}. ${opp.title} - ${opp.potentialSavings.currency} ${opp.potentialSavings.amount.toLocaleString()} (${opp.confidence} confidence)`
).join('\n')}
    `.trim();
  }
}

export const costSavingsAnalyzerService = CostSavingsAnalyzerService.getInstance();
