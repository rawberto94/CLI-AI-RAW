/**
 * Renewal Intelligence Service
 * 
 * Comprehensive renewal management with:
 * - Renewal Radar (upcoming renewals with risk scoring)
 * - Automated alerts at 90/60/30 days
 * - Portfolio analytics and spending trends
 * - Rate benchmarking and negotiation opportunities
 * - Auto-renewal tracking and opt-out management
 * - Renewal calendar with priority scoring
 * 
 * @version 2.0.0
 */

import { prisma } from '../lib/prisma';
import { createLogger } from '../utils/logger';

const logger = createLogger('renewal-intelligence');

// ============================================================================
// TYPES
// ============================================================================

export interface RenewalRadarItem {
  contractId: string;
  contractTitle: string;
  supplierName: string;
  category?: string;
  currentValue: number;
  currency: string;
  renewalDate: Date;
  daysUntilRenewal: number;
  autoRenewal: boolean;
  optOutDeadline?: Date;
  daysUntilOptOut?: number;
  noticePeriodDays?: number;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  riskScore: number; // 0-100
  recommendedAction: 'renew' | 'renegotiate' | 'terminate' | 'review' | 'opt_out';
  confidence: number;
  lastRenewalValue?: number;
  valueChange?: number; // Percentage change from last renewal
  issues: string[];
  metadata: {
    contractAgeMonths: number;
    negotiationHistory: number;
    performanceScore?: number;
    complianceScore?: number;
  };
}

export interface RenewalCalendar {
  year: number;
  month: number;
  monthName: string;
  renewals: RenewalCalendarItem[];
  totalValue: number;
  riskSummary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface RenewalCalendarItem {
  contractId: string;
  title: string;
  supplierName: string;
  renewalDate: Date;
  value: number;
  riskLevel: string;
  autoRenewal: boolean;
  daysUntilRenewal: number;
}

export interface PortfolioAnalytics {
  totalContractsUpForRenewal: number;
  totalValueAtRisk: number;
  averageRenewalLeadTime: number; // days
  renewalSuccessRate: number; // percentage
  autoRenewalRate: number;
  negotiatedSavings: number;
  expiringWithoutRenewalPlan: number;
  byCategory: Record<string, {
    count: number;
    value: number;
    avgRiskScore: number;
  }>;
  bySupplier: Record<string, {
    count: number;
    value: number;
    renewalDates: Date[];
  }>;
  trends: {
    month: string;
    renewals: number;
    value: number;
    negotiatedSavings: number;
  }[];
}

export interface RateBenchmark {
  category: string;
  role?: string;
  currentRate: number;
  marketRate: number;
  benchmarkSource: string;
  variance: number; // percentage
  recommendation: string;
  lastUpdated: Date;
}

export interface NegotiationOpportunity {
  contractId: string;
  contractTitle: string;
  supplierName: string;
  category: string;
  currentValue: number;
  potentialSavings: number;
  savingsPercentage: number;
  confidence: number;
  reasons: string[];
  recommendedStrategy: string;
  supportingData: {
    marketBenchmark?: RateBenchmark;
    historicalRates?: number[];
    comparableContracts?: Array<{
      contractId: string;
      supplierName: string;
      rate: number;
    }>;
  };
  priority: 'critical' | 'high' | 'medium' | 'low';
  dueDate: Date;
}

export interface AlertSchedule {
  contractId: string;
  alerts: Array<{
    type: 'renewal' | 'opt_out' | 'notice' | 'review';
    daysBefore: number;
    scheduledDate: Date;
    priority: 'critical' | 'high' | 'medium' | 'low';
    recipients: string[];
    channels: ('email' | 'in_app' | 'slack' | 'sms')[];
  }>;
}

export interface RenewalPrediction {
  contractId: string;
  renewalProbability: number; // 0-100
  predictedOutcome: 'renew' | 'renegotiate' | 'terminate' | 'uncertain';
  confidence: number;
  factors: Array<{
    name: string;
    impact: number; // -1 to 1
    description: string;
  }>;
  recommendedActions: string[];
}

// ============================================================================
// MAIN SERVICE
// ============================================================================

class RenewalIntelligenceService {
  private static instance: RenewalIntelligenceService;

