/**
 * Workflow Actions Handler
 * Handles workflow creation and management
 */

import { DetectedIntent, ActionResponse, ChatContext } from '../types';
import { prisma } from '@/lib/prisma';
import { addActivityLogEntry } from '@/lib/activity-log';

export async function handleWorkflowActions(
  intent: DetectedIntent,
  context: ChatContext
): Promise<ActionResponse> {
  const { action, entities } = intent;
  const { tenantId, userId, contractId } = context;

  try {
    switch (action) {
      case 'start_workflow':
        return await startWorkflow(entities, tenantId, userId);

      case 'list_workflows':
        return await listWorkflows(tenantId);

      case 'workflow_status':
        return await getWorkflowStatus(entities.workflowId, tenantId);

      case 'pending_approvals':
        return await getPendingApprovals(tenantId, userId);

      case 'approve_step':
        return await approveStep(entities.executionId, tenantId, userId, entities.comment);

      case 'reject_step':
        return await rejectStep(entities.executionId, tenantId, userId, entities.reason);

      case 'create_workflow':
        return await createWorkflowTemplate(entities, tenantId, userId);

      case 'assign_approver':
        return await assignApprover(entities.executionId, entities.assignee, tenantId, userId);

      case 'escalate':
        return await escalateWorkflow(entities.executionId, tenantId, userId, entities.reason);

      case 'cancel_workflow':
        return await cancelWorkflow(entities.executionId, tenantId, userId, entities.reason);

      default:
        return {
          success: false,
          message: `Unknown workflow action: ${action}`,
        };
    }
  } catch (error) {
    console.error('[Workflow Actions] Error:', error);
    return {
      success: false,
      message: 'Failed to process workflow request',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
    };
  }
}

async function startWorkflow(
  entities: DetectedIntent['entities'],
  tenantId: string,
  userId: string
): Promise<ActionResponse> {
  const { contractId, workflowType, workflowId } = entities;

  if (!contractId) {
    return {
      success: false,
      message: 'Which contract would you like to start a workflow for?',
    };
  }

  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId },
  });

  if (!contract) {
    return { success: false, message: 'Contract not found' };
  }

  // Find or determine workflow template
  let workflow = null;
  if (workflowId) {
    workflow = await prisma.workflow.findFirst({
      where: { id: workflowId, tenantId, isActive: true },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
  } else if (workflowType) {
    workflow = await prisma.workflow.findFirst({
      where: { tenantId, type: workflowType, isActive: true },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
  }

  if (!workflow) {
    // List available workflows
    const available = await prisma.workflow.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, name: true, type: true },
    });

    if (available.length === 0) {
      return {
        success: false,
        message: 'No workflows configured. Please create one first.',
        actions: [
          { label: 'Create Workflow', action: 'navigate', params: { url: '/settings/workflows/new' } },
        ],
      };
    }

    return {
      success: false,
      message: 'Which workflow would you like to start?',
      data: { available },
      actions: available.map((w) => ({
        label: w.name,
        action: 'start_workflow',
        params: { contractId, workflowId: w.id },
      })),
    };
  }

  // Create workflow execution
  const execution = await prisma.workflowExecution.create({
    data: {
      tenantId,
      workflowId: workflow.id,
      contractId,
      status: 'PENDING',
      currentStep: 0,
      startedBy: userId,
      startedAt: new Date(),
    },
  });

  // Create step executions
  if (workflow.steps.length > 0) {
    await prisma.workflowStepExecution.createMany({
      data: workflow.steps.map((step, idx) => ({
        executionId: execution.id,
        stepId: step.id,
        status: idx === 0 ? 'PENDING' : 'WAITING',
        order: idx,
      })),
    });
  }

  await addActivityLogEntry({
    tenantId,
    contractId,
    action: 'WORKFLOW_STARTED',
    performedBy: userId,
    details: { workflowId: workflow.id, workflowName: workflow.name, source: 'chatbot' },
  });

  return {
    success: true,
    message: `Started "${workflow.name}" workflow for "${contract.contractTitle}"`,
    data: {
      executionId: execution.id,
      workflowName: workflow.name,
      totalSteps: workflow.steps.length,
    },
    actions: [
      { label: 'View Workflow', action: 'navigate', params: { url: `/workflows/${execution.id}` } },
    ],
  };
}

