/**
 * Workflow Orchestrator Agent — Codename: Orchestrator 🎼
 *
 * Decomposes multi-step analysis requests into an ordered dispatch
 * plan of registered agents, manages sequencing, and merges
 * individual outputs into a unified result.
 *
 * Cluster: evolution | Handle: @orchestrator
 */

import { BaseAgent } from './base-agent';
import type { AgentInput, AgentOutput } from './types';
import { agentRegistry } from './index';
import { dispatchToAgent } from './agent-dispatch';
import { logger } from '../utils/logger';

// --------------------------------------------------------------------------
// Internal types
// --------------------------------------------------------------------------

interface PlanStep {
  agentName: string;
  reason: string;
  order: number;
  dependsOn: string[];
}

interface OrchestratedResult {
  plan: PlanStep[];
  results: Record<string, AgentOutput>;
  summary: string;
  success: boolean;
  executedAt: string;
}

// Agent keywords for intent-to-agent mapping
const INTENT_MAP: Array<{ keywords: RegExp; agents: string[] }> = [
  { keywords: /risk|compliance|regulat/i, agents: ['compliance-monitoring-agent', 'proactive-validation-agent'] },
  { keywords: /obligation|deadline|due\s?date/i, agents: ['obligation-tracking-agent', 'autonomous-deadline-manager'] },
  { keywords: /template|draft|boilerplate/i, agents: ['template-generation-agent'] },
  { keywords: /conflict|contradict|inconsisten/i, agents: ['conflict-resolution-agent'] },
  { keywords: /health|quality|score/i, agents: ['contract-health-monitor'] },
  { keywords: /workflow|approval|routing/i, agents: ['workflow-suggestion-engine', 'workflow-authoring-agent'] },
  { keywords: /opportunit|saving|spend/i, agents: ['opportunity-discovery-engine'] },
  { keywords: /search|find|lookup/i, agents: ['intelligent-search-agent'] },
  { keywords: /summar|overview|brief/i, agents: ['contract-summarization-agent'] },
  { keywords: /transform|structur|entity|pattern/i, agents: ['contract-transformation-agent'] },
  { keywords: /portfolio|trend|analyt/i, agents: ['data-synthesizer-agent'] },
  { keywords: /gap|missing|incomplet/i, agents: ['smart-gap-filling-agent'] },
  { keywords: /onboard|setup|checklist|getting\s?started/i, agents: ['onboarding-coach-agent'] },
];

// Dependency ordering hints (agent → should run after these)
const DEPENDENCY_HINTS: Record<string, string[]> = {
  'conflict-resolution-agent': [],
  'proactive-validation-agent': [],
  'contract-health-monitor': ['proactive-validation-agent'],
  'smart-gap-filling-agent': ['proactive-validation-agent'],
  'compliance-monitoring-agent': ['proactive-validation-agent'],
  'obligation-tracking-agent': [],
  'autonomous-deadline-manager': ['obligation-tracking-agent'],
  'workflow-suggestion-engine': ['compliance-monitoring-agent'],
  'workflow-authoring-agent': ['workflow-suggestion-engine'],
  'opportunity-discovery-engine': ['contract-health-monitor'],
  'contract-summarization-agent': [],
  'template-generation-agent': [],
  'contract-transformation-agent': [],
  'data-synthesizer-agent': [],
  'onboarding-coach-agent': [],
};

// --------------------------------------------------------------------------
// Agent implementation
// --------------------------------------------------------------------------

export class WorkflowOrchestratorAgent extends BaseAgent {
  name = 'workflow-orchestrator-agent';
  version = '1.0.0';
  capabilities = ['workflow-orchestration'] as string[];

