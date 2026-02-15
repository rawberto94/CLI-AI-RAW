/**
 * Workflow Suggestion Engine
 * Suggests optimal approval workflows based on contract analysis and historical data
 */

import { BaseAgent } from './base-agent';
import type {
  AgentInput,
  AgentOutput,
  WorkflowSuggestion,
  ApprovalStep,
  WorkflowHistory,
  CompletedStep,
  AgentRecommendation,
} from './types';
import { logger } from '../utils/logger';
import { prisma } from '../lib/prisma';

export class WorkflowSuggestionEngine extends BaseAgent {
  name = 'workflow-suggestion-engine';
  version = '1.0.0';
  capabilities = ['workflow-suggestion', 'pattern-analysis', 'optimization'];

  async execute(input: AgentInput): Promise<AgentOutput> {
    const { contract } = input.context;

    // Get historical workflow data
    const historicalData = await this.getHistoricalWorkflows(
      input.tenantId,
      contract.contractType
    );

    // Generate workflow suggestion
    const suggestion = await this.suggestWorkflow(contract, historicalData);

    // Convert to recommendations
    const recommendations: AgentRecommendation[] = [
      {
        id: `workflow-primary-${Date.now()}`,
        title: suggestion.workflowName,
        description: `${suggestion.reasoning}\n\nEstimated Duration: ${suggestion.estimatedDuration} days`,
        category: 'process-improvement',
        priority: 'high',
        confidence: suggestion.confidence,
        effort: 'low',
        timeframe: `${suggestion.estimatedDuration} days`,
        actions: suggestion.steps.map((step, idx) => ({
          id: `step-${idx}`,
          type: 'create-workflow',
          description: `${step.name} - ${step.assignee}`,
          priority: step.required ? 'high' : 'medium',
          automated: true,
          targetEntity: {
            type: 'workflow',
            id: 'new',
          },
          payload: step,
        })),
        reasoning: suggestion.reasoning,
      },
    ];

    // Add alternative workflows as recommendations
    for (const alt of suggestion.alternatives) {
      recommendations.push({
        id: `workflow-alt-${Date.now()}-${alt.workflowName}`,
        title: `Alternative: ${alt.workflowName}`,
        description: alt.reasoning,
        category: 'process-improvement',
        priority: 'medium',
        confidence: alt.confidence,
        effort: 'low',
        timeframe: `${alt.estimatedDuration} days`,
        actions: alt.steps.map((step, idx) => ({
          id: `alt-step-${idx}`,
          type: 'create-workflow',
          description: `${step.name} - ${step.assignee}`,
          priority: step.required ? 'high' : 'medium',
          automated: true,
          targetEntity: {
            type: 'workflow',
            id: 'new',
          },
          payload: step,
        })),
        reasoning: alt.reasoning,
      });
    }

    return {
      success: true,
      data: suggestion,
      recommendations,
      confidence: suggestion.confidence,
      reasoning: this.formatReasoning([
        `Workflow: ${suggestion.workflowName}`,
        `Confidence: ${(suggestion.confidence * 100).toFixed(0)}%`,
        `Based on: ${suggestion.basedOnContracts.length} similar contracts`,
        `Estimated Duration: ${suggestion.estimatedDuration} days`,
        '',
        'Steps:',
        ...suggestion.steps.map((step, idx) => 
          `  ${idx + 1}. ${step.name} (${step.assignee}, ${step.deadline} days${step.required ? ', required' : ''})`
        ),
        '',
        `Alternatives Available: ${suggestion.alternatives.length}`,
      ]),
      metadata: {
        processingTime: Date.now() - (input.metadata?.timestamp?.getTime() ?? Date.now()),
      },
    };
  }

  protected getEventType(): 'workflow_suggested' {
    return 'workflow_suggested';
  }

