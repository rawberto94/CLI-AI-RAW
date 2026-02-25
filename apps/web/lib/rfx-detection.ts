/**
 * RFx Detection Algorithms — Canonical Implementation
 *
 * Extracted from the rfx-opportunities API route so detection logic is
 * reusable across API routes, background jobs, and the @scout chat handler.
 *
 * Each algorithm takes a prisma-compatible client and returns a uniform
 * RFxOpportunity[] array. The API route is now a thin wrapper around
 * these functions.
 *
 * NOTE: The workers package (packages/workers/src/agents/rfx-detection-agent.ts)
 * has a separate class-based implementation with its own prisma client. If you
 * update detection logic here, consider backporting to the workers agent, or
 * migrate the workers agent to call these functions via the API.
 *
 * @module rfx-detection
 */

import type { PrismaClient } from '@prisma/client';

// ============================================================================
// TYPES
// ============================================================================

export interface RFxOpportunity {
  id: string;
  algorithm: 'expiration' | 'savings' | 'performance' | 'consolidation';
  urgency: 'critical' | 'high' | 'medium' | 'low';
  confidence: number;
  title: string;
  description: string;
  contractId: string;
  contractTitle: string;
  supplierName: string | null;
  currentValue: number | null;
  expiryDate: string | null;
  daysToExpiry: number | null;
  savingsPotential: number | null;
  savingsPercent: number | null;
  reasoning: string;
  evidence: {
    marketRate?: number | null;
    similarContracts?: number;
    spendingTrend?: string;
    performanceScore?: number | null;
  };
  recommendedAction: string;
  category: string;
}

export interface DetectionFilter {
  algorithm: 'expiration' | 'savings' | 'performance' | 'consolidation' | 'all';
  urgency: 'critical' | 'high' | 'medium' | 'low' | 'all';
  category?: string;
  minSavings?: number;
  limit: number;
  offset: number;
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

/**
 * Run selected detection algorithms and return sorted opportunities.
 */
export async function detectRFxOpportunities(
  db: PrismaClient,
  tenantId: string,
  filter: DetectionFilter,
): Promise<RFxOpportunity[]> {
  const algorithmsToRun =
    filter.algorithm === 'all'
      ? (['expiration', 'savings', 'performance', 'consolidation'] as const)
      : [filter.algorithm];

  const runners: Record<string, () => Promise<RFxOpportunity[]>> = {
    expiration: () => detectExpiringContracts(db, tenantId, filter),
    savings: () => detectSavingsOpportunities(db, tenantId, filter),
    performance: () => detectPerformanceIssues(db, tenantId, filter),
    consolidation: () => detectConsolidationOpportunities(db, tenantId, filter),
  };

  const results = await Promise.allSettled(
    algorithmsToRun.map(alg => runners[alg]?.() ?? Promise.resolve([])),
  );

  const opportunities: RFxOpportunity[] = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i]!;
    if (result.status === 'fulfilled') {
      opportunities.push(...result.value);
    } else {
      console.error(`Detection algorithm '${algorithmsToRun[i]}' failed:`, result.reason);
    }
  }

  // Urgency filter
  const filtered =
    filter.urgency !== 'all'
      ? opportunities.filter(o => o.urgency === filter.urgency)
      : opportunities;

  // Sort: urgency → confidence → savings
  const urgencyOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  filtered.sort((a, b) => {
    const uDiff = (urgencyOrder[a.urgency] ?? 4) - (urgencyOrder[b.urgency] ?? 4);
    if (uDiff !== 0) return uDiff;
    const cDiff = b.confidence - a.confidence;
    if (Math.abs(cDiff) > 0.05) return cDiff;
    return (b.savingsPotential || 0) - (a.savingsPotential || 0);
  });

  return filtered;
}

// ============================================================================
// ALGORITHM 1: EXPIRATION DETECTION
// ============================================================================

