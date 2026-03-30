/**
 * Onboarding Coach Agent — Codename: Navigator 🧭
 *
 * Analyses a tenant's contract portfolio completeness and platform
 * usage to generate a setup checklist, completion percentages,
 * and recommendations for underused features.
 *
 * Cluster: strategists | Handle: @navigator
 */

import { BaseAgent } from './base-agent';
import type { AgentInput, AgentOutput, AgentRecommendation } from './types';
import { logger } from '../utils/logger';
import clientsDb from 'clients-db';

const getClient = typeof clientsDb === 'function' ? clientsDb : (clientsDb as any).default;
const prisma = getClient();

// --------------------------------------------------------------------------
// Internal types
// --------------------------------------------------------------------------

interface ChecklistItem {
  id: string;
  category: string;
  label: string;
  completed: boolean;
  value?: string;
  tip: string;
}

interface FeatureSuggestion {
  feature: string;
  description: string;
  currentUsage: string;
  priority: 'high' | 'medium' | 'low';
}

interface OnboardingReport {
  completionPercentage: number;
  checklist: ChecklistItem[];
  featureSuggestions: FeatureSuggestion[];
  maturityLevel: 'beginner' | 'developing' | 'established' | 'advanced';
  generatedAt: string;
}

// --------------------------------------------------------------------------
// Agent implementation
// --------------------------------------------------------------------------

export class OnboardingCoachAgent extends BaseAgent {
  name = 'onboarding-coach-agent';
  version = '1.0.0';
  capabilities = ['onboarding-coaching'] as string[];

