/**
 * Agent Dispatch Service
 * 
 * Bridges the AgentRegistry to the orchestrator pipeline.
 * Provides typed dispatch to any registered intelligence agent,
 * with error isolation, timeout, result aggregation, and rich
 * context enrichment from artifacts, RAG, and Knowledge Graph.
 * 
 * @version 2.0.0 - Now with context enrichment
 */

import { agentRegistry } from './index';
import type { AgentInput, AgentOutput } from './types';
import { logger } from '../utils/logger';
import {
  agentContextEnrichmentService,
  type EnrichedAgentContext,
} from '../compat/data-orchestration';

const AGENT_TIMEOUT_MS = parseInt(process.env.AGENT_DISPATCH_TIMEOUT_MS || '15000', 10);
const ENABLE_CONTEXT_ENRICHMENT = process.env.ENABLE_AGENT_CONTEXT_ENRICHMENT !== 'false';

/**
 * Build enriched agent input with full context from all data sources
 */
async function buildEnrichedInput(
  contractId: string,
  tenantId: string,
  baseContext: Record<string, any> = {},
  options: {
    includeArtifacts?: boolean;
    includeSimilarContracts?: boolean;
    includeGraphInsights?: boolean;
    includeSemanticContext?: boolean;
  } = {}
): Promise<AgentInput> {
  // Start with basic context
  let enrichedContext = { ...baseContext };
  let enrichmentMeta: EnrichedAgentContext['_meta'] | undefined;
  
  if (ENABLE_CONTEXT_ENRICHMENT) {
    try {
      const enrichment = await agentContextEnrichmentService.enrichContext(
        contractId,
        tenantId,
        {
          includeArtifacts: options.includeArtifacts ?? true,
          similarContractLimit: options.includeSimilarContracts ? 5 : 0,
          includeGraphInsights: options.includeGraphInsights ?? true,
          includeSemanticContext: options.includeSemanticContext ?? true,
          cacheTtlMs: 5 * 60 * 1000, // 5 minutes
        }
      );
      
      // Merge enriched data into context
      enrichedContext = {
        ...enrichedContext,
        contract: enrichment.contract,
        artifacts: enrichment.artifacts,
        similarContracts: enrichment.similarContracts,
        graphInsights: enrichment.graphInsights,
        semanticContext: enrichment.semanticContext,
        patterns: enrichment.patterns,
        _enrichment: enrichment._meta,
      };
      
      enrichmentMeta = enrichment._meta;
      
      logger.debug({
        contractId,
        enrichmentTimeMs: enrichmentMeta?.enrichmentTimeMs,
        sources: enrichmentMeta?.dataSources,
      }, 'Agent context enriched');
    } catch (error) {
      logger.warn({ error, contractId }, 'Context enrichment failed, using base context');
    }
  }
  
  return {
    contractId,
    tenantId,
    context: enrichedContext,
    metadata: {
      triggeredBy: baseContext.triggeredBy || 'system',
      priority: baseContext.priority || 'medium',
      timestamp: new Date(),
      enrichment: enrichmentMeta,
    },
  };
}

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
 * Now with full context enrichment from artifacts, RAG, and Knowledge Graph.
 */
export async function runPostArtifactIntelligence(
  contractId: string,
  tenantId: string,
  context: Record<string, any>,
): Promise<Map<string, AgentOutput>> {
  const input = await buildEnrichedInput(contractId, tenantId, context, {
    includeArtifacts: true,
    includeSimilarContracts: false, // Skip for speed
    includeGraphInsights: false,    // Skip for speed
    includeSemanticContext: false,  // Skip for speed
  });

  return dispatchToAgents([
    'proactive-validation-agent',
    'contract-health-monitor',
    'smart-gap-filling-agent',
    'conflict-resolution-agent',
  ], input);
}

/**
 * Post-pipeline intelligence pass
 * Runs the full intelligence suite after the entire pipeline completes.
 * Includes complete context enrichment for deep analysis.
 */