export async function detectExpiringContracts(
  db: PrismaClient,
  tenantId: string,
  filter: DetectionFilter,
): Promise<RFxOpportunity[]> {
  const sixMonthsFromNow = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);
  const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const ninetyDays = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

  const contracts = await (db as any).contract.findMany({
    where: {
      tenantId,
      status: { in: ['ACTIVE', 'EXECUTED'] },
      expirationDate: { lte: sixMonthsFromNow, gte: new Date() },
      ...(filter.category && { contractType: filter.category }),
    },
    select: {
      id: true,
      contractTitle: true,
      supplierName: true,
      totalValue: true,
      annualValue: true,
      expirationDate: true,
      contractType: true,
    },
  });

  return contracts.map((c: any) => {
    const daysToExpiry = c.expirationDate
      ? Math.ceil((c.expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : 0;

    let urgency: RFxOpportunity['urgency'] = 'low';
    if (c.expirationDate && c.expirationDate <= thirtyDays) urgency = 'critical';
    else if (c.expirationDate && c.expirationDate <= ninetyDays) urgency = 'high';
    else urgency = 'medium';

    const value = c.annualValue?.toNumber?.() ?? c.totalValue?.toNumber?.() ?? 0;

    return {
      id: `exp-${c.id}`,
      algorithm: 'expiration' as const,
      urgency,
      confidence: urgency === 'critical' ? 0.95 : urgency === 'high' ? 0.9 : 0.85,
      title: `Contract Expiring: ${c.contractTitle}`,
      description: `Contract expires in ${daysToExpiry} days. Start RFx now to ensure continuity.`,
      contractId: c.id,
      contractTitle: c.contractTitle,
      supplierName: c.supplierName,
      currentValue: value,
      expiryDate: c.expirationDate?.toISOString() ?? null,
      daysToExpiry,
      savingsPotential: null,
      savingsPercent: null,
      reasoning: `Contract expires on ${c.expirationDate?.toLocaleDateString()}. Typical RFx cycle is 60-90 days.`,
      evidence: { spendingTrend: 'stable' },
      recommendedAction:
        urgency === 'critical'
          ? 'Start emergency RFx immediately'
          : 'Plan RFx for competitive renewal',
      category: c.contractType || 'General',
    };
  });
}

// ============================================================================
// ALGORITHM 2: SAVINGS OPPORTUNITY DETECTION
// ============================================================================

export async function detectSavingsOpportunities(
  db: PrismaClient,
  tenantId: string,
  filter: DetectionFilter,
): Promise<RFxOpportunity[]> {
  const contracts = await (db as any).contract.findMany({
    where: {
      tenantId,
      status: { in: ['ACTIVE', 'EXECUTED'] },
      expirationDate: { gt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) },
      ...(filter.category && { contractType: filter.category }),
    },
    select: {
      id: true,
      contractTitle: true,
      supplierName: true,
      totalValue: true,
      annualValue: true,
      contractType: true,
      expirationDate: true,
    },
  });

  const opportunities: RFxOpportunity[] = [];

  for (const contract of contracts) {
    const comparableContracts = await (db as any).contract.findMany({
      where: {
        tenantId,
        id: { not: contract.id },
        contractType: contract.contractType,
        status: { in: ['ACTIVE', 'EXECUTED'] },
        totalValue: {
          gte: contract.totalValue ? contract.totalValue.mul(0.5) : undefined,
          lte: contract.totalValue ? contract.totalValue.mul(2) : undefined,
        },
      },
      select: { totalValue: true, annualValue: true },
    });

    if (comparableContracts.length < 3) continue;

    const avgAnnualValue = comparableContracts
      .filter((c: any) => c.annualValue != null)
      .reduce((sum: number, c: any, _: number, arr: any[]) => sum + c.annualValue!.toNumber() / arr.length, 0);

    const contractAnnualValue = contract.annualValue?.toNumber?.() ?? 0;
    if (avgAnnualValue === 0 || contractAnnualValue === 0) continue;

    const savingsPercent =
      ((contractAnnualValue - avgAnnualValue) / contractAnnualValue) * 100;
    const savingsPotential = contractAnnualValue - avgAnnualValue;

    if (savingsPercent <= 5) continue;
    if (filter.minSavings && savingsPotential < filter.minSavings) continue;

    let urgency: RFxOpportunity['urgency'] = 'low';
    if (savingsPercent > 30) urgency = 'high';
    else if (savingsPercent > 15) urgency = 'medium';

    opportunities.push({
      id: `sav-${contract.id}`,
      algorithm: 'savings',
      urgency,
      confidence: Math.min(0.95, 0.7 + savingsPercent / 100),
      title: `Potential Savings: ${contract.contractTitle}`,
      description: `Contract is ${Math.round(savingsPercent)}% above market rate. Estimated savings: $${Math.round(savingsPotential)}/year.`,
      contractId: contract.id,
      contractTitle: contract.contractTitle,
      supplierName: contract.supplierName,
      currentValue: contractAnnualValue,
      expiryDate: contract.expirationDate?.toISOString() ?? null,
      daysToExpiry: contract.expirationDate
        ? Math.ceil((contract.expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null,
      savingsPotential,
      savingsPercent,
      reasoning: `Compared to ${comparableContracts.length} similar contracts, this contract is ${Math.round(savingsPercent)}% above market rate.`,
      evidence: {
        marketRate: avgAnnualValue,
        similarContracts: comparableContracts.length,
      },
      recommendedAction:
        savingsPercent > 25
          ? 'Renegotiate with current vendor or run competitive RFx'
          : 'Monitor pricing and consider renewal negotiation',
      category: contract.contractType || 'General',
    });
  }

  return opportunities;
}

// ============================================================================
// ALGORITHM 3: PERFORMANCE ISSUE DETECTION
// ============================================================================

export async function detectPerformanceIssues(
  db: PrismaClient,
  tenantId: string,
  _filter: DetectionFilter,
): Promise<RFxOpportunity[]> {
  const riskDetections = await (db as any).riskDetectionLog.findMany({
    where: {
      tenantId,
      acknowledged: false,
      severity: { in: ['HIGH', 'CRITICAL'] },
      riskType: { in: ['PERFORMANCE_ISSUE', 'DELIVERY_RISK', 'QUALITY_ISSUE'] },
    },
    include: {
      contract: {
        select: {
          id: true,
          contractTitle: true,
          supplierName: true,
          totalValue: true,
          annualValue: true,
          contractType: true,
          expirationDate: true,
        },
      },
    },
    orderBy: { detectedAt: 'desc' },
  });

  return riskDetections
    .map((risk: any) => {
      const contract = risk.contract;
      if (!contract) return null;

      const value = contract.annualValue?.toNumber?.() ?? contract.totalValue?.toNumber?.() ?? 0;

      return {
        id: `perf-${risk.id}`,
        algorithm: 'performance' as const,
        urgency: (risk.severity === 'CRITICAL' ? 'critical' : 'high') as RFxOpportunity['urgency'],
        confidence: risk.confidence || 0.85,
        title: `Performance Issue: ${contract.contractTitle}`,
        description: `${risk.riskType}: ${risk.description}`,
        contractId: contract.id,
        contractTitle: contract.contractTitle,
        supplierName: contract.supplierName,
        currentValue: value,
        expiryDate: contract.expirationDate?.toISOString() ?? null,
        daysToExpiry: contract.expirationDate
          ? Math.ceil((contract.expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : null,
        savingsPotential: null,
        savingsPercent: null,
        reasoning: `Performance issue detected: ${risk.description}. Recommend evaluating alternative suppliers.`,
        evidence: { performanceScore: risk.metadata?.performanceScore ?? null },
        recommendedAction:
          risk.severity === 'CRITICAL'
            ? 'Terminate contract and initiate emergency sourcing'
            : 'Address issue with vendor and prepare contingency sourcing',
        category: contract.contractType || 'General',
      };
    })
    .filter((o: RFxOpportunity | null): o is RFxOpportunity => o !== null);
}

// ============================================================================
// ALGORITHM 4: CONSOLIDATION OPPORTUNITY DETECTION
// ============================================================================

export async function detectConsolidationOpportunities(
  db: PrismaClient,
  tenantId: string,
  filter: DetectionFilter,
): Promise<RFxOpportunity[]> {
  const suppliers = await (db as any).contract.groupBy({
    by: ['supplierName'],
    where: {
      tenantId,
      status: { in: ['ACTIVE', 'EXECUTED'] },
      supplierName: { not: null },
      ...(filter.category && { contractType: filter.category }),
    },
    _count: { id: true },
    having: { id: { _count: { gte: 2 } } },
  });

  const opportunities: RFxOpportunity[] = [];

  for (const supplier of suppliers) {
    if (!supplier.supplierName) continue;

    const contracts = await (db as any).contract.findMany({
      where: {
        tenantId,
        supplierName: supplier.supplierName,
        status: { in: ['ACTIVE', 'EXECUTED'] },
      },
      select: {
        id: true,
        contractTitle: true,
        totalValue: true,
        annualValue: true,
        contractType: true,
        expirationDate: true,
      },
    });

    const totalValue = contracts.reduce(
      (sum: number, c: any) => sum + (c.annualValue?.toNumber?.() ?? c.totalValue?.toNumber?.() ?? 0),
      0,
    );

    const savingsPotential = totalValue * 0.15;

    opportunities.push({
      id: `cons-${supplier.supplierName.replace(/\s+/g, '-')}`,
      algorithm: 'consolidation',
      urgency: 'medium',
      confidence: 0.8,
      title: `Consolidation Opportunity: ${supplier.supplierName}`,
      description: `${supplier._count.id} contracts with ${supplier.supplierName} could be consolidated for volume discounts.`,
      contractId: contracts[0]?.id || '',
      contractTitle: contracts[0]?.contractTitle || '',
      supplierName: supplier.supplierName,
      currentValue: totalValue,
      expiryDate: contracts[0]?.expirationDate?.toISOString() ?? null,
      daysToExpiry: contracts[0]?.expirationDate
        ? Math.ceil((contracts[0].expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null,
      savingsPotential,
      savingsPercent: 15,
      reasoning: `Consolidating ${supplier._count.id} contracts could yield 10-20% volume discount.`,
      evidence: { similarContracts: supplier._count.id },
      recommendedAction: 'Negotiate master agreement or consolidate at next renewal cycle',
      category: contracts[0]?.contractType || 'General',
    });
  }

  return opportunities;
}
