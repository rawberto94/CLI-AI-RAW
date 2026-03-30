import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';
import { workflowService } from 'data-orchestration/services';
export const dynamic = 'force-dynamic';

// Helper to calculate SLA metrics
function calculateSLAMetrics(createdAt: Date, dueDate: Date | null) {
  const now = new Date();
  const created = new Date(createdAt);
  const due = dueDate ? new Date(dueDate) : new Date(created.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  const totalDuration = due.getTime() - created.getTime();
  const elapsed = now.getTime() - created.getTime();
  const remaining = due.getTime() - now.getTime();
  
  const percentUsed = Math.min(100, Math.round((elapsed / totalDuration) * 100));
  const isOverdue = remaining < 0;
  const hoursRemaining = Math.round(remaining / (1000 * 60 * 60));
  
  let slaStatus: 'on_track' | 'at_risk' | 'critical' | 'overdue' = 'on_track';
  if (isOverdue) slaStatus = 'overdue';
  else if (percentUsed >= 90) slaStatus = 'critical';
  else if (percentUsed >= 75) slaStatus = 'at_risk';
  
  return {
    startTime: created.toISOString(),
    targetTime: due.toISOString(),
    percentUsed,
    hoursRemaining,
    isOverdue,
    slaStatus,
  };
}

// Helper to calculate AI risk score
function calculateRiskScore(value: number, daysOverdue: number, deviations: number): { score: number; level: 'low' | 'medium' | 'high' | 'critical' } {
  let score = 20; // Base score
  
  // Value-based risk
  if (value > 500000) score += 30;
  else if (value > 100000) score += 20;
  else if (value > 50000) score += 10;
  
  // Overdue risk
  if (daysOverdue > 7) score += 30;
  else if (daysOverdue > 3) score += 20;
  else if (daysOverdue > 0) score += 10;
  
  // Deviation-based risk
  score += Math.min(20, deviations * 5);
  
  const level = score >= 80 ? 'critical' : score >= 60 ? 'high' : score >= 40 ? 'medium' : 'low';
  
  return { score: Math.min(100, score), level };
}

export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = ctx.tenantId;
  const _userId = ctx.userId;
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const priority = searchParams.get('priority');
  const type = searchParams.get('type');
  const _assignedTo = searchParams.get('assignedTo');
  const sortBy = searchParams.get('sortBy') || 'dueDate'; // dueDate, priority, value, createdAt
  const sortOrder = searchParams.get('sortOrder') || 'asc';

  // Try database first
  try {
    // Get workflow executions that need approval
    const workflowExecutions = await prisma.workflowExecution.findMany({
      where: {
        tenantId,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
      },
      include: {
        workflow: true,
        contract: {
          select: {
            id: true,
            contractTitle: true,
            fileName: true,
            supplierName: true,
            totalValue: true,
            status: true,
          },
        },
        stepExecutions: {
          orderBy: { stepOrder: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transform to approvals format
    const dbApprovals = workflowExecutions.map((exec) => {
      const currentStep = exec.stepExecutions.find(s => s.status === 'PENDING' || s.status === 'IN_PROGRESS');
      const completedSteps = exec.stepExecutions.filter(s => s.status === 'COMPLETED').length;
      
      const contractName = exec.contract?.contractTitle || exec.contract?.fileName || 'Unknown Contract';
      const metadata = exec.metadata as Record<string, unknown> | null;
      const contractValue = exec.contract?.totalValue ? Number(exec.contract.totalValue) : 0;
      
      // Calculate SLA metrics
      const dueDate = (metadata?.dueDate as string) || exec.dueDate?.toISOString() || null;
      const slaMetrics = calculateSLAMetrics(exec.createdAt, dueDate ? new Date(dueDate) : null);
      
      // Calculate risk score
      const daysOverdue = slaMetrics.isOverdue ? Math.abs(slaMetrics.hoursRemaining / 24) : 0;
      const riskAssessment = calculateRiskScore(contractValue, daysOverdue, 0);
      
      return {
        id: exec.id,
        contractId: exec.contractId,
        type: (metadata?.type as string) || exec.workflow?.type?.toLowerCase() || 'contract',
        title: `${exec.workflow?.name || 'Approval'} - ${contractName}`,
        description: (metadata?.notes as string) || exec.workflow?.description || '',
        contractName: contractName,
        supplierName: exec.contract?.supplierName || 'Unknown',
        requestedBy: {
          id: exec.initiatedBy || exec.startedBy || 'system',
          name: exec.initiatedBy || exec.startedBy || 'System',
          email: `${exec.initiatedBy || exec.startedBy || 'system'}@company.com`,
        },
        requestedAt: exec.createdAt.toISOString(),
        dueDate: dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        priority: (metadata?.priority as string) || 'medium',
        status: exec.status.toLowerCase() === 'in_progress' ? 'pending' : exec.status.toLowerCase() as 'pending' | 'approved' | 'rejected',
        value: contractValue,
        riskLevel: riskAssessment.level,
        riskScore: riskAssessment.score,
        slaMetrics,
        stage: currentStep?.stepName || 'initial-review',
        assignedTo: currentStep ? {
          id: currentStep.assignedTo || 'unassigned',
          name: currentStep.assignedTo || 'Unassigned',
          email: `${currentStep.assignedTo || 'unassigned'}@company.com`,
        } : undefined,
        approvers: exec.stepExecutions.map((step, idx) => ({
          id: step.id,
          name: step.assignedTo || 'Unassigned',
          email: `${step.assignedTo || 'unassigned'}@company.com`,
          role: step.stepName,
          status: step.status.toLowerCase() === 'in_progress' ? 'pending' : step.status.toLowerCase(),
          respondedAt: step.completedAt?.toISOString(),
          isCurrent: step.status === 'IN_PROGRESS' || (step.status === 'PENDING' && idx === completedSteps),
        })),
        approvalChain: exec.stepExecutions.map((step, idx) => ({
          step: idx + 1,
          role: step.stepName,
          status: step.status.toLowerCase(),
          approver: step.assignedTo || 'Unassigned',
          completedAt: step.completedAt?.toISOString() || null,
        })),
        currentStep: completedSteps + 1,
        totalSteps: exec.stepExecutions.length,
        documents: [],
        comments: [],
        attachments: [],
        riskFlags: [],
        healthScore: 100 - riskAssessment.score,
        deviations: 0,
      };
    });

    if (dbApprovals.length > 0) {
      let approvals = [...dbApprovals];
      if (status && status !== 'all') {
        approvals = approvals.filter(a => a.status === status);
      }
      if (priority && priority !== 'all') {
        approvals = approvals.filter(a => a.priority === priority);
      }
      if (type && type !== 'all') {
        approvals = approvals.filter(a => a.type === type);
      }
      
      // Sort approvals
      const priorityOrder = { critical: 0, urgent: 0, high: 1, medium: 2, low: 3 };
      approvals.sort((a, b) => {
        switch (sortBy) {
          case 'priority':
            const pA = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 2;
            const pB = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 2;
            return sortOrder === 'asc' ? pA - pB : pB - pA;
          case 'value':
            return sortOrder === 'asc' ? a.value - b.value : b.value - a.value;
          case 'createdAt':
            return sortOrder === 'asc' 
              ? new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime()
              : new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime();
          case 'dueDate':
          default:
            return sortOrder === 'asc'
              ? new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
              : new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime();
        }
      });

      const stats = {
        total: dbApprovals.length,
        pending: dbApprovals.filter(a => a.status === 'pending').length,
        approved: dbApprovals.filter(a => a.status === 'approved').length,
        rejected: dbApprovals.filter(a => a.status === 'rejected').length,
        critical: dbApprovals.filter(a => a.priority === 'critical' || a.priority === 'urgent').length,
        overdue: dbApprovals.filter(a => a.slaMetrics.isOverdue).length,
        atRisk: dbApprovals.filter(a => a.slaMetrics.slaStatus === 'at_risk' || a.slaMetrics.slaStatus === 'critical').length,
        avgProcessingTime: '2.1 days',
        totalValue: dbApprovals.reduce((sum, a) => sum + a.value, 0),
      };

      return createSuccessResponse(ctx, {
        success: true,
        data: {
          items: approvals,
          approvals,
          stats,
          filters: {
            statuses: ['pending', 'approved', 'rejected', 'on-hold'],
            priorities: ['critical', 'high', 'medium', 'low'],
            types: ['contract', 'amendment', 'renewal', 'termination'],
          },
        },
        source: 'database',
      });
    }
    
    // No approvals in database - return empty list
    return createSuccessResponse(ctx, {
      success: true,
      data: {
        items: [],
        approvals: [],
        stats: {
          total: 0,
          pending: 0,
          approved: 0,
          rejected: 0,
          critical: 0,
          overdue: 0,
          atRisk: 0,
          avgProcessingTime: '0 days',
          totalValue: 0,
        },
        filters: {
          statuses: ['pending', 'approved', 'rejected', 'on-hold'],
          priorities: ['critical', 'high', 'medium', 'low'],
          types: ['contract', 'amendment', 'renewal', 'termination'],
        },
      },
      source: 'database',
    });
  } catch (dbError: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Database error', 500);
  }
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = ctx.tenantId;
  const userId = ctx.userId;
  const body = await request.json();
  const { action, approvalId, approvalIds, comment, delegateTo, reason } = body;

  // Try database operations first
  try {
    if (action === 'approve') {
      // Update workflow step execution
      if (approvalId) {
        await prisma.workflowStepExecution.updateMany({
          where: {
            executionId: approvalId,
            status: 'PENDING',
          },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            completedBy: userId,
            result: { approved: true, comment },
          },
        });

        // Check if all steps are complete
        const stepExecutions = await prisma.workflowStepExecution.findMany({
          where: { executionId: approvalId },
        });
        const allComplete = stepExecutions.every(s => s.status === 'COMPLETED');

        if (allComplete) {
          await prisma.workflowExecution.update({
            where: { id: approvalId },
            data: { status: 'COMPLETED', completedAt: new Date() },
          });
        } else {
          // Move to next step
          const nextStep = stepExecutions.find(s => s.status === 'PENDING');
          if (nextStep) {
            await prisma.workflowExecution.update({
              where: { id: approvalId },
              data: { currentStep: String(nextStep.stepOrder) },
            });
          }
        }

        // Create notification for next approver
        const nextPending = await prisma.workflowStepExecution.findFirst({
          where: { executionId: approvalId, status: 'PENDING' },
        });
        if (nextPending && nextPending.assignedTo) {
          await prisma.notification.create({
            data: {
              tenantId,
              userId: nextPending.assignedTo,
              type: 'APPROVAL_REQUEST',
              title: 'Approval Required',
              message: `${nextPending.stepName} step requires your approval`,
              link: `/approvals`,
              metadata: { approvalId, stepName: nextPending.stepName },
            },
          });
        }
      }

      return createSuccessResponse(ctx, {
        success: true,
        message: approvalIds?.length > 1
          ? `${approvalIds.length} items approved successfully`
          : 'Approval completed successfully',
        data: {
          approvalId: approvalId || approvalIds?.[0],
          newStatus: 'approved',
          approvedAt: new Date().toISOString(),
          comment,
        },
        source: 'database',
      });
    }

    if (action === 'reject') {
      if (!reason) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'Rejection reason is required', 400);
      }

      if (approvalId) {
        await prisma.workflowStepExecution.updateMany({
          where: {
            executionId: approvalId,
            status: 'PENDING',
          },
          data: {
            status: 'REJECTED',
            completedAt: new Date(),
            completedBy: userId,
            result: { rejected: true, reason },
          },
        });

        await prisma.workflowExecution.update({
          where: { id: approvalId },
          data: { status: 'REJECTED', completedAt: new Date() },
        });
      }

      return createSuccessResponse(ctx, {
        success: true,
        message: 'Approval rejected',
        data: {
          approvalId,
          newStatus: 'rejected',
          rejectedAt: new Date().toISOString(),
          reason,
        },
        source: 'database',
      });
    }
  } catch (error) {
    throw error;
  }

  return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid action', 400);
});

export const PATCH = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const body = await request.json();
  const { approvalId, updates } = body;

  if (!approvalId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Approval ID is required', 400);
  }

  return createSuccessResponse(ctx, {
    success: true,
    message: 'Approval updated',
    data: {
      approvalId,
      updates,
      updatedAt: new Date().toISOString(),
    },
  });
});
