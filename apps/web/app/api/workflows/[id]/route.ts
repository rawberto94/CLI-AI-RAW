import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiTenantId } from '@/lib/tenant-server';

export const dynamic = 'force-dynamic';

// Mock workflow for fallback
const mockWorkflow = {
  id: '1',
  tenantId: 'demo',
  name: 'Contract Approval Workflow',
  description: 'Standard approval process for new contracts',
  type: 'APPROVAL',
  isActive: true,
  steps: [
    {
      id: 's1',
      name: 'Legal Review',
      order: 0,
      type: 'REVIEW',
      assignedRole: 'Legal Team',
      config: { dueDays: 3, requiresApproval: true, allowReject: true },
    },
    {
      id: 's2',
      name: 'Finance Approval',
      order: 1,
      type: 'APPROVAL',
      assignedRole: 'Finance Manager',
      config: { dueDays: 2, requiresApproval: true, allowReject: true, allowDelegate: true },
    },
  ],
  executions: 45,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-15'),
};

/**
 * GET /api/workflows/:id - Get specific workflow
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workflowId } = await params;
    const tenantId = await getApiTenantId(request);
    
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant ID is required' },
        { status: 400 }
      );
    }
    
    // Try database first
    try {
      const workflow = await prisma.workflow.findFirst({
        where: { id: workflowId, tenantId },
        include: {
          steps: {
            orderBy: { order: 'asc' },
          },
          _count: {
            select: { executions: true },
          },
        },
      });
      
      if (workflow) {
        return NextResponse.json({
          success: true,
          workflow: {
            ...workflow,
            executions: workflow._count.executions,
          },
          source: 'database',
        });
      }
    } catch (dbError) {
      console.warn('Database lookup failed:', dbError);
    }
    
    // Fallback to mock only if id matches and tenantId is demo
    if ((workflowId === '1' || workflowId === mockWorkflow.id) && tenantId === 'demo') {
      return NextResponse.json({
        success: true,
        workflow: mockWorkflow,
        source: 'mock',
      });
    }
    
    return NextResponse.json(
      { success: false, error: 'Workflow not found' },
      { status: 404 }
    );
  } catch (error) {
    console.error('Error fetching workflow:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch workflow',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/workflows/:id - Update workflow
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workflowId } = await params;
    const body = await request.json();
    const { name, description, type, steps, isActive, triggerType, config, metadata } = body;
    const tenantId = await getApiTenantId(request);
    
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant ID is required' },
        { status: 400 }
      );
    }
    
    // Try database first
    try {
      // Verify workflow belongs to tenant before updating
      const existingWorkflow = await prisma.workflow.findFirst({
        where: { id: workflowId, tenantId },
        select: { id: true },
      });
      
      if (!existingWorkflow) {
        return NextResponse.json(
          { success: false, error: 'Workflow not found' },
          { status: 404 }
        );
      }
      
      // First, delete existing steps
      await prisma.workflowStep.deleteMany({
        where: { workflowId: existingWorkflow.id },
      });
      
      // Update workflow with new steps
      const workflow = await prisma.workflow.update({
        where: { id: existingWorkflow.id },
        data: {
          name,
          description,
          type: type || 'APPROVAL',
          isActive: isActive !== false,
          config: config || {},
          metadata: { ...(metadata || {}), triggerType },
          updatedAt: new Date(),
          steps: {
            create: (steps || []).map((step: { name: string; description?: string; order?: number; stepType?: string; type?: string; assigneeType?: string; assigneeId?: string; dueDays?: number; dueHours?: number; requiresApproval?: boolean; allowReject?: boolean; allowDelegate?: boolean; config?: Record<string, unknown> }, index: number) => ({
              name: step.name,
              description: step.description,
              order: step.order ?? index,
              type: step.stepType || step.type || 'APPROVAL',
              assignedRole: step.assigneeType === 'ROLE' ? step.assigneeId : undefined,
              assignedUser: step.assigneeType === 'USER' ? step.assigneeId : undefined,
              config: {
                dueDays: step.dueDays,
                dueHours: step.dueHours,
                requiresApproval: step.requiresApproval,
                allowReject: step.allowReject,
                allowDelegate: step.allowDelegate,
                ...step.config,
              },
              isRequired: step.requiresApproval !== false,
              timeout: step.dueDays ? step.dueDays * 24 * 60 : undefined,
            })),
          },
        },
        include: {
          steps: {
            orderBy: { order: 'asc' },
          },
        },
      });
      
      return NextResponse.json({
        success: true,
        workflow,
        source: 'database',
        message: 'Workflow updated successfully',
      });
    } catch (dbError) {
      console.warn('Database update failed:', dbError);
    }
    
    // Fallback mock response
    return NextResponse.json({
      success: true,
      workflow: {
        ...mockWorkflow,
        ...body,
        updatedAt: new Date(),
      },
      source: 'mock',
      message: 'Workflow updated (mock)',
    });
  } catch (error) {
    console.error('Error updating workflow:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update workflow',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/workflows/:id - Partially update workflow (e.g., toggle active status)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workflowId } = await params;
    const body = await request.json();
    const tenantId = await getApiTenantId(request);
    
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant ID is required' },
        { status: 400 }
      );
    }
    
    // Try database first
    try {
      // Verify workflow belongs to tenant before updating
      const existingWorkflow = await prisma.workflow.findFirst({
        where: { id: workflowId, tenantId },
        select: { id: true },
      });
      
      if (!existingWorkflow) {
        return NextResponse.json(
          { success: false, error: 'Workflow not found' },
          { status: 404 }
        );
      }
      
      const workflow = await prisma.workflow.update({
        where: { id: existingWorkflow.id },
        data: {
          ...body,
          updatedAt: new Date(),
        },
        include: {
          steps: {
            orderBy: { order: 'asc' },
          },
        },
      });
      
      return NextResponse.json({
        success: true,
        workflow,
        source: 'database',
        message: 'Workflow updated successfully',
      });
    } catch (dbError) {
      console.warn('Database update failed:', dbError);
    }
    
    // Fallback mock response
    return NextResponse.json({
      success: true,
      workflow: {
        ...mockWorkflow,
        ...body,
        updatedAt: new Date(),
      },
      source: 'mock',
      message: 'Workflow updated (mock)',
    });
  } catch (error) {
    console.error('Error updating workflow:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update workflow',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/workflows/:id - Delete workflow
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workflowId } = await params;
    const tenantId = await getApiTenantId(request);
    
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant ID is required' },
        { status: 400 }
      );
    }
    
    // Try database first
    try {
      // Verify workflow belongs to tenant before deleting
      const existingWorkflow = await prisma.workflow.findFirst({
        where: { id: workflowId, tenantId },
        select: { id: true },
      });
      
      if (!existingWorkflow) {
        return NextResponse.json(
          { success: false, error: 'Workflow not found' },
          { status: 404 }
        );
      }
      
      // Delete steps first (cascade should handle this, but be explicit)
      await prisma.workflowStep.deleteMany({
        where: { workflowId: existingWorkflow.id },
      });
      
      await prisma.workflow.delete({
        where: { id: existingWorkflow.id },
      });
      
      return NextResponse.json({
        success: true,
        source: 'database',
        message: 'Workflow deleted successfully',
      });
    } catch (dbError) {
      console.warn('Database delete failed:', dbError);
    }
    
    // Fallback mock response
    return NextResponse.json({
      success: true,
      source: 'mock',
      message: 'Workflow deleted (mock)',
    });
  } catch (error) {
    console.error('Error deleting workflow:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to delete workflow',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
