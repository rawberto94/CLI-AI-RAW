import pino from 'pino';

const logger = pino({ name: 'multi-agent-coordinator' });

/**
 * Agent Types and their specializations
 */
export enum AgentType {
  LEGAL = 'legal',
  PRICING = 'pricing',
  COMPLIANCE = 'compliance',
  RISK = 'risk',
  OPERATIONS = 'operations',
}

export interface AgentProposal {
  agentType: AgentType;
  artifactTypes: string[];
  priority: number;
  reasoning: string;
  dependencies: string[];
  estimatedCost: number;
  estimatedTime: number;
  confidence: number;
}

export interface AgentNegotiation {
  round: number;
  proposals: AgentProposal[];
  consensus: AgentProposal[];
  conflicts: Array<{
    agents: AgentType[];
    issue: string;
    resolution?: string;
  }>;
}

export interface ExecutionPlan {
  phases: Array<{
    name: string;
    agents: AgentType[];
    artifacts: string[];
    parallel: boolean;
    estimatedDuration: number;
  }>;
  totalCost: number;
  totalTime: number;
  optimizationScore: number;
}

/**
 * Specialist Agent Profiles
 */
const AGENT_PROFILES: Record<AgentType, {
  expertise: string[];
  artifacts: string[];
  priority: number;
  costMultiplier: number;
}> = {
  [AgentType.LEGAL]: {
    expertise: ['clauses', 'obligations', 'compliance', 'amendments'],
    artifacts: ['CLAUSES', 'OBLIGATIONS', 'COMPLIANCE', 'AMENDMENTS'],
    priority: 10,
    costMultiplier: 1.5,
  },
  [AgentType.PRICING]: {
    expertise: ['financial', 'rates', 'negotiation'],
    artifacts: ['FINANCIAL', 'NEGOTIATION_POINTS', 'PRICING_ANALYSIS'],
    priority: 8,
    costMultiplier: 1.0,
  },
  [AgentType.COMPLIANCE]: {
    expertise: ['compliance', 'risk', 'regulatory'],
    artifacts: ['COMPLIANCE', 'RISK', 'REGULATORY_CHECK'],
    priority: 9,
    costMultiplier: 1.3,
  },
  [AgentType.RISK]: {
    expertise: ['risk', 'liability', 'insurance'],
    artifacts: ['RISK', 'LIABILITY_ANALYSIS', 'INSURANCE_REVIEW'],
    priority: 7,
    costMultiplier: 1.2,
  },
  [AgentType.OPERATIONS]: {
    expertise: ['overview', 'contacts', 'renewal'],
    artifacts: ['OVERVIEW', 'CONTACTS', 'RENEWAL'],
    priority: 6,
    costMultiplier: 0.8,
  },
};

/**
 * Multi-Agent Coordinator
 * Manages collaboration between specialist agents
 */
export class MultiAgentCoordinator {
  /**
   * Analyze contract and get proposals from all agents
   */
  async analyzeContract(
    contractId: string,
    contractType: string,
    requiredArtifacts: string[],
    contractText: string
  ): Promise<AgentNegotiation> {
    logger.info({ contractId, contractType }, '🤝 Starting multi-agent negotiation');

    // Get proposals from each agent
    const proposals: AgentProposal[] = [];

    for (const [agentType, profile] of Object.entries(AGENT_PROFILES)) {
      // Check if agent has relevant expertise
      const relevantArtifacts = requiredArtifacts.filter(art =>
        profile.artifacts.includes(art)
      );

      if (relevantArtifacts.length === 0) continue;

      // Agent proposes its plan
      const proposal: AgentProposal = {
        agentType: agentType as AgentType,
        artifactTypes: relevantArtifacts,
        priority: profile.priority,
        reasoning: this.generateReasoning(agentType as AgentType, relevantArtifacts, contractType),
        dependencies: this.identifyDependencies(relevantArtifacts),
        estimatedCost: relevantArtifacts.length * profile.costMultiplier * 100,
        estimatedTime: relevantArtifacts.length * 30, // seconds
        confidence: this.assessConfidence(agentType as AgentType, contractText),
      };

      proposals.push(proposal);
    }

    // Negotiate between agents
    const negotiation = await this.negotiate(proposals);

    logger.info({
      contractId,
      proposalCount: proposals.length,
      consensusCount: negotiation.consensus.length,
      conflictCount: negotiation.conflicts.length,
    }, '✅ Negotiation complete');

    return negotiation;
  }