  /**
   * Suggest optimal workflow based on contract and historical data
   */
  private async suggestWorkflow(
    contract: any,
    historicalData: WorkflowHistory[]
  ): Promise<WorkflowSuggestion> {
    // Find similar contracts
    const similarContracts = this.findSimilarContracts(contract, historicalData);

    if (similarContracts.length === 0) {
      // No historical data, use template
      return this.generateTemplateWorkflow(contract);
    }

    // Extract patterns from similar contracts
    const patterns = this.extractWorkflowPatterns(similarContracts);

    // Build primary workflow
    const steps: ApprovalStep[] = [];

    // Step 1: Legal Review (always required for contracts > $50K)
    if (contract.value > 50000) {
      steps.push({
        name: 'Legal Review',
        assignee: 'legal@company.com',
        deadline: patterns.avgLegalReviewDays || 3,
        required: true,
        reason: 'Required for all contracts exceeding $50,000',
      });
    }

    // Step 2: Finance Approval (required for contracts > $100K)
    if (contract.value > 100000) {
      steps.push({
        name: 'Finance Approval',
        assignee: 'finance@company.com',
        deadline: patterns.avgFinanceReviewDays || 2,
        required: true,
        reason: 'Budget impact threshold met ($100K+)',
        conditions: [
          {
            field: 'value',
            operator: 'greater_than',
            value: 100000,
            description: 'Contract value exceeds $100,000',
          },
        ],
      });
    }

    // Step 3: Procurement Review (for supplier contracts)
    if (contract.contractType?.includes('SUPPLIER') || contract.contractType?.includes('PROCUREMENT')) {
      steps.push({
        name: 'Procurement Review',
        assignee: 'procurement@company.com',
        deadline: 2,
        required: true,
        reason: 'Standard procurement process',
      });
    }

    // Step 4: Department Head Approval
    steps.push({
      name: 'Department Head Approval',
      assignee: 'department@company.com',
      deadline: 2,
      required: contract.value > 25000,
      reason: contract.value > 25000 ? 'Required for contracts > $25K' : 'Optional review',
    });

    // Step 5: Executive Signoff (for high-value contracts)
    if (contract.value > 500000) {
      steps.push({
        name: 'Executive Signoff',
        assignee: 'executive@company.com',
        deadline: 1,
        required: true,
        reason: 'High-value contract requiring C-level approval',
        conditions: [
          {
            field: 'value',
            operator: 'greater_than',
            value: 500000,
            description: 'Contract value exceeds $500,000',
          },
        ],
      });
    }

    // Calculate estimated duration
    const estimatedDuration = steps.reduce((sum, step) => sum + step.deadline, 0);

    // Generate alternatives
    const alternatives = this.generateAlternativeWorkflows(contract, patterns);

    return {
      workflowName: `${contract.contractType} Approval Workflow`,
      confidence: similarContracts.length > 5 ? 0.85 : 0.70,
      reasoning: this.buildWorkflowReasoning(similarContracts, patterns, contract),
      steps,
      estimatedDuration,
      basedOnContracts: similarContracts.map(c => c.contractId),
      alternatives,
    };
  }

  /**
   * Find contracts similar to the input contract
   */
  private findSimilarContracts(
    contract: any,
    historicalData: WorkflowHistory[]
  ): WorkflowHistory[] {
    return historicalData
      .filter(h => {
        // Same contract type
        if (h.contractType !== contract.contractType) return false;

        // Similar value (within 50% range)
        const valueDiff = Math.abs(h.value - contract.value) / contract.value;
        if (valueDiff > 0.5) return false;

        // Successful workflows only
        return h.success;
      })
      .slice(0, 20); // Limit to 20 most recent
  }

