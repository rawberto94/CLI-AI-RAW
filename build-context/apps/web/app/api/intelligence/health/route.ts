/**
 * Intelligence Health API — Contract health scores for the dashboard
 *
 * GET /api/intelligence/health         — List contract health scores
 * POST /api/intelligence/health/refresh — Recalculate all health scores
 *
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, type AuthenticatedApiContext } from '@/lib/api-middleware';
import { calculateContractHealth } from '@/lib/health/contract-health-score';

export const GET = withAuthApiHandler(async (_request: NextRequest, ctx: AuthenticatedApiContext) => {
  const { tenantId } = ctx;

  // Fetch contracts with their artifacts and health-related fields
  const contracts = await prisma.contract.findMany({
    where: { tenantId },
    orderBy: { updatedAt: 'desc' },
    take: 100,
    select: {
      id: true,
      contractTitle: true,
      fileName: true,
      counterparty: true,
      vendor: true,
      status: true,
      expirationDate: true,
      expirationRisk: true,
      totalValue: true,
      metadata: true,
      artifacts: { select: { id: true, type: true } },
      updatedAt: true,
    },
  });

  const healthContracts = contracts.map(c => {
    const meta = (c.metadata || {}) as Record<string, unknown>;
    const healthScore = (meta.healthScore as number) || 75;
    const previousScore = (meta.previousHealthScore as number) || healthScore;

    // Calculate factors from available data
    const hasArtifacts = c.artifacts.length > 0;
    const hasMetadata = meta && Object.keys(meta).length > 5;
    const completeness = (hasArtifacts ? 50 : 0) + (hasMetadata ? 50 : 0);

    const daysToExpiry = c.expirationDate
      ? Math.ceil((new Date(c.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : 999;
    const expirationScore = daysToExpiry > 90 ? 100 : daysToExpiry > 30 ? 70 : daysToExpiry > 0 ? 40 : 10;

    const riskScore = c.expirationRisk === 'CRITICAL' ? 20 : c.expirationRisk === 'HIGH' ? 40 : c.expirationRisk === 'MEDIUM' ? 70 : 90;

    return {
      contractId: c.id,
      contractName: c.contractTitle || c.fileName || 'Untitled',
      supplierName: c.counterparty || c.vendor || 'Unknown',
      overallScore: healthScore,
      previousScore,
      trend: healthScore > previousScore ? 'improving' : healthScore < previousScore ? 'declining' : 'stable',
      status: healthScore >= 70 ? 'healthy' : healthScore >= 50 ? 'at-risk' : 'critical',
      factors: [
        {
          id: `${c.id}-completeness`,
          name: 'Document Completeness',
          score: completeness,
          weight: 0.2,
          status: completeness >= 80 ? 'good' : completeness >= 50 ? 'warning' : 'critical',
          description: `${c.artifacts.length} artifacts generated`,
        },
        {
          id: `${c.id}-expiration`,
          name: 'Expiration Risk',
          score: expirationScore,
          weight: 0.25,
          status: expirationScore >= 70 ? 'good' : expirationScore >= 40 ? 'warning' : 'critical',
          description: daysToExpiry > 0 ? `${daysToExpiry} days until expiration` : 'Expired',
        },
        {
          id: `${c.id}-risk`,
          name: 'Risk Assessment',
          score: riskScore,
          weight: 0.25,
          status: riskScore >= 70 ? 'good' : riskScore >= 40 ? 'warning' : 'critical',
          description: `Risk level: ${c.expirationRisk || 'LOW'}`,
        },
      ],
      lastAssessed: c.updatedAt.toISOString(),
      nextReview: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      actionItems: [
        ...(completeness < 80 ? [{ id: `${c.id}-ai`, action: 'Run AI artifact generation', priority: 'medium' }] : []),
        ...(expirationScore < 40 ? [{ id: `${c.id}-renew`, action: 'Review expiration and plan renewal', priority: 'high' }] : []),
        ...(riskScore < 40 ? [{ id: `${c.id}-risk`, action: 'Conduct detailed risk assessment', priority: 'high' }] : []),
      ],
    };
  });

  return NextResponse.json({
    success: true,
    data: { contracts: healthContracts },
  });
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const { tenantId } = ctx;

  // Batch recalculate health scores for all tenant contracts
  const contracts = await prisma.contract.findMany({
    where: { tenantId },
    select: { id: true },
    take: 100,
  });

  let updated = 0;
  for (const c of contracts) {
    try {
      const health = await calculateContractHealth(c.id);
      await prisma.contract.update({
        where: { id: c.id },
        data: {
          metadata: {
            ...(await prisma.contract.findUnique({ where: { id: c.id }, select: { metadata: true } }).then(r => (r?.metadata || {}) as Record<string, unknown>)),
            healthScore: health.overallScore,
            previousHealthScore: health.overallScore,
            healthGrade: health.grade,
          },
        },
      });
      updated++;
    } catch {
      // Continue with next contract
    }
  }

  return NextResponse.json({ success: true, updated });
});
