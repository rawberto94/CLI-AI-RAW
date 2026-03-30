/**
 * Workflow Authoring Agent — Codename: Blueprinter 📐
 *
 * Generates approval workflow definitions based on contract
 * characteristics: type, value tier, risk level, and parties.
 * Produces step sequences with assignee roles, SLAs, and
 * conditional routing rules.
 *
 * Cluster: strategists | Handle: @blueprinter
 */

import { BaseAgent } from './base-agent';
import type { AgentInput, AgentOutput, AgentRecommendation } from './types';
import { logger } from '../utils/logger';

// --------------------------------------------------------------------------
// Internal types
// --------------------------------------------------------------------------

interface WorkflowStep {
  id: string;
  name: string;
  assigneeRole: string;
  slaHours: number;
  order: number;
  required: boolean;
  condition?: string;
}

interface RoutingRule {
  id: string;
  condition: string;
  action: string;
  description: string;
}

interface WorkflowDefinition {
  name: string;
  description: string;
  contractType: string;
  valueTier: string;
  steps: WorkflowStep[];
  routingRules: RoutingRule[];
  estimatedDurationHours: number;
  generatedAt: string;
}

// --------------------------------------------------------------------------
// Value tier definitions
// --------------------------------------------------------------------------

type ValueTier = 'micro' | 'small' | 'medium' | 'large' | 'enterprise';

function classifyValueTier(value: number): ValueTier {
  if (value < 10_000) return 'micro';
  if (value < 50_000) return 'small';
  if (value < 250_000) return 'medium';
  if (value < 1_000_000) return 'large';
  return 'enterprise';
}

// --------------------------------------------------------------------------
// Step generation per tier
// --------------------------------------------------------------------------

const BASE_STEPS: WorkflowStep[] = [
  { id: 'step-1', name: 'Contract Upload & Initial Review', assigneeRole: 'contract-owner', slaHours: 24, order: 1, required: true },
  { id: 'step-2', name: 'Metadata Verification', assigneeRole: 'contract-manager', slaHours: 8, order: 2, required: true },
];

const LEGAL_REVIEW: WorkflowStep = { id: 'step-legal', name: 'Legal Review', assigneeRole: 'legal-counsel', slaHours: 48, order: 3, required: true, condition: 'value >= $50,000 OR type in (MSA, LICENSE, NDA)' };
const FINANCE_REVIEW: WorkflowStep = { id: 'step-finance', name: 'Finance Approval', assigneeRole: 'finance-director', slaHours: 24, order: 4, required: true, condition: 'value >= $100,000' };
const COMPLIANCE_REVIEW: WorkflowStep = { id: 'step-compliance', name: 'Compliance Check', assigneeRole: 'compliance-officer', slaHours: 24, order: 5, required: false, condition: 'risk = HIGH OR industry in (healthcare, finance, government)' };
const EXEC_SIGNOFF: WorkflowStep = { id: 'step-exec', name: 'Executive Signoff', assigneeRole: 'c-level-executive', slaHours: 48, order: 6, required: true, condition: 'value >= $500,000' };
const PROCUREMENT_REVIEW: WorkflowStep = { id: 'step-procurement', name: 'Procurement Review', assigneeRole: 'procurement-manager', slaHours: 16, order: 3, required: false, condition: 'type in (PO, SOW, SUPPLY)' };
const FINAL_APPROVAL: WorkflowStep = { id: 'step-final', name: 'Final Approval & Execution', assigneeRole: 'contract-manager', slaHours: 8, order: 10, required: true };