  async execute(input: AgentInput): Promise<AgentOutput> {
    const tenantId = input.tenantId;

    logger.info({ contractId: input.contractId, tenantId }, 'Running onboarding assessment');

    // Gather portfolio stats
    let stats: {
      contractCount: number;
      artifactCount: number;
      templateCount: number;
      userCount: number;
      hasWorkflows: boolean;
      hasChatHistory: boolean;
      hasComplianceCheck: boolean;
      uniqueAgentsUsed: number;
    };

    try {
      const [contractCount, artifactCount, templateCount, userCount, workflowCount, chatCount, complianceCount, agentActions] = await Promise.all([
        prisma.contract.count({ where: { tenantId } }),
        prisma.artifact.count({ where: { contract: { tenantId } } }),
        prisma.contractTemplate.count({ where: { tenantId } }),
        prisma.user.count({ where: { tenantId } }),
        prisma.auditLog.count({ where: { tenantId, action: { startsWith: 'workflow:' } } }),
        prisma.auditLog.count({ where: { tenantId, action: { startsWith: 'agent:' } } }),
        prisma.auditLog.count({ where: { tenantId, action: { contains: 'compliance' } } }).catch(() => 0),
        prisma.auditLog.findMany({
          where: { tenantId, action: { startsWith: 'agent:' } },
          select: { action: true },
          distinct: ['action'],
          take: 50,
        }).catch(() => [] as any[]),
      ]);

      stats = {
        contractCount,
        artifactCount,
        templateCount,
        userCount,
        hasWorkflows: workflowCount > 0,
        hasChatHistory: chatCount > 0,
        hasComplianceCheck: complianceCount > 0,
        uniqueAgentsUsed: agentActions.length,
      };
    } catch (error) {
      logger.error({ error, tenantId }, 'Failed to gather onboarding stats');
      return {
        success: false,
        confidence: 0,
        reasoning: `Failed to query tenant stats: ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    // --- Build checklist ---
    const checklist: ChecklistItem[] = [
      {
        id: 'check-contracts',
        category: 'Data',
        label: 'Upload at least one contract',
        completed: stats.contractCount > 0,
        value: `${stats.contractCount} uploaded`,
        tip: 'Upload a PDF contract via the dashboard to kick off AI analysis.',
      },
      {
        id: 'check-artifacts',
        category: 'Data',
        label: 'Generate artifacts for a contract',
        completed: stats.artifactCount > 0,
        value: `${stats.artifactCount} artifacts generated`,
        tip: 'Artifacts are generated automatically when a contract is processed. Check the Artifacts tab.',
      },
      {
        id: 'check-multi-contracts',
        category: 'Data',
        label: 'Upload 5+ contracts for portfolio analysis',
        completed: stats.contractCount >= 5,
        value: `${stats.contractCount} of 5`,
        tip: 'Portfolio analytics require multiple contracts. Upload at least 5 for meaningful insights.',
      },
      {
        id: 'check-templates',
        category: 'Templates',
        label: 'Create a contract template',
        completed: stats.templateCount > 0,
        value: `${stats.templateCount} templates`,
        tip: 'Templates speed up drafting. Go to Templates > Create New to build a reusable template.',
      },
      {
        id: 'check-team',
        category: 'Collaboration',
        label: 'Invite team members',
        completed: stats.userCount > 1,
        value: `${stats.userCount} user(s)`,
        tip: 'Invite colleagues from Settings > Team to collaborate on contract review.',
      },
      {
        id: 'check-workflows',
        category: 'Workflows',
        label: 'Set up an approval workflow',
        completed: stats.hasWorkflows,
        value: stats.hasWorkflows ? 'Active' : 'Not configured',
        tip: 'Configure approval workflows in Settings to automate contract review routing.',
      },
      {
        id: 'check-chat',
        category: 'AI',
        label: 'Use the AI chatbot on a contract',
        completed: stats.hasChatHistory,
        value: stats.hasChatHistory ? 'Used' : 'Not used',
        tip: 'Open any contract and click "Chat with AI" to ask questions about contract terms.',
      },
      {
        id: 'check-compliance',
        category: 'Compliance',
        label: 'Run compliance analysis on a contract',
        completed: stats.hasComplianceCheck,
        value: stats.hasComplianceCheck ? 'Active' : 'Not run',
        tip: 'Compliance monitoring agents automatically flag regulatory risks — upload a contract to trigger analysis.',
      },
      {
        id: 'check-agents',
        category: 'AI',
        label: 'Interact with 3+ different AI agents',
        completed: stats.uniqueAgentsUsed >= 3,
        value: `${stats.uniqueAgentsUsed} agent(s) used`,
        tip: 'Mention agents like @sage, @sentinel, or @merchant in the chatbot to access specialised contract intelligence.',
      },
    ];

    const completedCount = checklist.filter(c => c.completed).length;
    const completionPercentage = Math.round((completedCount / checklist.length) * 100);

    // --- Feature suggestions ---
    const featureSuggestions: FeatureSuggestion[] = [];

    if (stats.templateCount === 0) {
      featureSuggestions.push({
        feature: 'Contract Templates',
        description: 'Create reusable templates to standardise contract drafting and reduce cycle time.',
        currentUsage: '0 templates created',
        priority: 'high',
      });
    }

    if (!stats.hasWorkflows && stats.contractCount >= 3) {
      featureSuggestions.push({
        feature: 'Approval Workflows',
        description: 'Automate review routing with approval workflows. Set up value-based or type-based routing rules.',
        currentUsage: 'No workflows configured',
        priority: 'high',
      });
    }

    if (!stats.hasChatHistory && stats.contractCount > 0) {
      featureSuggestions.push({
        feature: 'AI Contract Assistant',
        description: 'Ask the AI chatbot questions about any contract — risks, obligations, key terms, and more.',
        currentUsage: 'Not yet used',
        priority: 'medium',
      });
    }

    if (stats.contractCount > 0 && stats.contractCount < 5) {
      featureSuggestions.push({
        feature: 'Portfolio Analytics',
        description: 'Upload 5+ contracts to unlock portfolio-wide analytics including spend analysis and vendor concentration.',
        currentUsage: `${stats.contractCount} of 5 contracts needed`,
        priority: 'medium',
      });
    }

    if (stats.userCount <= 1) {
      featureSuggestions.push({
        feature: 'Team Collaboration',
        description: 'Invite team members to collaborate on contract review, comments, and approvals.',
        currentUsage: 'Single user',
        priority: 'low',
      });
    }

    if (stats.uniqueAgentsUsed < 3 && stats.contractCount > 0) {
      featureSuggestions.push({
        feature: 'Agent Specialisation',
        description: 'Explore specialised agents: @mediator for conflict detection, @blueprinter for workflow design, @synthesizer for portfolio analytics.',
        currentUsage: `${stats.uniqueAgentsUsed} agent(s) tried`,
        priority: stats.uniqueAgentsUsed === 0 ? 'high' : 'medium',
      });
    }

    // --- Maturity level ---
    let maturityLevel: OnboardingReport['maturityLevel'];
    if (completionPercentage < 30) maturityLevel = 'beginner';
    else if (completionPercentage < 60) maturityLevel = 'developing';
    else if (completionPercentage < 90) maturityLevel = 'established';
    else maturityLevel = 'advanced';

    const report: OnboardingReport = {
      completionPercentage,
      checklist,
      featureSuggestions,
      maturityLevel,
      generatedAt: new Date().toISOString(),
    };

    // --- Recommendations ---
    const recommendations: AgentRecommendation[] = featureSuggestions.map((fs, idx) => ({
      id: `onboard-rec-${idx}-${Date.now()}`,
      title: `Activate: ${fs.feature}`,
      description: fs.description,
      category: 'process-improvement' as const,
      priority: fs.priority as 'high' | 'medium' | 'low',
      confidence: 0.9,
      effort: 'low' as const,
      timeframe: 'This week',
      actions: [],
      reasoning: `Current usage: ${fs.currentUsage}`,
    }));

    return {
      success: true,
      data: report,
      recommendations,
      confidence: 0.9,
      reasoning: this.formatReasoning([
        `Onboarding completion: ${completionPercentage}% (${completedCount}/${checklist.length})`,
        `Maturity level: ${maturityLevel}`,
        `${featureSuggestions.length} feature suggestion(s)`,
        `Contracts: ${stats.contractCount}, Templates: ${stats.templateCount}, Users: ${stats.userCount}`,
      ]),
      metadata: { completionPercentage, maturityLevel },
    };
  }

  protected getEventType(): 'onboarding_coached' {
    return 'onboarding_coached';
  }
}

export const onboardingCoachAgent = new OnboardingCoachAgent();
