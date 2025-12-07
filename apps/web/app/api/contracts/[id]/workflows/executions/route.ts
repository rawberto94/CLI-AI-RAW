import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/prisma';
import { getApiTenantId } from '@/lib/tenant-server';

export const dynamic = 'force-dynamic';

// Mock workflow executions for demonstration
const getMockExecutions = () => [
  {
    id: '1',
    workflowName: 'Contract Approval',
    status: 'in_progress',
    startedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    currentStep: 'Legal Review',
    initiatedBy: 'Sarah Chen',
    steps: [
      { id: '1', name: 'Manager Review', assignedTo: 'Roberto Ostojic', status: 'completed', completedAt: new Date(Date.now() - 1.5 * 24 * 60 * 60 * 1000).toISOString(), order: 1 },
      { id: '2', name: 'Legal Review', assignedTo: 'Legal Team', status: 'in_progress', order: 2 },
      { id: '3', name: 'Finance Approval', assignedTo: 'Finance Team', status: 'pending', order: 3 }
    ]
  },
  {
    id: '2',
    workflowName: 'Contract Renewal',
    status: 'completed',
    startedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
    initiatedBy: 'System',
    steps: [
      { id: '4', name: 'Client Notification', assignedTo: 'Account Manager', status: 'completed', completedAt: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString(), order: 1 },
      { id: '5', name: 'Terms Update', assignedTo: 'Contract Manager', status: 'completed', completedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(), order: 2 }
    ]
  }
];

/**
 * GET /api/contracts/:id/workflows/executions
 * Get all workflow executions for a contract
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: contractId } = await params;
    const tenantId = await getApiTenantId(request);
    const useMock = request.nextUrl.searchParams.get('mock') === 'true';

    if (useMock) {
      return NextResponse.json({
        success: true,
        executions: getMockExecutions(),
        source: 'mock'
      });
    }

    try {
      const db = await getDb();

    // Check if contract exists
    const contract = await db.contract.findUnique({
      where: { id: contractId, tenantId },
      select: { id: true }
    });

    if (!contract) {
      return NextResponse.json(
        { success: false, error: 'Contract not found' },
        { status: 404 }
      );
    }

    // Get workflow executions for this contract
    const executions = await db.workflowExecution.findMany({
      where: {
        contractId,
        tenantId
      },
      include: {
        workflow: {
          select: {
            name: true,
            description: true
          }
        },
        stepExecutions: {
          orderBy: { stepOrder: 'asc' },
          include: {
            step: {
              select: { name: true, order: true, assignedRole: true }
            }
          }
        }
      },
      orderBy: { startedAt: 'desc' }
    });

    // Transform executions
    const transformedExecutions = executions.map(exec => ({
      id: exec.id,
      workflowName: exec.workflow.name,
      status: exec.status.toLowerCase(),
      startedAt: exec.startedAt.toISOString(),
      completedAt: exec.completedAt?.toISOString(),
      currentStep: exec.stepExecutions.find((s: { status: string }) => s.status === 'IN_PROGRESS')?.step?.name,
      initiatedBy: exec.initiatedBy || 'System',
      steps: exec.stepExecutions.map((stepExec: { id: string; step?: { name?: string; order?: number; assignedRole?: string | null } | null; assignedTo?: string | null; status: string; completedAt?: Date | null }) => ({
        id: stepExec.id,
        name: stepExec.step?.name || 'Unknown',
        assignedTo: stepExec.assignedTo || stepExec.step?.assignedRole || 'Unassigned',
        status: stepExec.status.toLowerCase().replace('_', '_'),
        completedAt: stepExec.completedAt?.toISOString(),
        order: stepExec.step?.order || 0
      }))
    }));

      return NextResponse.json({
        success: true,
        executions: transformedExecutions,
        source: 'database'
      });

    } catch (dbError) {
      console.warn('Database query failed, using mock data:', dbError);
      return NextResponse.json({
        success: true,
        executions: getMockExecutions(),
        source: 'mock-fallback'
      });
    }

  } catch (error) {
    console.error('Error fetching workflow executions:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch workflow executions',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/contracts/:id/workflows/executions
 * Start a new workflow execution for a contract
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: contractId } = await params;
    const tenantId = await getApiTenantId(request);
    const body = await request.json();
    const { workflowId, initiatedBy } = body;

    if (!workflowId) {
      return NextResponse.json(
        { success: false, error: 'Workflow ID is required' },
        { status: 400 }
      );
    }

    const db = await getDb();

    // Check if contract exists
    const contract = await db.contract.findUnique({
      where: { id: contractId, tenantId },
      select: { id: true }
    });

    if (!contract) {
      return NextResponse.json(
        { success: false, error: 'Contract not found' },
        { status: 404 }
      );
    }

    // Get workflow template
    const workflow = await db.workflow.findUnique({
      where: { id: workflowId },
      include: {
        steps: {
          orderBy: { order: 'asc' }
        }
      }
    });

    if (!workflow || workflow.tenantId !== tenantId) {
      return NextResponse.json(
        { success: false, error: 'Workflow not found' },
        { status: 404 }
      );
    }

    // Create workflow execution
    const execution = await db.workflowExecution.create({
      data: {
        tenantId,
        workflowId,
        contractId,
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        initiatedBy: initiatedBy || 'System',
        stepExecutions: {
          create: workflow.steps.map((step, index) => ({
            stepId: step.id,
            stepOrder: index,
            stepName: step.name,
            status: index === 0 ? 'IN_PROGRESS' : 'PENDING',
            assignedTo: step.assignedUser || step.assignedRole || undefined,
            startedAt: index === 0 ? new Date() : undefined
          }))
        }
      },
      include: {
        workflow: true,
        stepExecutions: {
          orderBy: { stepOrder: 'asc' }
        }
      }
    });

    return NextResponse.json({
      success: true,
      execution: {
        id: execution.id,
        workflowName: execution.workflow.name,
        status: execution.status.toLowerCase(),
        startedAt: execution.startedAt.toISOString(),
        message: 'Workflow started successfully'
      }
    });

  } catch (error) {
    console.error('Error starting workflow execution:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to start workflow execution',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
