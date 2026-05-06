import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

import { createErrorResponse, createSuccessResponse } from '@/lib/api-middleware';
import { getContractLifecycle, requiresApprovalWorkflow } from '@/lib/contract-helpers';
import { prisma } from '@/lib/prisma';
import { evaluateContractPreApprovalGates, formatUnmetPreApprovalGates } from '@/lib/governance/pre-approval-gates';

import type { ContractApiContext } from '@/lib/contracts/server/context';

const workflowStepSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  order: z.number().int().optional(),
  type: z.string().optional(),
  assignedRole: z.string().optional(),
  assignedUser: z.string().optional(),
  approverType: z.enum(['user', 'role', 'group']).optional(),
  approvers: z.array(z.string()).default([]),
  approvalType: z.enum(['any', 'all']).optional(),
  slaHours: z.number().int().optional(),
  escalationEnabled: z.boolean().optional(),
  escalateTo: z.string().optional(),
  config: z.record(z.unknown()).optional(),
  isRequired: z.boolean().optional(),
  timeout: z.number().int().optional(),
});

type WorkflowStepInput = z.infer<typeof workflowStepSchema>;

const createWorkflowSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  type: z.string().default('APPROVAL'),
  isActive: z.boolean().default(true),
  config: z.record(z.unknown()).default({}),
  metadata: z.record(z.unknown()).default({}),
  steps: z.array(workflowStepSchema).default([]),
});

type WorkflowPayload = z.infer<typeof createWorkflowSchema>;

type WorkflowContract = {
  id: string;
  tenantId: string;
  status: string;
  documentRole: string | null;
  metadata: Prisma.JsonValue | null;
  contractTitle: string | null;
  fileName: string | null;
  contractType: string | null;
  totalValue: Prisma.Decimal | number | null;
  currency: string | null;
};

function buildWorkflowStepInput(step: WorkflowStepInput, index: number) {
  const approvers = step.approvers.filter((approver) => approver.trim().length > 0);
  const approverType = step.approverType || (step.assignedUser ? 'user' : step.assignedRole ? 'role' : 'role');
  const assignedUser = approverType === 'user' ? (step.assignedUser || approvers[0]) : step.assignedUser;
  const assignedRole = approverType !== 'user' ? (step.assignedRole || approvers[0]) : step.assignedRole;
  const timeout = step.slaHours ?? step.timeout;
  const config = JSON.parse(JSON.stringify({
    ...(step.config || {}),
    approverType,
    approvers,
    approvalType: step.approvalType || 'any',
    slaHours: timeout ?? null,
    escalationEnabled: step.escalationEnabled ?? false,
    escalateTo: step.escalateTo || null,
  })) as Prisma.InputJsonValue;

  const stepData: Prisma.WorkflowStepCreateWithoutWorkflowInput = {
    name: step.name,
    order: step.order ?? index,
    type: step.type || 'APPROVAL',
    isRequired: step.isRequired !== false,
    config,
  };

  if (step.description) stepData.description = step.description;
  if (assignedRole) stepData.assignedRole = assignedRole;
  if (assignedUser) stepData.assignedUser = assignedUser;
  if (timeout) stepData.timeout = timeout;

  return stepData;
}

function serializeWorkflowStep(step: {
  id: string;
  name: string;
  description: string | null;
  type: string;
  assignedRole: string | null;
  assignedUser: string | null;
  isRequired: boolean;
  timeout: number | null;
  order: number;
  config: Prisma.JsonValue | null;
}) {
  const config = step.config && typeof step.config === 'object'
    ? (step.config as Record<string, unknown>)
    : {};
  const approvers = Array.isArray(config.approvers)
    ? config.approvers.filter((approver): approver is string => typeof approver === 'string' && approver.trim().length > 0)
    : [step.assignedUser || step.assignedRole].filter((approver): approver is string => Boolean(approver));

  return {
    id: step.id,
    name: step.name,
    description: step.description,
    type: step.type,
    assignedRole: step.assignedRole,
    assignedUser: step.assignedUser,
    isRequired: step.isRequired,
    timeout: step.timeout,
    order: step.order,
    config: step.config,
    approverType: typeof config.approverType === 'string'
      ? config.approverType
      : step.assignedUser
        ? 'user'
        : 'role',
    approvers,
    approvalType: typeof config.approvalType === 'string' ? config.approvalType : 'any',
    slaHours: typeof config.slaHours === 'number' ? config.slaHours : step.timeout || 24,
    escalationEnabled: Boolean(config.escalationEnabled),
    escalateTo: typeof config.escalateTo === 'string' ? config.escalateTo : undefined,
  };
}

