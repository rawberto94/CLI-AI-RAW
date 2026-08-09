/**
 * Portfolio policy rollup for dashboards.
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { hasPermissionForRole } from '@/lib/permissions-shared';
import { prisma } from '@/lib/prisma';

export const GET = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  if (!hasPermissionForRole(ctx.userRole, 'policy:read') && !hasPermissionForRole(ctx.userRole, 'contracts:view')) {
    return createErrorResponse(ctx, 'FORBIDDEN', 'policy:read required', 403);
  }

  
  const tenantId = ctx.tenantId;

  // Latest evaluation per contract via raw grouping approximation:
  // fetch recent evaluations and de-dupe in memory
  const recent = await (prisma as any).policyEvaluation.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: 2000,
    select: {
      contractId: true,
      status: true,
      policyScore: true,
      criticalCount: true,
      highCount: true,
      createdAt: true,
    },
  });

  const latestByContract = new Map<string, (typeof recent)[0]>();
  for (const row of recent) {
    if (!latestByContract.has(row.contractId)) {
      latestByContract.set(row.contractId, row);
    }
  }

  const byStatus: Record<string, number> = {
    PASS: 0,
    PASS_WITH_NOTES: 0,
    REVIEW: 0,
    FAIL: 0,
    INDETERMINATE: 0,
  };
  let scoreSum = 0;
  let criticalContracts = 0;

  for (const row of latestByContract.values()) {
    byStatus[row.status] = (byStatus[row.status] || 0) + 1;
    scoreSum += row.policyScore || 0;
    if (row.criticalCount > 0 || row.status === 'FAIL') criticalContracts += 1;
  }

  const n = latestByContract.size || 1;

  // Most violated rules (open findings)
  const topFindings = await (prisma as any).policyFinding.groupBy({
    by: ['ruleCode', 'title'],
    where: {
      tenantId,
      status: { in: ['VIOLATION', 'INCONSISTENCY', 'MISSING'] },
      waiverId: null,
    },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 15,
  }).catch(() => []);

  const packs = await (prisma as any).policyPack.count({
    where: { tenantId, status: 'active' },
  });

  return createSuccessResponse(ctx, {
    success: true,
    summary: {
      contractsEvaluated: latestByContract.size,
      activePacks: packs,
      byStatus,
      avgPolicyScore: Math.round(scoreSum / n),
      criticalContracts,
      topViolatedRules: (topFindings || []).map((f: any) => ({
        ruleCode: f.ruleCode,
        title: f.title,
        count: f._count?.id ?? 0,
      })),
    },
  });
});
