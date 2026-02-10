import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from '@/lib/auth'
import { publishRealtimeEvent } from '@/lib/realtime/publish'
import { workflowService } from 'data-orchestration/services';

/**
 * LEAN API: Quick approval actions
 * 
 * Instead of complex workflow management, provide simple one-click actions:
 * - POST /api/approvals/quick with { contractId, action: 'approve' | 'reject' | 'skip' }
 * 
 * Smart defaults:
 * - Auto-creates simple approval workflow if none exists
 * - Moves to next step automatically
 * - Sends notifications (when configured)
 */

export const dynamic = 'force-dynamic'

interface QuickActionBody {
  contractId: string
  action: 'approve' | 'reject' | 'request-changes'
  comment?: string
}

// Default workflow template - no configuration needed
const DEFAULT_WORKFLOW = {
  name: 'Quick Approval',
  type: 'APPROVAL',
  steps: [
    { name: 'Review & Approve', type: 'APPROVAL', assignedRole: 'Approver' },
  ],
}

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (!session?.user) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401)
  }
  const tenantId = session.user.tenantId
  const userId = session.user.id

  const body: QuickActionBody = await request.json()

  const { contractId, action, comment } = body

  if (!contractId || !action) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'contractId and action required', 400)
  }

  // Find contract
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId },
    select: { id: true, contractTitle: true, fileName: true, status: true },
  })

  if (!contract) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404)
  }

  // Find or create workflow execution
  let execution = await prisma.workflowExecution.findFirst({
    where: { contractId, tenantId },
    include: {
      workflow: true,
      stepExecutions: { orderBy: { stepOrder: 'asc' } },
    },
  })

  // Auto-create simple workflow if none exists
  if (!execution) {
    const workflow = await prisma.workflow.create({
      data: {
        tenantId,
        name: DEFAULT_WORKFLOW.name,
        type: DEFAULT_WORKFLOW.type,
        isActive: true,
        steps: {
          create: DEFAULT_WORKFLOW.steps.map((step, i) => ({
            name: step.name,
            type: step.type,
            assignedRole: step.assignedRole,
            order: i,
            isRequired: true,
          })),
        },
      },
      include: { steps: true },
    })

    execution = await prisma.workflowExecution.create({
      data: {
        tenantId,
        workflowId: workflow.id,
        contractId,
        status: 'IN_PROGRESS',
        currentStep: '0',
        stepExecutions: {
          create: workflow.steps.map((step, i) => ({
            stepId: step.id,
            stepOrder: i,
            stepName: step.name,
            status: i === 0 ? 'IN_PROGRESS' : 'PENDING',
            assignedTo: userId,
          })),
        },
      },
      include: {
        workflow: true,
        stepExecutions: { orderBy: { stepOrder: 'asc' } },
      },
    })
  }

  // Find current step
  const currentStepExec = execution.stepExecutions.find(
    se => se.status === 'IN_PROGRESS' || se.status === 'WAITING'
  ) || execution.stepExecutions[0]

  if (!currentStepExec) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'No active step found', 400)
  }

  // Process action
  const now = new Date()
  let newStatus: string
  let stepStatus: string
  let contractStatus: string | undefined

  switch (action) {
    case 'approve':
      stepStatus = 'COMPLETED'
      // Check if this was the last step
      const nextStep = execution.stepExecutions.find(
        se => se.stepOrder > currentStepExec.stepOrder && se.status === 'PENDING'
      )
      if (nextStep) {
        newStatus = 'IN_PROGRESS'
        // Activate next step
        await prisma.workflowStepExecution.update({
          where: { id: nextStep.id },
          data: { status: 'IN_PROGRESS', startedAt: now },
        })
      } else {
        newStatus = 'COMPLETED'
        contractStatus = 'APPROVED'
      }
      break
    case 'reject':
      stepStatus = 'REJECTED'
      newStatus = 'FAILED'
      contractStatus = 'REJECTED'
      break
    case 'request-changes':
      stepStatus = 'WAITING'
      newStatus = 'IN_PROGRESS'
      break
    default:
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid action', 400)
  }

  // Update step execution
  await prisma.workflowStepExecution.update({
    where: { id: currentStepExec.id },
    data: {
      status: stepStatus,
      completedBy: userId,
      completedAt: stepStatus !== 'WAITING' ? now : null,
      result: comment ? { comment, action } : { action },
    },
  })

  // Update workflow execution
  await prisma.workflowExecution.update({
    where: { id: execution.id },
    data: {
      status: newStatus,
      currentStep: String(currentStepExec.stepOrder + 1),
      completedAt: newStatus === 'COMPLETED' || newStatus === 'FAILED' ? now : null,
    },
  })

  // Optionally update contract status
  if (contractStatus) {
    await prisma.contract.update({
      where: { id: contractId },
      data: { status: contractStatus as any },
    })
  }

  const approvalEvent =
    newStatus === 'COMPLETED'
      ? 'approval:completed'
      : newStatus === 'FAILED'
        ? 'approval:rejected'
        : 'approval:submitted'

  void publishRealtimeEvent({
    event: approvalEvent,
    data: { tenantId, contractId, executionId: execution.id },
    source: 'api:approvals/quick',
  })

  if (contractStatus) {
    void publishRealtimeEvent({
      event: 'contract:updated',
      data: { tenantId, contractId, status: contractStatus },
      source: 'api:approvals/quick',
    })
  }

  return createSuccessResponse(ctx, {
    success: true,
    action,
    message: action === 'approve' 
      ? (newStatus === 'COMPLETED' ? 'Contract approved!' : 'Step approved, moving to next')
      : action === 'reject'
      ? 'Contract rejected'
      : 'Changes requested',
    workflowStatus: newStatus,
    contractStatus,
  })
});

// GET - List pending approvals with simplified response
export const GET = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  if (!session?.user?.id) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401)
  }
  const tenantId = session.user.tenantId

  const pendingExecutions = await prisma.workflowExecution.findMany({
    where: {
      tenantId,
      status: { in: ['PENDING', 'IN_PROGRESS'] },
    },
    include: {
      contract: {
        select: {
          id: true,
          contractTitle: true,
          fileName: true,
          totalValue: true,
          status: true,
        },
      },
      stepExecutions: {
        where: { status: { in: ['IN_PROGRESS', 'WAITING'] } },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  const simplified = pendingExecutions.map(exec => ({
    id: exec.id,
    contractId: exec.contractId,
    contractName: exec.contract.contractTitle || exec.contract.fileName,
    value: exec.contract.totalValue,
    currentStep: exec.stepExecutions[0]?.stepName || 'Pending',
    status: exec.status,
    createdAt: exec.createdAt,
  }))

  return createSuccessResponse(ctx, {
    success: true,
    count: simplified.length,
    approvals: simplified,
  })
});
