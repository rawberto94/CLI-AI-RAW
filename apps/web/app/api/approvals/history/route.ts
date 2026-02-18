/**
 * Approval History API Route
 * 
 * Returns timeline of approval actions: approved, rejected, escalated,
 * delegated, created, comment — sourced from workflow step executions.
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  withAuthApiHandler,
  createSuccessResponse,
  createErrorResponse,
} from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = ctx.tenantId;
  const { searchParams } = new URL(request.url);
  const contractId = searchParams.get('contractId');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
  const filter = searchParams.get('filter'); // approved, rejected, escalated, delegated, created, comment
  const search = searchParams.get('search');
  const dateRange = searchParams.get('dateRange'); // 7d, 30d, 90d

  try {
    // Build date filter
    let dateFilter: Date | undefined;
    if (dateRange) {
      const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : 0;
      if (days > 0) {
        dateFilter = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      }
    }

    // Fetch step executions with their parent execution + contract
    const stepExecs = await prisma.workflowStepExecution.findMany({
      where: {
        execution: {
          tenantId,
          ...(contractId && { contractId }),
        },
        status: { in: ['COMPLETED', 'REJECTED', 'SKIPPED', 'IN_PROGRESS', 'PENDING'] },
        ...(dateFilter && { updatedAt: { gte: dateFilter } }),
      },
      include: {
        execution: {
          include: {
            contract: {
              select: {
                id: true,
                contractTitle: true,
                fileName: true,
                supplierName: true,
                totalValue: true,
                category: true,
              },
            },
            workflow: {
              select: { type: true },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit * 2, // fetch extra for filtering
    });

    // Transform to HistoryEntry format
    let history = stepExecs.map(step => {
      const exec = step.execution;
      const contract = exec.contract;
      const result = step.result as Record<string, unknown> | null;

      // Map step status → action
      let action: string;
      if (step.status === 'COMPLETED') {
        if (result?.approved) action = 'approved';
        else if (result?.delegated) action = 'delegated';
        else action = 'approved';
      } else if (step.status === 'REJECTED') {
        action = 'rejected';
      } else if (step.status === 'SKIPPED') {
        action = 'escalated';
      } else if (step.status === 'IN_PROGRESS') {
        action = 'created';
      } else {
        action = 'created';
      }

      // Map workflow type → entry type
      const wfType = exec.workflow?.type?.toLowerCase() || 'contract';
      let type: string;
      if (wfType.includes('amend')) type = 'amendment';
      else if (wfType.includes('renew')) type = 'renewal';
      else if (wfType.includes('terminat')) type = 'termination';
      else type = 'contract';

      const contractName =
        contract?.contractTitle || contract?.fileName || 'Unknown Contract';

      return {
        id: step.id,
        contractId: exec.contractId,
        contractName,
        type,
        action,
        actor: {
          name: step.completedBy || step.assignedTo || 'System',
          email: `${(step.completedBy || step.assignedTo || 'system')}@company.com`,
          role: step.stepName || 'Reviewer',
        },
        timestamp: (step.completedAt || step.updatedAt).toISOString(),
        stepName: step.stepName || undefined,
        comment: (result?.comment as string) || (result?.reason as string) || undefined,
        metadata: {
          value: contract?.totalValue ? Number(contract.totalValue) : undefined,
          supplier: contract?.supplierName || undefined,
          ...(result?.delegated ? {
            previousAssignee: step.assignedTo,
            newAssignee: result.delegateTo as string,
          } : {}),
          ...(result?.reason ? { reason: result.reason as string } : {}),
        },
      };
    });

    // Apply action filter
    if (filter && filter !== 'all') {
      history = history.filter(h => h.action === filter);
    }

    // Apply search filter
    if (search) {
      const q = search.toLowerCase();
      history = history.filter(
        h =>
          h.contractName.toLowerCase().includes(q) ||
          h.actor.name.toLowerCase().includes(q)
      );
    }

    // Trim to limit
    history = history.slice(0, limit);

    return createSuccessResponse(ctx, {
      history,
      count: history.length,
    });
  } catch (error) {
    console.error('[Approval History GET]', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to fetch approval history', 500);
  }
});
