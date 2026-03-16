/**
 * Agent Swarm - Multi-Agent Collaboration System
 * 
 * Enables dynamic team formation where multiple agents collaborate
 * on complex tasks with specialized roles.
 * 
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import { logger } from '../utils/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface SwarmAgent {
  id: string;
  name: string;
  role: 'coordinator' | 'specialist' | 'reviewer' | 'executor';
  capabilities: string[];
  specialty: string;
  systemPrompt: string;
  model: string;
  maxTokens: number;
  currentLoad: number;
  maxConcurrent: number;
  successRate: number;
  avgResponseTime: number;
}

export interface SwarmTask {
  id: string;
  title: string;
  description: string;
  type: 'analysis' | 'generation' | 'review' | 'negotiation' | 'synthesis';
  requiredCapabilities: string[];
  complexity: 'simple' | 'moderate' | 'complex';
  context: Record<string, unknown>;
  constraints?: {
    maxDuration?: number;
    maxCost?: number;
    qualityThreshold?: number;
  };
  deadline?: Date;
}

export interface Subtask {
  id: string;
  title: string;
  description: string;
  assignedTo: string;
  dependencies: string[];
  estimatedDuration: number;
  outputFormat: 'text' | 'json' | 'structured';
}

export interface TaskPlan {
  id: string;
  taskId: string;
  strategy: 'parallel' | 'sequential' | 'hybrid';
  subtasks: Subtask[];
  coordinationPoints: Array<{
    afterSubtask: string;
    action: 'synthesize' | 'review' | 'vote';
  }>;
  estimatedTotalDuration: number;
}

export interface SwarmResult {
  taskId: string;
  success: boolean;
  output: unknown;
  metadata: {
    teamSize: number;
    subtasksCompleted: number;
    totalDuration: number;
    totalTokens: number;
    consensusLevel?: number;
  };
  contributions: Array<{
    agentId: string;
    agentName: string;
    contribution: string;
    confidence: number;
  }>;
  reasoning: string;
}

export interface ConsensusResult {
  consensus: boolean;
  confidence: number;
  agreedPoints: string[];
  disputedPoints: Array<{ point: string; views: Record<string, string> }>;
  resolution?: string;
}

// ============================================================================
// AGENT REGISTRY
// ============================================================================

export class AgentRegistry {
  private agents: Map<string, SwarmAgent> = new Map();
  private capabilityIndex: Map<string, Set<string>> = new Map();

  register(agent: SwarmAgent): void {
    this.agents.set(agent.id, agent);
    
    // Index by capabilities
    for (const cap of agent.capabilities) {
      if (!this.capabilityIndex.has(cap)) {
        this.capabilityIndex.set(cap, new Set());
      }
      this.capabilityIndex.get(cap)!.add(agent.id);
    }

    logger.info({ agentId: agent.id, name: agent.name }, 'Agent registered');
  }

  findAgents(criteria: {
    capabilities?: string[];
    role?: SwarmAgent['role'];
    available?: boolean;
    minSuccessRate?: number;
  }): SwarmAgent[] {
    let candidates = Array.from(this.agents.values());

    if (criteria.capabilities) {
      const capableSets = criteria.capabilities
        .map(cap => this.capabilityIndex.get(cap))
        .filter((set): set is Set<string> => set !== undefined);
      
      if (capableSets.length > 0) {
        const firstSet = capableSets[0]!;
        const capableIds = capableSets.slice(1).reduce<Set<string>>((intersection, set) => {
          return new Set([...intersection].filter(x => set.has(x)));
        }, firstSet);
        
        candidates = candidates.filter(a => capableIds.has(a.id));
      } else {
        candidates = [];
      }
    }

    if (criteria.role) {
      candidates = candidates.filter(a => a.role === criteria.role);
    }

    if (criteria.available) {
      candidates = candidates.filter(a => a.currentLoad < a.maxConcurrent);
    }

    if (criteria.minSuccessRate !== undefined) {
      const minRate = criteria.minSuccessRate;
      candidates = candidates.filter(a => a.successRate >= minRate);
    }

    return candidates;
  }

  getAgent(id: string): SwarmAgent | undefined {
    return this.agents.get(id);
  }

  updateLoad(agentId: string, delta: number): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.currentLoad = Math.max(0, agent.currentLoad + delta);
    }
  }
}

// ============================================================================
// SWARM ORCHESTRATOR
// ============================================================================

export class AgentSwarm extends EventEmitter {
  private registry: AgentRegistry;
  private openai: OpenAI;
  private activeTasks: Map<string, SwarmTeam> = new Map();

  constructor() {
    super();
    this.registry = new AgentRegistry();
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.initializeDefaultAgents();
  }

  private initializeDefaultAgents(): void {
    // Register built-in agents
    this.registry.register({
      id: 'coordinator-001',
      name: 'Coordinator',
      role: 'coordinator',
      capabilities: ['planning', 'coordination', 'synthesis', 'task-decomposition'],
      specialty: 'Multi-agent coordination and result synthesis',
      systemPrompt: `You are a coordinator agent. Your job is to break down complex tasks into subtasks, assign them to specialists, and synthesize their outputs into a coherent result. Focus on clarity, completeness, and consistency.`,
      model: 'gpt-4o',
      maxTokens: 4000,
      currentLoad: 0,
      maxConcurrent: 5,
      successRate: 0.95,
      avgResponseTime: 2000,
    });

    this.registry.register({
      id: 'legal-analyst-001',
      name: 'Legal Analyst',
      role: 'specialist',
      capabilities: ['legal-analysis', 'risk-assessment', 'compliance-check', 'contract-review'],
      specialty: 'Legal contract analysis and risk identification',
      systemPrompt: `You are a legal analyst specializing in contract law. Analyze contracts for legal risks, compliance issues, and potential liabilities. Provide specific citations and recommendations.`,
      model: 'gpt-4o',
      maxTokens: 4000,
      currentLoad: 0,
      maxConcurrent: 3,
      successRate: 0.92,
      avgResponseTime: 3000,
    });

    this.registry.register({
      id: 'financial-analyst-001',
      name: 'Financial Analyst',
      role: 'specialist',
      capabilities: ['financial-analysis', 'pricing', 'cost-optimization', 'benchmarking'],
      specialty: 'Financial analysis and cost optimization',
      systemPrompt: `You are a financial analyst. Analyze pricing, costs, and financial terms. Compare against benchmarks and identify savings opportunities. Provide quantified recommendations.`,
      model: 'gpt-4o',
      maxTokens: 3000,
      currentLoad: 0,
      maxConcurrent: 3,
      successRate: 0.90,
      avgResponseTime: 2500,
    });

    this.registry.register({
      id: 'negotiation-expert-001',
      name: 'Negotiation Expert',
      role: 'specialist',
      capabilities: ['negotiation', 'strategy', 'positioning', 'deal-structuring'],
      specialty: 'Negotiation strategy and deal optimization',
      systemPrompt: `You are a negotiation expert. Develop negotiation strategies, identify leverage points, and suggest optimal deal structures. Consider both immediate gains and long-term relationship value.`,
      model: 'gpt-4o',
      maxTokens: 3000,
      currentLoad: 0,
      maxConcurrent: 3,
      successRate: 0.88,
      avgResponseTime: 2800,
    });

    this.registry.register({
      id: 'compliance-officer-001',
      name: 'Compliance Officer',
      role: 'reviewer',
      capabilities: ['compliance', 'regulatory', 'audit', 'policy-check'],
      specialty: 'Regulatory compliance and policy adherence',
      systemPrompt: `You are a compliance officer. Review outputs for regulatory compliance, policy adherence, and audit readiness. Flag any concerns and suggest remediation.`,
      model: 'gpt-4o-mini',
      maxTokens: 2000,
      currentLoad: 0,
      maxConcurrent: 5,
      successRate: 0.94,
      avgResponseTime: 1500,
    });
  }

  /**
   * Submit a task to the swarm for collaborative execution
   */
  async execute(task: SwarmTask): Promise<SwarmResult> {
    logger.info({ taskId: task.id, type: task.type }, 'Swarm executing task');
    this.emit('task:started', task);

    try {
      // Step 1: Form team
      const team = this.formTeam(task);
      this.activeTasks.set(task.id, team);

      // Step 2: Create execution plan
      const plan = await team.createPlan(task);

      // Step 3: Execute subtasks
      const results = await team.execute(plan);

      // Step 4: Synthesize final output
      const synthesis = await team.synthesize(results, task);

      this.activeTasks.delete(task.id);
      this.emit('task:completed', { taskId: task.id, result: synthesis });

      return synthesis;
    } catch (error) {
      this.activeTasks.delete(task.id);
      this.emit('task:failed', { taskId: task.id, error });
      throw error;
    }
  }

  private formTeam(task: SwarmTask): SwarmTeam {
    // Select coordinator
    const coordinators = this.registry.findAgents({
      role: 'coordinator',
      available: true,
    });
    const coordinator = coordinators[0]; // Best coordinator
    if (!coordinator) {
      throw new Error('No coordinator agent available');
    }

    // Select specialists based on required capabilities
    const specialists = this.registry.findAgents({
      capabilities: task.requiredCapabilities,
      role: 'specialist',
      available: true,
      minSuccessRate: 0.85,
    }).slice(0, 3); // Max 3 specialists

    // Select reviewer if complex task
    let reviewer: SwarmAgent | undefined;
    if (task.complexity === 'complex') {
      const reviewers = this.registry.findAgents({
        role: 'reviewer',
        available: true,
      });
      reviewer = reviewers[0];
    }

    return new SwarmTeam(coordinator, specialists, reviewer, this.registry, this.openai);
  }

  getActiveTasks(): Array<{ taskId: string; team: string[] }> {
    return Array.from(this.activeTasks.entries()).map(([taskId, team]) => ({
      taskId,
      team: [team['coordinator'].id, ...team['specialists'].map(s => s.id)],
    }));
  }
}

