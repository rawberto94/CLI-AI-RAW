/**
 * Request / approve a policy finding waiver.
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { hasPermissionForRole } from '@/lib/permissions-shared';
import { prisma } from '@/lib/prisma';

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const { id: findingId } = await (ctx as any).params as { id: string };
  const body = await request.json();
  const reason = String(body.reason || '').trim();
  const action = body.action === 'approve' ? 'approve' : body.action === 'reject' ? 'reject' : 'request';

  if (!reason && action === 'request') {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'reason is required', 400);
  }

  if (action === 'approve' || action === 'reject') {
    if (!hasPermissionForRole(ctx.userRole, 'policy:waive')) {
      return createErrorResponse(ctx, 'FORBIDDEN', 'policy:waive required to approve/reject', 403);
    }
  } else if (!hasPermissionForRole(ctx.userRole, 'policy:read') && !hasPermissionForRole(ctx.userRole, 'contracts:edit')) {
    return createErrorResponse(ctx, 'FORBIDDEN', 'permission required', 403);
  }

  const finding = await (prisma as any).policyFinding.findFirst({
    where: { id: findingId, tenantId: ctx.tenantId },
  });
  if (!finding) return createErrorResponse(ctx, 'NOT_FOUND', 'Finding not found', 404);

  if (action === 'request') {
    const waiver = await (prisma as any).policyWaiver.upsert({
      where: {
        tenantId_contractId_ruleCode: {
          tenantId: ctx.tenantId,
          contractId: finding.contractId,
          ruleCode: finding.ruleCode,
        },
      },
      create: {
        tenantId: ctx.tenantId,
        contractId: finding.contractId,
        ruleCode: finding.ruleCode,
        reason,
        requestedBy: ctx.userId,
        status: 'pending',
        scope: 'contract',
      },
      update: {
        reason,
        requestedBy: ctx.userId,
        status: 'pending',
        approvedBy: null,
      },
    });

    await (prisma as any).policyFinding.update({
      where: { id: findingId },
      data: { waiverId: waiver.id },
    });

    return createSuccessResponse(ctx, { success: true, waiver });
  }

  const waiver = await (prisma as any).policyWaiver.findFirst({
    where: {
      tenantId: ctx.tenantId,
      contractId: finding.contractId,
      ruleCode: finding.ruleCode,
    },
  });
  if (!waiver) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'No pending waiver for this finding', 404);
  }

  const updated = await (prisma as any).policyWaiver.update({
    where: { id: waiver.id },
    data: {
      status: action === 'approve' ? 'approved' : 'rejected',
      approvedBy: ctx.userId,
      reason: reason || waiver.reason,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : waiver.expiresAt,
    },
  });

  if (action === 'approve') {
    await (prisma as any).policyFinding.updateMany({
      where: {
        tenantId: ctx.tenantId,
        contractId: finding.contractId,
        ruleCode: finding.ruleCode,
      },
      data: { waiverId: updated.id },
    });
  }

  return createSuccessResponse(ctx, { success: true, waiver: updated });
});
