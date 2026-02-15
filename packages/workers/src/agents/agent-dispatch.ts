/**
 * Agent Dispatch Service
 * 
 * Bridges the AgentRegistry to the orchestrator pipeline.
 * Provides typed dispatch to any registered intelligence agent,
 * with error isolation, timeout, and result aggregation.
 */

import { agentRegistry } from './index';
import type { AgentInput, AgentOutput } from './types';
import { logger } from '../utils/logger';

const AGENT_TIMEOUT_MS = parseInt(process.env.AGENT_DISPATCH_TIMEOUT_MS || '15000', 10);

/**
 * Dispatch to a single registered agent by name.
 * Returns the output on success, or a synthetic failure output on error/timeout.
 */
export async function dispatchToAgent(
  agentName: string,
  input: AgentInput,
): Promise<AgentOutput> {
  const agent = agentRegistry.get(agentName);
  if (!agent) {
    logger.warn({ agentName }, 'Agent not found in registry');
    return { success: false, confidence: 0, reasoning: `Agent "${agentName}" not registered` };
  }

  try {
    const result = await Promise.race<AgentOutput>([
      agent.executeWithTracking(input),
      new Promise<AgentOutput>((_, reject) =>
        setTimeout(() => reject(new Error(`Agent "${agentName}" timed out after ${AGENT_TIMEOUT_MS}ms`)), AGENT_TIMEOUT_MS)
      ),
    ]);

    logger.info({
      agentName,
      contractId: input.contractId,
      success: result.success,
      confidence: result.confidence,
    }, `Agent dispatch completed: ${agentName}`);

    return result;
  } catch (error) {
    logger.error({ error, agentName, contractId: input.contractId }, `Agent dispatch failed: ${agentName}`);
    return {
      success: false,
      confidence: 0,
      reasoning: `Agent "${agentName}" failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Dispatch to multiple agents in parallel with error isolation.
 * Each agent runs independently — one failure doesn't block others.
 */
export async function dispatchToAgents(
  agentNames: string[],
  input: AgentInput,
): Promise<Map<string, AgentOutput>> {
  const results = new Map<string, AgentOutput>();

  const settled = await Promise.allSettled(
    agentNames.map(async (name) => {
      const output = await dispatchToAgent(name, input);
      return { name, output };
    }),
  );

  for (const result of settled) {
    if (result.status === 'fulfilled') {
      results.set(result.value.name, result.value.output);
    }
  }

  logger.info({
    contractId: input.contractId,
    dispatched: agentNames.length,
    succeeded: Array.from(results.values()).filter(r => r.success).length,
    failed: agentNames.length - results.size,
  }, 'Multi-agent dispatch completed');

  return results;
}

/**
 * Post-artifact intelligence pass
 * Runs the validation + health suite after artifacts are generated.
 */
export async function runPostArtifactIntelligence(
  contractId: string,
  tenantId: string,
  context: Record<string, any>,
): Promise<Map<string, AgentOutput>> {
  const input: AgentInput = {
    contractId,
    tenantId,
    context,
    metadata: {
      triggeredBy: 'system',
      priority: 'medium',
      timestamp: new Date(),
    },
  };

  return dispatchToAgents([
    'proactive-validation-agent',
    'contract-health-monitor',
    'smart-gap-filling-agent',
  ], input);
}

/**
 * Post-pipeline intelligence pass
 * Runs the full intelligence suite after the entire pipeline completes.
 */
export async function runPostPipelineIntelligence(
  contractId: string,
  tenantId: string,
  context: Record<string, any>,
): Promise<Map<string, AgentOutput>> {
  const input: AgentInput = {
    contractId,
    tenantId,
    context,
    metadata: {
      triggeredBy: 'system',
      priority: 'low',
      timestamp: new Date(),
    },
  };

  return dispatchToAgents([
    'workflow-suggestion-engine',
    'autonomous-deadline-manager',
    'opportunity-discovery-engine',
  ], input);
}
