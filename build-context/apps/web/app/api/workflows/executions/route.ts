import { NextRequest } from 'next/server';
import getDb from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';
export const dynamic = 'force-dynamic';

/**
 * GET /api/workflows/executions - List all workflow executions
 */
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = await ctx.tenantId;
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const contractId = searchParams.get('contractId');

  const db = await getDb();

  const where: Record<string, unknown> = { tenantId };
  if (status) where.status = status.toUpperCase();
  if (contractId) where.contractId = contractId;

  const executions = await db.workflowExecution.findMany({
    where,
    include: {
      workflow: {
        select: {
          name: true,
          description: true,
        },
      },
      contract: {
        select: {
          id: true,
          fileName: true,
        },
      },
      stepExecutions: {
        orderBy: { stepOrder: 'asc' },
      },
    },
    orderBy: { startedAt: 'desc' },
  });

  return createSuccessResponse(ctx, {
    success: true,
    executions: executions.map(exec => ({
      id: exec.id,
      workflowName: exec.workflow?.name || 'Ad-hoc Approval',
      contractId: exec.contractId,
      contractName: exec.contract?.fileName,
      status: exec.status.toLowerCase(),
      startedAt: exec.startedAt.toISOString(),
      completedAt: exec.completedAt?.toISOString(),
      initiatedBy: exec.initiatedBy,
      steps: exec.stepExecutions.map(step => ({
        id: step.id,
        name: step.stepName,
        assignedTo: step.assignedTo,
        status: step.status.toLowerCase(),
        completedAt: step.completedAt?.toISOString(),
        order: step.stepOrder,
      })),
    })),
    total: executions.length,
  });
});

/**
 * POST /api/workflows/executions - Create a new workflow execution (ad-hoc approval)
 */
export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = await ctx.tenantId;
  const body = await request.json();

  const { contractId, type, priority, dueDate, notes, steps } = body;

  if (!contractId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Contract ID is required', 400);
  }

  if (!steps || steps.length === 0) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'At least one approval step is required', 400);
  }

  const db = await getDb();

  const contract = await db.contract.findUnique({
    where: { id: contractId, tenantId },
    select: { id: true, fileName: true },
  });

  if (!contract) {
    return createErrorResponse(ctx, 'NOT_FOUND', `Contract ${contractId} not found`, 404);
  }

  const actualContractId = contract.id;

  // Create or find an ad-hoc approval workflow
  let workflow = await db.workflow.findFirst({
    where: {
      tenantId,
      name: 'Ad-hoc Approval',
      type: 'APPROVAL',
    },
    include: {
      steps: true,
    },
  });

  if (!workflow) {
    workflow = await db.workflow.create({
      data: {
        tenantId,
        name: 'Ad-hoc Approval',
        description: 'Dynamic approval workflow created for individual submissions',
        type: 'APPROVAL',
        isActive: true,
        config: {},
        metadata: {},
      },
      include: {
        steps: true,
      },
    });
  }

  // Create workflow steps for each approval step if they don't exist
  const stepIds: string[] = [];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i] as { stepOrder: number; stepName: string; assignedTo: string; required?: boolean };

    // Check if a step with this name already exists for this workflow
    let workflowStep = workflow.steps.find(s => s.name === step.stepName && s.order === (step.stepOrder || i + 1));

    if (!workflowStep) {
      workflowStep = await db.workflowStep.create({
        data: {
          workflowId: workflow.id,
          name: step.stepName,
          order: step.stepOrder || i + 1,
          type: 'APPROVAL',
          assignedRole: step.assignedTo,
          isRequired: step.required !== false,
        },
      });
    }

    stepIds.push(workflowStep.id);
  }

  // Create the workflow execution
  const execution = await db.workflowExecution.create({
    data: {
      tenantId,
      workflowId: workflow.id,
      contractId: actualContractId,
      status: 'IN_PROGRESS',
      startedAt: new Date(),
      initiatedBy: 'User',
      metadata: {
        type: type || 'approval',
        priority: priority || 'medium',
        dueDate: dueDate || null,
        notes: notes || null,
      },
      stepExecutions: {
        create: steps.map((step: { stepOrder: number; stepName: string; assignedTo: string; required?: boolean }, index: number) => ({
          stepId: stepIds[index],
          stepOrder: step.stepOrder || index + 1,
          stepName: step.stepName,
          assignedTo: step.assignedTo,
          status: index === 0 ? 'IN_PROGRESS' : 'PENDING',
          startedAt: index === 0 ? new Date() : undefined,
          metadata: {
            required: step.required !== false,
          },
        })),
      },
    },
    include: {
      stepExecutions: {
        orderBy: { stepOrder: 'asc' },
      },
    },
  });

  return createSuccessResponse(ctx, {
    success: true,
    execution: {
      id: execution.id,
      contractId: execution.contractId,
      status: execution.status.toLowerCase(),
      startedAt: execution.startedAt.toISOString(),
      steps: execution.stepExecutions.map(step => ({
        id: step.id,
        name: step.stepName,
        assignedTo: step.assignedTo,
        status: step.status.toLowerCase(),
        order: step.stepOrder,
      })),
    },
    message: 'Approval workflow started successfully',
  });
});
