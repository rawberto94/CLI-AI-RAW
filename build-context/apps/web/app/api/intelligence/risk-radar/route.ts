/**
 * Risk Radar API Route
 *
 * GET /api/intelligence/risk-radar
 * Aggregates risk data from contract health scores, deadline proximity,
 * compliance gaps, and financial exposure into a unified risk view.
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, type AuthenticatedApiContext } from '@/lib/api-middleware';

interface RiskItem {
  id: string;
  contractId: string;
  contractName: string;
  supplierName: string;
  riskCategory: string;
  severity: string;
  score: number;
  trend: string;
  description: string;
  detectedAt: string;
  recommendedAction: string;
  factors: string[];
}

export const GET = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const { tenantId } = ctx;

  try {
    // Fetch contracts with relevant risk fields
    const contracts = await prisma.contract.findMany({
      where: { tenantId },
      select: {
        id: true,
        contractTitle: true,
        supplierName: true,
        counterparty: true,
        vendor: true,
        totalValue: true,
        annualValue: true,
        effectiveDate: true,
        expirationDate: true,
        status: true,
        contractType: true,
        autoRenewalEnabled: true,
        department: true,
        healthScore: true,
        riskScore: true,
        complianceScore: true,
      },
      take: 200,
      orderBy: { updatedAt: 'desc' },
    });

    const now = new Date();
    const risks: RiskItem[] = [];
    let riskIdCounter = 0;

    for (const contract of contracts) {
      const name = contract.contractTitle || 'Untitled Contract';
      const supplier = contract.supplierName || contract.counterparty || contract.vendor || 'Unknown';
      const expDate = contract.expirationDate ? new Date(contract.expirationDate) : null;
      const daysToExpiry = expDate ? Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

      // Deadline risks
      if (daysToExpiry !== null && daysToExpiry > 0 && daysToExpiry <= 90) {
        const severity = daysToExpiry <= 14 ? 'critical' : daysToExpiry <= 30 ? 'high' : daysToExpiry <= 60 ? 'medium' : 'low';
        const score = Math.max(0, 100 - daysToExpiry);
        risks.push({
          id: `risk-${++riskIdCounter}`,
          contractId: contract.id,
          contractName: name,
          supplierName: supplier,
          riskCategory: 'deadline',
          severity,
          score,
          trend: daysToExpiry <= 30 ? 'increasing' : 'stable',
          description: `Contract expires in ${daysToExpiry} day${daysToExpiry === 1 ? '' : 's'}${contract.autoRenewalEnabled ? ' (auto-renewal enabled)' : ''}.`,
          detectedAt: now.toISOString(),
          recommendedAction: daysToExpiry <= 14
            ? 'Immediate action required — initiate renewal or termination process'
            : 'Review contract terms and begin renewal planning',
          factors: [
            `${daysToExpiry} days until expiration`,
            ...(contract.autoRenewalEnabled ? ['Auto-renewal is enabled'] : ['No auto-renewal — manual action needed']),
            ...(contract.totalValue ? [`Contract value: $${Number(contract.totalValue).toLocaleString()}`] : []),
          ],
        });
      }

      // Health risks
      const healthScore = typeof contract.healthScore === 'number' ? contract.healthScore : null;
      if (healthScore !== null && healthScore < 60) {
        const severity = healthScore < 30 ? 'critical' : healthScore < 45 ? 'high' : 'medium';
        risks.push({
          id: `risk-${++riskIdCounter}`,
          contractId: contract.id,
          contractName: name,
          supplierName: supplier,
          riskCategory: 'operational',
          severity,
          score: 100 - healthScore,
          trend: 'stable',
          description: `Contract health score is ${healthScore}/100, indicating operational concerns.`,
          detectedAt: now.toISOString(),
          recommendedAction: 'Review contract health factors and address data gaps or compliance issues',
          factors: [
            `Health score: ${healthScore}/100`,
            ...(contract.department ? [`Department: ${contract.department}`] : []),
          ],
        });
      }

      // Financial risks (high-value contracts with issues)
      const totalVal = Number(contract.totalValue || 0);
      if (totalVal > 100000 && (healthScore === null || healthScore < 50)) {
        risks.push({
          id: `risk-${++riskIdCounter}`,
          contractId: contract.id,
          contractName: name,
          supplierName: supplier,
          riskCategory: 'financial',
          severity: totalVal > 500000 ? 'high' : 'medium',
          score: Math.min(95, Math.round(totalVal / 10000)),
          trend: 'stable',
          description: `High-value contract ($${totalVal.toLocaleString()}) with ${healthScore !== null ? `low health score (${healthScore})` : 'unassessed health'}.`,
          detectedAt: now.toISOString(),
          recommendedAction: 'Prioritize health assessment and compliance review for this high-value contract',
          factors: [
            `Total value: $${totalVal.toLocaleString()}`,
            healthScore !== null ? `Health score: ${healthScore}/100` : 'Health not yet assessed',
            ...(contract.contractType ? [`Type: ${contract.contractType}`] : []),
          ],
        });
      }

      // Compliance risks
      const complianceScore = typeof contract.complianceScore === 'number' ? contract.complianceScore : null;
      if (complianceScore !== null && complianceScore < 50) {
        risks.push({
          id: `risk-${++riskIdCounter}`,
          contractId: contract.id,
          contractName: name,
          supplierName: supplier,
          riskCategory: 'compliance',
          severity: complianceScore < 25 ? 'critical' : 'high',
          score: 100 - complianceScore,
          trend: 'increasing',
          description: `Compliance score of ${complianceScore}/100 indicates regulatory or policy gaps.`,
          detectedAt: now.toISOString(),
          recommendedAction: 'Conduct compliance audit and address identified gaps immediately',
          factors: [
            `Compliance score: ${complianceScore}/100`,
            ...(contract.contractType ? [`Contract type: ${contract.contractType}`] : []),
          ],
        });
      }
    }

    // Sort by score descending (highest risk first)
    risks.sort((a, b) => b.score - a.score);

    // Build summary
    const byCategory: Record<string, number> = {};
    for (const r of risks) {
      byCategory[r.riskCategory] = (byCategory[r.riskCategory] || 0) + 1;
    }

    const criticalCount = risks.filter(r => r.severity === 'critical').length;
    const highCount = risks.filter(r => r.severity === 'high').length;
    const avgScore = risks.length > 0 ? Math.round(risks.reduce((s, r) => s + r.score, 0) / risks.length) : 0;

    const summary = {
      totalRisks: risks.length,
      criticalCount,
      highCount,
      mediumCount: risks.filter(r => r.severity === 'medium').length,
      lowCount: risks.filter(r => r.severity === 'low').length,
      byCategory,
      portfolioRiskScore: avgScore,
      trend: criticalCount > 3 ? 'worsening' : criticalCount === 0 && highCount < 3 ? 'improving' : 'stable',
    };

    return createSuccessResponse(ctx, { risks: risks.slice(0, 100), summary });
  } catch (error) {
    console.error('[Risk Radar] Failed:', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to compute risk radar data', 500);
  }
});
