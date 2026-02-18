/**
 * Workflow Management Service
 * 
 * Comprehensive workflow management for:
 * - Creating and configuring approval workflows
 * - Starting workflow executions on contracts
 * - Processing step approvals/rejections
 * - Tracking workflow progress
 * - Auto-escalation and reminders
 * - Integration with autonomous agent orchestrator
 * 
 * @version 1.0.0
 */

import { prisma } from '../lib/prisma';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';


// ============================================================================
// TYPES
// ============================================================================

export type WorkflowType = 'APPROVAL' | 'REVIEW' | 'NOTIFICATION' | 'CUSTOM';
export type WorkflowStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type StepStatus = 'PENDING' | 'WAITING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'SKIPPED' | 'REJECTED';

export interface WorkflowDefinition {
  id?: string;
  tenantId: string;
  name: string;
  description?: string;
  type: WorkflowType;
  isDefault?: boolean;
  steps: WorkflowStepDefinition[];
  config?: WorkflowConfig;
  metadata?: Record<string, unknown>;
}

export interface WorkflowStepDefinition {
  name: string;
  description?: string;
  type: WorkflowType;
  order: number;
  assignedRole?: string;
  assignedUser?: string;
  isRequired: boolean;
  timeoutHours?: number;
  config?: StepConfig;
  conditions?: StepCondition[];
}

export interface WorkflowConfig {
  parallelExecution?: boolean;
  autoEscalate?: boolean;
  escalationHours?: number;
  reminderHours?: number;
  allowSkip?: boolean;
  requireAllApprovals?: boolean;
}

export interface StepConfig {
  approvalType?: 'any' | 'all' | 'majority';
  minApprovers?: number;
  allowDelegation?: boolean;
  requireComment?: boolean;
  autoApproveConditions?: StepCondition[];
}

export interface StepCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'in';
  value: unknown;
  description?: string;
}

export interface WorkflowExecutionRequest {
  workflowId: string;
  contractId: string;
  tenantId: string;
  initiatedBy: string;
  dueDate?: Date;
  metadata?: Record<string, unknown>;
}

export interface StepActionRequest {
  executionId: string;
  stepId: string;
  action: 'approve' | 'reject' | 'skip' | 'delegate' | 'request_changes';
  userId: string;
  comment?: string;
  delegateTo?: string;
  metadata?: Record<string, unknown>;
}

export interface WorkflowProgress {
  executionId: string;
  workflowName: string;
  status: WorkflowStatus;
  currentStep: number;
  totalSteps: number;
  percentComplete: number;
  steps: StepProgress[];
  startedAt: Date;
  estimatedCompletion?: Date;
  blockedBy?: string;
}

export interface StepProgress {
  stepId: string;
  name: string;
  order: number;
  status: StepStatus;
  assignedTo?: string;
  completedBy?: string;
  completedAt?: Date;
  comment?: string;
  isOverdue: boolean;
  dueDate?: Date;
}

export interface WorkflowEvent {
  type: 'execution_started' | 'step_completed' | 'step_rejected' | 'workflow_completed' | 
        'workflow_failed' | 'escalation_needed' | 'reminder_sent' | 'overdue';
  executionId: string;
  workflowId: string;
  contractId: string;
  tenantId: string;
  stepId?: string;
  userId?: string;
  data?: Record<string, unknown>;
  timestamp: Date;
}

// ============================================================================
// WORKFLOW TEMPLATES - Pre-built workflows for different scenarios
// ============================================================================

