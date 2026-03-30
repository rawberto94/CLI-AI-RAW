/**
 * Data Synthesizer Agent — Codename: Synthesizer �
 *
 * Aggregates cross-contract portfolio data for trend analysis,
 * anomaly detection, vendor concentration analysis, and
 * timeline heatmaps. Works on individual contracts but produces
 * portfolio-level insights by referencing tenant-wide context.
 *
 * Cluster: oracles | Handle: @synthesizer
 */

import { BaseAgent } from './base-agent';
import type { AgentInput, AgentOutput, AgentRecommendation } from './types';
import { logger } from '../utils/logger';
import clientsDb from 'clients-db';

const getClient = typeof clientsDb === 'function' ? clientsDb : (clientsDb as any).default;
const prisma = getClient();

// --------------------------------------------------------------------------
// Internal types
// --------------------------------------------------------------------------

interface PortfolioSummary {
  totalContracts: number;
  activeContracts: number;
  totalPortfolioValue: number;
  averageContractValue: number;
  typeDistribution: Record<string, number>;
  statusDistribution: Record<string, number>;
}

interface ValueAnalysis {
  topContractsByValue: Array<{ id: string; title: string; value: number }>;
  valueRanges: Array<{ range: string; count: number }>;
  totalValue: number;
  medianValue: number;
}

interface TimelineEntry {
  month: string;
  expirationCount: number;
  renewalCount: number;
}

interface VendorConcentration {
  vendor: string;
  contractCount: number;
  totalValue: number;
  percentage: number;
}

interface Anomaly {
  id: string;
  type: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  contractId?: string;
}

interface TrendData {
  metric: string;
  direction: 'increasing' | 'decreasing' | 'stable';
  description: string;
}

interface SynthesisResult {
  portfolioSummary: PortfolioSummary;
  valueAnalysis: ValueAnalysis;
  timelineData: TimelineEntry[];
  vendorConcentration: VendorConcentration[];
  anomalies: Anomaly[];
  trends: TrendData[];
  synthesisedAt: string;
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function classifyValueRange(value: number): string {
  if (value < 10_000) return '<$10K';
  if (value < 50_000) return '$10K-$50K';
  if (value < 100_000) return '$50K-$100K';
  if (value < 500_000) return '$100K-$500K';
  if (value < 1_000_000) return '$500K-$1M';
  return '>$1M';
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : ((sorted[mid - 1]! + sorted[mid]!) / 2);
}

// --------------------------------------------------------------------------
// Agent implementation
// --------------------------------------------------------------------------

export class DataSynthesizerAgent extends BaseAgent {
  name = 'data-synthesizer-agent';
  version = '1.0.0';
  capabilities = ['data-synthesis', 'opportunity-discovery'] as string[];