  /**
   * Negotiate between agents to resolve conflicts
   */
  private async negotiate(proposals: AgentProposal[]): Promise<AgentNegotiation> {
    const conflicts: AgentNegotiation['conflicts'] = [];

    // Identify conflicts (overlapping artifacts)
    const artifactOwners = new Map<string, AgentType[]>();
    
    for (const proposal of proposals) {
      for (const artifact of proposal.artifactTypes) {
        if (!artifactOwners.has(artifact)) {
          artifactOwners.set(artifact, []);
        }
        artifactOwners.get(artifact)!.push(proposal.agentType);
      }
    }

    // Resolve conflicts by priority and confidence
    const consensus: AgentProposal[] = [];
    const artifactAssignments = new Map<string, AgentType>();

    for (const [artifact, agents] of artifactOwners.entries()) {
      if (agents.length > 1) {
        // Conflict! Multiple agents want this artifact
        const conflictingProposals = proposals.filter(p =>
          agents.includes(p.agentType) && p.artifactTypes.includes(artifact)
        );

        // Winner: highest priority * confidence
        const winner = conflictingProposals.reduce((best, current) => {
          const bestScore = best.priority * best.confidence;
          const currentScore = current.priority * current.confidence;
          return currentScore > bestScore ? current : best;
        });

        artifactAssignments.set(artifact, winner.agentType);

        conflicts.push({
          agents,
          issue: `Multiple agents want to generate ${artifact}`,
          resolution: `Assigned to ${winner.agentType} (priority: ${winner.priority}, confidence: ${winner.confidence})`,
        });
      } else {
        artifactAssignments.set(artifact, agents[0]!);
      }
    }

    // Build consensus proposals
    for (const proposal of proposals) {
      const assignedArtifacts = proposal.artifactTypes.filter(art =>
        artifactAssignments.get(art) === proposal.agentType
      );

      if (assignedArtifacts.length > 0) {
        consensus.push({
          ...proposal,
          artifactTypes: assignedArtifacts,
        });
      }
    }

    return {
      round: 1,
      proposals,
      consensus,
      conflicts,
    };
  }

  /**
   * Create optimized execution plan
   */
  async createExecutionPlan(negotiation: AgentNegotiation): Promise<ExecutionPlan> {
    const { consensus } = negotiation;

    // Build dependency graph
    const dependencyGraph = new Map<string, string[]>();
    for (const proposal of consensus) {
      for (const artifact of proposal.artifactTypes) {
        dependencyGraph.set(artifact, proposal.dependencies);
      }
    }

    // Topological sort to determine phases
    const phases: ExecutionPlan['phases'] = [];
    const processed = new Set<string>();
    let phaseNum = 0;

    while (processed.size < consensus.reduce((sum, p) => sum + p.artifactTypes.length, 0)) {
      const currentPhase: string[] = [];

      for (const proposal of consensus) {
        for (const artifact of proposal.artifactTypes) {
          if (processed.has(artifact)) continue;

          const deps = dependencyGraph.get(artifact) || [];
          const depsReady = deps.every(dep => processed.has(dep));

          if (depsReady) {
            currentPhase.push(artifact);
          }
        }
      }

      if (currentPhase.length === 0 && processed.size < consensus.reduce((sum, p) => sum + p.artifactTypes.length, 0)) {
        // Circular dependency or stuck - add remaining
        for (const proposal of consensus) {
          for (const artifact of proposal.artifactTypes) {
            if (!processed.has(artifact)) {
              currentPhase.push(artifact);
            }
          }
        }
      }

      // Group by agent
      const agentsInPhase = new Set<AgentType>();
      for (const artifact of currentPhase) {
        const agent = consensus.find(p => p.artifactTypes.includes(artifact));
        if (agent) agentsInPhase.add(agent.agentType);
      }

      const maxTime = Math.max(
        ...Array.from(agentsInPhase).map(agent => {
          const proposal = consensus.find(p => p.agentType === agent)!;
          return proposal.estimatedTime;
        })
      );

      phases.push({
        name: `Phase ${phaseNum + 1}`,
        agents: Array.from(agentsInPhase),
        artifacts: currentPhase,
        parallel: currentPhase.length > 1,
        estimatedDuration: maxTime,
      });

      currentPhase.forEach(art => processed.add(art));
      phaseNum++;
    }

    const totalCost = consensus.reduce((sum, p) => sum + p.estimatedCost, 0);
    const totalTime = phases.reduce((sum, p) => sum + p.estimatedDuration, 0);
    const optimizationScore = this.calculateOptimizationScore(phases, consensus);

    logger.info({
      phaseCount: phases.length,
      totalCost,
      totalTime,
      optimizationScore: optimizationScore.toFixed(2),
    }, '📋 Execution plan created');

    return {
      phases,
      totalCost,
      totalTime,
      optimizationScore,
    };
  }