  async execute(input: AgentInput): Promise<AgentOutput> {
    const query = (input.context?.query as string) ?? '';
    logger.info({ contractId: input.contractId, query }, 'Orchestrator building dispatch plan');

    // 1. Resolve intent → agents
    const matchedAgents = this.resolveAgents(query);

    if (matchedAgents.length === 0) {
      return {
        success: true,
        data: { plan: [], results: {}, summary: 'No matching agents for the request.', success: true, executedAt: new Date().toISOString() },
        confidence: 0.5,
        reasoning: this.formatReasoning(['No agent intents matched the query']),
      };
    }

    // 2. Build ordered plan
    const plan = this.buildPlan(matchedAgents);

    // 3. Execute plan (sequential for dependency-chained steps)
    const results: Record<string, AgentOutput> = {};
    const executed = new Set<string>();
    let successCount = 0;

    // Group by order for parallel execution within the same level
    const orderGroups = new Map<number, PlanStep[]>();
    for (const step of plan) {
      const group = orderGroups.get(step.order) ?? [];
      group.push(step);
      orderGroups.set(step.order, group);
    }

    const sortedOrders = [...orderGroups.keys()].sort((a, b) => a - b);

    for (const order of sortedOrders) {
      const group = orderGroups.get(order) ?? [];
      const settled = await Promise.allSettled(
        group.map(async (step) => {
          // Verify dependencies are satisfied
          const depsOk = step.dependsOn.every(d => executed.has(d));
          if (!depsOk) {
            logger.warn({ agent: step.agentName, missingDeps: step.dependsOn.filter(d => !executed.has(d)) }, 'Skipping agent — unmet dependencies');
            return { name: step.agentName, output: { success: false, confidence: 0, reasoning: 'Unmet dependencies' } as AgentOutput };
          }
          const output = await dispatchToAgent(step.agentName, input);
          return { name: step.agentName, output };
        }),
      );

      for (const r of settled) {
        if (r.status === 'fulfilled') {
          results[r.value.name] = r.value.output;
          executed.add(r.value.name);
          if (r.value.output.success) successCount++;
        }
      }
    }

    const summary = this.synthesizeResults(plan, results, successCount);

    const orchestratedResult: OrchestratedResult = {
      plan,
      results,
      summary,
      success: successCount > 0,
      executedAt: new Date().toISOString(),
    };

    // Collect all recommendations from sub-agents, deduplicated by category
    const allRecommendations = Object.values(results)
      .flatMap(r => r.recommendations ?? []);
    const seenCategories = new Set<string>();
    const dedupedRecommendations = allRecommendations.filter(rec => {
      const key = `${rec.category}:${rec.title}`;
      if (seenCategories.has(key)) return false;
      seenCategories.add(key);
      return true;
    });

    return {
      success: successCount > 0,
      data: orchestratedResult,
      recommendations: dedupedRecommendations.length > 0 ? dedupedRecommendations : undefined,
      confidence: successCount / Math.max(plan.length, 1),
      reasoning: this.formatReasoning([
        `Query: "${query.slice(0, 120)}"`,
        `Matched ${matchedAgents.length} agent(s): ${matchedAgents.join(', ')}`,
        `Executed ${executed.size} / ${plan.length} — ${successCount} succeeded`,
        ...Object.entries(results)
          .filter(([, r]) => !r.success)
          .map(([name, r]) => `⚠️  ${name} failed: ${(r.reasoning || 'unknown error').slice(0, 80)}`),
        ...(dedupedRecommendations.length > 0 ? [`${dedupedRecommendations.length} cross-agent recommendation(s) collected`] : []),
      ]),
    };
  }

  /** Synthesize a human-readable summary from all agent results */
  private synthesizeResults(plan: PlanStep[], results: Record<string, AgentOutput>, successCount: number): string {
    const lines: string[] = [`Orchestrated ${plan.length} agent(s): ${successCount} succeeded, ${plan.length - successCount} failed/skipped.`];

    for (const step of plan) {
      const result = results[step.agentName];
      if (!result) {
        lines.push(`• ${step.agentName}: skipped (not executed)`);
        continue;
      }
      if (result.success) {
        const dataKeys = result.data ? Object.keys(result.data) : [];
        const recCount = result.recommendations?.length ?? 0;
        lines.push(`• ${step.agentName}: ✅ confidence=${(result.confidence * 100).toFixed(0)}%` +
          (recCount > 0 ? ` — ${recCount} recommendation(s)` : '') +
          (dataKeys.length > 0 ? ` — output: ${dataKeys.join(', ')}` : ''));
      } else {
        lines.push(`• ${step.agentName}: ❌ ${(result.reasoning || 'no details').slice(0, 100)}`);
      }
    }

    return lines.join('\n');
  }

  /** Map query text to agent names */
  private resolveAgents(query: string): string[] {
    if (!query) return [];
    const matched = new Set<string>();
    const registered = new Set(agentRegistry.getAll().map(a => a.name));

    for (const entry of INTENT_MAP) {
      if (entry.keywords.test(query)) {
        for (const agent of entry.agents) {
          if (registered.has(agent)) {
            matched.add(agent);
          }
        }
      }
    }
    return Array.from(matched);
  }

  /** Build a dependency-ordered plan */
  private buildPlan(agents: string[]): PlanStep[] {
    const agentSet = new Set(agents);
    const steps: PlanStep[] = [];

    // Topological-ish ordering using dependency hints
    const resolved = new Set<string>();
    const pending = [...agents];
    let order = 0;
    const maxIterations = agents.length + 1;
    let iteration = 0;

    while (pending.length > 0 && iteration < maxIterations) {
      iteration++;
      const batch: string[] = [];

      for (const name of pending) {
        const deps = (DEPENDENCY_HINTS[name] ?? []).filter(d => agentSet.has(d));
        if (deps.every(d => resolved.has(d))) {
          batch.push(name);
        }
      }

      if (batch.length === 0) {
        // Break cycle by adding all remaining
        batch.push(...pending);
      }

      for (const name of batch) {
        steps.push({
          agentName: name,
          reason: `Matched query intent`,
          order,
          dependsOn: (DEPENDENCY_HINTS[name] ?? []).filter(d => agentSet.has(d)),
        });
        resolved.add(name);
      }

      // Remove resolved from pending
      for (const name of batch) {
        const idx = pending.indexOf(name);
        if (idx !== -1) pending.splice(idx, 1);
      }

      order++;
    }

    return steps;
  }

  protected getEventType(): 'workflow_orchestrated' {
    return 'workflow_orchestrated';
  }
}

export const workflowOrchestratorAgent = new WorkflowOrchestratorAgent();
