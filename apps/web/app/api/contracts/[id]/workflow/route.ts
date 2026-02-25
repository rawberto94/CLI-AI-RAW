import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { contractService } from 'data-orchestration/services';
import { Prisma } from '@prisma/client';
import { getApiTenantId } from '@/lib/tenant-server';
import { requiresApprovalWorkflow, getContractLifecycle } from '@/lib/contract-helpers';
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

const workflowStepSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  order: z.number().int().optional(),
  type: z.string().optional(),
  assignedRole: z.string().optional(),
  assignedUser: z.string().optional(),
  config: z.record(z.unknown()).optional(),
  isRequired: z.boolean().optional(),
  timeout: z.number().int().optional(),
});

const createWorkflowSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  type: z.string().default('APPROVAL'),
  isActive: z.boolean().default(true),
  config: z.record(z.unknown()).default({}),
  metadata: z.record(z.unknown()).default({}),
  steps: z.array(workflowStepSchema).default([]),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
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
    
    const contractId = params.id;

    // First verify contract exists
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: { id: true, contractTitle: true, fileName: true },
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
        steps: execution.workflow.steps.map(step => ({
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
        })),
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
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
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
    
    const contractId = params.id;
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

    // Create workflow
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
          create: body.steps.map((step, index) => {
            const stepData: Prisma.WorkflowStepCreateWithoutWorkflowInput = {
              name: step.name,
              order: step.order ?? index,
              type: step.type || 'APPROVAL',
              isRequired: step.isRequired !== false,
            };
            if (step.description) stepData.description = step.description;
            if (step.assignedRole) stepData.assignedRole = step.assignedRole;
            if (step.assignedUser) stepData.assignedUser = step.assignedUser;
            if (step.config) stepData.config = step.config as Prisma.InputJsonValue;
            if (step.timeout) stepData.timeout = step.timeout;
            return stepData;
          }),
        },
      },
      include: {
        steps: {
          orderBy: { order: 'asc' },
        },
      },
    });

    // Create workflow execution linked to this contract
    const execution = await prisma.workflowExecution.create({
      data: {
        tenantId,
        workflowId: workflow.id,
        contractId,
        status: 'PENDING',
        currentStep: '0',
      },
    });

    // Create step executions
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

    return createSuccessResponse(ctx, {
      success: true,
      workflow: {
        id: workflow.id,
        executionId: execution.id,
        contractId,
        name: workflow.name,
        description: workflow.description,
        type: workflow.type,
        isActive: workflow.isActive,
        status: execution.status,
        steps: workflow.steps.map(step => ({
          id: step.id,
          name: step.name,
          description: step.description,
          type: step.type,
          assignedRole: step.assignedRole,
          assignedUser: step.assignedUser,
          isRequired: step.isRequired,
          timeout: step.timeout,
          order: step.order,
        })),
      },
      message: 'Workflow created successfully',
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
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
    
    const contractId = params.id;
    const body = await request.json();

    // Find existing workflow execution for this contract
    const existingExecution = await prisma.workflowExecution.findFirst({
      where: { contractId, tenantId },
      include: { workflow: true },
    });

    if (!existingExecution?.workflow) {
      // If no existing workflow, create new one
      return POST(request, { params });
    }

    const workflowId = existingExecution.workflow.id;

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
        config: body.config,
        metadata: body.metadata,
        steps: {
          create: ((body.steps || []) as WorkflowStepInput[]).map((step, index) => {
            const stepData: Prisma.WorkflowStepCreateWithoutWorkflowInput = {
              name: step.name,
              order: step.order ?? index,
              type: step.type || 'APPROVAL',
              isRequired: step.isRequired !== false,
            };
            if (step.description) stepData.description = step.description;
            if (step.assignedRole) stepData.assignedRole = step.assignedRole;
            if (step.assignedUser) stepData.assignedUser = step.assignedUser;
            if (step.config) stepData.config = step.config as Prisma.InputJsonValue;
            if (step.timeout) stepData.timeout = step.timeout;
            return stepData;
          }),
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
        steps: workflow.steps.map(step => ({
          id: step.id,
          name: step.name,
          description: step.description,
          type: step.type,
          assignedRole: step.assignedRole,
          assignedUser: step.assignedUser,
          isRequired: step.isRequired,
          timeout: step.timeout,
          order: step.order,
        })),
      },
      message: 'Workflow updated successfully',
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
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
    
    const contractId = params.id;

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