  /**
   * Generate reasoning for agent proposal
   */
  private generateReasoning(agent: AgentType, artifacts: string[], contractType: string): string {
    const profile = AGENT_PROFILES[agent];
    return `As a ${agent} specialist, I have expertise in ${profile.expertise.join(', ')}. For ${contractType} contracts, ${artifacts.join(', ')} are critical for ${agent} analysis.`;
  }

  /**
   * Identify dependencies between artifacts
   */
  private identifyDependencies(artifacts: string[]): string[] {
    const deps: string[] = [];

    // Common dependencies
    if (artifacts.includes('FINANCIAL') || artifacts.includes('NEGOTIATION_POINTS')) {
      deps.push('OVERVIEW');
    }

    if (artifacts.includes('RISK')) {
      deps.push('CLAUSES', 'OBLIGATIONS');
    }

    if (artifacts.includes('COMPLIANCE')) {
      deps.push('CLAUSES');
    }

    return deps;
  }

  /**
   * Assess agent confidence based on contract content
   */
  private assessConfidence(agent: AgentType, contractText: string): number {
    const profile = AGENT_PROFILES[agent];
    let confidence = 0.5;

    // Check if contract mentions agent's expertise areas
    const text = contractText.toLowerCase();
    for (const expertise of profile.expertise) {
      if (text.includes(expertise.toLowerCase())) {
        confidence += 0.1;
      }
    }

    return Math.min(1.0, confidence);
  }

  /**
   * Calculate optimization score for execution plan
   */
  private calculateOptimizationScore(
    phases: ExecutionPlan['phases'],
    consensus: AgentProposal[]
  ): number {
    // Factors:
    // - Parallelization (more parallel = better)
    // - Phase count (fewer phases = better)
    // - Cost efficiency (lower cost = better)

    const parallelPhases = phases.filter(p => p.parallel).length;
    const parallelizationScore = phases.length > 0 ? parallelPhases / phases.length : 0;

    const phaseEfficiency = 1.0 / Math.max(1, phases.length);

    const avgCost = consensus.reduce((sum, p) => sum + p.estimatedCost, 0) / consensus.length;
    const costEfficiency = avgCost < 150 ? 1.0 : 150 / avgCost;

    return (parallelizationScore * 0.4 + phaseEfficiency * 0.3 + costEfficiency * 0.3);
  }
}

/**
 * Get singleton coordinator instance
 */
let coordinatorInstance: MultiAgentCoordinator | null = null;

export function getMultiAgentCoordinator(): MultiAgentCoordinator {
  if (!coordinatorInstance) {
    coordinatorInstance = new MultiAgentCoordinator();
  }
  return coordinatorInstance;
}
