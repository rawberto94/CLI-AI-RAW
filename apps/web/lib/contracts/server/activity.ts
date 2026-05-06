import { createErrorResponse, createSuccessResponse } from '@/lib/api-middleware';

import type { ContractApiContext } from '@/lib/contracts/server/context';

export async function getContractActivity(
  context: ContractApiContext,
  contractId: string,
) {
  const { default: getDb } = await import('@/lib/prisma');
  const db = await getDb();

  const contract = await db.contract.findFirst({
    where: {
      id: contractId,
      tenantId: context.tenantId,
    },
    select: { id: true },
  });
  if (!contract) {
    return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
  }

  const activities = await db.contractActivity.findMany({
    where: {
      contractId,
      tenantId: context.tenantId,
    },
    orderBy: { timestamp: 'desc' },
    take: 50,
  });

  return createSuccessResponse(context, {
    success: true,
    activities: activities.map((activity) => ({
      id: activity.id,
      type: activity.type,
      user: activity.userId || 'System',
      action: activity.action,
      details: activity.details,
      timestamp: activity.timestamp.toISOString(),
      metadata: activity.metadata,
    })),
    source: 'database',
  });
}