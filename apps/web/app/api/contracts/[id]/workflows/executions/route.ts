import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@repo/db';

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
      { id: '1', name: 'Manager Review', assignedTo: 'John Doe', status: 'completed', completedAt: new Date(Date.now() - 1.5 * 24 * 60 * 60 * 1000).toISOString(), order: 1 },
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
  { params }: { params: { id: string } }
) {
  try {
    const contractId = params.id;
    const tenantId = request.headers.get('x-tenant-id') || 'demo';
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
        entityId: contractId,
        entityType: 'CONTRACT'
      },
      include: {
        workflow: {
          select: {
            name: true,
            description: true
          }
        },
        steps: {
          orderBy: { order: 'asc' },
          include: {
            assignedToUser: {
              select: { name: true, email: true }
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
      currentStep: exec.steps.find(s => s.status === 'IN_PROGRESS')?.name,
      initiatedBy: exec.initiatedBy || 'System',
      steps: exec.steps.map(step => ({
        id: step.id,
        name: step.name,
        assignedTo: step.assignedToUser?.name || step.assignedToRole || 'Unassigned',
        status: step.status.toLowerCase().replace('_', '_'),
        completedAt: step.completedAt?.toISOString(),
        comment: step.comment || undefined,
        order: step.order
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
  { params }: { params: { id: string } }
) {
  try {
    const contractId = params.id;
    const tenantId = request.headers.get('x-tenant-id') || 'demo';
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

    // Create workflow execution
    const execution = await db.workflowExecution.create({
      data: {
        tenantId,
        workflowId,
        entityType: 'CONTRACT',
        entityId: contractId,
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        initiatedBy: initiatedBy || 'System',
        steps: {
          create: workflow.steps.map((step, index) => ({
            tenantId,
            name: step.name,
            description: step.description,
            type: step.type,
            order: step.order,
            status: index === 0 ? 'IN_PROGRESS' : 'PENDING',
            assignedToRole: step.assignedToRole,
            assignedToUserId: step.assignedToUserId,
            dueDate: step.dueDays 
              ? new Date(Date.now() + step.dueDays * 24 * 60 * 60 * 1000)
              : undefined,
            config: step.config
          }))
        }
      },
      include: {
        workflow: true,
        steps: {
          orderBy: { order: 'asc' }
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
