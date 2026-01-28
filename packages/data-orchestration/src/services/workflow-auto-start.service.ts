/**
 * Workflow Auto-Start Service
 * 
 * Automatically triggers workflows based on configurable rules when contracts
 * are uploaded, updated, or reach certain thresholds.
 * 
 * @version 1.0.0
 */

import { PrismaClient } from '@prisma/client';
import { EventEmitter } from 'events';
import { getWorkflowManagementService, WorkflowTemplateKey } from './workflow-management.service';

const prisma = new PrismaClient();

// ============================================================================
// TYPES
// ============================================================================

export interface AutoStartRule {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  isActive: boolean;
  priority: number; // Lower = higher priority
  conditions: AutoStartCondition[];
  workflowTemplateKey: WorkflowTemplateKey;
  notifyOnTrigger: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AutoStartCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'in' | 'not_in' | 'exists';
  value: unknown;
}

export interface ContractData {
  id: string;
  tenantId: string;
  title?: string;
  contractType?: string;
  value?: number;
  status?: string;
  riskLevel?: string;
  riskScore?: number;
  supplierName?: string;
  expirationDate?: Date;
  isAutoRenewal?: boolean;
  hasAmendment?: boolean;
  partyCount?: number;
  [key: string]: unknown;
}

export interface AutoStartResult {
  triggered: boolean;
  rule?: AutoStartRule;
  executionId?: string;
  reason?: string;
}

// ============================================================================
// DEFAULT AUTO-START RULES
// ============================================================================

export const DEFAULT_AUTO_START_RULES: Omit<AutoStartRule, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'High Value Contract Approval',
    description: 'Auto-start executive approval for contracts over $100,000',
    isActive: true,
    priority: 1,
    conditions: [
      { field: 'value', operator: 'greater_than', value: 100000 },
      { field: 'status', operator: 'equals', value: 'UPLOADED' },
    ],
    workflowTemplateKey: 'executive',
    notifyOnTrigger: true,
  },
  {
    name: 'High Risk Escalation',
    description: 'Auto-start risk escalation workflow for high-risk contracts',
    isActive: true,
    priority: 2,
    conditions: [
      { field: 'riskLevel', operator: 'in', value: ['HIGH', 'CRITICAL'] },
    ],
    workflowTemplateKey: 'risk_escalation',
    notifyOnTrigger: true,
  },
  {
    name: 'Risk Score Escalation',
    description: 'Auto-start risk escalation for contracts with risk score > 70',
    isActive: true,
    priority: 3,
    conditions: [
      { field: 'riskScore', operator: 'greater_than', value: 70 },
    ],
    workflowTemplateKey: 'risk_escalation',
    notifyOnTrigger: true,
  },
  {
    name: 'NDA Fast Track',
    description: 'Auto-start fast track approval for NDA contracts',
    isActive: true,
    priority: 10,
    conditions: [
      { field: 'contractType', operator: 'in', value: ['NDA', 'CONFIDENTIALITY_AGREEMENT'] },
      { field: 'status', operator: 'equals', value: 'UPLOADED' },
    ],
    workflowTemplateKey: 'nda_fast_track',
    notifyOnTrigger: false,
  },
  {
    name: 'Standard Contract Approval',
    description: 'Auto-start standard approval for contracts $25K-$100K',
    isActive: true,
    priority: 20,
    conditions: [
      { field: 'value', operator: 'greater_than', value: 25000 },
      { field: 'value', operator: 'less_than', value: 100001 },
      { field: 'status', operator: 'equals', value: 'UPLOADED' },
    ],
    workflowTemplateKey: 'standard',
    notifyOnTrigger: true,
  },
  {
    name: 'Low Value Express Approval',
    description: 'Auto-start express approval for contracts under $25K',
    isActive: true,
    priority: 30,
    conditions: [
      { field: 'value', operator: 'less_than', value: 25000 },
      { field: 'value', operator: 'greater_than', value: 0 },
      { field: 'status', operator: 'equals', value: 'UPLOADED' },
    ],
    workflowTemplateKey: 'express',
    notifyOnTrigger: false,
  },
  {
    name: 'Amendment Workflow',
    description: 'Auto-start amendment approval when amendment detected',
    isActive: true,
    priority: 5,
    conditions: [
      { field: 'contractType', operator: 'in', value: ['AMENDMENT', 'ADDENDUM', 'CHANGE_ORDER'] },
    ],
    workflowTemplateKey: 'amendment',
    notifyOnTrigger: true,
  },
  {
    name: 'Procurement Review',
    description: 'Auto-start procurement review for purchase orders',
    isActive: true,
    priority: 15,
    conditions: [
      { field: 'contractType', operator: 'in', value: ['PURCHASE_ORDER', 'WORK_ORDER', 'SOW', 'PO', 'WO'] },
    ],
    workflowTemplateKey: 'procurement',
    notifyOnTrigger: true,
  },
];

// ============================================================================
// WORKFLOW AUTO-START SERVICE
// ============================================================================

export class WorkflowAutoStartService extends EventEmitter {
  private static instance: WorkflowAutoStartService;
  private rules: Map<string, AutoStartRule[]> = new Map(); // tenantId -> rules

  private constructor() {
    super();
  }

  static getInstance(): WorkflowAutoStartService {
    if (!WorkflowAutoStartService.instance) {
      WorkflowAutoStartService.instance = new WorkflowAutoStartService();
    }
    return WorkflowAutoStartService.instance;
  }

  /**
   * Initialize rules for a tenant (load from DB or use defaults)
   */
  async initializeRules(tenantId: string): Promise<void> {
    try {
      // Try to load from database (stored in tenant settings)
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { settings: true },
      });