export const WORKFLOW_TEMPLATES = {
  // Standard approval workflow
  standard: {
    name: 'Standard Approval',
    type: 'APPROVAL' as WorkflowType,
    description: 'Standard multi-step approval for general contracts',
    contractTypes: ['*'], // All types
    steps: [
      { name: 'Initial Review', role: 'reviewer', timeoutHours: 48, order: 0 },
      { name: 'Legal Review', role: 'legal', timeoutHours: 72, order: 1 },
      { name: 'Final Approval', role: 'approver', timeoutHours: 48, order: 2 },
    ],
  },
  // Express approval for low-risk contracts
  express: {
    name: 'Express Approval',
    type: 'APPROVAL' as WorkflowType,
    description: 'Fast-track approval for low-value, low-risk contracts',
    contractTypes: ['*'],
    maxValue: 25000,
    steps: [
      { name: 'Quick Review', role: 'reviewer', timeoutHours: 24, order: 0 },
      { name: 'Final Approval', role: 'approver', timeoutHours: 24, order: 1 },
    ],
  },
  // Legal-focused review
  legal_review: {
    name: 'Legal Review',
    type: 'APPROVAL' as WorkflowType,
    description: 'In-depth legal review for complex contracts',
    contractTypes: ['MSA', 'SERVICE_AGREEMENT'],
    steps: [
      { name: 'Legal Analysis', role: 'legal', timeoutHours: 72, order: 0 },
      { name: 'Compliance Check', role: 'compliance', timeoutHours: 48, order: 1 },
      { name: 'Legal Director Approval', role: 'legal_director', timeoutHours: 48, order: 2 },
    ],
  },
  // Executive approval for high-value contracts
  executive: {
    name: 'Executive Approval',
    type: 'APPROVAL' as WorkflowType,
    description: 'Full approval chain for high-value contracts',
    contractTypes: ['*'],
    minValue: 100000,
    steps: [
      { name: 'Manager Review', role: 'manager', timeoutHours: 48, order: 0 },
      { name: 'Legal Review', role: 'legal', timeoutHours: 72, order: 1 },
      { name: 'Finance Review', role: 'finance', timeoutHours: 48, order: 2 },
      { name: 'VP Approval', role: 'vp', timeoutHours: 48, order: 3 },
      { name: 'Executive Approval', role: 'executive', timeoutHours: 72, order: 4 },
    ],
  },
  // Amendment/Addendum/Change Order
  amendment: {
    name: 'Amendment Approval',
    type: 'APPROVAL' as WorkflowType,
    description: 'Approval for contract amendments, addendums, and change orders',
    contractTypes: ['AMENDMENT', 'ADDENDUM', 'CHANGE_ORDER'],
    steps: [
      { name: 'Legal Review', role: 'legal', timeoutHours: 48, order: 0 },
      { name: 'Original Approver Review', role: 'original_approver', timeoutHours: 48, order: 1 },
      { name: 'Final Sign-off', role: 'approver', timeoutHours: 24, order: 2 },
    ],
  },
  // NDA Fast Track
  nda_fast_track: {
    name: 'NDA Fast Track',
    type: 'APPROVAL' as WorkflowType,
    description: 'Expedited approval for standard NDAs',
    contractTypes: ['NDA'],
    steps: [
      { name: 'Legal Quick Review', role: 'legal', timeoutHours: 24, order: 0 },
      { name: 'Auto-Approval Check', role: 'auto', timeoutHours: 1, order: 1, autoApprove: true },
    ],
  },
  // Vendor Onboarding
  vendor_onboarding: {
    name: 'Vendor Onboarding',
    type: 'REVIEW' as WorkflowType,
    description: 'Comprehensive vendor vetting and onboarding process',
    contractTypes: ['MSA', 'SERVICE_AGREEMENT', 'VENDOR_AGREEMENT'],
    steps: [
      { name: 'Compliance Check', role: 'compliance', timeoutHours: 72, order: 0 },
      { name: 'Finance Review', role: 'finance', timeoutHours: 48, order: 1 },
      { name: 'Procurement Approval', role: 'procurement', timeoutHours: 48, order: 2 },
    ],
  },
  // Contract Termination
  termination: {
    name: 'Contract Termination',
    type: 'APPROVAL' as WorkflowType,
    description: 'Approval process for early contract termination',
    contractTypes: ['*'],
    steps: [
      { name: 'Legal Review', role: 'legal', timeoutHours: 72, order: 0 },
      { name: 'Finance Impact Assessment', role: 'finance', timeoutHours: 48, order: 1 },
      { name: 'Manager Approval', role: 'manager', timeoutHours: 48, order: 2 },
      { name: 'Executive Approval', role: 'executive', timeoutHours: 48, order: 3, conditional: { minValue: 100000 } },
    ],
  },
  // Renewal Opt-Out
  renewal_opt_out: {
    name: 'Renewal Opt-Out',
    type: 'NOTIFICATION' as WorkflowType,
    description: 'Notification and confirmation for auto-renewal cancellation',
    contractTypes: ['*'],
    steps: [
      { name: 'Stakeholder Notification', role: 'stakeholders', timeoutHours: 24, order: 0 },
      { name: 'Decision Confirmation', role: 'manager', timeoutHours: 72, order: 1 },
      { name: 'Legal Review', role: 'legal', timeoutHours: 48, order: 2, isRequired: false },
    ],
  },
  // Risk Escalation
  risk_escalation: {
    name: 'Risk Escalation',
    type: 'APPROVAL' as WorkflowType,
    description: 'Escalation workflow for high-risk flagged contracts',
    contractTypes: ['*'],
    riskLevel: 'HIGH',
    steps: [
      { name: 'Risk Assessment', role: 'risk', timeoutHours: 48, order: 0 },
      { name: 'Compliance Review', role: 'compliance', timeoutHours: 48, order: 1 },
      { name: 'Legal Director Approval', role: 'legal_director', timeoutHours: 48, order: 2 },
      { name: 'Executive Review', role: 'executive', timeoutHours: 72, order: 3 },
    ],
  },
  // Multi-Party Signature
  multi_party: {
    name: 'Multi-Party Signature',
    type: 'APPROVAL' as WorkflowType,
    description: 'Approval workflow for contracts requiring multiple party signatures',
    contractTypes: ['*'],
    steps: [
      { name: 'Internal Approval', role: 'approver', timeoutHours: 48, order: 0 },
      { name: 'Counter-party A Signature', role: 'external_a', timeoutHours: 120, order: 1, isExternal: true },
      { name: 'Counter-party B Signature', role: 'external_b', timeoutHours: 120, order: 2, isExternal: true },
      { name: 'Final Execution', role: 'legal', timeoutHours: 24, order: 3 },
    ],
  },
  // Procurement Review
  procurement: {
    name: 'Procurement Review',
    type: 'APPROVAL' as WorkflowType,
    description: 'Approval workflow for purchase orders and work orders',
    contractTypes: ['PURCHASE_ORDER', 'WORK_ORDER', 'SOW'],
    steps: [
      { name: 'Budget Verification', role: 'finance', timeoutHours: 24, order: 0 },
      { name: 'Procurement Review', role: 'procurement', timeoutHours: 48, order: 1 },
      { name: 'Finance Approval', role: 'finance_director', timeoutHours: 48, order: 2 },
      { name: 'Department Head Approval', role: 'department_head', timeoutHours: 48, order: 3 },
    ],
  },
} as const;

