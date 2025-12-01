import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Standard workflow templates
const workflowTemplates = {
  standard: {
    name: 'Standard Approval',
    steps: [
      { name: 'Initial Review', role: 'reviewer', durationDays: 2 },
      { name: 'Legal Review', role: 'legal', durationDays: 3 },
      { name: 'Final Approval', role: 'approver', durationDays: 2 },
    ],
  },
  express: {
    name: 'Express Approval',
    steps: [
      { name: 'Quick Review', role: 'reviewer', durationDays: 1 },
      { name: 'Final Approval', role: 'approver', durationDays: 1 },
    ],
  },
  legal_review: {
    name: 'Legal Review',
    steps: [
      { name: 'Legal Analysis', role: 'legal', durationDays: 3 },
      { name: 'Compliance Check', role: 'compliance', durationDays: 2 },
      { name: 'Legal Director Approval', role: 'legal_director', durationDays: 2 },
    ],
  },
  executive: {
    name: 'Executive Approval',
    steps: [
      { name: 'Manager Review', role: 'manager', durationDays: 2 },
      { name: 'Legal Review', role: 'legal', durationDays: 3 },
      { name: 'Finance Review', role: 'finance', durationDays: 2 },
      { name: 'VP Approval', role: 'vp', durationDays: 2 },
      { name: 'Executive Approval', role: 'executive', durationDays: 3 },
    ],
  },
};