function serializeWorkflowSummary(
  workflow: {
    id: string;
    name: string;
    description: string | null;
    type: string;
    isActive: boolean;
    steps: Array<{
      id: string;
      name: string;
      description: string | null;
      type: string;
      assignedRole: string | null;
      assignedUser: string | null;
      isRequired: boolean;
      timeout: number | null;
      order: number;
      config: Prisma.JsonValue | null;
    }>;
  },
  executionId: string,
  contractId: string,
  status?: string,
) {
  return {
    id: workflow.id,
    executionId,
    contractId,
    name: workflow.name,
    description: workflow.description,
    type: workflow.type,
    isActive: workflow.isActive,
    ...(status ? { status } : {}),
    steps: workflow.steps.map((step) => serializeWorkflowStep(step)),
  };
}

async function createWorkflowForContract(
  tenantId: string,
  contractId: string,
  contract: WorkflowContract,
  body: WorkflowPayload,
) {
  const workflowSteps = body.steps.map((step, index) => buildWorkflowStepInput(step, index));
  const governance = await evaluateContractPreApprovalGates(contract, workflowSteps);

  if (body.isActive && governance.unmetGates.length > 0) {
    return { governance, workflow: null, execution: null };
  }

  const workflow = await prisma.workflow.create({
    data: {
      tenantId,
      name: body.name || `Workflow for ${contract.contractTitle || contract.fileName}`,
      description: body.description,
      type: body.type,
      isActive: body.isActive,
      config: body.config as Prisma.InputJsonValue,
      metadata: body.metadata as Prisma.InputJsonValue,
      steps: {
        create: workflowSteps,
      },
    },
    include: {
      steps: {
        orderBy: { order: 'asc' },
      },
    },
  });

  const execution = await prisma.workflowExecution.create({
    data: {
      tenantId,
      workflowId: workflow.id,
      contractId,
      status: 'PENDING',
      currentStep: '0',
    },
  });

  if (workflow.steps.length > 0) {
    await prisma.workflowStepExecution.createMany({
      data: workflow.steps.map((step, index) => ({
        executionId: execution.id,
        stepId: step.id,
        stepOrder: index,
        stepName: step.name,
        status: index === 0 ? 'WAITING' : 'PENDING',
        assignedTo: step.assignedUser || step.assignedRole,
      })),
    });
  }

  return { governance, workflow, execution };
}

async function getWorkflowContract(
  context: ContractApiContext,
  contractId: string,
): Promise<WorkflowContract | Response> {
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId: context.tenantId },
    select: {
      id: true,
      tenantId: true,
      status: true,
      documentRole: true,
      metadata: true,
      contractTitle: true,
      fileName: true,
      contractType: true,
      totalValue: true,
      currency: true,
    },
  });

  if (!contract) {
    return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
  }

  return contract;
}

function getWorkflowApplicabilityError(
  context: ContractApiContext,
  contract: WorkflowContract,
) {
  const lifecycle = getContractLifecycle(contract);
  return createErrorResponse(
    context,
    'BAD_REQUEST',
    `Workflows are only applicable for new contracts or amendments. This appears to be an ${lifecycle.toLowerCase()} contract.`,
    400,
  );
}

function getWorkflowGovernanceError(
  context: ContractApiContext,
  unmetGates: Array<{ gateId?: string; gateName?: string }>,
) {
  return createErrorResponse(
    context,
    'CONFLICT',
    `Workflow is missing required pre-approval gates: ${formatUnmetPreApprovalGates(unmetGates)}`,
    409,
    {
      field: 'steps',
      retryable: false,
    },
  );
}

export async function getContractWorkflow(
  context: ContractApiContext,
  contractId: string,
) {
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId: context.tenantId },
    select: {
      id: true,
      contractTitle: true,
      fileName: true,
      contractType: true,
      totalValue: true,
      currency: true,
    },
  });

  if (!contract) {
    return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
  }

  const execution = await prisma.workflowExecution.findFirst({
    where: { contractId, tenantId: context.tenantId },
    orderBy: { createdAt: 'desc' },
    include: {
      workflow: {
        include: {
          steps: {
            orderBy: { order: 'asc' },
          },
        },
      },
      stepExecutions: {
        orderBy: { stepOrder: 'asc' },
      },
    },
  });

  const workflowSteps = execution?.workflow?.steps || [];
  const governance = await evaluateContractPreApprovalGates(
    {
      tenantId: context.tenantId,
      contractType: contract.contractType,
      totalValue: contract.totalValue,
      currency: contract.currency,
    },
    workflowSteps,
  );

  const workflowData = execution?.workflow
    ? {
        ...serializeWorkflowSummary(execution.workflow, execution.id, contractId, execution.status),
        currentStep: execution.currentStep,
        stepExecutions: execution.stepExecutions.map((stepExecution) => ({
          id: stepExecution.id,
          stepId: stepExecution.stepId,
          stepName: stepExecution.stepName,
          status: stepExecution.status,
          assignedTo: stepExecution.assignedTo,
          completedBy: stepExecution.completedBy,
          result: stepExecution.result,
          startedAt: stepExecution.startedAt.toISOString(),
          completedAt: stepExecution.completedAt?.toISOString(),
        })),
        createdAt: execution.workflow.createdAt.toISOString(),
        updatedAt: execution.workflow.updatedAt.toISOString(),
      }
    : null;

  return createSuccessResponse(context, {
    success: true,
    contract: {
      id: contract.id,
      title: contract.contractTitle || contract.fileName,
    },
    workflow: workflowData,
    governance,
  });
}

