import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Mock data store (in production, this would use Prisma/database)
const mockWorkflows: any[] = [
  {
    id: '1',
    tenantId: 'demo',
    name: 'Contract Approval Workflow',
    description: 'Standard approval process for new contracts',
    type: 'CONTRACT_APPROVAL',
    triggerType: 'MANUAL',
    isActive: true,
    steps: [
      {
        id: 's1',
        name: 'Legal Review',
        order: 0,
        stepType: 'REVIEW',
        assigneeType: 'ROLE',
        assigneeName: 'Legal Team',
        dueDays: 3,
        requiresApproval: true,
        allowReject: true,
        allowDelegate: false,
      },
      {
        id: 's2',
        name: 'Finance Approval',
        order: 1,
        stepType: 'APPROVAL',
        assigneeType: 'ROLE',
        assigneeName: 'Finance Manager',
        dueDays: 2,
        requiresApproval: true,
        allowReject: true,
        allowDelegate: true,
      },
      {
        id: 's3',
        name: 'Executive Sign-off',
        order: 2,
        stepType: 'APPROVAL',
        assigneeType: 'USER',
        assigneeName: 'CEO',
        dueDays: 1,
        requiresApproval: true,
        allowReject: true,
        allowDelegate: false,
      },
    ],
    executions: 45,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-15'),
  },
  {
    id: '2',
    tenantId: 'demo',
    name: 'High-Value Contract Review',
    description: 'Enhanced review process for contracts over $100K',
    type: 'CONTRACT_REVIEW',
    triggerType: 'ON_VALUE_THRESHOLD',
    isActive: true,
    steps: [
      {
        id: 's1',
        name: 'Risk Assessment',
        order: 0,
        stepType: 'REVIEW',
        assigneeType: 'ROLE',
        assigneeName: 'Risk Team',
        dueDays: 2,
        requiresApproval: true,
        allowReject: true,
        allowDelegate: false,
      },
      {
        id: 's2',
        name: 'Compliance Check',
        order: 1,
        stepType: 'REVIEW',
        assigneeType: 'ROLE',
        assigneeName: 'Compliance Officer',
        dueDays: 2,
        requiresApproval: true,
        allowReject: true,
        allowDelegate: false,
      },
      {
        id: 's3',
        name: 'Final Approval',
        order: 2,
        stepType: 'APPROVAL',
        assigneeType: 'ROLE',
        assigneeName: 'Senior Management',
        dueDays: 3,
        requiresApproval: true,
        allowReject: true,
        allowDelegate: true,
      },
    ],
    executions: 12,
    createdAt: new Date('2025-01-10'),
    updatedAt: new Date('2025-01-14'),
  },
];

/**
 * GET /api/workflows - List all workflows
 */
export async function GET(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id') || 'demo';
    
    // Filter workflows by tenant
    const workflows = mockWorkflows.filter(w => w.tenantId === tenantId);
    
    return NextResponse.json({
      success: true,
      workflows,
      total: workflows.length,
    });
  } catch (error) {
    console.error('Error fetching workflows:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch workflows',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workflows - Create new workflow
 */
export async function POST(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id') || 'demo';
    const body = await request.json();
    
    const newWorkflow = {
      id: Date.now().toString(),
      tenantId,
      ...body,
      executions: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    mockWorkflows.push(newWorkflow);
    
    return NextResponse.json({
      success: true,
      workflow: newWorkflow,
      message: 'Workflow created successfully',
    });
  } catch (error) {
    console.error('Error creating workflow:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create workflow',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
