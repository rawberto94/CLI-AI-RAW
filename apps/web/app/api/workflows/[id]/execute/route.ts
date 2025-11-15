import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@repo/db';

export const dynamic = 'force-dynamic';

/**
 * POST /api/workflows/:id/execute
 * Execute a workflow for a specific contract
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const workflowId = params.id;
    const body = await request.json();
    const { contractId, initiatedBy, metadata } = body;

    if (!contractId) {
      return NextResponse.json(
        { success: false, error: 'Contract ID is required' },
        { status: 400 }
      );
    }

    const db = await getDb();

    // Get workflow details
    const workflow = await db.workflow.findUnique({
      where: { id: workflowId },
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

    // Create workflow execution
    const execution = await db.workflowExecution.create({
      data: {
        workflowId,
        contractId,
        status: 'IN_PROGRESS',
        currentStep: workflow.steps[0]?.id,
        initiatedBy: initiatedBy || 'system',
        metadata: metadata || {},
        startedAt: new Date(),
      }
    });

    // Create first step execution
    if (workflow.steps.length > 0) {
      const firstStep = workflow.steps[0];
      
      await db.workflowStepExecution.create({
        data: {
          executionId: execution.id,
          stepId: firstStep.id,
          status: 'PENDING',
          assignedTo: firstStep.assignedRole || firstStep.assignedUser,
          startedAt: new Date(),
        }
      });

      // Send notification to assigned user/role
      console.log(`Workflow started: ${workflow.name} for contract ${contractId}`);
      console.log(`Assigned to: ${firstStep.assignedRole || firstStep.assignedUser}`);
    }

    return NextResponse.json({
      success: true,
      data: {
        executionId: execution.id,
        workflowId: workflow.id,
        workflowName: workflow.name,
        status: execution.status,
        currentStep: workflow.steps[0]?.name,
        message: 'Workflow execution started successfully'
      }
    });

  } catch (error) {
    console.error('Error executing workflow:', error);
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