function buildSteps(tier: ValueTier, contractType: string, riskLevel: string, industry: string): WorkflowStep[] {
  const steps = [...BASE_STEPS];
  let order = 3;

  // Procurement for sourcing-type contracts
  if (['PO', 'SOW', 'SUPPLY'].includes(contractType.toUpperCase())) {
    steps.push({ ...PROCUREMENT_REVIEW, order: order++ });
  }

  // Legal for medium+ or specific types
  if (tier !== 'micro' || ['MSA', 'LICENSE', 'NDA'].includes(contractType.toUpperCase())) {
    steps.push({ ...LEGAL_REVIEW, order: order++ });
  }

  // Finance for medium+
  if (['medium', 'large', 'enterprise'].includes(tier)) {
    steps.push({ ...FINANCE_REVIEW, order: order++ });
  }

  // Compliance for high-risk or regulated
  if (riskLevel === 'high' || riskLevel === 'critical') {
    steps.push({ ...COMPLIANCE_REVIEW, required: true, order: order++ });
  }

  // Industry-specific compliance steps
  if (industry === 'healthcare') {
    steps.push({ id: 'step-hipaa', name: 'HIPAA Compliance Review', assigneeRole: 'privacy-officer', slaHours: 24, order: order++, required: true, condition: 'industry = healthcare' });
  }
  if (industry === 'finance') {
    steps.push({ id: 'step-sox', name: 'SOX / AML Compliance Review', assigneeRole: 'compliance-officer', slaHours: 24, order: order++, required: true, condition: 'industry = finance' });
  }
  if (industry === 'government') {
    steps.push({ id: 'step-far', name: 'FAR/DFARS Flow-Down Review', assigneeRole: 'government-contracts-officer', slaHours: 48, order: order++, required: true, condition: 'industry = government' });
  }

  // Executive for large+
  if (['large', 'enterprise'].includes(tier)) {
    steps.push({ ...EXEC_SIGNOFF, order: order++ });
  }

  steps.push({ ...FINAL_APPROVAL, order: order });

  return steps.sort((a, b) => a.order - b.order);
}

// Identify steps that can run concurrently
function identifyParallelSteps(steps: WorkflowStep[]): Array<{ stepIds: string[]; reason: string }> {
  const parallelGroups: Array<{ stepIds: string[]; reason: string }> = [];

  const legalStep = steps.find(s => s.id === 'step-legal');
  const financeStep = steps.find(s => s.id === 'step-finance');
  const complianceStep = steps.find(s => s.id === 'step-compliance');
  const hipaaStep = steps.find(s => s.id === 'step-hipaa');
  const soxStep = steps.find(s => s.id === 'step-sox');

  // Legal + Finance can run in parallel
  if (legalStep && financeStep) {
    parallelGroups.push({
      stepIds: [legalStep.id, financeStep.id],
      reason: 'Legal review and finance approval have no dependency — parallelise to reduce cycle time.',
    });
  }

  // Compliance + industry-specific can run in parallel
  const industrySteps = [hipaaStep, soxStep, complianceStep].filter(Boolean) as WorkflowStep[];
  if (industrySteps.length > 1) {
    parallelGroups.push({
      stepIds: industrySteps.map(s => s.id),
      reason: 'Compliance reviews are independent and can proceed concurrently.',
    });
  }

  return parallelGroups;
}

function buildRoutingRules(tier: ValueTier, contractType: string, industry: string): RoutingRule[] {
  const rules: RoutingRule[] = [
    { id: 'rule-1', condition: 'Any step rejected', action: 'Return to contract owner for revision', description: 'Rejection triggers return-to-sender workflow with required edits.' },
    { id: 'rule-2', condition: 'SLA breached', action: 'Escalate to manager of assignee', description: 'Auto-escalation when an approval step exceeds its SLA.' },
    { id: 'rule-3', condition: 'Reviewer unavailable > 24 hours', action: 'Delegate to backup approver', description: 'Auto-delegation prevents workflow stalls when reviewers are out of office.' },
  ];

  if (['large', 'enterprise'].includes(tier)) {
    rules.push({ id: 'rule-value-change', condition: 'Value changed during negotiation', action: 'Re-route to finance approval', description: 'Value changes require fresh financial review.' });
  }

  if (['NDA', 'LICENSE'].includes(contractType.toUpperCase())) {
    rules.push({ id: 'rule-ip', condition: 'IP transfer clause detected', action: 'Require additional IP counsel review', description: 'IP transfers require specialist legal review.' });
  }

  if (industry === 'healthcare') {
    rules.push({ id: 'rule-phi', condition: 'PHI data handling detected', action: 'Require BAA execution before data exchange', description: 'Protected health information requires an executed BAA.' });
  }

  if (industry === 'government') {
    rules.push({ id: 'rule-clearance', condition: 'Classified information referenced', action: 'Escalate to security officer', description: 'Classified contracts need security officer clearance.' });
  }

  // Multi-party contracts need all-party approval
  rules.push({ id: 'rule-multi-party', condition: 'More than 2 parties identified', action: 'Add counter-party review step per additional party', description: 'Multi-party agreements require sign-off from each party representative.' });

  return rules;
}