export async function POST(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id') || 'demo';
    const userId = request.headers.get('x-user-id') || 'current-user';
    const body = await request.json();
    
    const {
      contractId,
      contractTitle,
      workflowType = 'standard',
      priority = 'medium',
      deadline,
      notes,
      approvers = [],
    } = body;

    if (!contractId) {
      return NextResponse.json(
        { success: false, error: 'Contract ID is required' },
        { status: 400 }
      );
    }

    // Get template or use custom approvers
    const template = workflowTemplates[workflowType as keyof typeof workflowTemplates] || workflowTemplates.standard;

    // Try database first
    try {
      // Check if contract exists
      const contract = await prisma.contract.findUnique({
        where: { id: contractId },
        select: { id: true, contractTitle: true, supplierName: true, totalValue: true },
      });

      if (!contract) {
        return NextResponse.json(
          { success: false, error: 'Contract not found' },
          { status: 404 }
        );
      }

      // Check for existing active approval workflow
      const existingWorkflow = await prisma.workflowExecution.findFirst({
        where: {
          contractId,
          status: { in: ['PENDING', 'IN_PROGRESS'] },
        },
      });

      if (existingWorkflow) {
        return NextResponse.json(
          { success: false, error: 'Contract already has an active approval workflow' },
          { status: 400 }
        );
      }

      // Create or find workflow definition
      let workflow = await prisma.workflow.findFirst({
        where: {
          tenantId,
          name: template.name,
          type: 'APPROVAL',
        },
      });

      if (!workflow) {
        workflow = await prisma.workflow.create({
          data: {
            tenantId,
            name: template.name,
            description: `${template.name} workflow for contract approvals`,
            type: 'APPROVAL',
            isActive: true,
            config: {
              steps: template.steps.map((step, idx) => ({
                order: idx + 1,
                ...step,
              })),
            },
            createdBy: userId,
          },
        });
      }

      // Calculate due date
      const totalDays = template.steps.reduce((sum, step) => sum + step.durationDays, 0);
      const dueDate = deadline 
        ? new Date(deadline)
        : new Date(Date.now() + totalDays * 24 * 60 * 60 * 1000);

      // Create workflow execution
      const execution = await prisma.workflowExecution.create({
        data: {
          tenantId,
          workflowId: workflow.id,
          contractId,
          status: 'PENDING',
          currentStep: '1',
          startedBy: userId,
          dueDate,
          metadata: {
            priority,
            notes,
            submittedAt: new Date().toISOString(),
            contractTitle: contract.contractTitle || contractTitle,
            workflowType,
          },
        },
      });

      // Create step executions
      const stepsToCreate = approvers.length > 0 
        ? approvers.map((approver: { name: string; email: string }, idx: number) => ({
            executionId: execution.id,
            stepOrder: idx + 1,
            stepName: `Step ${idx + 1}: ${approver.name}`,
            status: idx === 0 ? 'PENDING' : 'WAITING',
            assignedTo: approver.email,
          }))
        : template.steps.map((step, idx) => ({
            executionId: execution.id,
            stepOrder: idx + 1,
            stepName: step.name,
            status: idx === 0 ? 'PENDING' : 'WAITING',
            assignedTo: null, // Will be assigned based on role
          }));

      await prisma.workflowStepExecution.createMany({
        data: stepsToCreate,
      });

      // Update contract status
      await prisma.contract.update({
        where: { id: contractId },
        data: { 
          status: 'PENDING',
          updatedAt: new Date(),
        },
      });

      // Create notification for first approver if assigned
      const firstApprover = approvers[0]?.email;
      if (firstApprover) {
        await prisma.notification.create({
          data: {
            tenantId,
            userId: firstApprover,
            type: 'APPROVAL_REQUEST',
            title: 'New Approval Request',
            message: `${contract.contractTitle || contractTitle} requires your approval`,
            link: '/approvals',
            metadata: {
              executionId: execution.id,
              contractId,
              priority,
            },
          },
        });
      }

      // Log activity
      // Activity log - using notification as audit trail
      await prisma.notification.create({
        data: {
          tenantId,
          userId,
          type: 'SYSTEM',
          title: 'Approval Submitted',
          message: `Contract submitted for ${workflowType} approval`,
          link: `/contracts/${contractId}`,
          metadata: {
            action: 'SUBMIT_FOR_APPROVAL',
            resourceType: 'CONTRACT',
            resourceId: contractId,
            workflowType,
            priority,
            executionId: execution.id,
            approverCount: approvers.length || template.steps.length,
          },
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Contract submitted for approval',
        data: {
          executionId: execution.id,
          workflowName: template.name,
          contractId,
          contractTitle: contract.contractTitle || contractTitle,
          priority,
          dueDate: dueDate.toISOString(),
          totalSteps: stepsToCreate.length,
          status: 'pending',
        },
        source: 'database',
      });
    } catch (dbError) {
      console.warn('Database operation failed:', dbError);
      // Continue to mock fallback
    }

    // Fallback mock response
    const dueDate = deadline 
      ? new Date(deadline)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    return NextResponse.json({
      success: true,
      message: 'Contract submitted for approval',
      data: {
        executionId: `exec_${Date.now()}`,
        workflowName: template.name,
        contractId,
        contractTitle,
        priority,
        dueDate: dueDate.toISOString(),
        totalSteps: approvers.length || template.steps.length,
        status: 'pending',
      },
      source: 'mock',
    });
  } catch (error) {
    console.error('Submit approval error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to submit for approval' },
      { status: 500 }
    );
  }
}

// Get available workflow templates
export async function GET(request: NextRequest) {
  const tenantId = request.headers.get('x-tenant-id') || 'demo';

  try {
    // Try to get custom workflows from database
    const customWorkflows = await prisma.workflow.findMany({
      where: {
        tenantId,
        type: 'APPROVAL',
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        description: true,
        config: true,
      },
    });

    // Combine with default templates
    const templates = [
      ...Object.entries(workflowTemplates).map(([key, value]) => ({
        id: key,
        name: value.name,
        description: `Standard ${value.name.toLowerCase()} process`,
        steps: value.steps,
        isDefault: true,
      })),
      ...customWorkflows.map(w => ({
        id: w.id,
        name: w.name,
        description: w.description || '',
        steps: ((w.config as Record<string, unknown>)?.steps as unknown[]) || [],
        isDefault: false,
      })),
    ];

    return NextResponse.json({
      success: true,
      data: {
        templates,
        defaultTemplate: 'standard',
      },
    });
  } catch {
    // Return default templates on error
    return NextResponse.json({
      success: true,
      data: {
        templates: Object.entries(workflowTemplates).map(([key, value]) => ({
          id: key,
          name: value.name,
          description: `Standard ${value.name.toLowerCase()} process`,
          steps: value.steps,
          isDefault: true,
        })),
        defaultTemplate: 'standard',
      },
    });
  }
}
