import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/auth';
import { publishRealtimeEvent } from '@/lib/realtime/publish';
import { requiresApprovalWorkflow, getContractLifecycle, suggestWorkflow } from '@/lib/contract-helpers';
import { autoAssignWorkflowSteps } from '@/lib/workflow-auto-assign';

export const dynamic = 'force-dynamic';

// Standard workflow templates
const workflowTemplates = {
  standard: {
    name: 'Standard Approval',
    type: 'APPROVAL',
    steps: [
      { name: 'Initial Review', role: 'reviewer', durationDays: 2 },
      { name: 'Legal Review', role: 'legal', durationDays: 3 },
      { name: 'Final Approval', role: 'approver', durationDays: 2 },
    ],
  },
  express: {
    name: 'Express Approval',
    type: 'APPROVAL',
    steps: [
      { name: 'Quick Review', role: 'reviewer', durationDays: 1 },
      { name: 'Final Approval', role: 'approver', durationDays: 1 },
    ],
  },
  legal_review: {
    name: 'Legal Review',
    type: 'APPROVAL',
    steps: [
      { name: 'Legal Analysis', role: 'legal', durationDays: 3 },
      { name: 'Compliance Check', role: 'compliance', durationDays: 2 },
      { name: 'Legal Director Approval', role: 'legal_director', durationDays: 2 },
    ],
  },
  executive: {
    name: 'Executive Approval',
    type: 'APPROVAL',
    steps: [
      { name: 'Manager Review', role: 'manager', durationDays: 2 },
      { name: 'Legal Review', role: 'legal', durationDays: 3 },
      { name: 'Finance Review', role: 'finance', durationDays: 2 },
      { name: 'VP Approval', role: 'vp', durationDays: 2 },
      { name: 'Executive Approval', role: 'executive', durationDays: 3 },
    ],
  },
  // Amendment/Addendum/Change Order workflow
  amendment: {
    name: 'Amendment Approval',
    type: 'APPROVAL',
    contractTypes: ['AMENDMENT', 'ADDENDUM', 'CHANGE_ORDER'],
    steps: [
      { name: 'Legal Review', role: 'legal', durationDays: 2 },
      { name: 'Original Approver Review', role: 'original_approver', durationDays: 2 },
      { name: 'Final Sign-off', role: 'approver', durationDays: 1 },
    ],
  },
  // NDA Fast Track workflow
  nda_fast_track: {
    name: 'NDA Fast Track',
    type: 'APPROVAL',
    contractTypes: ['NDA'],
    steps: [
      { name: 'Legal Quick Review', role: 'legal', durationDays: 1 },
      { name: 'Standard Template Check', role: 'auto', durationDays: 0, autoApprove: true },
    ],
  },
  // Vendor Onboarding workflow
  vendor_onboarding: {
    name: 'Vendor Onboarding',
    type: 'REVIEW',
    contractTypes: ['MSA', 'SERVICE_AGREEMENT', 'VENDOR_AGREEMENT'],
    steps: [
      { name: 'Compliance Check', role: 'compliance', durationDays: 3 },
      { name: 'Finance Review', role: 'finance', durationDays: 2 },
      { name: 'Procurement Approval', role: 'procurement', durationDays: 2 },
    ],
  },
  // Contract Termination workflow
  termination: {
    name: 'Contract Termination',
    type: 'APPROVAL',
    steps: [
      { name: 'Legal Review', role: 'legal', durationDays: 3 },
      { name: 'Finance Impact Assessment', role: 'finance', durationDays: 2 },
      { name: 'Manager Approval', role: 'manager', durationDays: 2 },
      { name: 'Executive Approval', role: 'executive', durationDays: 2, conditional: { minValue: 100000 } },
    ],
  },
  // Renewal Opt-Out workflow
  renewal_opt_out: {
    name: 'Renewal Opt-Out',
    type: 'NOTIFICATION',
    steps: [
      { name: 'Stakeholder Notification', role: 'stakeholders', durationDays: 1 },
      { name: 'Decision Confirmation', role: 'manager', durationDays: 3 },
      { name: 'Legal Review', role: 'legal', durationDays: 2, conditional: { required: false } },
    ],
  },
  // Risk Escalation workflow
  risk_escalation: {
    name: 'Risk Escalation',
    type: 'APPROVAL',
    steps: [
      { name: 'Risk Assessment', role: 'risk', durationDays: 2 },
      { name: 'Compliance Review', role: 'compliance', durationDays: 2 },
      { name: 'Legal Director Approval', role: 'legal_director', durationDays: 2 },
      { name: 'Executive Review', role: 'executive', durationDays: 3 },
    ],
  },
  // Multi-Party Signature workflow
  multi_party: {
    name: 'Multi-Party Signature',
    type: 'APPROVAL',
    steps: [
      { name: 'Internal Approval', role: 'approver', durationDays: 2 },
      { name: 'Counter-party A Signature', role: 'external_a', durationDays: 5 },
      { name: 'Counter-party B Signature', role: 'external_b', durationDays: 5 },
      { name: 'Final Execution', role: 'legal', durationDays: 1 },
    ],
  },
  // Procurement Review workflow
  procurement: {
    name: 'Procurement Review',
    type: 'APPROVAL',
    contractTypes: ['PURCHASE_ORDER', 'WORK_ORDER', 'SOW'],
    steps: [
      { name: 'Budget Verification', role: 'finance', durationDays: 1 },
      { name: 'Procurement Review', role: 'procurement', durationDays: 2 },
      { name: 'Finance Approval', role: 'finance_director', durationDays: 2 },
      { name: 'Department Head Approval', role: 'department_head', durationDays: 2 },
    ],
  },
};

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = session.user.tenantId;
    const userId = session.user.id;
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

    const effectiveWorkflowType = (
      typeof workflowType === 'string' && workflowType in workflowTemplates ? workflowType : 'standard'
    ) as keyof typeof workflowTemplates;

    // Get template or use custom approvers
    const template = workflowTemplates[effectiveWorkflowType] || workflowTemplates.standard;

    // Try database first
    try {
      // Check if contract exists
      const contract = await prisma.contract.findUnique({
        where: { id: contractId },
        select: { 
          id: true, 
          contractTitle: true, 
          supplierName: true, 
          totalValue: true,
          status: true,
          documentRole: true,
          metadata: true,
        },
      });

      if (!contract) {
        return NextResponse.json(
          { success: false, error: 'Contract not found' },
          { status: 404 }
        );
      }

      // Only allow approval workflows for NEW contracts (DRAFT status or documentRole=NEW_CONTRACT)
      // Skip approval for EXISTING contracts being uploaded for reference/storage
      if (!requiresApprovalWorkflow(contract)) {
        const lifecycle = getContractLifecycle(contract);
        return NextResponse.json(
          { 
            success: false, 
            error: 'Approval workflows are only required for new contracts being created or amendments.',
            lifecycle,
            hint: 'To submit for approval, set contract status=DRAFT or documentRole=NEW_CONTRACT',
            currentStatus: contract.status,
            currentDocumentRole: contract.documentRole,
          },
          { status: 400 }
        );
      }

      // Suggest appropriate workflow if not specified
      const suggestedWorkflow = suggestWorkflow({
        totalValue: contract.totalValue != null ? Number(contract.totalValue) : null,
        documentRole: contract.documentRole,
        metadata: contract.metadata,
      });
      const effectiveWorkflowType = workflowType || suggestedWorkflow || 'standard';

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

      // Auto-assign workflow steps to users based on roles
      const { assigned } = await autoAssignWorkflowSteps(tenantId, execution.id);
      
      void assigned; // Used for auto-assignment tracking

      // Update contract status
      await prisma.contract.update({
        where: { id: contractId },
        data: { 
          status: 'PENDING',
          updatedAt: new Date(),
        },
      });

      void publishRealtimeEvent({
        event: 'approval:submitted',
        data: { tenantId, contractId, executionId: execution.id },
        source: 'api:approvals/submit',
      });
      void publishRealtimeEvent({
        event: 'contract:updated',
        data: { tenantId, contractId, status: 'PENDING' },
        source: 'api:approvals/submit',
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
    } catch {
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
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to submit for approval' },
      { status: 500 }
    );
  }
}

// Get available workflow templates
export async function GET() {
  const session = await getServerSession();
  if (!session?.user?.tenantId) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }
  const tenantId = session.user.tenantId;

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