      const settings = tenant?.settings as Record<string, unknown> | null;
      const storedRules = settings?.workflowAutoStartRules as AutoStartRule[] | undefined;

      if (storedRules && storedRules.length > 0) {
        this.rules.set(tenantId, storedRules);
      } else {
        // Use default rules
        const defaultRules: AutoStartRule[] = DEFAULT_AUTO_START_RULES.map((rule, idx) => ({
          ...rule,
          id: `default-${idx}`,
          tenantId,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));
        this.rules.set(tenantId, defaultRules);
      }
    } catch (error) {
      // Fallback to defaults on error
      const defaultRules: AutoStartRule[] = DEFAULT_AUTO_START_RULES.map((rule, idx) => ({
        ...rule,
        id: `default-${idx}`,
        tenantId,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
      this.rules.set(tenantId, defaultRules);
    }
  }

  /**
   * Get all rules for a tenant
   */
  async getRules(tenantId: string): Promise<AutoStartRule[]> {
    if (!this.rules.has(tenantId)) {
      await this.initializeRules(tenantId);
    }
    return this.rules.get(tenantId) || [];
  }

  /**
   * Update rules for a tenant
   */
  async updateRules(tenantId: string, rules: AutoStartRule[]): Promise<void> {
    this.rules.set(tenantId, rules);

    // Persist to database
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { settings: true },
      });

      const existingSettings = (tenant?.settings as Record<string, unknown>) || {};

      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          settings: {
            ...existingSettings,
            workflowAutoStartRules: rules,
          },
        },
      });
    } catch (error) {
      console.error('[WorkflowAutoStart] Failed to persist rules:', error);
    }
  }

  /**
   * Add a new rule
   */
  async addRule(tenantId: string, rule: Omit<AutoStartRule, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>): Promise<AutoStartRule> {
    const rules = await this.getRules(tenantId);
    
    const newRule: AutoStartRule = {
      ...rule,
      id: `rule-${Date.now()}`,
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    rules.push(newRule);
    rules.sort((a, b) => a.priority - b.priority);
    
    await this.updateRules(tenantId, rules);
    return newRule;
  }

  /**
   * Evaluate contract against rules and auto-start workflow if matched
   */
  async evaluateAndTrigger(
    contractData: ContractData,
    initiatedBy: string = 'system'
  ): Promise<AutoStartResult> {
    const { tenantId } = contractData;
    const rules = await this.getRules(tenantId);
    const activeRules = rules.filter(r => r.isActive).sort((a, b) => a.priority - b.priority);

    for (const rule of activeRules) {
      if (this.evaluateConditions(rule.conditions, contractData)) {
        // Rule matched - start workflow
        try {
          const workflowService = getWorkflowManagementService();
          
          // Get the workflow definition for this template
          const workflow = await workflowService.getOrCreateWorkflowFromTemplate(
            tenantId,
            rule.workflowTemplateKey
          );

          if (workflow) {
            // Start the workflow execution
            const execution = await workflowService.startWorkflow({
              workflowId: workflow.id,
              contractId: contractData.id,
              tenantId,
              initiatedBy,
              metadata: {
                autoStarted: true,
                ruleId: rule.id,
                ruleName: rule.name,
              },
            });

            this.emit('workflow:auto-started', {
              contractId: contractData.id,
              tenantId,
              rule,
              executionId: execution.executionId,
            });

            return {
              triggered: true,
              rule,
              executionId: execution.executionId,
              reason: `Auto-started by rule: ${rule.name}`,
            };
          }
        } catch (error) {
          console.error('[WorkflowAutoStart] Failed to start workflow:', error);
          // Continue to next rule
        }
      }
    }

    return {
      triggered: false,
      reason: 'No matching rules found',
    };
  }

  /**
   * Evaluate conditions against contract data
   */
  private evaluateConditions(conditions: AutoStartCondition[], data: ContractData): boolean {
    return conditions.every(condition => this.evaluateCondition(condition, data));
  }

  private evaluateCondition(condition: AutoStartCondition, data: ContractData): boolean {
    const value = data[condition.field];

    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      
      case 'not_equals':
        return value !== condition.value;
      
      case 'greater_than':
        return typeof value === 'number' && value > (condition.value as number);
      
      case 'less_than':
        return typeof value === 'number' && value < (condition.value as number);
      
      case 'contains':
        return typeof value === 'string' && value.toLowerCase().includes(String(condition.value).toLowerCase());
      
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(value);
      
      case 'not_in':
        return Array.isArray(condition.value) && !condition.value.includes(value);
      
      case 'exists':
        return condition.value ? value !== undefined && value !== null : value === undefined || value === null;
      
      default:
        return false;
    }
  }

  /**
   * Enable/disable a rule
   */
  async toggleRule(tenantId: string, ruleId: string, isActive: boolean): Promise<void> {
    const rules = await this.getRules(tenantId);
    const rule = rules.find(r => r.id === ruleId);
    
    if (rule) {
      rule.isActive = isActive;
      rule.updatedAt = new Date();
      await this.updateRules(tenantId, rules);
    }
  }

  /**
   * Delete a rule
   */
  async deleteRule(tenantId: string, ruleId: string): Promise<void> {
    const rules = await this.getRules(tenantId);
    const filteredRules = rules.filter(r => r.id !== ruleId);
    await this.updateRules(tenantId, filteredRules);
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

let autoStartServiceInstance: WorkflowAutoStartService | null = null;

export function getWorkflowAutoStartService(): WorkflowAutoStartService {
  if (!autoStartServiceInstance) {
    autoStartServiceInstance = WorkflowAutoStartService.getInstance();
  }
  return autoStartServiceInstance;
}

export const workflowAutoStartService = getWorkflowAutoStartService();