export async function postContractWorkflow(
  request: NextRequest,
  context: ContractApiContext,
  contractId: string,
) {
  const body = createWorkflowSchema.parse(await request.json());
  const contract = await getWorkflowContract(context, contractId);

  if (contract instanceof Response) {
    return contract;
  }

  if (!requiresApprovalWorkflow(contract)) {
    return getWorkflowApplicabilityError(context, contract);
  }

  const existingExecution = await prisma.workflowExecution.findFirst({
    where: { contractId, tenantId: context.tenantId },
  });

  if (existingExecution) {
    return createErrorResponse(context, 'CONFLICT', 'Workflow already exists for this contract. Use PUT to update.', 409);
  }

  const created = await createWorkflowForContract(context.tenantId, contractId, contract, body);
  if (!created.workflow || !created.execution) {
    return getWorkflowGovernanceError(context, created.governance.unmetGates);
  }

  return createSuccessResponse(context, {
    success: true,
    workflow: serializeWorkflowSummary(created.workflow, created.execution.id, contractId, created.execution.status),
    governance: created.governance,
    message: 'Workflow created successfully',
  });
}

export async function putContractWorkflow(
  request: NextRequest,
  context: ContractApiContext,
  contractId: string,
) {
  const body = createWorkflowSchema.parse(await request.json());
  const contract = await getWorkflowContract(context, contractId);

  if (contract instanceof Response) {
    return contract;
  }

  if (!requiresApprovalWorkflow(contract)) {
    return getWorkflowApplicabilityError(context, contract);
  }

  const existingExecution = await prisma.workflowExecution.findFirst({
    where: { contractId, tenantId: context.tenantId },
    include: { workflow: true },
  });

  if (!existingExecution?.workflow) {
    const created = await createWorkflowForContract(context.tenantId, contractId, contract, body);
    if (!created.workflow || !created.execution) {
      return getWorkflowGovernanceError(context, created.governance.unmetGates);
    }

    return createSuccessResponse(context, {
      success: true,
      workflow: serializeWorkflowSummary(created.workflow, created.execution.id, contractId, created.execution.status),
      governance: created.governance,
      message: 'Workflow created successfully',
    });
  }

  const workflowSteps = body.steps.map((step, index) => buildWorkflowStepInput(step, index));
  const governance = await evaluateContractPreApprovalGates(contract, workflowSteps);

  if (body.isActive && governance.unmetGates.length > 0) {
    return getWorkflowGovernanceError(context, governance.unmetGates);
  }

  await prisma.workflowStep.deleteMany({
    where: { workflowId: existingExecution.workflow.id },
  });

  const workflow = await prisma.workflow.update({
    where: { id: existingExecution.workflow.id },
    data: {
      name: body.name,
      description: body.description,
      type: body.type || 'APPROVAL',
      isActive: body.isActive ?? true,
      config: body.config as Prisma.InputJsonValue,
      metadata: body.metadata as Prisma.InputJsonValue,
      steps: {
        create: workflowSteps,
      },
    },
    include: {
      steps: {
        orderBy: { order: 'asc' },
      },
    },
  });

  await prisma.workflowStepExecution.deleteMany({
    where: { executionId: existingExecution.id },
  });

  if (workflow.steps.length > 0) {
    await prisma.workflowStepExecution.createMany({
      data: workflow.steps.map((step, index) => ({
        executionId: existingExecution.id,
        stepId: step.id,
        stepOrder: index,
        stepName: step.name,
        status: index === 0 ? 'WAITING' : 'PENDING',
        assignedTo: step.assignedUser || step.assignedRole,
      })),
    });
  }

  await prisma.workflowExecution.update({
    where: { id: existingExecution.id },
    data: {
      status: 'PENDING',
      currentStep: '0',
      completedAt: null,
      error: null,
    },
  });

  return createSuccessResponse(context, {
    success: true,
    workflow: serializeWorkflowSummary(workflow, existingExecution.id, contractId),
    governance,
    message: 'Workflow updated successfully',
  });
}

export async function deleteContractWorkflow(
  context: ContractApiContext,
  contractId: string,
) {
  const existingExecution = await prisma.workflowExecution.findFirst({
    where: { contractId, tenantId: context.tenantId },
    include: { workflow: true },
  });

  if (!existingExecution?.workflow) {
    return createErrorResponse(context, 'NOT_FOUND', 'Workflow not found', 404);
  }

  await prisma.workflow.delete({
    where: { id: existingExecution.workflow.id },
  });

  return createSuccessResponse(context, {
    success: true,
    message: 'Workflow deleted successfully',
  });
}