  /**
   * Extract patterns from historical workflows
   */
  private extractWorkflowPatterns(workflows: WorkflowHistory[]): {
    avgDuration: number;
    avgLegalReviewDays: number;
    avgFinanceReviewDays: number;
    commonPath: string;
    successRate: number;
    bottlenecks: string[];
  } {
    const totalDuration = workflows.reduce((sum, w) => sum + w.totalDuration, 0);
    const avgDuration = totalDuration / workflows.length;

    // Calculate average days per step type
    let totalLegalDays = 0;
    let legalCount = 0;
    let totalFinanceDays = 0;
    let financeCount = 0;

    for (const workflow of workflows) {
      for (const step of workflow.steps) {
        if (step.name.toLowerCase().includes('legal')) {
          totalLegalDays += step.duration;
          legalCount++;
        }
        if (step.name.toLowerCase().includes('finance')) {
          totalFinanceDays += step.duration;
          financeCount++;
        }
      }
    }

    const avgLegalReviewDays = legalCount > 0 ? Math.ceil(totalLegalDays / legalCount) : 3;
    const avgFinanceReviewDays = financeCount > 0 ? Math.ceil(totalFinanceDays / financeCount) : 2;

    // Find common path
    const stepSequences = workflows.map(w => w.steps.map(s => s.name).join(' → '));
    const commonPath = this.findMostCommon(stepSequences);

    // Calculate success rate
    const successRate = (workflows.filter(w => w.success).length / workflows.length) * 100;

    // Identify bottlenecks (steps that take longest)
    const bottlenecks = this.identifyBottlenecks(workflows);

    return {
      avgDuration,
      avgLegalReviewDays,
      avgFinanceReviewDays,
      commonPath,
      successRate,
      bottlenecks,
    };
  }

  /**
   * Identify workflow bottlenecks
   */
  private identifyBottlenecks(workflows: WorkflowHistory[]): string[] {
    const stepDurations = new Map<string, number[]>();

    for (const workflow of workflows) {
      for (const step of workflow.steps) {
        if (!stepDurations.has(step.name)) {
          stepDurations.set(step.name, []);
        }
        stepDurations.get(step.name)!.push(step.duration);
      }
    }

    const bottlenecks: string[] = [];

    for (const [stepName, durations] of stepDurations) {
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      // Consider a bottleneck if average duration > 3 days
      if (avgDuration > 3) {
        bottlenecks.push(`${stepName} (avg ${avgDuration.toFixed(1)} days)`);
      }
    }

    return bottlenecks;
  }

