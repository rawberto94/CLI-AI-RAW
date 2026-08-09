/**
 * Contract policy check — GET latest evaluation; POST re-run.
 */

import { NextRequest } from 'next/server';
import {
  withContractApiHandler,
  createSuccessResponse,
  createErrorResponse,
} from '@/lib/api-middleware';
import { hasPermissionForRole } from '@/lib/permissions-shared';
import { prisma } from '@/lib/prisma';
import { getQueueService, QUEUE_NAMES, JOB_NAMES } from '@repo/utils/queue/contract-queue';

export const GET = withContractApiHandler(async (_request: NextRequest, ctx) => {
  if (!hasPermissionForRole(ctx.userRole, 'policy:read') && !hasPermissionForRole(ctx.userRole, 'contracts:view')) {
    return createErrorResponse(ctx, 'FORBIDDEN', 'policy:read required', 403);
  }

  const { id: contractId } = await (ctx as any).params as { id: string };

  const evaluation = await (prisma as any).policyEvaluation.findFirst({
    where: { contractId, tenantId: ctx.tenantId },
    orderBy: { createdAt: 'desc' },
    include: {
      findings: {
        orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
      },
      pack: { select: { id: true, name: true, version: true, mode: true } },
    },
  });

  const artifact = await prisma.artifact.findFirst({
    where: { contractId, type: 'POLICY_CHECK' as any },
    select: { id: true, data: true, updatedAt: true },
  });

  return createSuccessResponse(ctx, {
    success: true,
    evaluation,
    artifact: artifact?.data ?? null,
  });
});

export const POST = withContractApiHandler(async (request: NextRequest, ctx) => {
  if (!hasPermissionForRole(ctx.userRole, 'policy:manage') && !hasPermissionForRole(ctx.userRole, 'contracts:edit')) {
    return createErrorResponse(ctx, 'FORBIDDEN', 'policy:manage or contracts:edit required', 403);
  }

  const { id: contractId } = await (ctx as any).params as { id: string };
  const body = await request.json().catch(() => ({}));
  const packId = body.packId as string | undefined;
  const sync = body.sync === true;
  const allowSemantic = body.allowSemantic !== false;
  const tenantId = ctx.tenantId;

  if (packId) {
    const pack = await (prisma as any).policyPack.findFirst({
      where: { id: packId, tenantId },
      select: { id: true },
    });
    if (!pack) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid policyPackId for tenant', 400);
    }
    await prisma.contract.update({
      where: { id: contractId },
      data: { policyPackId: packId } as any,
    });
  }

  if (sync) {
    const { evaluatePolicyPack } = await import('@repo/data-orchestration/services/policy/index');
    const result = await evaluatePolicyPack({
      tenantId,
      contractId,
      packId,
      triggeredBy: 'manual',
      allowSemantic,
      prisma,
    });
    return createSuccessResponse(ctx, { success: true, result });
  }

  try {
    const qs = getQueueService();
    await qs.addJob(
      QUEUE_NAMES.POLICY_EVALUATION,
      JOB_NAMES.EVALUATE_POLICY,
      {
        contractId,
        tenantId,
        packId,
        triggeredBy: 'manual',
        allowSemantic,
      },
      {
        priority: 10,
        jobId: `policy-manual-${contractId}-${Date.now()}`,
      },
    );
    return createSuccessResponse(ctx, { success: true, queued: true });
  } catch {
    const { evaluatePolicyPack } = await import('@repo/data-orchestration/services/policy/index');
    const result = await evaluatePolicyPack({
      tenantId,
      contractId,
      packId,
      triggeredBy: 'manual',
      allowSemantic,
      prisma,
    });
    return createSuccessResponse(ctx, { success: true, result, queued: false });
  }
});