export async function runPostPipelineIntelligence(
  contractId: string,
  tenantId: string,
  context: Record<string, any>,
): Promise<Map<string, AgentOutput>> {
  const input = await buildEnrichedInput(contractId, tenantId, context, {
    includeArtifacts: true,
    includeSimilarContracts: true,
    includeGraphInsights: true,
    includeSemanticContext: true,
  });

  return dispatchToAgents([
    'workflow-suggestion-engine',
    'autonomous-deadline-manager',
    'opportunity-discovery-engine',
    'compliance-monitoring-agent',
    'obligation-tracking-agent',
    'contract-summarization-agent',
    'template-generation-agent',
    'contract-transformation-agent',
  ], input);
}

/**
 * Dispatch on pipeline failure — retry agent analyzes failures
 * and returns a strategy for recovery.
 */
export async function runOnFailure(
  contractId: string,
  tenantId: string,
  failureHistory: Array<{ stage: string; error: string; timestamp: Date }>,
): Promise<AgentOutput> {
  const input = await buildEnrichedInput(contractId, tenantId, { failureHistory }, {
    includeArtifacts: false,
    includeSimilarContracts: false,
    includeGraphInsights: false,
    includeSemanticContext: false,
  });
  
  return dispatchToAgent('adaptive-retry-agent', input);
}

/**
 * Dispatch learning feedback — records user corrections
 * for continuous extraction improvement.
 */
export async function runLearningFeedback(
  contractId: string,
  tenantId: string,
  userCorrections: Array<{ field: string; originalValue: any; correctedValue: any; reason?: string }>,
): Promise<AgentOutput> {
  const input = await buildEnrichedInput(contractId, tenantId, { userCorrections }, {
    includeArtifacts: true,
    includeSimilarContracts: false,
    includeGraphInsights: false,
    includeSemanticContext: false,
  });
  
  return dispatchToAgent('continuous-learning-agent', input);
}

/**
 * Interactive agent dispatch for chat/API usage
 * Full context enrichment for user-facing interactions
 */
export async function dispatchInteractive(
  agentName: string,
  contractId: string,
  tenantId: string,
  query: string,
  userContext?: Record<string, any>,
): Promise<AgentOutput> {
  const input = await buildEnrichedInput(contractId, tenantId, {
    query,
    userContext,
    triggeredBy: 'user',
    priority: 'high',
  }, {
    includeArtifacts: true,
    includeSimilarContracts: true,
    includeGraphInsights: true,
    includeSemanticContext: true,
  });
  
  return dispatchToAgent(agentName, input);
}

/**
 * Batch dispatch for portfolio-wide analysis
 * Efficiently processes multiple contracts with shared enrichment
 */
export async function dispatchPortfolioAnalysis(
  agentName: string,
  contractIds: string[],
  tenantId: string,
  analysisType: string,
): Promise<Map<string, AgentOutput>> {
  const results = new Map<string, AgentOutput>();
  
  // Process in batches to avoid overwhelming the system
  const BATCH_SIZE = 5;
  for (let i = 0; i < contractIds.length; i += BATCH_SIZE) {
    const batch = contractIds.slice(i, i + BATCH_SIZE);
    
    const batchResults = await Promise.allSettled(
      batch.map(async (contractId) => {
        const input = await buildEnrichedInput(contractId, tenantId, {
          analysisType,
          portfolioMode: true,
          batchIndex: i / BATCH_SIZE,
        }, {
          includeArtifacts: true,
          includeSimilarContracts: false,
          includeGraphInsights: true,
          includeSemanticContext: false,
        });
        
        const output = await dispatchToAgent(agentName, input);
        return { contractId, output };
      })
    );
    
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.set(result.value.contractId, result.value.output);
      }
    }
  }
  
  logger.info({
    agentName,
    totalContracts: contractIds.length,
    successful: Array.from(results.values()).filter(r => r.success).length,
  }, 'Portfolio analysis completed');
  
  return results;
}

// Re-export enrichment service for direct use
export { agentContextEnrichmentService, type EnrichedAgentContext };
