/**
 * Approval Queue API Route
 * 
 * Endpoints for managing approval workflows and queue items.
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';
import { workflowService } from 'data-orchestration/services';

// =============================================================================
// SCHEMAS
// =============================================================================

const ApprovalActionSchema = z.object({
  action: z.enum(['approve', 'reject', 'request_changes']),
  comment: z.string().optional(),
  reason: z.string().optional(),
});

const BulkApprovalSchema = z.object({
  itemIds: z.array(z.string()),
  action: z.enum(['approve', 'reject']),
  comment: z.string().optional(),
});

// =============================================================================
// GET - Fetch approval queue items
// =============================================================================

export const GET = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  if (!session?.user?.id) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || 'pending';
  const category = searchParams.get('category');
  const priority = searchParams.get('priority');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');

  // Get tenant ID from session
  const tenantId = session.user.tenantId;

  // Build query filters
  const where: any = {
    tenantId,
  };

  // Filter by approver (items where current user is pending approver)
  if (searchParams.get('myQueue') === 'true') {
    where.approvalChain = {
      some: {
        approverId: session.user.id,
        status: 'PENDING',
      },
    };
  }

  if (status && status !== 'all') {
    where.status = status.toUpperCase();
  }

  if (category && category !== 'all') {
    where.category = category.toUpperCase();
  }

  if (priority && priority !== 'all') {
    where.priority = priority.toUpperCase();
  }

  // Fetch workflow executions as approval items
  const [items, total] = await Promise.all([
    prisma.workflowExecution.findMany({
      where: {
        workflow: {
          tenantId,
        },
        status: status === 'pending' ? 'IN_PROGRESS' : undefined,
      },
      include: {
        workflow: {
          include: {
            steps: true,
          },
        },
        stepExecutions: {
          include: {
            step: true,
          },
          orderBy: {
            step: {
              order: 'asc',
            },
          },
        },
        contract: {
          select: {
            id: true,
            contractTitle: true,
            category: true,
            totalValue: true,
            currency: true,
          },
        },
      },
      orderBy: [
        { dueDate: 'asc' },
      ],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.workflowExecution.count({
      where: {
        workflow: {
          tenantId,
        },
        status: status === 'pending' ? 'IN_PROGRESS' : undefined,
      },
    }),
  ]);

  // Calculate stats
  const stats = await prisma.workflowExecution.groupBy({
    by: ['status'],
    where: {
      workflow: {
        tenantId,
      },
    },
    _count: {
      status: true,
    },
  });

  const overdueCount = await prisma.workflowExecution.count({
    where: {
      workflow: {
        tenantId,
      },
      status: 'IN_PROGRESS',
      dueDate: {
        lt: new Date(),
      },
    },
  });

  // Transform items to match frontend schema
  const transformedItems = items.map(item => ({
    id: item.id,
    category: item.contract ? 'contract' : 'workflow',
    title: item.workflow.name,
    subtitle: item.contract?.contractTitle || 'Workflow Execution',
    requestedBy: {
      id: item.initiatedBy || 'system',
      name: 'System',
      email: '',
    },
    requestedAt: item.startedAt,
    dueDate: item.dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    priority: 'medium',
    status: item.status === 'IN_PROGRESS' ? 'pending' : item.status.toLowerCase(),
    contractId: item.contractId,
    contractName: item.contract?.contractTitle,
    value: item.contract?.totalValue,
    currency: item.contract?.currency || 'USD',
    approvalChain: item.stepExecutions.map((se, idx) => ({
      id: se.id,
      approver: {
        id: se.completedBy || 'pending',
        name: se.step.assignedRole || 'Pending Reviewer',
        email: '',
        role: se.step.assignedRole || 'Approver',
      },
      status: se.status === 'COMPLETED' ? 'approved' : 
              se.status === 'REJECTED' ? 'rejected' : 'pending',
      decidedAt: se.completedAt,
      comment: typeof se.result === 'string' ? se.result : undefined,
      order: idx + 1,
    })),
    currentStep: item.stepExecutions.filter(se => se.status === 'COMPLETED').length + 1,
  }));

  return createSuccessResponse(ctx, {
    items: transformedItems,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    stats: {
      pending: stats.find(s => s.status === 'IN_PROGRESS')?._count.status || 0,
      approved: stats.find(s => s.status === 'COMPLETED')?._count.status || 0,
      rejected: stats.find(s => s.status === 'REJECTED')?._count.status || 0,
      overdue: overdueCount,
    },
  });
});

// =============================================================================
// POST - Take action on an approval item
// =============================================================================

export const POST = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  if (!session?.user?.id) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
  }

  const body = await req.json();
  const { searchParams } = new URL(req.url);
  const itemId = searchParams.get('itemId');

  // Handle bulk actions
  if (body.itemIds) {
    const validated = BulkApprovalSchema.parse(body);

    const results = await Promise.allSettled(
      validated.itemIds.map(async (id) => {
        return updateApprovalStatus(
          id,
          validated.action,
          session.user!.id!,
          validated.comment
        );
      })
    );

    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return createSuccessResponse(ctx, {
      message: `${succeeded} items processed, ${failed} failed`,
      succeeded,
      failed,
    });
  }

  // Handle single item action
  if (!itemId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'itemId is required', 400);
  }

  const validated = ApprovalActionSchema.parse(body);

  await updateApprovalStatus(
    itemId,
    validated.action,
    session.user.id,
    validated.comment || validated.reason
  );

  return createSuccessResponse(ctx, {
    message: `Item ${validated.action}d successfully`,
    itemId,
  });
});

// =============================================================================
// HELPERS
// =============================================================================

async function updateApprovalStatus(
  itemId: string,
  action: 'approve' | 'reject' | 'request_changes',
  userId: string,
  comment?: string
) {
  // Find the current pending step for this execution
  const stepExecution = await prisma.workflowStepExecution.findFirst({
    where: {
      executionId: itemId,
      status: 'PENDING',
    },
    include: {
      execution: {
        include: {
          workflow: {
            include: {
              steps: {
                orderBy: { order: 'asc' },
              },
            },
          },
        },
      },
      step: true,
    },
    orderBy: {
      stepOrder: 'asc',
    },
  });

  if (!stepExecution) {
    throw new Error('No pending step found for this item');
  }

  const newStatus = action === 'approve' ? 'COMPLETED' : 
                    action === 'reject' ? 'REJECTED' : 'PENDING';

  // Update step execution
  await prisma.workflowStepExecution.update({
    where: { id: stepExecution.id },
    data: {
      status: newStatus,
      completedAt: new Date(),
      completedBy: userId,
      result: comment ? JSON.stringify({ comment }) : undefined,
    },
  });

  // Check if this was the last step or if rejected
  const workflow = stepExecution.execution.workflow;
  const isLastStep = stepExecution.step.order === workflow.steps.length;
  
  if (action === 'reject') {
    // Reject the entire workflow
    await prisma.workflowExecution.update({
      where: { id: itemId },
      data: {
        status: 'REJECTED',
        completedAt: new Date(),
      },
    });
  } else if (action === 'approve' && isLastStep) {
    // Complete the workflow
    await prisma.workflowExecution.update({
      where: { id: itemId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
  }

  // Log audit event
  await prisma.auditLog.create({
    data: {
      tenantId: stepExecution.execution.workflow.tenantId,
      userId,
      action: `WORKFLOW_STEP_${action.toUpperCase()}`,
      entityType: 'WORKFLOW_STEP',
      entityId: stepExecution.id,
      metadata: {
        workflowExecutionId: itemId,
        comment,
        stepOrder: stepExecution.step.order,
      },
    },
  });
}