async function listWorkflows(tenantId: string): Promise<ActionResponse> {
  const workflows = await prisma.workflow.findMany({
    where: { tenantId, isActive: true },
    include: {
      steps: { select: { id: true, name: true }, orderBy: { order: 'asc' } },
      _count: { select: { executions: true } },
    },
    orderBy: { name: 'asc' },
  });

  return {
    success: true,
    message: `Found ${workflows.length} active workflows`,
    data: {
      workflows: workflows.map((w) => ({
        id: w.id,
        name: w.name,
        type: w.type,
        stepCount: w.steps.length,
        executionCount: w._count.executions,
        steps: w.steps.map((s) => s.name),
      })),
    },
  };
}

async function getWorkflowStatus(
  workflowId: string | undefined,
  tenantId: string
): Promise<ActionResponse> {
  // This could be executionId or workflowId - try both
  const execution = await prisma.workflowExecution.findFirst({
    where: {
      OR: [
        { id: workflowId, tenantId },
        { workflowId, tenantId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
      ],
    },
    include: {
      workflow: true,
      contract: { select: { id: true, contractTitle: true } },
      stepExecutions: {
        include: { step: true },
        orderBy: { order: 'asc' },
      },
    },
    orderBy: { startedAt: 'desc' },
  });

  if (!execution) {
    return {
      success: false,
      message: 'Workflow execution not found',
    };
  }

  const currentStep = execution.stepExecutions.find((s) => s.status === 'PENDING');
  const completedSteps = execution.stepExecutions.filter((s) => s.status === 'COMPLETED').length;

  return {
    success: true,
    message: `Workflow "${execution.workflow.name}" is ${execution.status}`,
    data: {
      executionId: execution.id,
      workflowName: execution.workflow.name,
      contractTitle: execution.contract?.contractTitle,
      status: execution.status,
      progress: {
        current: completedSteps,
        total: execution.stepExecutions.length,
        percentage: execution.stepExecutions.length > 0
          ? Math.round((completedSteps / execution.stepExecutions.length) * 100)
          : 0,
      },
      currentStep: currentStep
        ? { name: currentStep.step.name, assignee: currentStep.assignedTo }
        : null,
      steps: execution.stepExecutions.map((se) => ({
        name: se.step.name,
        status: se.status,
        completedAt: se.completedAt,
        completedBy: se.completedBy,
      })),
    },
  };
}

async function getPendingApprovals(tenantId: string, userId: string): Promise<ActionResponse> {
  const pending = await prisma.workflowStepExecution.findMany({
    where: {
      execution: { tenantId },
      status: 'PENDING',
      OR: [
        { assignedTo: userId },
        { assignedTo: null }, // Unassigned
      ],
    },
    include: {
      step: true,
      execution: {
        include: {
          workflow: true,
          contract: { select: { id: true, contractTitle: true, supplierName: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return {
    success: true,
    message: pending.length > 0
      ? `You have ${pending.length} pending approval(s)`
      : 'No pending approvals',
    data: {
      count: pending.length,
      approvals: pending.map((p) => ({
        executionId: p.executionId,
        stepId: p.id,
        stepName: p.step.name,
        workflowName: p.execution.workflow.name,
        contractId: p.execution.contractId,
        contractTitle: p.execution.contract?.contractTitle,
        supplier: p.execution.contract?.supplierName,
        waitingSince: p.createdAt,
      })),
    },
    actions: pending.slice(0, 3).map((p) => ({
      label: `Review "${p.execution.contract?.contractTitle}"`,
      action: 'navigate',
      params: { url: `/contracts/${p.execution.contractId}` },
    })),
  };
}

async function approveStep(
  executionId: string | undefined,
  tenantId: string,
  userId: string,
  comment?: string
): Promise<ActionResponse> {
  if (!executionId) {
    return {
      success: false,
      message: 'Which workflow step would you like to approve?',
    };
  }

  const stepExecution = await prisma.workflowStepExecution.findFirst({
    where: {
      OR: [{ id: executionId }, { executionId }],
      status: 'PENDING',
      execution: { tenantId },
    },
    include: {
      step: true,
      execution: {
        include: {
          workflow: true,
          contract: { select: { id: true, contractTitle: true } },
          stepExecutions: { orderBy: { order: 'asc' } },
        },
      },
    },
  });

  if (!stepExecution) {
    return { success: false, message: 'No pending step found' };
  }

  // Complete current step
  await prisma.workflowStepExecution.update({
    where: { id: stepExecution.id },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      completedBy: userId,
      comments: comment,
    },
  });

  // Find and activate next step
  const nextStep = stepExecution.execution.stepExecutions.find(
    (s) => s.order === stepExecution.order + 1 && s.status === 'WAITING'
  );

  if (nextStep) {
    await prisma.workflowStepExecution.update({
      where: { id: nextStep.id },
      data: { status: 'PENDING' },
    });
  } else {
    // All steps complete - finalize workflow
    await prisma.workflowExecution.update({
      where: { id: stepExecution.executionId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
  }

  await addActivityLogEntry({
    tenantId,
    contractId: stepExecution.execution.contractId,
    action: 'WORKFLOW_STEP_APPROVED',
    performedBy: userId,
    details: {
      stepName: stepExecution.step.name,
      workflowName: stepExecution.execution.workflow.name,
      comment,
      source: 'chatbot',
    },
  });

  return {
    success: true,
    message: nextStep
      ? `Approved "${stepExecution.step.name}". Next step: "${stepExecution.execution.workflow.name}"`
      : `Approved "${stepExecution.step.name}". Workflow complete!`,
    data: {
      approved: true,
      isComplete: !nextStep,
      contractId: stepExecution.execution.contractId,
    },
  };
}

async function rejectStep(
  executionId: string | undefined,
  tenantId: string,
  userId: string,
  reason?: string
): Promise<ActionResponse> {
  if (!executionId) {
    return {
      success: false,
      message: 'Which workflow step would you like to reject?',
    };
  }

  const stepExecution = await prisma.workflowStepExecution.findFirst({
    where: {
      OR: [{ id: executionId }, { executionId }],
      status: 'PENDING',
      execution: { tenantId },
    },
    include: {
      step: true,
      execution: {
        include: {
          workflow: true,
          contract: { select: { id: true, contractTitle: true } },
        },
      },
    },
  });

  if (!stepExecution) {
    return { success: false, message: 'No pending step found' };
  }

  // Reject step and workflow
  await prisma.$transaction([
    prisma.workflowStepExecution.update({
      where: { id: stepExecution.id },
      data: {
        status: 'REJECTED',
        completedAt: new Date(),
        completedBy: userId,
        comments: reason,
      },
    }),
    prisma.workflowExecution.update({
      where: { id: stepExecution.executionId },
      data: {
        status: 'REJECTED',
        completedAt: new Date(),
      },
    }),
  ]);

  await addActivityLogEntry({
    tenantId,
    contractId: stepExecution.execution.contractId,
    action: 'WORKFLOW_REJECTED',
    performedBy: userId,
    details: {
      stepName: stepExecution.step.name,
      workflowName: stepExecution.execution.workflow.name,
      reason,
      source: 'chatbot',
    },
  });

  return {
    success: true,
    message: `Rejected "${stepExecution.step.name}"${reason ? `: ${reason}` : ''}`,
    data: {
      rejected: true,
      contractId: stepExecution.execution.contractId,
    },
  };
}

async function createWorkflowTemplate(
  entities: DetectedIntent['entities'],
  tenantId: string,
  userId: string
): Promise<ActionResponse> {
  const { workflowName, workflowType, steps } = entities;

  if (!workflowName) {
    return {
      success: false,
      message: 'What would you like to name this workflow?',
    };
  }

  const workflow = await prisma.workflow.create({
    data: {
      tenantId,
      name: workflowName,
      type: workflowType || 'APPROVAL',
      isActive: true,
      createdBy: userId,
    },
  });

  // Create default steps if none provided
  const defaultSteps = steps || [
    { name: 'Manager Review', type: 'APPROVAL' },
    { name: 'Legal Review', type: 'APPROVAL' },
    { name: 'Final Approval', type: 'APPROVAL' },
  ];

  await prisma.workflowStep.createMany({
    data: defaultSteps.map((step: { name: string; type: string }, idx: number) => ({
      workflowId: workflow.id,
      name: step.name,
      type: step.type || 'APPROVAL',
      order: idx,
    })),
  });

  return {
    success: true,
    message: `Created workflow "${workflowName}" with ${defaultSteps.length} steps`,
    data: { workflowId: workflow.id },
    actions: [
      { label: 'Configure Workflow', action: 'navigate', params: { url: `/settings/workflows/${workflow.id}` } },
    ],
  };
}

async function assignApprover(
  executionId: string | undefined,
  assignee: string | undefined,
  tenantId: string,
  userId: string
): Promise<ActionResponse> {
  if (!executionId || !assignee) {
    return {
      success: false,
      message: 'Please specify the workflow step and the person to assign',
    };
  }

  const stepExecution = await prisma.workflowStepExecution.findFirst({
    where: {
      OR: [{ id: executionId }, { executionId }],
      status: 'PENDING',
      execution: { tenantId },
    },
    include: { step: true },
  });

  if (!stepExecution) {
    return { success: false, message: 'No pending step found' };
  }

  // Look up user
  const user = await prisma.user.findFirst({
    where: {
      tenantId,
      OR: [
        { email: { contains: assignee, mode: 'insensitive' } },
        { name: { contains: assignee, mode: 'insensitive' } },
      ],
    },
  });

  if (!user) {
    return {
      success: false,
      message: `User "${assignee}" not found`,
    };
  }

  await prisma.workflowStepExecution.update({
    where: { id: stepExecution.id },
    data: { assignedTo: user.id },
  });

  return {
    success: true,
    message: `Assigned "${stepExecution.step.name}" to ${user.name || user.email}`,
    data: { stepId: stepExecution.id, assignedTo: user.id },
  };
}

async function escalateWorkflow(
  executionId: string | undefined,
  tenantId: string,
  userId: string,
  reason?: string
): Promise<ActionResponse> {
  if (!executionId) {
    return {
      success: false,
      message: 'Which workflow would you like to escalate?',
    };
  }

  const execution = await prisma.workflowExecution.findFirst({
    where: {
      OR: [{ id: executionId }],
      tenantId,
      status: { in: ['PENDING', 'IN_PROGRESS'] },
    },
    include: {
      workflow: true,
      contract: { select: { id: true, contractTitle: true } },
    },
  });

  if (!execution) {
    return { success: false, message: 'Active workflow not found' };
  }

  await prisma.workflowExecution.update({
    where: { id: execution.id },
    data: {
      isEscalated: true,
      escalatedAt: new Date(),
      escalationReason: reason,
    },
  });

  await addActivityLogEntry({
    tenantId,
    contractId: execution.contractId,
    action: 'WORKFLOW_ESCALATED',
    performedBy: userId,
    details: { workflowName: execution.workflow.name, reason, source: 'chatbot' },
  });

  return {
    success: true,
    message: `Escalated workflow for "${execution.contract?.contractTitle}"`,
    data: { escalated: true },
  };
}

async function cancelWorkflow(
  executionId: string | undefined,
  tenantId: string,
  userId: string,
  reason?: string
): Promise<ActionResponse> {
  if (!executionId) {
    return {
      success: false,
      message: 'Which workflow would you like to cancel?',
    };
  }

  const execution = await prisma.workflowExecution.findFirst({
    where: {
      id: executionId,
      tenantId,
      status: { in: ['PENDING', 'IN_PROGRESS'] },
    },
    include: {
      workflow: true,
      contract: { select: { id: true, contractTitle: true } },
    },
  });

  if (!execution) {
    return { success: false, message: 'Active workflow not found' };
  }

  await prisma.$transaction([
    prisma.workflowExecution.update({
      where: { id: execution.id },
      data: {
        status: 'CANCELLED',
        completedAt: new Date(),
      },
    }),
    prisma.workflowStepExecution.updateMany({
      where: { executionId: execution.id, status: { in: ['PENDING', 'WAITING'] } },
      data: { status: 'CANCELLED' },
    }),
  ]);

  await addActivityLogEntry({
    tenantId,
    contractId: execution.contractId,
    action: 'WORKFLOW_CANCELLED',
    performedBy: userId,
    details: { workflowName: execution.workflow.name, reason, source: 'chatbot' },
  });

  return {
    success: true,
    message: `Cancelled workflow for "${execution.contract?.contractTitle}"${reason ? `: ${reason}` : ''}`,
    data: { cancelled: true },
  };
}