export type WorkflowTemplateKey = keyof typeof WORKFLOW_TEMPLATES;

// ============================================================================
// WORKFLOW MANAGEMENT SERVICE
// ============================================================================

export class WorkflowManagementService extends EventEmitter {
  private static instance: WorkflowManagementService;
  private escalationTimers: Map<string, NodeJS.Timeout> = new Map();
  private reminderTimers: Map<string, NodeJS.Timeout> = new Map();

  private constructor() {
    super();
  }

  static getInstance(): WorkflowManagementService {
    if (!WorkflowManagementService.instance) {
      WorkflowManagementService.instance = new WorkflowManagementService();
    }
    return WorkflowManagementService.instance;
  }

  // ==========================================================================
  // WORKFLOW DEFINITION MANAGEMENT
  // ==========================================================================

  /**
   * Create a new workflow definition
   */
  async createWorkflow(definition: WorkflowDefinition): Promise<string> {
    // If setting as default, unset other defaults
    if (definition.isDefault) {
      await prisma.workflow.updateMany({
        where: { tenantId: definition.tenantId, type: definition.type, isDefault: true },
        data: { isDefault: false }
      });
    }

    const workflow = await prisma.workflow.create({
      data: {
        id: definition.id || uuidv4(),
        tenantId: definition.tenantId,
        name: definition.name,
        description: definition.description,
        type: definition.type,
        isDefault: definition.isDefault || false,
        config: definition.config as any,
        metadata: definition.metadata as any,
        steps: {
          create: definition.steps.map((step, index) => ({
            id: uuidv4(),
            name: step.name,
            description: step.description,
            order: step.order ?? index,
            type: step.type,
            assignedRole: step.assignedRole,
            assignedUser: step.assignedUser,
            isRequired: step.isRequired,
            timeout: step.timeoutHours,
            config: { ...step.config, conditions: step.conditions } as any,
          }))
        }
      },
      include: { steps: true }
    });

    this.emit('workflow:created', { workflowId: workflow.id, tenantId: definition.tenantId });
    
    return workflow.id;
  }

  /**
   * Get workflow by ID
   */
  async getWorkflow(workflowId: string): Promise<any> {
    return prisma.workflow.findUnique({
      where: { id: workflowId },
      include: { steps: { orderBy: { order: 'asc' } } }
    });
  }

  /**
   * Get default workflow for a tenant and type
   */
  async getDefaultWorkflow(tenantId: string, type: WorkflowType = 'APPROVAL'): Promise<any> {
    return prisma.workflow.findFirst({
      where: { tenantId, type, isDefault: true, isActive: true },
      include: { steps: { orderBy: { order: 'asc' } } }
    });
  }

