import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getApiTenantId } from '@/lib/tenant-server';
import { requiresApprovalWorkflow, getContractLifecycle } from '@/lib/contract-helpers';

export const dynamic = 'force-dynamic';

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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = getApiTenantId(request);
    
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      );
    }
    
    const contractId = params.id;

    // First verify contract exists
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: { id: true, contractTitle: true, fileName: true },
    });

    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
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
    let workflowData = null;
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

    return NextResponse.json({
      success: true,
      contract: {
        id: contract.id,
        title: contract.contractTitle || contract.fileName,
      },
      workflow: workflowData,
    });
  } catch (error) {
    console.error('Error fetching contract workflow:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch workflow' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = getApiTenantId(request);
    
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      );
    }
    
    const contractId = params.id;
    const body = await request.json();

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
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    // Only allow workflow execution for NEW contracts
    if (!requiresApprovalWorkflow(contract)) {
      const lifecycle = getContractLifecycle(contract);
      return NextResponse.json(
        { 
          success: false, 
          error: `Workflows are only applicable for new contracts or amendments. This appears to be an ${lifecycle.toLowerCase()} contract.`,
          lifecycle,
          hint: 'Set status=DRAFT or documentRole=NEW_CONTRACT to enable workflow',
        },
        { status: 400 }
      );
    }

    // Check if workflow execution already exists for this contract
    const existingExecution = await prisma.workflowExecution.findFirst({
      where: { contractId, tenantId },
    });

    if (existingExecution) {
      return NextResponse.json(
        { success: false, error: 'Workflow already exists for this contract. Use PUT to update.' },
        { status: 409 }
      );
    }

    // Create workflow
    const workflow = await prisma.workflow.create({
      data: {
        tenantId,
        name: body.name || `Workflow for ${contract.contractTitle || contract.fileName}`,
        description: body.description,
        type: body.type || 'APPROVAL',
        isActive: body.isActive ?? true,
        config: body.config || {},
        metadata: body.metadata || {},
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

    return NextResponse.json({
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
    console.error('Error creating contract workflow:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create workflow' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = getApiTenantId(request);
    
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      );
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

    return NextResponse.json({
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
    console.error('Error updating contract workflow:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update workflow' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = getApiTenantId(request);
    
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      );
    }
    
    const contractId = params.id;

    // Find existing workflow execution for this contract
    const existingExecution = await prisma.workflowExecution.findFirst({
      where: { contractId, tenantId },
      include: { workflow: true },
    });

    if (!existingExecution?.workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    // Delete the workflow (cascade will delete steps and executions)
    await prisma.workflow.delete({
      where: { id: existingExecution.workflow.id },
    });

    return NextResponse.json({
      success: true,
      message: 'Workflow deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting contract workflow:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete workflow' },
      { status: 500 }
    );
  }
}