// --------------------------------------------------------------------------
// Agent implementation
// --------------------------------------------------------------------------

export class WorkflowAuthoringAgent extends BaseAgent {
  name = 'workflow-authoring-agent';
  version = '1.0.0';
  capabilities = ['workflow-authoring', 'workflow-suggestion'] as string[];

  async execute(input: AgentInput): Promise<AgentOutput> {
    const ctx = { ...input.context, ...(input.context?.contract || {}) };
    const contractType = (ctx.contractType || ctx.type || 'OTHER').toUpperCase();
    const totalValue = Number(ctx.totalValue || ctx.value || 0);
    const riskLevel = (ctx.riskLevel || ctx.riskScore || '').toString().toLowerCase();

    // Detect industry from context or text
    const text: string = ctx.rawText || ctx.searchableText || '';
    const industry = this.detectIndustry(ctx, text);

    logger.info({ contractId: input.contractId, contractType, totalValue, industry }, 'Authoring workflow');

    const tier = classifyValueTier(totalValue);
    const steps = buildSteps(tier, contractType, riskLevel, industry);
    const routingRules = buildRoutingRules(tier, contractType, industry);
    const parallelGroups = identifyParallelSteps(steps);

    // Calculate effective duration accounting for parallel execution
    const sequentialDuration = steps.reduce((sum, s) => sum + s.slaHours, 0);
    const parallelSavings = parallelGroups.reduce((savings, group) => {
      const groupSteps = group.stepIds.map(id => steps.find(s => s.id === id)).filter(Boolean) as WorkflowStep[];
      if (groupSteps.length > 1) {
        const maxSla = Math.max(...groupSteps.map(s => s.slaHours));
        const totalSla = groupSteps.reduce((sum, s) => sum + s.slaHours, 0);
        return savings + (totalSla - maxSla);
      }
      return savings;
    }, 0);
    const estimatedDurationHours = sequentialDuration - parallelSavings;

    const definition: WorkflowDefinition = {
      name: `${contractType} Approval — ${tier.charAt(0).toUpperCase() + tier.slice(1)} Tier`,
      description: `Auto-generated ${steps.length}-step approval workflow for ${contractType} contracts in the ${tier} value tier ($${totalValue.toLocaleString()}).`,
      contractType,
      valueTier: tier,
      steps,
      routingRules,
      estimatedDurationHours,
      generatedAt: new Date().toISOString(),
    };

    // --- Recommendations ---
    const recommendations: AgentRecommendation[] = [];

    if (tier === 'enterprise') {
      recommendations.push({
        id: `wf-rec-enterprise-${Date.now()}`,
        title: 'Enterprise-tier contract — enhanced oversight',
        description: 'This contract qualifies for enterprise-tier approval with executive signoff, compliance review, and legal counsel.',
        category: 'compliance' as const,
        priority: 'high' as const,
        confidence: 0.95,
        effort: 'low' as const,
        timeframe: 'Before execution',
        actions: [],
        reasoning: `Contract value $${totalValue.toLocaleString()} exceeds $1M threshold.`,
      });
    }

    if (parallelGroups.length > 0) {
      recommendations.push({
        id: `wf-rec-parallel-${Date.now()}`,
        title: `Parallelize ${parallelGroups.length} review group(s)`,
        description: `${parallelGroups.map(g => g.reason).join(' ')} This could save ~${parallelSavings} hours from the sequential estimate.`,
        category: 'process-improvement' as const,
        priority: 'medium' as const,
        confidence: 0.85,
        effort: 'low' as const,
        timeframe: 'Workflow configuration',
        actions: [],
        reasoning: 'Parallel review steps reduce total cycle time without sacrificing approval rigour.',
      });
    }

    if (industry !== 'general') {
      recommendations.push({
        id: `wf-rec-industry-${Date.now()}`,
        title: `${industry.charAt(0).toUpperCase() + industry.slice(1)} regulatory compliance steps included`,
        description: `Industry-specific review steps and routing rules have been added for ${industry} compliance requirements.`,
        category: 'compliance' as const,
        priority: 'high' as const,
        confidence: 0.9,
        effort: 'low' as const,
        timeframe: 'Automatic',
        actions: [],
        reasoning: `Regulated industries require additional approval gates to ensure compliance.`,
      });
    }

    if (estimatedDurationHours > 120) {
      recommendations.push({
        id: `wf-rec-duration-${Date.now()}`,
        title: 'Long approval cycle — consider streamlining',
        description: `Estimated workflow duration is ${estimatedDurationHours} hours (${Math.ceil(estimatedDurationHours / 24)} business days). Review whether all steps are necessary for this contract type.`,
        category: 'process-improvement' as const,
        priority: 'medium' as const,
        confidence: 0.8,
        effort: 'low' as const,
        timeframe: 'Workflow configuration',
        actions: [],
        reasoning: 'Long sequential workflows delay contract execution and create bottlenecks.',
      });
    }

    const confidence = this.calculateConfidence({
      dataQuality: totalValue > 0 ? 0.9 : 0.6,
      modelConfidence: 0.85,
      validationPassed: true,
    });

    return {
      success: true,
      data: { ...definition, parallelGroups },
      recommendations,
      confidence,
      reasoning: this.formatReasoning([
        `Contract type: ${contractType} | Industry: ${industry}`,
        `Value tier: ${tier} ($${totalValue.toLocaleString()})`,
        `Generated ${steps.length} workflow steps (${parallelGroups.length} parallelisable group(s))`,
        `${routingRules.length} routing rules (including ${industry !== 'general' ? 'industry-specific' : 'standard'})`,
        `Estimated duration: ${estimatedDurationHours} hours (${Math.ceil(estimatedDurationHours / 24)} business days)`,
        ...(parallelSavings > 0 ? [`Parallel execution saves ~${parallelSavings} hours vs sequential`] : []),
      ]),
      metadata: { tier, industry, stepCount: steps.length, estimatedDurationHours, parallelGroupCount: parallelGroups.length },
    };
  }

  private detectIndustry(ctx: Record<string, any>, text: string): string {
    const industry = (ctx.industry || ctx.department || '').toLowerCase();
    if (industry) {
      if (industry.includes('health') || industry.includes('pharma') || industry.includes('medical')) return 'healthcare';
      if (industry.includes('finance') || industry.includes('bank') || industry.includes('insurance')) return 'finance';
      if (industry.includes('government') || industry.includes('federal') || industry.includes('public')) return 'government';
    }
    if (!text) return 'general';
    if (/hipaa|phi|protected\s+health|medical\s+record/i.test(text)) return 'healthcare';
    if (/sox|sarbanes|aml|kyc|dodd.?frank/i.test(text)) return 'finance';
    if (/far\s+|dfars|federal\s+acqui|government\s+contract/i.test(text)) return 'government';
    return 'general';
  }

  protected getEventType(): 'workflow_authored' {
    return 'workflow_authored';
  }
}

export const workflowAuthoringAgent = new WorkflowAuthoringAgent();