  /**
   * List all workflows for a tenant
   */
  async listWorkflows(tenantId: string, options?: { type?: WorkflowType; activeOnly?: boolean }): Promise<any[]> {
    return prisma.workflow.findMany({
      where: {
        tenantId,
        ...(options?.type && { type: options.type }),
        ...(options?.activeOnly && { isActive: true })
      },
      include: { steps: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Intelligently route to the best workflow based on contract characteristics
   */
  async routeToWorkflow(
    tenantId: string,
    contractData: {
      contractType?: string;
      value?: number;
      riskLevel?: string;
      isAmendment?: boolean;
      isTermination?: boolean;
      isRenewalOptOut?: boolean;
      partyCount?: number;
    }
  ): Promise<{ templateKey: WorkflowTemplateKey; template: typeof WORKFLOW_TEMPLATES[WorkflowTemplateKey]; reason: string }> {
    const { contractType, value, riskLevel, isAmendment, isTermination, isRenewalOptOut, partyCount } = contractData;

    // Priority-based routing logic
    
    // 1. Risk escalation takes highest priority
    if (riskLevel === 'HIGH' || riskLevel === 'CRITICAL') {
      return {
        templateKey: 'risk_escalation',
        template: WORKFLOW_TEMPLATES.risk_escalation,
        reason: `High-risk contract requires comprehensive risk escalation workflow`
      };
    }

    // 2. Special action workflows
    if (isTermination) {
      return {
        templateKey: 'termination',
        template: WORKFLOW_TEMPLATES.termination,
        reason: 'Contract termination requires termination approval workflow'
      };
    }

    if (isRenewalOptOut) {
      return {
        templateKey: 'renewal_opt_out',
        template: WORKFLOW_TEMPLATES.renewal_opt_out,
        reason: 'Renewal opt-out requires notification workflow'
      };
    }

    // 3. Multi-party contracts
    if (partyCount && partyCount > 2) {
      return {
        templateKey: 'multi_party',
        template: WORKFLOW_TEMPLATES.multi_party,
        reason: `Contract with ${partyCount} parties requires multi-party signature workflow`
      };
    }

    // 4. Contract type specific workflows
    if (contractType) {
      const upperType = contractType.toUpperCase();
      
      if (['AMENDMENT', 'ADDENDUM', 'CHANGE_ORDER'].includes(upperType) || isAmendment) {
        return {
          templateKey: 'amendment',
          template: WORKFLOW_TEMPLATES.amendment,
          reason: 'Amendment/addendum requires original approver sign-off'
        };
      }

      if (upperType === 'NDA') {
        return {
          templateKey: 'nda_fast_track',
          template: WORKFLOW_TEMPLATES.nda_fast_track,
          reason: 'NDA uses fast-track approval workflow'
        };
      }

      if (['PURCHASE_ORDER', 'WORK_ORDER', 'PO', 'WO'].includes(upperType)) {
        return {
          templateKey: 'procurement',
          template: WORKFLOW_TEMPLATES.procurement,
          reason: 'Purchase/work order requires procurement review workflow'
        };
      }

      if (['SOW', 'STATEMENT_OF_WORK'].includes(upperType)) {
        return {
          templateKey: 'procurement',
          template: WORKFLOW_TEMPLATES.procurement,
          reason: 'Statement of work requires procurement review'
        };
      }

      if (['MSA', 'SERVICE_AGREEMENT', 'VENDOR_AGREEMENT'].includes(upperType)) {
        // Check if this is a new vendor
        return {
          templateKey: 'vendor_onboarding',
          template: WORKFLOW_TEMPLATES.vendor_onboarding,
          reason: 'Service agreement requires vendor onboarding workflow'
        };
      }
    }

    // 5. Value-based routing
    if (value !== undefined) {
      if (value >= 500000) {
        return {
          templateKey: 'executive',
          template: WORKFLOW_TEMPLATES.executive,
          reason: `High-value contract ($${value.toLocaleString()}) requires executive approval`
        };
      }

      if (value >= 100000) {
        return {
          templateKey: 'legal_review',
          template: WORKFLOW_TEMPLATES.legal_review,
          reason: `Contract value ($${value.toLocaleString()}) requires legal review workflow`
        };
      }

      if (value < 25000) {
        return {
          templateKey: 'express',
          template: WORKFLOW_TEMPLATES.express,
          reason: `Low-value contract ($${value.toLocaleString()}) qualifies for express approval`
        };
      }
    }

    // 6. Default to standard workflow
    return {
      templateKey: 'standard',
      template: WORKFLOW_TEMPLATES.standard,
      reason: 'Using standard approval workflow'
    };
  }

  /**
   * Create workflow from template
   */
  async createFromTemplate(
    tenantId: string,
    templateKey: WorkflowTemplateKey,
    options?: { setAsDefault?: boolean; customName?: string }
  ): Promise<string> {
    const template = WORKFLOW_TEMPLATES[templateKey];
    
    return this.createWorkflow({
      tenantId,
      name: options?.customName || template.name,
      description: template.description,
      type: template.type,
      isDefault: options?.setAsDefault,
      steps: template.steps.map((step, idx) => ({
        name: step.name,
        type: template.type,
        order: step.order ?? idx,
        assignedRole: step.role,
        isRequired: (step as any).isRequired !== false,
        timeoutHours: step.timeoutHours,
        config: (step as any).autoApprove || (step as any).isExternal ? {
          allowDelegation: !(step as any).isExternal,
          autoApproveConditions: (step as any).autoApprove ? [{ field: 'value', operator: 'less_than' as const, value: 10000 }] : undefined,
        } : undefined,
      }))
    });
  }

  /**
   * Seed all workflow templates for a tenant
   */
  async seedTemplatesForTenant(tenantId: string): Promise<{ created: string[]; skipped: string[] }> {
    const created: string[] = [];
    const skipped: string[] = [];

    for (const [key, template] of Object.entries(WORKFLOW_TEMPLATES)) {
      // Check if workflow with this name already exists
      const existing = await prisma.workflow.findFirst({
        where: { tenantId, name: template.name }
      });

      if (existing) {
        skipped.push(template.name);
        continue;
      }

      await this.createFromTemplate(tenantId, key as WorkflowTemplateKey, {
        setAsDefault: key === 'standard'
      });
      created.push(template.name);
    }

    return { created, skipped };
  }

  /**
   * Update workflow definition
   */
  async updateWorkflow(workflowId: string, updates: Partial<WorkflowDefinition>): Promise<void> {
    await prisma.workflow.update({
      where: { id: workflowId },
      data: {
        name: updates.name,
        description: updates.description,
        type: updates.type,
        isDefault: updates.isDefault,
        config: updates.config as any,
        metadata: updates.metadata as any,
      }
    });

    this.emit('workflow:updated', { workflowId });
  }

  /**
   * Delete workflow
   */
  async deleteWorkflow(workflowId: string): Promise<void> {
    await prisma.workflow.delete({ where: { id: workflowId } });
    this.emit('workflow:deleted', { workflowId });
  }

  // ==========================================================================
  // WORKFLOW EXECUTION
  // ==========================================================================

  /**
   * Start a workflow execution on a contract
   */
  async startExecution(request: WorkflowExecutionRequest): Promise<string> {
    const workflow = await this.getWorkflow(request.workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${request.workflowId} not found`);
    }

    if (workflow.steps.length === 0) {
      throw new Error('Workflow has no steps defined');
    }

    const firstStep = workflow.steps[0];

    // Create execution
    const execution = await prisma.workflowExecution.create({
      data: {
        id: uuidv4(),
        workflowId: request.workflowId,
        contractId: request.contractId,
        tenantId: request.tenantId,
        status: 'IN_PROGRESS',
        currentStep: firstStep.id,
        initiatedBy: request.initiatedBy,
        startedBy: request.initiatedBy,
        dueDate: request.dueDate,
        metadata: request.metadata as any,
        stepExecutions: {
          create: workflow.steps.map((step: any) => ({
            id: uuidv4(),
            stepId: step.id,
            stepOrder: step.order,
            stepName: step.name,
            status: step.order === 0 ? 'IN_PROGRESS' : 'PENDING',
            assignedTo: step.assignedUser || step.assignedRole,
          }))
        }
      },
      include: { stepExecutions: true }
    });

    // Update contract status
    await prisma.contract.update({
      where: { id: request.contractId },
      data: { 
        status: 'PENDING'
      }
    });

    // Schedule reminders and escalations
    this.scheduleReminders(execution.id, workflow.config);

    // Emit event
    this.emitWorkflowEvent({
      type: 'execution_started',
      executionId: execution.id,
      workflowId: request.workflowId,
      contractId: request.contractId,
      tenantId: request.tenantId,
      data: { 
        workflowName: workflow.name,
        firstStep: firstStep.name,
        assignedTo: firstStep.assignedUser || firstStep.assignedRole
      },
      timestamp: new Date()
    });

    return execution.id;
  }

  /**
   * Get execution progress
   */
  async getExecutionProgress(executionId: string): Promise<WorkflowProgress | null> {
    const execution = await prisma.workflowExecution.findUnique({
      where: { id: executionId },
      include: {
        workflow: true,
        stepExecutions: {
          orderBy: { stepOrder: 'asc' },
          include: { step: true }
        }
      }
    });

    if (!execution) return null;

    const completedSteps = execution.stepExecutions.filter(
      (se: any) => se.status === 'COMPLETED'
    ).length;

    const currentStepExec = execution.stepExecutions.find(
      (se: any) => se.status === 'IN_PROGRESS' || se.status === 'WAITING'
    );

    return {
      executionId,
      workflowName: execution.workflow.name,
      status: execution.status as WorkflowStatus,
      currentStep: currentStepExec?.stepOrder ?? completedSteps,
      totalSteps: execution.stepExecutions.length,
      percentComplete: Math.round((completedSteps / execution.stepExecutions.length) * 100),
      steps: execution.stepExecutions.map((se: any) => ({
        stepId: se.stepId,
        name: se.stepName,
        order: se.stepOrder,
        status: se.status as StepStatus,
        assignedTo: se.assignedTo,
        completedBy: se.completedBy,
        completedAt: se.completedAt,
        comment: (se.result as any)?.comment,
        isOverdue: se.step?.timeout 
          ? new Date() > new Date(se.startedAt.getTime() + se.step.timeout * 60 * 60 * 1000)
          : false,
        dueDate: se.step?.timeout
          ? new Date(se.startedAt.getTime() + se.step.timeout * 60 * 60 * 1000)
          : undefined
      })),
      startedAt: execution.startedAt,
      blockedBy: currentStepExec?.assignedTo ?? undefined
    };
  }

  /**
   * Process a step action (approve, reject, etc.)
   */
  async processStepAction(request: StepActionRequest): Promise<{ success: boolean; message: string; nextStep?: string }> {
    const stepExec = await prisma.workflowStepExecution.findFirst({
      where: { executionId: request.executionId, stepId: request.stepId },
      include: { 
        step: true,
        execution: { 
          include: { 
            workflow: { include: { steps: true } },
            stepExecutions: true 
          } 
        }
      }
    });

    if (!stepExec) {
      throw new Error('Step execution not found');
    }

    if (!['IN_PROGRESS', 'WAITING'].includes(stepExec.status)) {
      throw new Error(`Step is not awaiting action (current status: ${stepExec.status})`);
    }

    const execution = stepExec.execution;
    const workflow = execution.workflow;
    const allSteps = workflow.steps.sort((a: any, b: any) => a.order - b.order);
    const currentStepIndex = allSteps.findIndex((s: any) => s.id === request.stepId);

    switch (request.action) {
      case 'approve': {
        // Mark step as completed
        await prisma.workflowStepExecution.update({
          where: { id: stepExec.id },
          data: {
            status: 'COMPLETED',
            completedBy: request.userId,
            completedAt: new Date(),
            result: JSON.stringify({ action: 'approved', comment: request.comment, metadata: request.metadata })
          }
        });

        // Check if there's a next step
        const nextStep = allSteps[currentStepIndex + 1];
        
        if (nextStep) {
          // Activate next step
          const nextStepExec = execution.stepExecutions.find((se: any) => se.stepId === nextStep.id);
          if (nextStepExec) {
            await prisma.workflowStepExecution.update({
              where: { id: nextStepExec.id },
              data: { status: 'IN_PROGRESS', startedAt: new Date() }
            });

            await prisma.workflowExecution.update({
              where: { id: request.executionId },
              data: { currentStep: nextStep.id }
            });
          }

          this.emitWorkflowEvent({
            type: 'step_completed',
            executionId: request.executionId,
            workflowId: workflow.id,
            contractId: execution.contractId,
            tenantId: execution.tenantId!,
            stepId: request.stepId,
            userId: request.userId,
            data: { 
              stepName: stepExec.stepName,
              nextStep: nextStep.name,
              comment: request.comment
            },
            timestamp: new Date()
          });

          return { 
            success: true, 
            message: `Step approved. Moving to: ${nextStep.name}`,
            nextStep: nextStep.name
          };
        } else {
          // Workflow complete
          await this.completeExecution(request.executionId, true);
          
          return { 
            success: true, 
            message: 'Workflow completed successfully!' 
          };
        }
      }

      case 'reject': {
        await prisma.workflowStepExecution.update({
          where: { id: stepExec.id },
          data: {
            status: 'REJECTED',
            completedBy: request.userId,
            completedAt: new Date(),
            result: JSON.stringify({ action: 'rejected', comment: request.comment, metadata: request.metadata })
          }
        });

        // Fail the workflow
        await this.completeExecution(request.executionId, false, `Rejected at step: ${stepExec.stepName}`);

        this.emitWorkflowEvent({
          type: 'step_rejected',
          executionId: request.executionId,
          workflowId: workflow.id,
          contractId: execution.contractId,
          tenantId: execution.tenantId!,
          stepId: request.stepId,
          userId: request.userId,
          data: { stepName: stepExec.stepName, comment: request.comment },
          timestamp: new Date()
        });

        return { 
          success: true, 
          message: `Step rejected. Workflow terminated.` 
        };
      }

      case 'skip': {
        if (stepExec.step?.isRequired) {
          throw new Error('Cannot skip a required step');
        }

        await prisma.workflowStepExecution.update({
          where: { id: stepExec.id },
          data: {
            status: 'SKIPPED',
            completedBy: request.userId,
            completedAt: new Date(),
            result: { action: 'skipped', comment: request.comment }
          }
        });

        // Move to next step (same logic as approve)
        const nextStep = allSteps[currentStepIndex + 1];
        if (nextStep) {
          const nextStepExec = execution.stepExecutions.find((se: any) => se.stepId === nextStep.id);
          if (nextStepExec) {
            await prisma.workflowStepExecution.update({
              where: { id: nextStepExec.id },
              data: { status: 'IN_PROGRESS', startedAt: new Date() }
            });
          }
          return { success: true, message: `Step skipped. Moving to: ${nextStep.name}`, nextStep: nextStep.name };
        } else {
          await this.completeExecution(request.executionId, true);
          return { success: true, message: 'Workflow completed successfully!' };
        }
      }

      case 'delegate': {
        if (!request.delegateTo) {
          throw new Error('Delegate target user is required');
        }

        await prisma.workflowStepExecution.update({
          where: { id: stepExec.id },
          data: {
            assignedTo: request.delegateTo,
            metadata: { 
              ...(stepExec.metadata as any || {}), 
              delegatedFrom: request.userId, 
              delegatedAt: new Date() 
            }
          }
        });

        return { success: true, message: `Step delegated to ${request.delegateTo}` };
      }

      case 'request_changes': {
        await prisma.workflowStepExecution.update({
          where: { id: stepExec.id },
          data: {
            status: 'WAITING',
            result: { action: 'changes_requested', comment: request.comment }
          }
        });

        return { success: true, message: 'Changes requested. Waiting for updates.' };
      }

      default:
        throw new Error(`Unknown action: ${request.action}`);
    }
  }

  /**
   * Complete a workflow execution
   */
  private async completeExecution(executionId: string, success: boolean, error?: string): Promise<void> {
    const execution = await prisma.workflowExecution.update({
      where: { id: executionId },
      data: {
        status: success ? 'COMPLETED' : 'FAILED',
        completedAt: new Date(),
        error
      },
      include: { workflow: true }
    });

    // Update contract status
    await prisma.contract.update({
      where: { id: execution.contractId },
      data: {
        status: success ? 'ACTIVE' : 'DRAFT'
      }
    });

    // Clear timers
    this.clearTimers(executionId);

    // Emit event
    this.emitWorkflowEvent({
      type: success ? 'workflow_completed' : 'workflow_failed',
      executionId,
      workflowId: execution.workflowId,
      contractId: execution.contractId,
      tenantId: execution.tenantId!,
      data: { workflowName: execution.workflow.name, error },
      timestamp: new Date()
    });
  }

  /**
   * Cancel a workflow execution
   */
  async cancelExecution(executionId: string, cancelledBy: string, reason?: string): Promise<void> {
    const execution = await prisma.workflowExecution.update({
      where: { id: executionId },
      data: {
        status: 'CANCELLED',
        completedAt: new Date(),
        error: reason || 'Cancelled by user',
        metadata: {
          cancelledBy,
          cancelledAt: new Date().toISOString()
        }
      },
      include: { workflow: true }
    });

    // Mark all pending steps as skipped
    await prisma.workflowStepExecution.updateMany({
      where: { executionId, status: { in: ['PENDING', 'IN_PROGRESS', 'WAITING'] } },
      data: { status: 'SKIPPED' }
    });

    // Revert contract status
    await prisma.contract.update({
      where: { id: execution.contractId },
      data: { status: 'DRAFT' }
    });

    this.clearTimers(executionId);
  }

  // ==========================================================================
  // AUTONOMOUS INTEGRATION
  // ==========================================================================

  /**
   * Suggest and optionally auto-start a workflow for a contract
   * Called by the Autonomous Agent Orchestrator
   */
  async suggestWorkflowForContract(
    contractId: string,
    tenantId: string,
    options?: { autoStart?: boolean; initiatedBy?: string }
  ): Promise<{ workflowId: string; workflowName: string; executionId?: string; suggested: boolean }> {
    // Get contract details
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: { 
        id: true, 
        totalValue: true, 
        contractType: true, 
        status: true,
        supplierId: true 
      }
    });

    if (!contract) {
      throw new Error('Contract not found');
    }

    // Find the most appropriate workflow
    let workflow = await this.getDefaultWorkflow(tenantId, 'APPROVAL');
    
    // If no default, try to find any active workflow
    if (!workflow) {
      const workflows = await this.listWorkflows(tenantId, { type: 'APPROVAL', activeOnly: true });
      workflow = workflows[0];
    }

    // If still no workflow, create a basic one
    if (!workflow) {
      const workflowId = await this.createWorkflow({
        tenantId,
        name: 'Standard Approval Workflow',
        type: 'APPROVAL',
        isDefault: true,
        steps: this.generateDefaultSteps(contract)
      });
      workflow = await this.getWorkflow(workflowId);
    }

    const result: { workflowId: string; workflowName: string; executionId?: string; suggested: boolean } = {
      workflowId: workflow.id,
      workflowName: workflow.name,
      suggested: true
    };

    // Auto-start if requested
    if (options?.autoStart) {
      result.executionId = await this.startExecution({
        workflowId: workflow.id,
        contractId,
        tenantId,
        initiatedBy: options.initiatedBy || 'autonomous-agent'
      });
    }

    return result;
  }

  /**
   * Generate default workflow steps based on contract characteristics
   */
  private generateDefaultSteps(contract: any): WorkflowStepDefinition[] {
    const steps: WorkflowStepDefinition[] = [];
    let order = 0;

    // Legal review for high-value contracts
    if (contract.value && contract.value > 50000) {
      steps.push({
        name: 'Legal Review',
        type: 'APPROVAL',
        order: order++,
        assignedRole: 'legal',
        isRequired: true,
        timeoutHours: 72,
        conditions: [{ field: 'value', operator: 'greater_than', value: 50000 }]
      });
    }

    // Finance review for contracts over 100k
    if (contract.value && contract.value > 100000) {
      steps.push({
        name: 'Finance Approval',
        type: 'APPROVAL',
        order: order++,
        assignedRole: 'finance',
        isRequired: true,
        timeoutHours: 48
      });
    }

    // Always require manager approval
    steps.push({
      name: 'Manager Approval',
      type: 'APPROVAL',
      order: order++,
      assignedRole: 'manager',
      isRequired: true,
      timeoutHours: 24
    });

    // Executive signoff for very high value
    if (contract.value && contract.value > 500000) {
      steps.push({
        name: 'Executive Signoff',
        type: 'APPROVAL',
        order: order++,
        assignedRole: 'executive',
        isRequired: true,
        timeoutHours: 24
      });
    }

    return steps;
  }

  /**
   * Get pending approvals for a user/role
   */
  async getPendingApprovals(
    tenantId: string,
    options?: { userId?: string; role?: string; limit?: number }
  ): Promise<any[]> {
    const whereClause: any = {
      execution: { tenantId, status: 'IN_PROGRESS' },
      status: { in: ['IN_PROGRESS', 'WAITING'] }
    };

    if (options?.userId) {
      whereClause.assignedTo = options.userId;
    } else if (options?.role) {
      whereClause.assignedTo = options.role;
    }

    return prisma.workflowStepExecution.findMany({
      where: whereClause,
      include: {
        step: true,
        execution: {
          include: {
            workflow: true,
            contract: {
              select: { id: true, contractTitle: true, totalValue: true, supplierId: true }
            }
          }
        }
      },
      orderBy: { startedAt: 'asc' },
      take: options?.limit || 50
    });
  }

  /**
   * Auto-escalate overdue steps
   * Called periodically by the autonomous orchestrator
   */
  async checkAndEscalateOverdue(): Promise<{ escalated: number; reminders: number }> {
    const now = new Date();
    let escalated = 0;
    let reminders = 0;

    // Find overdue steps
    const overdueSteps = await prisma.workflowStepExecution.findMany({
      where: {
        status: { in: ['IN_PROGRESS', 'WAITING'] }
      },
      include: {
        step: true,
        execution: { include: { workflow: true } }
      }
    });

    for (const stepExec of overdueSteps) {
      if (!stepExec.step?.timeout) continue;

      const timeoutMs = stepExec.step.timeout * 60 * 60 * 1000;
      const dueTime = new Date(stepExec.startedAt.getTime() + timeoutMs);

      if (now > dueTime) {
        // Overdue - escalate
        this.emitWorkflowEvent({
          type: 'overdue',
          executionId: stepExec.executionId,
          workflowId: stepExec.execution.workflowId,
          contractId: stepExec.execution.contractId,
          tenantId: stepExec.execution.tenantId!,
          stepId: stepExec.stepId,
          data: {
            stepName: stepExec.stepName,
            assignedTo: stepExec.assignedTo,
            overdueSince: dueTime
          },
          timestamp: now
        });
        escalated++;
      } else if (now > new Date(dueTime.getTime() - 4 * 60 * 60 * 1000)) {
        // Due within 4 hours - send reminder
        this.emitWorkflowEvent({
          type: 'reminder_sent',
          executionId: stepExec.executionId,
          workflowId: stepExec.execution.workflowId,
          contractId: stepExec.execution.contractId,
          tenantId: stepExec.execution.tenantId!,
          stepId: stepExec.stepId,
          data: {
            stepName: stepExec.stepName,
            assignedTo: stepExec.assignedTo,
            dueIn: Math.round((dueTime.getTime() - now.getTime()) / (60 * 60 * 1000)) + ' hours'
          },
          timestamp: now
        });
        reminders++;
      }
    }

    return { escalated, reminders };
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private scheduleReminders(executionId: string, config?: any): void {
    // In production, this would schedule actual reminders
    // For now, we track the execution ID
    console.log(`[Workflow] Scheduling reminders for execution ${executionId}`);
  }

  private clearTimers(executionId: string): void {
    const escalationTimer = this.escalationTimers.get(executionId);
    if (escalationTimer) {
      clearTimeout(escalationTimer);
      this.escalationTimers.delete(executionId);
    }

    const reminderTimer = this.reminderTimers.get(executionId);
    if (reminderTimer) {
      clearTimeout(reminderTimer);
      this.reminderTimers.delete(executionId);
    }
  }

  private emitWorkflowEvent(event: WorkflowEvent): void {
    this.emit('workflow:event', event);
    this.emit(`workflow:${event.type}`, event);
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

let workflowManagementServiceInstance: WorkflowManagementService | null = null;

export function getWorkflowManagementService(): WorkflowManagementService {
  if (!workflowManagementServiceInstance) {
    workflowManagementServiceInstance = WorkflowManagementService.getInstance();
  }
  return workflowManagementServiceInstance;
}

export const workflowManagementService = getWorkflowManagementService();
