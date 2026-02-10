import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';
import { workflowService } from 'data-orchestration/services';
export const dynamic = 'force-dynamic';

/**
 * GET /api/workflows - List all workflows
 */
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = await ctx.tenantId;

  if (!tenantId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant ID is required', 400);
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const isActive = searchParams.get('isActive');

  const where: Record<string, unknown> = { tenantId };
  if (type) where.type = type;
  if (isActive !== null) where.isActive = isActive === 'true';

  const workflows = await prisma.workflow.findMany({
    where,
    include: {
      steps: {
        orderBy: { order: 'asc' },
      },
      _count: {
        select: { executions: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return createSuccessResponse(ctx, {
    success: true,
    workflows: workflows.map(w => ({
      ...w,
      executions: w._count.executions,
    })),
    total: workflows.length,
  });
});

interface WorkflowStepInput {
  name: string;
  description?: string;
  order?: number;
  type?: string;
  assignedRole?: string;
  assignedUser?: string;
  config?: Record<string, unknown>;
  isRequired?: boolean;
  timeout?: number;
}

/**
 * POST /api/workflows - Create new workflow
 */
export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = await ctx.tenantId;

  if (!tenantId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant ID is required', 400);
  }

  const body = await request.json();

  const { name, description, type, steps, isActive } = body;

  if (!name) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Workflow name is required', 400);
  }

  const workflow = await prisma.workflow.create({
    data: {
      tenantId,
      name,
      description,
      type: type || 'APPROVAL',
      isActive: isActive !== false,
      config: body.config || {},
      metadata: body.metadata || {},
      steps: {
        create: ((steps || []) as WorkflowStepInput[]).map((step, index) => {
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

  return createSuccessResponse(ctx, {
    success: true,
    workflow,
    message: 'Workflow created successfully',
  });
});

/**
 * PATCH /api/workflows - Update workflow
 */
export const PATCH = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = await ctx.tenantId;

  if (!tenantId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant ID is required', 400);
  }

  const body = await request.json();
  const { id, steps, ...updates } = body;

  if (!id) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Workflow ID is required', 400);
  }

  // Verify workflow belongs to tenant before updating
  const existingWorkflow = await prisma.workflow.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });

  if (!existingWorkflow) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Workflow not found', 404);
  }

  // If updating steps, delete old ones and create new ones
  if (steps) {
    await prisma.workflowStep.deleteMany({
      where: { workflowId: existingWorkflow.id },
    });

    await prisma.workflowStep.createMany({
      data: (steps as WorkflowStepInput[]).map((step, index) => {
        const stepData: Prisma.WorkflowStepCreateManyInput = {
          workflowId: existingWorkflow.id,
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
    });
  }

  const workflow = await prisma.workflow.update({
    where: { id: existingWorkflow.id },
    data: {
      ...updates,
      updatedAt: new Date(),
    },
    include: {
      steps: {
        orderBy: { order: 'asc' },
      },
    },
  });

  return createSuccessResponse(ctx, {
    success: true,
    workflow,
    message: 'Workflow updated successfully',
  });
});

/**
 * DELETE /api/workflows - Delete workflow
 */
export const DELETE = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = await ctx.tenantId;

  if (!tenantId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant ID is required', 400);
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Workflow ID is required', 400);
  }

  // Verify workflow belongs to tenant before deleting
  const existingWorkflow = await prisma.workflow.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });

  if (!existingWorkflow) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Workflow not found', 404);
  }

  await prisma.workflow.delete({
    where: { id: existingWorkflow.id },
  });

  return createSuccessResponse(ctx, {
    success: true,
    message: 'Workflow deleted successfully',
  });
});