  /**
   * Find most common element in array
   */
  private findMostCommon(arr: string[]): string {
    const counts = new Map<string, number>();
    
    for (const item of arr) {
      counts.set(item, (counts.get(item) || 0) + 1);
    }

    let maxCount = 0;
    let mostCommon = '';

    for (const [item, count] of counts) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = item;
      }
    }

    return mostCommon || 'No common pattern';
  }

  /**
   * Generate alternative workflows
   */
  private generateAlternativeWorkflows(
    contract: any,
    patterns: any
  ): WorkflowSuggestion[] {
    const alternatives: WorkflowSuggestion[] = [];

    // Alternative 1: Expedited Review
    if (contract.value < 100000) {
      alternatives.push({
        workflowName: 'Expedited Review',
        confidence: 0.75,
        reasoning: 'Fast-track approval for lower-value contracts, skipping non-critical steps',
        steps: [
          {
            name: 'Quick Legal Check',
            assignee: 'legal@company.com',
            deadline: 1,
            required: true,
            reason: 'Rapid compliance review',
          },
          {
            name: 'Department Approval',
            assignee: 'department@company.com',
            deadline: 1,
            required: true,
            reason: 'Final approval',
          },
        ],
        estimatedDuration: 2,
        basedOnContracts: [],
        alternatives: [],
      });
    }

    // Alternative 2: Parallel Review
    alternatives.push({
      workflowName: 'Parallel Review Process',
      confidence: 0.80,
      reasoning: 'Process multiple reviews simultaneously to reduce total time',
      steps: [
        {
          name: 'Legal Review',
          assignee: 'legal@company.com',
          deadline: 3,
          required: true,
          reason: 'Parallel legal review',
          parallelWith: ['Finance Review'],
        },
        {
          name: 'Finance Review',
          assignee: 'finance@company.com',
          deadline: 3,
          required: true,
          reason: 'Parallel finance review',
          parallelWith: ['Legal Review'],
        },
        {
          name: 'Executive Signoff',
          assignee: 'executive@company.com',
          deadline: 1,
          required: contract.value > 500000,
          reason: 'Final approval',
        },
      ],
      estimatedDuration: 4, // Parallel processing reduces time
      basedOnContracts: [],
      alternatives: [],
    });

    return alternatives;
  }

  /**
   * Generate template workflow when no historical data
   */
  private generateTemplateWorkflow(contract: any): WorkflowSuggestion {
    const steps: ApprovalStep[] = [
      {
        name: 'Initial Review',
        assignee: 'reviewer@company.com',
        deadline: 2,
        required: true,
        reason: 'Standard initial review',
      },
      {
        name: 'Approval',
        assignee: 'approver@company.com',
        deadline: 2,
        required: true,
        reason: 'Final approval',
      },
    ];

    return {
      workflowName: 'Standard Approval Workflow',
      confidence: 0.60,
      reasoning: 'Template workflow (no historical data available for this contract type)',
      steps,
      estimatedDuration: 4,
      basedOnContracts: [],
      alternatives: [],
    };
  }

  /**
   * Build reasoning explanation
   */
  private buildWorkflowReasoning(
    similarContracts: WorkflowHistory[],
    patterns: any,
    contract: any
  ): string {
    if (similarContracts.length === 0) {
      return 'No historical data available. Using standard template workflow.';
    }

    const points: string[] = [];

    points.push(`Based on analysis of ${similarContracts.length} similar ${contract.contractType} contracts`);
    points.push(`Average approval time: ${patterns.avgDuration.toFixed(1)} days`);
    points.push(`Success rate: ${patterns.successRate.toFixed(0)}%`);
    points.push(`Most common approval path: ${patterns.commonPath}`);

    if (patterns.bottlenecks.length > 0) {
      points.push(`Identified bottlenecks: ${patterns.bottlenecks.join(', ')}`);
    }

    return points.join('\n');
  }

  /**
   * Get historical workflow data from database
   */
  private async getHistoricalWorkflows(
    tenantId: string,
    contractType: string
  ): Promise<WorkflowHistory[]> {
    try {
      const executions = await prisma.workflowExecution.findMany({
        where: {
          tenantId,
          status: { in: ['COMPLETED', 'FAILED'] },
          contract: { contractType },
        },
        include: {
          contract: { select: { id: true, contractType: true, totalValue: true } },
          stepExecutions: {
            orderBy: { stepOrder: 'asc' },
            select: {
              stepName: true,
              assignedTo: true,
              completedAt: true,
              startedAt: true,
              status: true,
            },
          },
        },
        orderBy: { completedAt: 'desc' },
        take: 50,
      });

      return executions.map((exec): WorkflowHistory => ({
        contractId: exec.contractId,
        contractType: (exec.contract.contractType || contractType) as any,
        value: exec.contract.totalValue ? Number(exec.contract.totalValue) : 0,
        steps: exec.stepExecutions
          .filter(s => s.completedAt)
          .map((s): CompletedStep => ({
            name: s.stepName || 'Unknown Step',
            assignee: s.assignedTo || 'unassigned',
            completedAt: s.completedAt!,
            duration: s.completedAt && s.startedAt
              ? (s.completedAt.getTime() - s.startedAt.getTime()) / 86400000
              : 0,
            approved: s.status === 'COMPLETED',
          })),
        totalDuration: exec.completedAt && exec.startedAt
          ? (exec.completedAt.getTime() - exec.startedAt.getTime()) / 86400000
          : 0,
        success: exec.status === 'COMPLETED',
      }));
    } catch (error) {
      logger.error({ error, tenantId, contractType }, 'Failed to fetch historical workflows');
      return [];
    }
  }
}

// Export singleton instance
export const workflowSuggestionEngine = new WorkflowSuggestionEngine();