// ============================================================================
// SWARM TEAM
// ============================================================================

class SwarmTeam {
  private totalTokensUsed = 0;

  constructor(
    private coordinator: SwarmAgent,
    private specialists: SwarmAgent[],
    private reviewer: SwarmAgent | undefined,
    private registry: AgentRegistry,
    private openai: OpenAI
  ) {}

  /**
   * Create execution plan for the task
   */
  async createPlan(task: SwarmTask): Promise<TaskPlan> {
    this.registry.updateLoad(this.coordinator.id, 1);

    const prompt = `Create an execution plan for this task:

Title: ${task.title}
Description: ${task.description}
Type: ${task.type}
Complexity: ${task.complexity}

Available Specialists:
${this.specialists.map(s => `- ${s.name}: ${s.specialty}`).join('\n')}

Create 2-4 subtasks that can be executed in parallel where possible.
Each subtask should be assigned to the most appropriate specialist.

Format as JSON:
{
  "strategy": "parallel|sequential|hybrid",
  "subtasks": [{
    "title": "...",
    "description": "...",
    "assignedTo": "${this.specialists[0]?.id || 'specialist'}",
    "dependencies": [],
    "estimatedDuration": 30,
    "outputFormat": "text|json|structured"
  }],
  "coordinationPoints": [{"afterSubtask": "id", "action": "synthesize|review|vote"}],
  "estimatedTotalDuration": 120
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.coordinator.model,
        messages: [
          { role: 'system', content: this.coordinator.systemPrompt },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        max_tokens: this.coordinator.maxTokens,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('No plan generated');
      this.totalTokensUsed += response.usage?.total_tokens ?? 0;

      const planData = JSON.parse(content);

      return {
        id: uuidv4(),
        taskId: task.id,
        strategy: planData.strategy,
        subtasks: planData.subtasks.map((st: any) => ({
          ...st,
          id: uuidv4(),
        })),
        coordinationPoints: planData.coordinationPoints,
        estimatedTotalDuration: planData.estimatedTotalDuration,
      };
    } finally {
      this.registry.updateLoad(this.coordinator.id, -1);
    }
  }

  /**
   * Execute all subtasks
   */
  async execute(plan: TaskPlan): Promise<Array<{ subtask: Subtask; result: unknown; agent: SwarmAgent }>> {
    const results: Array<{ subtask: Subtask; result: unknown; agent: SwarmAgent }> = [];

    // Group by dependencies
    const independent = plan.subtasks.filter(st => st.dependencies.length === 0);
    const dependent = plan.subtasks.filter(st => st.dependencies.length > 0);

    // Execute independent tasks in parallel
    const independentResults = await Promise.all(
      independent.map(st => this.executeSubtask(st))
    );
    results.push(...independentResults);

    // Execute dependent tasks
    for (const subtask of dependent) {
      // Wait for dependencies
      const depsComplete = subtask.dependencies.every(depId => 
        results.some(r => r.subtask.id === depId)
      );
      
      if (depsComplete) {
        const result = await this.executeSubtask(subtask);
        results.push(result);
      }
    }

    return results;
  }

  private async executeSubtask(
    subtask: Subtask
  ): Promise<{ subtask: Subtask; result: unknown; agent: SwarmAgent }> {
    const agent = this.registry.getAgent(subtask.assignedTo) || this.specialists[0];
    if (!agent) {
      throw new Error(`No agent available for subtask: ${subtask.title}`);
    }
    
    this.registry.updateLoad(agent.id, 1);
    const startTime = Date.now();

    try {
      const response = await this.openai.chat.completions.create({
        model: agent.model,
        messages: [
          { role: 'system', content: agent.systemPrompt },
          { role: 'user', content: `Task: ${subtask.title}\n\n${subtask.description}` },
        ],
        max_tokens: agent.maxTokens,
      });

      const result = response.choices[0]?.message?.content;
      this.totalTokensUsed += response.usage?.total_tokens ?? 0;

      // Parse structured output if needed
      let parsedResult: unknown = result;
      if (subtask.outputFormat === 'json' && result) {
        try {
          parsedResult = JSON.parse(result);
        } catch {
          // Keep as text if JSON parse fails
        }
      }

      return {
        subtask,
        result: parsedResult,
        agent,
      };
    } finally {
      this.registry.updateLoad(agent.id, -1);
      
      // Update metrics
      const duration = Date.now() - startTime;
      agent.avgResponseTime = (agent.avgResponseTime * 0.9) + (duration * 0.1);
      agent.successRate = Math.min(1, agent.successRate * 0.99 + 0.01);
    }
  }

  /**
   * Synthesize subtask results into final output
   */
  async synthesize(
    results: Array<{ subtask: Subtask; result: unknown; agent: SwarmAgent }>,
    originalTask: SwarmTask
  ): Promise<SwarmResult> {
    this.registry.updateLoad(this.coordinator.id, 1);

    try {
      const synthesisPrompt = `Synthesize these subtask results into a coherent final output:

Original Task: ${originalTask.title}
${originalTask.description}

Subtask Results:
${results.map(r => `
--- ${r.subtask.title} (${r.agent.name}) ---
${JSON.stringify(r.result, null, 2)}
`).join('\n')}

Provide:
1. Integrated final output
2. Key insights from each specialist
3. Any conflicts or gaps identified
4. Overall confidence level

Format as JSON:
{
  "output": "...",
  "insights": ["..."],
  "confidence": 0.95,
  "reasoning": "..."
}`;

      const response = await this.openai.chat.completions.create({
        model: this.coordinator.model,
        messages: [
          { role: 'system', content: this.coordinator.systemPrompt },
          { role: 'user', content: synthesisPrompt },
        ],
        response_format: { type: 'json_object' },
        max_tokens: this.coordinator.maxTokens,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('Synthesis failed');
      this.totalTokensUsed += response.usage?.total_tokens ?? 0;

      const synthesis = JSON.parse(content);

      // Review if reviewer assigned and complex task
      let finalOutput = synthesis.output;
      if (this.reviewer && originalTask.complexity === 'complex') {
        finalOutput = await this.reviewOutput(finalOutput, originalTask);
      }

      return {
        taskId: originalTask.id,
        success: true,
        output: finalOutput,
        metadata: {
          teamSize: 1 + this.specialists.length + (this.reviewer ? 1 : 0),
          subtasksCompleted: results.length,
          totalDuration: results.reduce((sum, r) => sum + (r.subtask.estimatedDuration || 0), 0),
          totalTokens: this.totalTokensUsed,
          consensusLevel: synthesis.confidence,
        },
        contributions: results.map(r => ({
          agentId: r.agent.id,
          agentName: r.agent.name,
          contribution: r.subtask.title,
          confidence: 0.85, // Would calculate from actual results
        })),
        reasoning: synthesis.reasoning,
      };
    } finally {
      this.registry.updateLoad(this.coordinator.id, -1);
    }
  }

  private async reviewOutput(output: unknown, task: SwarmTask): Promise<unknown> {
    if (!this.reviewer) return output;

    this.registry.updateLoad(this.reviewer.id, 1);

    try {
      const reviewPrompt = `Review this output for quality and completeness:

Task: ${task.title}
Output: ${JSON.stringify(output, null, 2)}

Check for:
- Accuracy and factual correctness
- Completeness (all requirements addressed)
- Clarity and coherence
- Compliance with any constraints

Provide reviewed/improved output.`;

      const response = await this.openai.chat.completions.create({
        model: this.reviewer.model,
        messages: [
          { role: 'system', content: this.reviewer.systemPrompt },
          { role: 'user', content: reviewPrompt },
        ],
        max_tokens: this.reviewer.maxTokens,
      });

      const reviewResult = response.choices[0]?.message?.content || output;
      this.totalTokensUsed += response.usage?.total_tokens ?? 0;
      return reviewResult;
    } finally {
      this.registry.updateLoad(this.reviewer.id, -1);
    }
  }

  /**
   * Reach consensus among specialists on a disputed point
   */
  async reachConsensus(point: string, views: Record<string, string>): Promise<ConsensusResult> {
    const consensusPrompt = `Reach consensus on this point:

Point: ${point}

Views:
${Object.entries(views).map(([agent, view]) => `- ${agent}: ${view}`).join('\n')}

Analyze the views, find common ground, and propose a consensus position.
Format as JSON:
{
  "consensus": true/false,
  "confidence": 0-1,
  "agreedPoints": ["..."],
  "disputedPoints": [{"point": "...", "views": {"agent": "view"}}],
  "resolution": "consensus position or path forward"
}`;

    const response = await this.openai.chat.completions.create({
      model: this.coordinator.model,
      messages: [
        { role: 'system', content: this.coordinator.systemPrompt },
        { role: 'user', content: consensusPrompt },
      ],
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(response.choices[0]?.message?.content || '{}');
    this.totalTokensUsed += response.usage?.total_tokens ?? 0;
    return result;
  }
}

// Export singleton
export const agentSwarm = new AgentSwarm();