  async execute(input: AgentInput): Promise<AgentOutput> {
    const tenantId = input.tenantId;

    logger.info({ contractId: input.contractId, tenantId }, 'Synthesising portfolio data');

    // Fetch all contracts for the tenant
    let contracts: Array<{
      id: string;
      contractTitle: string | null;
      contractType: string | null;
      status: string | null;
      totalValue: any; // Decimal type
      supplierName: string | null;
      effectiveDate: Date | null;
      expirationDate: Date | null;
      autoRenewalEnabled: boolean | null;
      createdAt: Date;
    }>;

    try {
      contracts = await prisma.contract.findMany({
        where: { tenantId },
        select: {
          id: true,
          contractTitle: true,
          contractType: true,
          status: true,
          totalValue: true,
          supplierName: true,
          effectiveDate: true,
          expirationDate: true,
          autoRenewalEnabled: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 500, // cap for performance
      });
    } catch (error) {
      logger.error({ error, tenantId }, 'Failed to fetch contracts for synthesis');
      return {
        success: false,
        confidence: 0,
        reasoning: `Failed to query contracts: ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    if (contracts.length === 0) {
      return {
        success: true,
        data: this.emptyResult(),
        confidence: 0.5,
        reasoning: 'No contracts found for this tenant.',
      };
    }

    // --- Portfolio summary ---
    const now = new Date();
    const activeContracts = contracts.filter(c => {
      if (c.status === 'active') return true;
      if (c.expirationDate && new Date(c.expirationDate) > now) return true;
      return false;
    });

    const values = contracts.map(c => Number(c.totalValue || 0));
    const totalPortfolioValue = values.reduce((a, b) => a + b, 0);

    const typeDistribution: Record<string, number> = {};
    const statusDistribution: Record<string, number> = {};
    for (const c of contracts) {
      const t = c.contractType || 'Unknown';
      typeDistribution[t] = (typeDistribution[t] || 0) + 1;
      const s = c.status || 'unknown';
      statusDistribution[s] = (statusDistribution[s] || 0) + 1;
    }

    const portfolioSummary: PortfolioSummary = {
      totalContracts: contracts.length,
      activeContracts: activeContracts.length,
      totalPortfolioValue,
      averageContractValue: contracts.length > 0 ? totalPortfolioValue / contracts.length : 0,
      typeDistribution,
      statusDistribution,
    };

    // --- Value analysis ---
    const positiveValues = values.filter(v => v > 0);
    const topByValue = [...contracts]
      .sort((a, b) => Number(b.totalValue || 0) - Number(a.totalValue || 0))
      .slice(0, 10)
      .filter(c => Number(c.totalValue || 0) > 0)
      .map(c => ({ id: c.id, title: c.contractTitle || 'Untitled', value: Number(c.totalValue || 0) }));

    const rangeCounts: Record<string, number> = {};
    for (const v of positiveValues) {
      const range = classifyValueRange(v);
      rangeCounts[range] = (rangeCounts[range] || 0) + 1;
    }
    const valueRanges = Object.entries(rangeCounts).map(([range, count]) => ({ range, count }));

    const valueAnalysis: ValueAnalysis = {
      topContractsByValue: topByValue,
      valueRanges,
      totalValue: totalPortfolioValue,
      medianValue: median(positiveValues),
    };

    // --- Timeline heatmap (next 12 months) ---
    const timelineData: TimelineEntry[] = [];
    for (let i = 0; i < 12; i++) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const mk = monthKey(monthDate);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + i + 1, 0);

      const expirationCount = contracts.filter(c => {
        if (!c.expirationDate) return false;
        const exp = new Date(c.expirationDate);
        return monthKey(exp) === mk;
      }).length;

      const renewalCount = contracts.filter(c => {
        if (!c.autoRenewalEnabled || !c.expirationDate) return false;
        const exp = new Date(c.expirationDate);
        return monthKey(exp) === mk;
      }).length;

      timelineData.push({
        month: mk,
        expirationCount,
        renewalCount,
      });
    }

    // --- Vendor concentration ---
    const vendorMap = new Map<string, { count: number; totalValue: number }>();
    for (const c of contracts) {
      const vendor = c.supplierName || 'Unknown';
      const entry = vendorMap.get(vendor) || { count: 0, totalValue: 0 };
      entry.count++;
      entry.totalValue += Number(c.totalValue || 0);
      vendorMap.set(vendor, entry);
    }
    const vendorConcentration: VendorConcentration[] = [...vendorMap.entries()]
      .map(([vendor, data]) => ({
        vendor,
        contractCount: data.count,
        totalValue: data.totalValue,
        percentage: totalPortfolioValue > 0 ? (data.totalValue / totalPortfolioValue) * 100 : 0,
      }))
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 20);

    // --- Anomaly detection ---
    const anomalies: Anomaly[] = [];
    let anomalyIdx = 0;

    // Outlier values (>3x median)
    const med = median(positiveValues);
    if (med > 0) {
      for (const c of contracts) {
        const v = Number(c.totalValue || 0);
        if (v > med * 5 && v > 100_000) {
          anomalies.push({
            id: `anomaly-${++anomalyIdx}`,
            type: 'outlier-value',
            description: `"${c.contractTitle || 'Untitled'}" has value $${v.toLocaleString()} — ${(v / med).toFixed(1)}x the median portfolio value.`,
            severity: 'medium',
            contractId: c.id,
          });
        }
      }
    }

    // Single-vendor concentration risk (>50% of portfolio value)
    for (const vc of vendorConcentration) {
      if (vc.percentage > 50 && vc.contractCount >= 2) {
        anomalies.push({
          id: `anomaly-${++anomalyIdx}`,
          type: 'vendor-concentration',
          description: `${vc.vendor} accounts for ${vc.percentage.toFixed(1)}% of portfolio value ($${vc.totalValue.toLocaleString()}) across ${vc.contractCount} contracts.`,
          severity: 'high',
        });
      }
    }

    // Expiration cluster (>3 contracts in one month)
    for (const te of timelineData) {
      if (te.expirationCount >= 3) {
        anomalies.push({
          id: `anomaly-${++anomalyIdx}`,
          type: 'expiration-cluster',
          description: `${te.expirationCount} contracts expire in ${te.month}. Consider staggering renewal dates to reduce workload spikes.`,
          severity: te.expirationCount >= 5 ? 'high' : 'medium',
        });
      }
    }

    // Missing values
    const missingValueCount = contracts.filter(c => !c.totalValue || Number(c.totalValue) === 0).length;
    if (missingValueCount > contracts.length * 0.3) {
      anomalies.push({
        id: `anomaly-${++anomalyIdx}`,
        type: 'missing-data',
        description: `${missingValueCount} of ${contracts.length} contracts (${((missingValueCount / contracts.length) * 100).toFixed(0)}%) have no total value specified.`,
        severity: 'medium',
      });
    }

    // --- Trends ---
    const trends: TrendData[] = [];

    // Contract creation velocity
    const recentContracts = contracts.filter(c => c.createdAt > new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)).length;
    const olderContracts = contracts.filter(c => {
      const t = c.createdAt.getTime();
      return t > now.getTime() - 180 * 24 * 60 * 60 * 1000 && t <= now.getTime() - 90 * 24 * 60 * 60 * 1000;
    }).length;
    if (recentContracts > olderContracts * 1.5 && recentContracts > 3) {
      trends.push({ metric: 'Contract volume', direction: 'increasing', description: `${recentContracts} contracts in last 90 days vs ${olderContracts} in prior 90 days.` });
    } else if (olderContracts > recentContracts * 1.5 && olderContracts > 3) {
      trends.push({ metric: 'Contract volume', direction: 'decreasing', description: `${recentContracts} contracts in last 90 days vs ${olderContracts} in prior 90 days.` });
    } else {
      trends.push({ metric: 'Contract volume', direction: 'stable', description: `${recentContracts} contracts in last 90 days, ${olderContracts} in prior 90 days.` });
    }

    // Type concentration
    const topType = Object.entries(typeDistribution).sort(([, a], [, b]) => b - a)[0];
    if (topType && contracts.length > 5 && topType[1] > contracts.length * 0.5) {
      trends.push({ metric: 'Type concentration', direction: 'increasing', description: `${topType[0]} represents ${((topType[1] / contracts.length) * 100).toFixed(0)}% of all contracts.` });
    }

    const result: SynthesisResult = {
      portfolioSummary,
      valueAnalysis,
      timelineData,
      vendorConcentration,
      anomalies,
      trends,
      synthesisedAt: new Date().toISOString(),
    };

    // --- Recommendations ---
    const recommendations: AgentRecommendation[] = [];

    if (anomalies.filter(a => a.type === 'vendor-concentration').length > 0) {
      recommendations.push({
        id: `synth-rec-vendor-${Date.now()}`,
        title: 'Vendor diversification recommended',
        description: 'High vendor concentration risk detected. Consider diversifying suppliers to reduce single-source dependency.',
        category: 'risk-mitigation' as const,
        priority: 'high' as const,
        confidence: 0.85,
        effort: 'high' as const,
        timeframe: 'Next procurement cycle',
        actions: [],
        reasoning: 'Single-vendor dependency creates supply chain risk and reduces negotiating leverage.',
      });
    }

    if (anomalies.filter(a => a.type === 'expiration-cluster').length > 0) {
      recommendations.push({
        id: `synth-rec-expiry-${Date.now()}`,
        title: 'Stagger contract expiration dates',
        description: 'Multiple contracts expire within the same month. Stagger renewal dates to avoid administrative bottlenecks.',
        category: 'process-improvement' as const,
        priority: 'medium' as const,
        confidence: 0.9,
        effort: 'medium' as const,
        timeframe: 'At next renewal',
        actions: [],
        reasoning: 'Clustered expirations overwhelm review teams and increase risk of auto-renewals going unreviewed.',
      });
    }

    if (missingValueCount > 0) {
      recommendations.push({
        id: `synth-rec-data-${Date.now()}`,
        title: 'Improve contract data completeness',
        description: `${missingValueCount} contracts lack total value data. Complete this for accurate portfolio analytics.`,
        category: 'data-quality' as const,
        priority: 'medium' as const,
        confidence: 0.95,
        effort: 'low' as const,
        timeframe: 'Ongoing',
        actions: [],
        reasoning: 'Incomplete financial data undermines portfolio value analysis and reporting accuracy.',
      });
    }

    const confidence = this.calculateConfidence({
      dataQuality: contracts.length > 10 ? 0.9 : 0.6,
      modelConfidence: 0.85,
      validationPassed: true,
    });

    return {
      success: true,
      data: result,
      recommendations,
      confidence,
      reasoning: this.formatReasoning([
        `Portfolio: ${contracts.length} contracts, ${activeContracts.length} active`,
        `Total value: $${totalPortfolioValue.toLocaleString()}`,
        `${vendorConcentration.length} unique vendor(s)`,
        `${anomalies.length} anomaly/ies detected`,
        `${trends.length} trend(s) identified`,
        ...anomalies.slice(0, 3).map(a => `⚠️  [${a.severity.toUpperCase()}] ${a.type}: ${a.description.slice(0, 80)}`),
      ]),
      metadata: {
        contractCount: contracts.length,
        anomalyCount: anomalies.length,
        portfolioValue: totalPortfolioValue,
      },
    };
  }

  private emptyResult(): SynthesisResult {
    return {
      portfolioSummary: { totalContracts: 0, activeContracts: 0, totalPortfolioValue: 0, averageContractValue: 0, typeDistribution: {}, statusDistribution: {} },
      valueAnalysis: { topContractsByValue: [], valueRanges: [], totalValue: 0, medianValue: 0 },
      timelineData: [],
      vendorConcentration: [],
      anomalies: [],
      trends: [],
      synthesisedAt: new Date().toISOString(),
    };
  }

  protected getEventType(): 'data_synthesized' {
    return 'data_synthesized';
  }
}

export const dataSynthesizerAgent = new DataSynthesizerAgent();
