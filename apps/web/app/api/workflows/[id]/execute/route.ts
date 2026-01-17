import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantIdFromRequest } from '@/lib/tenant-server';
import { publishRealtimeEvent } from '@/lib/realtime/publish';

export const dynamic = 'force-dynamic';

/**
 * POST /api/workflows/:id/execute
 * Execute a workflow for a specific contract
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workflowId } = await params;
    let tenantId: string;
    try {
      tenantId = await getTenantIdFromRequest(request);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Tenant ID is required' },
        { status: 400 }
      );
    }
    const userId = request.headers.get('x-user-id') || 'current-user';
    const body = await request.json();
    const { contractId, initiatedBy, metadata, dueDate, priority } = body;

    if (!contractId) {
      return NextResponse.json(
        { success: false, error: 'Contract ID is required' },
        { status: 400 }
      );
    }

    // Get workflow details - verify it belongs to tenant
    const workflow = await prisma.workflow.findFirst({
      where: { id: workflowId, tenantId },
      include: {
        steps: {
          orderBy: { order: 'asc' }
        }
      }
    });

    if (!workflow) {
      return NextResponse.json(
        { success: false, error: 'Workflow not found' },
        { status: 404 }
      );
    }

    if (!workflow.isActive) {
      return NextResponse.json(
        { success: false, error: 'Workflow is not active' },
        { status: 400 }
      );
    }

    // Calculate due date based on first step timeout or provided dueDate
    const firstStep = workflow.steps[0];
    const calculatedDueDate = dueDate 
      ? new Date(dueDate) 
      : firstStep?.timeout 
        ? new Date(Date.now() + firstStep.timeout * 60 * 1000)
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Default 7 days

    // Create workflow execution
    const execution = await prisma.workflowExecution.create({
      data: {
        tenantId,
        workflowId,
        contractId,
        status: 'IN_PROGRESS',
        currentStep: '0',
        startedBy: initiatedBy || userId,
        dueDate: calculatedDueDate,
        metadata: { ...(metadata || {}), priority: priority || 'medium' },
      }
    });

    // Create step executions for all steps
    if (workflow.steps.length > 0) {
      const stepExecutions = await prisma.workflowStepExecution.createMany({
        data: workflow.steps.map((step, index) => ({
          executionId: execution.id,
          stepId: step.id,
          stepOrder: index,
          stepName: step.name,
          status: index === 0 ? 'PENDING' : 'WAITING',
          assignedTo: step.assignedRole || step.assignedUser || 'unassigned',
        })),
      });

      // Create notification for first step assignee
      if (firstStep) {
        const assignee = firstStep.assignedRole || firstStep.assignedUser;
        if (assignee) {
          await prisma.notification.create({
            data: {
              tenantId,
              userId: assignee,
              type: 'WORKFLOW_STEP',
              title: 'Workflow Action Required',
              message: `${firstStep.name} step requires your action for workflow "${workflow.name}"`,
              link: `/workflows/${workflowId}/executions/${execution.id}`,
              metadata: {
                executionId: execution.id,
                workflowId,
                stepName: firstStep.name,
                priority: priority || 'medium',
              },
            },
          });

          void publishRealtimeEvent({
            event: 'notification:new',
            data: { tenantId },
            source: 'api:workflows/execute',
          });
        }
      }
    }

    // Update contract status to indicate workflow in progress
    try {
      // Contract metadata is stored in a separate relation, just update status
      await prisma.contract.update({
        where: { id: contractId },
        data: {
          status: 'PENDING',
        },
      });

      void publishRealtimeEvent({
        event: 'contract:updated',
        data: { tenantId, contractId, status: 'PENDING' },
        source: 'api:workflows/execute',
      });
    } catch {
      // Contract update is optional, don't fail the execution
    }

    return NextResponse.json({
      success: true,
      data: {
        executionId: execution.id,
        workflowId: workflow.id,
        workflowName: workflow.name,
        status: execution.status,
        currentStep: workflow.steps[0]?.name,
        totalSteps: workflow.steps.length,
        dueDate: calculatedDueDate.toISOString(),
        message: 'Workflow execution started successfully'
      },
      source: 'database',
    });

  } catch (error: unknown) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to execute workflow',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/workflows/:id/execute
 * Get execution status for a workflow
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workflowId } = await params;
    const tenantId = await getApiTenantId(request);
    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get('contractId');
    const executionId = searchParams.get('executionId');

    const where: Record<string, unknown> = { tenantId, workflowId };
    if (contractId) where.contractId = contractId;
    if (executionId) where.id = executionId;

    const executions = await prisma.workflowExecution.findMany({
      where,
      include: {
        workflow: {
          select: { name: true, type: true },
        },
        contract: {
          select: { contractTitle: true, supplierName: true },
        },
        stepExecutions: {
          orderBy: { stepOrder: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      executions: executions.map((exec) => ({
        ...exec,
        progress: {
          completed: exec.stepExecutions.filter((s: { status: string }) => s.status === 'COMPLETED').length,
          total: exec.stepExecutions.length,
          currentStep: exec.stepExecutions.find((s: { status: string }) => s.status === 'PENDING')?.stepName || 'Complete',
        },
      })),
      total: executions.length,
      source: 'database',
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch executions' },
      { status: 500 }
    );
  }
}
