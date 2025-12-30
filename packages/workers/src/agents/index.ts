/**
 * Agent Registry
 * Central registry for all agentic AI workers
 */

import type { BaseAgent } from './base-agent';
import { proactiveValidationAgent } from './proactive-validation-agent';
import { smartGapFillingAgent } from './smart-gap-filling-agent';
import { adaptiveRetryAgent } from './adaptive-retry-agent';
import { workflowSuggestionEngine } from './workflow-suggestion-engine';
import { autonomousDeadlineManager } from './autonomous-deadline-manager';
import { contractHealthMonitor } from './contract-health-monitor';
import { continuousLearningAgent } from './continuous-learning-agent';
import { opportunityDiscoveryEngine } from './opportunity-discovery-engine';
import { intelligentSearchAgent } from './intelligent-search-agent';

export class AgentRegistry {
  private agents: Map<string, BaseAgent>;

  constructor() {
    this.agents = new Map();
    this.registerAllAgents();
  }

  /**
   * Register all available agents
   */
  private registerAllAgents(): void {
    // Phase 1: Quality & Reliability
    this.register(proactiveValidationAgent);
    this.register(smartGapFillingAgent);
    this.register(adaptiveRetryAgent);

    // Phase 2: Process Optimization
    this.register(workflowSuggestionEngine);
    this.register(autonomousDeadlineManager);
    this.register(contractHealthMonitor);
    this.register(continuousLearningAgent);

    // Phase 3: Advanced Intelligence
    this.register(opportunityDiscoveryEngine);
    this.register(intelligentSearchAgent);
  }

  /**
   * Register an agent
   */
  register(agent: BaseAgent): void {
    this.agents.set(agent.name, agent);
  }

  /**
   * Get agent by name
   */
  get(name: string): BaseAgent | undefined {
    return this.agents.get(name);
  }

  /**
   * Get all registered agents
   */
  getAll(): BaseAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get agents by capability
   */
  getByCapability(capability: string): BaseAgent[] {
    return this.getAll().filter(agent =>
      agent.capabilities.includes(capability)
    );
  }

  /**
   * List all available agents
   */
  list(): Array<{
    name: string;
    version: string;
    capabilities: string[];
  }> {
    return this.getAll().map(agent => ({
      name: agent.name,
      version: agent.version,
      capabilities: agent.capabilities,
    }));
  }
}

// Export singleton instance
export const agentRegistry = new AgentRegistry();

// Export all agents
export {
  proactiveValidationAgent,
  smartGapFillingAgent,
  adaptiveRetryAgent,
  workflowSuggestionEngine,
  autonomousDeadlineManager,
  contractHealthMonitor,
  continuousLearningAgent,
  opportunityDiscoveryEngine,
  intelligentSearchAgent,
};

// Export types
export type { BaseAgent };
export * from './types';