  private constructor() {
    logger.info('Renewal Intelligence Service initialized');
  }

  static getInstance(): RenewalIntelligenceService {
    if (!RenewalIntelligenceService.instance) {
      RenewalIntelligenceService.instance = new RenewalIntelligenceService();
    }
    return RenewalIntelligenceService.instance;
  }

  // ==========================================================================
  // RENEWAL RADAR
  // ==========================================================================

  /**
   * Get renewal radar - upcoming renewals with comprehensive risk analysis
   */
  async getRenewalRadar(
    tenantId: string,
    options: {
      daysAhead?: number;
      riskLevel?: ('critical' | 'high' | 'medium' | 'low')[];
      category?: string;
      supplierId?: string;
      includeAutoRenewal?: boolean;
    } = {}
  ): Promise<RenewalRadarItem[]> {
    const {
      daysAhead = 180,
      riskLevel,
      category,
      supplierId,
      includeAutoRenewal = true,
    } = options;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + daysAhead);

    // Fetch contracts with renewal artifacts expiring within window
    const contracts = await prisma.contract.findMany({
      where: {
        tenantId,
        isDeleted: false,
        OR: [
          {
            endDate: {
              gte: new Date(),
              lte: cutoffDate,
            },
          },
          {
            artifacts: {
              some: {
                type: 'RENEWAL',
                data: {
                  path: ['currentTermEnd'],
                  gte: new Date().toISOString(),
                  lte: cutoffDate.toISOString(),
                },
              },
            },
          },
        ],
        ...(category ? { category } : {}),
        ...(supplierId ? { supplierId } : {}),
      },
      include: {
        artifacts: {
          where: { type: 'RENEWAL' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },

      },
      orderBy: { endDate: 'asc' },
    });

    const radarItems: RenewalRadarItem[] = [];

    for (const contract of contracts) {
      const renewalArtifact = contract.artifacts?.[0];
      const renewalData = renewalArtifact?.data as any;
      const expiration = contract.expirationDate;

      // Determine renewal date
      const renewalDate = renewalData?.currentTermEnd 
        ? new Date(renewalData.currentTermEnd)
        : contract.endDate;

      if (!renewalDate) continue;

      const daysUntilRenewal = Math.ceil(
        (renewalDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      if (daysUntilRenewal < 0) continue; // Already expired

      // Calculate risk score
      const riskAnalysis = this.calculateRenewalRisk(
        contract,
        renewalData,
        null,
        daysUntilRenewal
      );

      // Filter by risk level if specified
      if (riskLevel && !riskLevel.includes(riskAnalysis.level)) {
        continue;
      }

      // Skip auto-renewal if not included
      if (!includeAutoRenewal && renewalData?.autoRenewal) {
        continue;
      }

      radarItems.push({
        contractId: contract.id,
        contractTitle: contract.contractTitle || contract.fileName || 'Untitled',
        supplierName: contract.supplierName || 'Unknown',
        category: contract.category ?? undefined,
        currentValue: Number(contract.totalValue || 0),
        currency: contract.currency || 'USD',
        renewalDate,
        daysUntilRenewal,
        autoRenewal: renewalData?.autoRenewal || false,
        optOutDeadline: renewalData?.renewalTerms?.optOutDeadline 
          ? new Date(renewalData.renewalTerms.optOutDeadline)
          : undefined,
        daysUntilOptOut: renewalData?.renewalTerms?.optOutDeadline
          ? Math.ceil((new Date(renewalData.renewalTerms.optOutDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : undefined,
        noticePeriodDays: renewalData?.renewalTerms?.noticePeriodDays,
        riskLevel: riskAnalysis.level,
        riskScore: riskAnalysis.score,
        recommendedAction: riskAnalysis.recommendedAction,
        confidence: renewalArtifact?.confidence ? Number(renewalArtifact.confidence) : 0.7,
        lastRenewalValue: renewalData?.lastRenewalValue,
        valueChange: renewalData?.lastRenewalValue
          ? ((Number(contract.totalValue) - renewalData.lastRenewalValue) / renewalData.lastRenewalValue) * 100
          : undefined,
        issues: riskAnalysis.issues,
        metadata: {
          contractAgeMonths: contract.startDate
            ? Math.floor((Date.now() - contract.startDate.getTime()) / (1000 * 60 * 60 * 24 * 30))
            : 0,
          negotiationHistory: renewalData?.renewalCount || 0,
          performanceScore: undefined,
          complianceScore: undefined,
        },
      });
    }

    // Sort by risk score (highest first), then by days until renewal
    return radarItems.sort((a, b) => {
      if (b.riskScore !== a.riskScore) return b.riskScore - a.riskScore;
      return a.daysUntilRenewal - b.daysUntilRenewal;
    });
  }

  /**
   * Generate renewal calendar with monthly aggregation
   */
  async getRenewalCalendar(
    tenantId: string,
    year: number = new Date().getFullYear()
  ): Promise<RenewalCalendar[]> {
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59);

    const contracts = await prisma.contract.findMany({
      where: {
        tenantId,
        isDeleted: false,
        endDate: {
          gte: startOfYear,
          lte: endOfYear,
        },
      },
      include: {
        artifacts: {
          where: { type: 'RENEWAL' },
          take: 1,
        },
      },
    });

    const months: RenewalCalendar[] = [];

    for (let month = 0; month < 12; month++) {
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0);

      const monthContracts = contracts.filter(c => {
        const endDate = c.endDate;
        return endDate && endDate >= monthStart && endDate <= monthEnd;
      });

      const renewals: RenewalCalendarItem[] = monthContracts.map(c => {
        const renewalArtifact = c.artifacts?.[0];
        const renewalData = renewalArtifact?.data as any;
        const daysUntilRenewal = c.endDate
          ? Math.ceil((c.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : 0;

        return {
          contractId: c.id,
          title: c.contractTitle || c.fileName || 'Untitled',
          supplierName: c.supplierName || 'Unknown',
          renewalDate: c.endDate!,
          value: Number(c.totalValue || 0),
          riskLevel: this.quickRiskLevel(daysUntilRenewal),
          autoRenewal: renewalData?.autoRenewal || false,
          daysUntilRenewal,
        };
      });

      const totalValue = renewals.reduce((sum, r) => sum + r.value, 0);

      months.push({
        year,
        month,
        monthName: monthStart.toLocaleString('default', { month: 'long' }),
        renewals: renewals.sort((a, b) => a.renewalDate.getTime() - b.renewalDate.getTime()),
        totalValue,
        riskSummary: {
          critical: renewals.filter(r => r.riskLevel === 'critical').length,
          high: renewals.filter(r => r.riskLevel === 'high').length,
          medium: renewals.filter(r => r.riskLevel === 'medium').length,
          low: renewals.filter(r => r.riskLevel === 'low').length,
        },
      });
    }

    return months;
  }

  // ==========================================================================
  // PORTFOLIO ANALYTICS
  // ==========================================================================

  /**
   * Get comprehensive portfolio analytics
   */
  async getPortfolioAnalytics(
    tenantId: string,
    options: {
      lookbackMonths?: number;
    } = {}
  ): Promise<PortfolioAnalytics> {
    const { lookbackMonths = 12 } = options;

    const now = new Date();
    const lookbackDate = new Date();
    lookbackDate.setMonth(lookbackDate.getMonth() - lookbackMonths);

    // Get all contracts expiring in next 12 months
    const upcomingRenewals = await this.getRenewalRadar(tenantId, { daysAhead: 365 });

    // Get historical renewal data
    const historicalRenewals = await prisma.contract.findMany({
      where: {
        tenantId,
        isDeleted: false,
        metadata: {
          path: ['renewalCount'],
          gt: 0,
        },
      },
      select: {
        totalValue: true,
        category: true,
        supplierName: true,
        endDate: true,
        metadata: true,
      },
    });

    // Calculate category breakdown
    const byCategory: PortfolioAnalytics['byCategory'] = {};
    const bySupplier: PortfolioAnalytics['bySupplier'] = {};

    for (const renewal of upcomingRenewals) {
      const cat = renewal.category || 'Uncategorized';
      if (!byCategory[cat]) {
        byCategory[cat] = { count: 0, value: 0, avgRiskScore: 0 };
      }
      byCategory[cat].count++;
      byCategory[cat].value += renewal.currentValue;
      byCategory[cat].avgRiskScore += renewal.riskScore;

      const sup = renewal.supplierName;
      if (!bySupplier[sup]) {
        bySupplier[sup] = { count: 0, value: 0, renewalDates: [] };
      }
      bySupplier[sup].count++;
      bySupplier[sup].value += renewal.currentValue;
      bySupplier[sup].renewalDates.push(renewal.renewalDate);
    }

    // Average risk scores
    for (const cat of Object.keys(byCategory)) {
      if (byCategory[cat].count > 0) {
        byCategory[cat].avgRiskScore /= byCategory[cat].count;
      }
    }

    // Calculate trends
    const trends: PortfolioAnalytics['trends'] = [];
    for (let i = lookbackMonths - 1; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = month.toLocaleString('default', { month: 'short', year: '2-digit' });

      const monthRenewals = historicalRenewals.filter(r => {
        if (!r.endDate) return false;
        return r.endDate.getMonth() === month.getMonth() &&
               r.endDate.getFullYear() === month.getFullYear();
      });

      trends.push({
        month: monthStr,
        renewals: monthRenewals.length,
        value: monthRenewals.reduce((sum, r) => sum + Number(r.totalValue || 0), 0),
        negotiatedSavings: 0, // Would come from actual negotiation tracking
      });
    }

    // Calculate metrics
    const totalValueAtRisk = upcomingRenewals.reduce((sum, r) => sum + r.currentValue, 0);
    const avgLeadTime = upcomingRenewals.length > 0
      ? upcomingRenewals.reduce((sum, r) => sum + r.daysUntilRenewal, 0) / upcomingRenewals.length
      : 0;

    const expiringWithoutPlan = upcomingRenewals.filter(r => {
      return r.daysUntilRenewal < 30 && r.riskLevel === 'critical';
    }).length;

    // Calculate renewal success rate from historical records
    const renewalHistoryCount = await prisma.renewalHistory.count({
      where: { tenantId },
    });
    const completedRenewals = await prisma.renewalHistory.count({
      where: { tenantId, status: 'COMPLETED' },
    });
    const renewalSuccessRate = renewalHistoryCount > 0
      ? Math.round((completedRenewals / renewalHistoryCount) * 100)
      : 0; // No history yet

    return {
      totalContractsUpForRenewal: upcomingRenewals.length,
      totalValueAtRisk,
      averageRenewalLeadTime: Math.round(avgLeadTime),
      renewalSuccessRate,
      autoRenewalRate: upcomingRenewals.length > 0
        ? upcomingRenewals.filter(r => r.autoRenewal).length / upcomingRenewals.length * 100
        : 0,
      negotiatedSavings: 0, // Would come from actual tracking
      expiringWithoutRenewalPlan: expiringWithoutPlan,
      byCategory,
      bySupplier,
      trends,
    };
  }

  // ==========================================================================
  // NEGOTIATION OPPORTUNITIES
  // ==========================================================================

  /**
   * Identify negotiation opportunities based on benchmarks and market data
   */
  async identifyNegotiationOpportunities(
    tenantId: string,
    options: {
      minSavingsPercentage?: number;
      minValue?: number;
      daysUntilRenewal?: number;
    } = {}
  ): Promise<NegotiationOpportunity[]> {
    const {
      minSavingsPercentage = 5,
      minValue = 10000,
      daysUntilRenewal = 180,
    } = options;

    // Get upcoming renewals with significant value
    const renewals = await this.getRenewalRadar(tenantId, { daysAhead: daysUntilRenewal });

    const opportunities: NegotiationOpportunity[] = [];

    for (const renewal of renewals) {
      if (renewal.currentValue < minValue) continue;

      const reasons: string[] = [];
      let potentialSavings = 0;
      let confidence = 0.5;
      let strategy = 'Standard renewal review';

      // Check for long tenure (negotiation leverage)
      if (renewal.metadata.contractAgeMonths > 36) {
        reasons.push(`Long-standing relationship (${Math.floor(renewal.metadata.contractAgeMonths / 12)} years) - loyalty discount opportunity`);
        confidence += 0.1;
      }

      // Check for multiple renewals without renegotiation
      if (renewal.metadata.negotiationHistory === 0 && renewal.autoRenewal) {
        reasons.push('Auto-renewed previously - rate may be above market');
        potentialSavings = renewal.currentValue * 0.08;
        confidence += 0.15;
        strategy = 'Request market rate analysis and competitive bids';
      }

      // Check for high risk score (indicates issues)
      if (renewal.riskScore > 70) {
        reasons.push('High risk indicators - renegotiate terms for better protection');
        confidence += 0.1;
      }

      // Value-based opportunity sizing
      if (renewal.currentValue > 100000) {
        reasons.push('High-value contract - significant savings potential');
        potentialSavings = Math.max(potentialSavings, renewal.currentValue * 0.1);
        confidence += 0.1;
        strategy = 'Engage procurement specialist for strategic negotiation';
      }

      // Calculate final savings percentage
      const savingsPercentage = potentialSavings / renewal.currentValue * 100;

      if (savingsPercentage >= minSavingsPercentage) {
        opportunities.push({
          contractId: renewal.contractId,
          contractTitle: renewal.contractTitle,
          supplierName: renewal.supplierName,
          category: renewal.category || 'General',
          currentValue: renewal.currentValue,
          potentialSavings,
          savingsPercentage,
          confidence: Math.min(confidence, 1),
          reasons,
          recommendedStrategy: strategy,
          supportingData: {
            comparableContracts: [], // Would fetch similar contracts
          },
          priority: renewal.riskLevel === 'critical' ? 'critical' :
                    renewal.riskLevel === 'high' ? 'high' :
                    savingsPercentage > 10 ? 'high' : 'medium',
          dueDate: renewal.renewalDate,
        });
      }
    }

    // Sort by priority and potential savings
    return opportunities.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return b.potentialSavings - a.potentialSavings;
    });
  }

  // ==========================================================================
  // ALERT SCHEDULING
  // ==========================================================================

  /**
   * Generate alert schedule for a contract
   */
  async generateAlertSchedule(
    contractId: string,
    tenantId: string
  ): Promise<AlertSchedule> {
    const renewal = await this.getRenewalRadar(tenantId, { daysAhead: 365 })
      .then(items => items.find(i => i.contractId === contractId));

    if (!renewal) {
      return { contractId, alerts: [] };
    }

    const alerts: AlertSchedule['alerts'] = [];

    // 90-day renewal alert
    if (renewal.daysUntilRenewal > 90) {
      alerts.push({
        type: 'renewal',
        daysBefore: 90,
        scheduledDate: new Date(renewal.renewalDate.getTime() - 90 * 24 * 60 * 60 * 1000),
        priority: 'medium',
        recipients: [],
        channels: ['email', 'in_app'],
      });
    }

    // 60-day renewal alert
    if (renewal.daysUntilRenewal > 60) {
      alerts.push({
        type: 'renewal',
        daysBefore: 60,
        scheduledDate: new Date(renewal.renewalDate.getTime() - 60 * 24 * 60 * 60 * 1000),
        priority: renewal.riskLevel === 'high' || renewal.riskLevel === 'critical' ? 'high' : 'medium',
        recipients: [],
        channels: ['email', 'in_app'],
      });
    }

    // 30-day critical alert
    if (renewal.daysUntilRenewal > 30) {
      alerts.push({
        type: 'renewal',
        daysBefore: 30,
        scheduledDate: new Date(renewal.renewalDate.getTime() - 30 * 24 * 60 * 60 * 1000),
        priority: 'critical',
        recipients: [],
        channels: ['email', 'in_app', 'slack'],
      });
    }

    // Opt-out deadline alert
    if (renewal.daysUntilOptOut && renewal.daysUntilOptOut > 0) {
      const optOutPriority = renewal.daysUntilOptOut <= 7 ? 'critical' :
                             renewal.daysUntilOptOut <= 14 ? 'high' : 'medium';
      
      alerts.push({
        type: 'opt_out',
        daysBefore: renewal.daysUntilOptOut,
        scheduledDate: new Date(),
        priority: optOutPriority,
        recipients: [],
        channels: optOutPriority === 'critical' ? ['email', 'in_app', 'slack', 'sms'] : ['email', 'in_app'],
      });
    }

    // Notice period alert
    if (renewal.noticePeriodDays && renewal.daysUntilRenewal > renewal.noticePeriodDays) {
      alerts.push({
        type: 'notice',
        daysBefore: renewal.noticePeriodDays,
        scheduledDate: new Date(renewal.renewalDate.getTime() - renewal.noticePeriodDays * 24 * 60 * 60 * 1000),
        priority: 'high',
        recipients: [],
        channels: ['email', 'in_app'],
      });
    }

    return { contractId, alerts };
  }

  // ==========================================================================
  // RENEWAL PREDICTION
  // ==========================================================================

  /**
   * Predict renewal outcome using historical data and contract characteristics
   */
  async predictRenewal(
    contractId: string,
    tenantId: string
  ): Promise<RenewalPrediction> {
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      include: {
        artifacts: {
          where: { type: 'RENEWAL' },
          take: 1,
        },
      },
    }) as any;

    if (!contract) {
      throw new Error('Contract not found');
    }

    const factors: RenewalPrediction['factors'] = [];
    let renewalProbability = 70; // Base probability

    // Factor 1: Contract performance (using days until expiry as proxy)
    const daysUntilExpiry = contract.endDate 
      ? Math.ceil((contract.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : 365;
    if (daysUntilExpiry < 90) {
      const perfImpact = (daysUntilExpiry / 90) * 0.2;
      renewalProbability += perfImpact * 20;
      factors.push({
        name: 'Time Pressure',
        impact: perfImpact,
        description: `${daysUntilExpiry} days until expiry`,
      });
    }

    // Factor 2: Renewal history
    const renewalData = contract.artifacts?.[0]?.data as any;
    if (renewalData?.renewalCount > 0) {
      renewalProbability += 10;
      factors.push({
        name: 'Renewal History',
        impact: 0.1,
        description: `Renewed ${renewalData.renewalCount} times previously`,
      });
    }

    // Factor 3: Risk score (using expiration risk field)
    if (contract.expirationRisk) {
      const riskMap: Record<string, number> = { LOW: 0.1, MEDIUM: 0.3, HIGH: 0.6, CRITICAL: 0.9, EXPIRED: 1 };
      const riskScore = riskMap[contract.expirationRisk] || 0.5;
      const riskImpact = -(riskScore - 0.5);
      renewalProbability += riskImpact * 15;
      factors.push({
        name: 'Risk Profile',
        impact: riskImpact,
        description: `Expiration risk: ${contract.expirationRisk}`,
      });
    }

    // Factor 4: Auto-renewal
    if (renewalData?.autoRenewal) {
      renewalProbability += 15;
      factors.push({
        name: 'Auto-Renewal Clause',
        impact: 0.15,
        description: 'Contract has auto-renewal provision',
      });
    }

    // Clamp probability
    renewalProbability = Math.max(10, Math.min(95, renewalProbability));

    // Determine predicted outcome
    let predictedOutcome: RenewalPrediction['predictedOutcome'];
    if (renewalProbability >= 80) {
      predictedOutcome = 'renew';
    } else if (renewalProbability >= 50) {
      predictedOutcome = 'renegotiate';
    } else if (renewalProbability >= 30) {
      predictedOutcome = 'uncertain';
    } else {
      predictedOutcome = 'terminate';
    }

    return {
      contractId,
      renewalProbability: Math.round(renewalProbability),
      predictedOutcome,
      confidence: 0.75, // Would be calculated from model accuracy
      factors,
      recommendedActions: this.generateRenewalRecommendations(
        renewalProbability,
        predictedOutcome,
        factors
      ),
    };
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  private calculateRenewalRisk(
    contract: any,
    renewalData: any,
    _healthScore: any,
    daysUntilRenewal: number
  ): {
    level: 'critical' | 'high' | 'medium' | 'low';
    score: number;
    recommendedAction: 'renew' | 'renegotiate' | 'terminate' | 'review' | 'opt_out';
    issues: string[];
  } {
    let score = 50;
    const issues: string[] = [];

    // Time pressure
    if (daysUntilRenewal < 14) {
      score += 30;
      issues.push('Urgent: Less than 2 weeks until expiration');
    } else if (daysUntilRenewal < 30) {
      score += 20;
      issues.push('High priority: Less than 30 days until expiration');
    } else if (daysUntilRenewal < 60) {
      score += 10;
    }

    // Opt-out deadline pressure
    if (renewalData?.renewalTerms?.optOutDeadline) {
      const optOutDays = Math.ceil(
        (new Date(renewalData.renewalTerms.optOutDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      if (optOutDays < 7 && optOutDays > 0) {
        score += 25;
        issues.push(`Critical: Opt-out deadline in ${optOutDays} days`);
      }
    }

    // Health score factors (using expiration risk)
    if (contract.expirationRisk === 'CRITICAL' || contract.expirationRisk === 'HIGH') {
      score += 15;
      issues.push('High expiration risk');
    }

    // Missing information
    if (!contract.totalValue) {
      score += 10;
      issues.push('Contract value not recorded');
    }

    // Determine level
    let level: 'critical' | 'high' | 'medium' | 'low';
    if (score >= 70) level = 'critical';
    else if (score >= 50) level = 'high';
    else if (score >= 30) level = 'medium';
    else level = 'low';

    // Determine recommended action
    let recommendedAction: 'renew' | 'renegotiate' | 'terminate' | 'review' | 'opt_out';
    if (score >= 80 && renewalData?.autoRenewal) {
      recommendedAction = 'opt_out';
    } else if (score >= 70) {
      recommendedAction = 'review';
    } else if (contract.expirationRisk === 'HIGH' || contract.expirationRisk === 'CRITICAL') {
      recommendedAction = 'renegotiate';
    } else if (score < 30 && !renewalData?.autoRenewal) {
      recommendedAction = 'renew';
    } else {
      recommendedAction = 'review';
    }

    return { level, score, recommendedAction, issues };
  }

  private quickRiskLevel(daysUntilRenewal: number): 'critical' | 'high' | 'medium' | 'low' {
    if (daysUntilRenewal < 14) return 'critical';
    if (daysUntilRenewal < 30) return 'high';
    if (daysUntilRenewal < 60) return 'medium';
    return 'low';
  }

  private generateRenewalRecommendations(
    probability: number,
    outcome: RenewalPrediction['predictedOutcome'],
    factors: RenewalPrediction['factors']
  ): string[] {
    const recommendations: string[] = [];

    if (outcome === 'renew') {
      recommendations.push('Proceed with standard renewal process');
      recommendations.push('Schedule renewal review meeting 60 days before expiration');
    } else if (outcome === 'renegotiate') {
      recommendations.push('Initiate renegotiation discussions early');
      recommendations.push('Prepare market benchmark analysis');
      recommendations.push('Identify alternative suppliers for leverage');
    } else if (outcome === 'terminate') {
      recommendations.push('Develop transition plan');
      recommendations.push('Notify stakeholders of potential termination');
      recommendations.push('Begin sourcing replacement vendor');
    } else {
      recommendations.push('Monitor contract performance closely');
      recommendations.push('Prepare for both renewal and termination scenarios');
    }

    // Add factor-specific recommendations
    const hasPerformanceIssue = factors.some(f => f.name === 'Performance Score' && f.impact < 0);
    if (hasPerformanceIssue) {
      recommendations.push('Address performance issues before renewal');
    }

    return recommendations;
  }
}

// Export singleton
export const renewalIntelligenceService = RenewalIntelligenceService.getInstance();
export { RenewalIntelligenceService };
