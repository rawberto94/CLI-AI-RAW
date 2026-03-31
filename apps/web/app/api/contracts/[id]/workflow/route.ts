import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { contractService } from 'data-orchestration/services';
import { Prisma } from '@prisma/client';
import { getApiTenantId } from '@/lib/tenant-server';
import { requiresApprovalWorkflow, getContractLifecycle } from '@/lib/contract-helpers';
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';
import { evaluateContractPreApprovalGates, formatUnmetPreApprovalGates } from '@/lib/governance/pre-approval-gates';

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

async function createWorkflowForContract(
  tenantId: string,
  contractId: string,
  contract: WorkflowContract,
  body: WorkflowPayload
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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const tenantId = await getApiTenantId(request);
    
    if (!tenantId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant ID is required', 400);
    }
    
    const { id: contractId } = await context.params;

    // First verify contract exists
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
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
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
    }

    // Get workflow execution for this contract
    const execution = await prisma.workflowExecution.findFirst({
      where: { contractId, tenantId },
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

    // If no workflow execution, return null workflow
    let workflowData: any = null;
    const workflowSteps = execution?.workflow?.steps || [];
    const governance = await evaluateContractPreApprovalGates(
      {
        tenantId,
        contractType: contract.contractType,
        totalValue: contract.totalValue,
        currency: contract.currency,
      },
      workflowSteps
    );

    if (execution?.workflow) {
      workflowData = {
        id: execution.workflow.id,
        executionId: execution.id,
        contractId,
        name: execution.workflow.name,
        description: execution.workflow.description,
        type: execution.workflow.type,
        isActive: execution.workflow.isActive,
        status: execution.status,
        currentStep: execution.currentStep,
        steps: execution.workflow.steps.map((step) => serializeWorkflowStep(step)),
        stepExecutions: execution.stepExecutions.map(se => ({
          id: se.id,
          stepId: se.stepId,
          stepName: se.stepName,
          status: se.status,
          assignedTo: se.assignedTo,
          completedBy: se.completedBy,
          result: se.result,
          startedAt: se.startedAt.toISOString(),
          completedAt: se.completedAt?.toISOString(),
        })),
        createdAt: execution.workflow.createdAt.toISOString(),
        updatedAt: execution.workflow.updatedAt.toISOString(),
      };
    }

    return createSuccessResponse(ctx, {
      success: true,
      contract: {
        id: contract.id,
        title: contract.contractTitle || contract.fileName,
      },
      workflow: workflowData,
      governance,
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const tenantId = await getApiTenantId(request);
    
    if (!tenantId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant ID is required', 400);
    }
    
    const { id: contractId } = await context.params;
    const body = createWorkflowSchema.parse(await request.json());

    // Verify contract exists
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
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
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
    }

    // Only allow workflow execution for NEW contracts
    if (!requiresApprovalWorkflow(contract)) {
      const lifecycle = getContractLifecycle(contract);
      return createErrorResponse(ctx, 'BAD_REQUEST', `Workflows are only applicable for new contracts or amendments. This appears to be an ${lifecycle.toLowerCase()} contract.`, 400);
    }

    // Check if workflow execution already exists for this contract
    const existingExecution = await prisma.workflowExecution.findFirst({
      where: { contractId, tenantId },
    });

    if (existingExecution) {
      return createErrorResponse(ctx, 'CONFLICT', 'Workflow already exists for this contract. Use PUT to update.', 409);
    }

    const created = await createWorkflowForContract(tenantId, contractId, contract, body);
    if (!created.workflow || !created.execution) {
      return createErrorResponse(
        ctx,
        'CONFLICT',
        `Workflow is missing required pre-approval gates: ${formatUnmetPreApprovalGates(created.governance.unmetGates)}`,
        409,
        {
          field: 'steps',
          retryable: false,
        }
      );
    }

    return createSuccessResponse(ctx, {
      success: true,
      workflow: {
        id: created.workflow.id,
        executionId: created.execution.id,
        contractId,
        name: created.workflow.name,
        description: created.workflow.description,
        type: created.workflow.type,
        isActive: created.workflow.isActive,
        status: created.execution.status,
        steps: created.workflow.steps.map((step) => serializeWorkflowStep(step)),
      },
      governance: created.governance,
      message: 'Workflow created successfully',
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const tenantId = await getApiTenantId(request);
    
    if (!tenantId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant ID is required', 400);
    }
    
    const { id: contractId } = await context.params;
    const body = createWorkflowSchema.parse(await request.json());

    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
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
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
    }

    if (!requiresApprovalWorkflow(contract)) {
      const lifecycle = getContractLifecycle(contract);
      return createErrorResponse(ctx, 'BAD_REQUEST', `Workflows are only applicable for new contracts or amendments. This appears to be an ${lifecycle.toLowerCase()} contract.`, 400);
    }

    // Find existing workflow execution for this contract
    const existingExecution = await prisma.workflowExecution.findFirst({
      where: { contractId, tenantId },
      include: { workflow: true },
    });

    if (!existingExecution?.workflow) {
      const created = await createWorkflowForContract(tenantId, contractId, contract, body);
      if (!created.workflow || !created.execution) {
        return createErrorResponse(
          ctx,
          'CONFLICT',
          `Workflow is missing required pre-approval gates: ${formatUnmetPreApprovalGates(created.governance.unmetGates)}`,
          409,
          {
            field: 'steps',
            retryable: false,
          }
        );
      }

      return createSuccessResponse(ctx, {
        success: true,
        workflow: {
          id: created.workflow.id,
          executionId: created.execution.id,
          contractId,
          name: created.workflow.name,
          description: created.workflow.description,
          type: created.workflow.type,
          isActive: created.workflow.isActive,
          status: created.execution.status,
          steps: created.workflow.steps.map((step) => serializeWorkflowStep(step)),
        },
        governance: created.governance,
        message: 'Workflow created successfully',
      });
    }

    const workflowId = existingExecution.workflow.id;
    const workflowSteps = body.steps.map((step, index) => buildWorkflowStepInput(step, index));
    const governance = await evaluateContractPreApprovalGates(contract, workflowSteps);

    if (body.isActive && governance.unmetGates.length > 0) {
      return createErrorResponse(
        ctx,
        'CONFLICT',
        `Workflow is missing required pre-approval gates: ${formatUnmetPreApprovalGates(governance.unmetGates)}`,
        409,
        {
          field: 'steps',
          retryable: false,
        }
      );
    }

    // Delete existing steps and recreate
    await prisma.workflowStep.deleteMany({
      where: { workflowId },
    });

    // Update workflow
    const workflow = await prisma.workflow.update({
      where: { id: workflowId },
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

    // Reset step executions
    await prisma.workflowStepExecution.deleteMany({
      where: { executionId: existingExecution.id },
    });

    // Create new step executions
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

    // Reset execution status
    await prisma.workflowExecution.update({
      where: { id: existingExecution.id },
      data: {
        status: 'PENDING',
        currentStep: '0',
        completedAt: null,
        error: null,
      },
    });

    return createSuccessResponse(ctx, {
      success: true,
      workflow: {
        id: workflow.id,
        executionId: existingExecution.id,
        contractId,
        name: workflow.name,
        description: workflow.description,
        type: workflow.type,
        isActive: workflow.isActive,
        steps: workflow.steps.map((step) => serializeWorkflowStep(step)),
      },
      governance,
      message: 'Workflow updated successfully',
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const tenantId = await getApiTenantId(request);
    
    if (!tenantId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant ID is required', 400);
    }
    
    const { id: contractId } = await context.params;

    // Find existing workflow execution for this contract
    const existingExecution = await prisma.workflowExecution.findFirst({
      where: { contractId, tenantId },
      include: { workflow: true },
    });

    if (!existingExecution?.workflow) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Workflow not found', 404);
    }

    // Delete the workflow (cascade will delete steps and executions)
    await prisma.workflow.delete({
      where: { id: existingExecution.workflow.id },
    });

    return createSuccessResponse(ctx, {
      success: true,
      message: 'Workflow deleted successfully',
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}
