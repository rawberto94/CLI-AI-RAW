/**
 * Multi-Agent Debate Service
 * 
 * Implements a debate pattern where multiple specialized AI agents
 * challenge and validate conclusions before finalization. This creates
 * a "wisdom of crowds" effect and catches errors through adversarial review.
 * 
 * Debate Flow:
 * 1. Primary Agent: Generates initial analysis
 * 2. Critic Agent: Challenges assumptions, looks for flaws
 * 3. Devil's Advocate: Presents counterarguments
 * 4. Synthesizer Agent: Consolidates consensus view
 * 5. Arbitrator: Makes final decision if consensus fails
 * 
 * @version 1.0.0
 */

import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { z } from 'zod';

// Note: @langchain/anthropic is an optional peer dependency
// Claude models will automatically fall back to OpenAI GPT-4o if not installed
// To enable Claude support, install: pnpm add @langchain/anthropic

// =============================================================================
// TYPES
// =============================================================================

export interface DebateAgent {
  id: string;
  name: string;
  role: DebateRole;
  personality: string;
  model: 'gpt-4o' | 'gpt-4o-mini' | 'claude-3-opus' | 'claude-3-sonnet' | 'claude-3-5-haiku';
  temperature: number;
  focusAreas: string[];
}

export type DebateRole = 
  | 'primary'      // Initial analysis generator
  | 'critic'       // Finds flaws and weaknesses
  | 'advocate'     // Devil's advocate, presents counterarguments
  | 'validator'    // Fact-checks and verifies claims
  | 'synthesizer'  // Combines perspectives into consensus
  | 'arbitrator';  // Final decision maker if no consensus

export interface DebateTurn {
  agentId: string;
  agentName: string;
  role: DebateRole;
  message: string;
  arguments: DebateArgument[];
  confidence: number;
  timestamp: Date;
  tokensUsed: number;
  responseTimeMs: number;
}

export interface DebateArgument {
  type: 'support' | 'counter' | 'neutral' | 'question';
  claim: string;
  evidence?: string;
  strength: 'weak' | 'moderate' | 'strong';
  addressed?: boolean;
}

export interface DebateResult {
  success: boolean;
  topic: string;
  consensusReached: boolean;
  consensusConfidence: number;
  finalConclusion: string;
  reasoning: string;
  turns: DebateTurn[];
  keyArguments: {
    supporting: DebateArgument[];
    opposing: DebateArgument[];
    unresolved: DebateArgument[];
  };
  dissent?: {
    agentId: string;
    agentName: string;
    dissenterView: string;
    strength: 'minor' | 'significant' | 'fundamental';
  };
  metadata: {
    totalTurns: number;
    totalTokensUsed: number;
    processingTimeMs: number;
    agentsParticipated: string[];
    convergenceScore: number;
  };
}

export interface DebateConfig {
  maxTurns: number;
  consensusThreshold: number; // 0-1, agreement level needed
  requireUnanimity: boolean;
  allowDissent: boolean;
  earlyTermination: boolean;
  timeoutMs: number;
}

export interface DebateContext {
  topic: string;
  contractId?: string;
  contractText?: string;
  artifactType?: string;
  initialAnalysis?: string;
  tenantId: string;
  userId: string;
  additionalContext?: Record<string, any>;
}

// =============================================================================
// DEFAULT AGENTS ROSTER
// =============================================================================

const DEFAULT_AGENTS: DebateAgent[] = [
  {
    id: 'primary-analyst',
    name: 'Primary Analyst',
    role: 'primary',
    personality: 'Thorough, detail-oriented, aims for comprehensive analysis',
    model: 'gpt-4o',
    temperature: 0.7,
    focusAreas: ['completeness', 'accuracy', 'clarity'],
  },
  {
    id: 'critical-reviewer',
    name: 'Critical Reviewer',
    role: 'critic',
    personality: 'Skeptical, rigorous, looks for gaps and errors',
    model: 'claude-3-sonnet',
    temperature: 0.5,
    focusAreas: ['assumptions', 'logic_flaws', 'missing_info'],
  },
  {
    id: 'devils-advocate',
    name: "Devil's Advocate",
    role: 'advocate',
    personality: 'Contrarian, challenges mainstream views, presents alternatives',
    model: 'gpt-4o-mini',
    temperature: 0.8,
    focusAreas: ['alternative_interpretations', 'edge_cases', 'risks'],
  },
  {
    id: 'fact-validator',
    name: 'Fact Validator',
    role: 'validator',
    personality: 'Meticulous, evidence-focused, verifies all claims',
    model: 'claude-3-sonnet',
    temperature: 0.3,
    focusAreas: ['factual_accuracy', 'source_verification', 'consistency'],
  },
  {
    id: 'consensus-builder',
    name: 'Consensus Builder',
    role: 'synthesizer',
    personality: 'Diplomatic, seeks common ground, integrates viewpoints',
    model: 'gpt-4o',
    temperature: 0.6,
    focusAreas: ['integration', 'resolution', 'balanced_view'],
  },
  {
    id: 'final-arbitrator',
    name: 'Final Arbitrator',
    role: 'arbitrator',
    personality: 'Authoritative, decisive, weighs all evidence fairly',
    model: 'gpt-4o',
    temperature: 0.4,
    focusAreas: ['final_judgment', 'precedent', 'fairness'],
  },
];

// =============================================================================
// AGENT PROMPTS
// =============================================================================

const AGENT_PROMPTS: Record<DebateRole, string> = {
  primary: `You are the PRIMARY ANALYST in a multi-agent debate.
Your role is to provide the initial comprehensive analysis.

Guidelines:
- Be thorough and cover all important aspects
- Support your claims with evidence from the source material
- Acknowledge areas of uncertainty
- Structure your analysis clearly

Format your response as:
## Analysis
[Your comprehensive analysis]

## Key Claims
- [Claim 1]: [Evidence]
- [Claim 2]: [Evidence]

## Confidence Level
[High/Medium/Low] - [Explanation]

## Areas of Uncertainty
- [Any uncertain aspects]`,

  critic: `You are the CRITICAL REVIEWER in a multi-agent debate.
Your role is to find weaknesses, gaps, and potential errors in the analysis.

Guidelines:
- Challenge assumptions that aren't well-supported
- Identify logical flaws or inconsistencies
- Point out missing information or perspectives
- Be constructive but rigorous

Format your response as:
## Critique
[Your critique of the analysis]

## Issues Found
1. [Issue]: [Explanation] (Severity: High/Medium/Low)
2. ...

## Questions to Address
- [Question 1]
- [Question 2]

## What's Working Well
- [Positive aspect 1]`,

  advocate: `You are the DEVIL'S ADVOCATE in a multi-agent debate.
Your role is to present counterarguments and alternative interpretations.

Guidelines:
- Take an opposing view where reasonable
- Present alternative interpretations
- Highlight risks the others may have missed
- Challenge the consensus direction

Format your response as:
## Counterarguments
[Your opposing viewpoints]

## Alternative Interpretations
1. [Alternative view 1]
2. [Alternative view 2]

## Overlooked Risks
- [Risk 1]
- [Risk 2]

## Strength of Dissent
[Strong/Moderate/Weak] - [Explanation]`,

  validator: `You are the FACT VALIDATOR in a multi-agent debate.
Your role is to verify claims and ensure factual accuracy.

Guidelines:
- Cross-check all factual claims against source material
- Identify any unsupported assertions
- Verify numbers, dates, and specific details
- Flag potential hallucinations

Format your response as:
## Validation Results
[Summary of validation]

## Verified Claims
✓ [Claim 1]: Verified - [Source reference]
✓ [Claim 2]: Verified - [Source reference]

## Unverified Claims
⚠ [Claim]: Cannot verify - [Reason]

## Factual Errors Found
✗ [Error]: [Correct information]`,

  synthesizer: `You are the CONSENSUS BUILDER in a multi-agent debate.
Your role is to integrate all perspectives into a coherent conclusion.

Guidelines:
- Acknowledge all valid points from each participant
- Find common ground between different views
- Propose resolutions for contested points
- Build toward consensus

Format your response as:
## Points of Agreement
- [All agents agree on...]

## Points of Contention
- [Issue 1]: [Agent A view] vs [Agent B view]
  → Proposed resolution: [Your resolution]

## Synthesized Conclusion
[Integrated conclusion that addresses all perspectives]

## Remaining Disagreements
- [Any unresolved issues]

## Consensus Confidence
[0-100]% - [Explanation]`,

  arbitrator: `You are the FINAL ARBITRATOR in a multi-agent debate.
Your role is to make the final decision when consensus cannot be reached.

Guidelines:
- Consider all arguments presented
- Weigh evidence objectively
- Make a decisive judgment
- Explain your reasoning clearly

Format your response as:
## Final Ruling
[Your final decision]

## Reasoning
[Detailed explanation of why you reached this conclusion]

## Weight Given to Each Perspective
- Primary Analyst: [Weight] - [Reason]
- Critical Reviewer: [Weight] - [Reason]
- Devil's Advocate: [Weight] - [Reason]
- Fact Validator: [Weight] - [Reason]
- Consensus Builder: [Weight] - [Reason]

## Confidence in Ruling
[High/Medium/Low] - [Explanation]

## Noted Dissent
[Any significant dissenting views that should be documented]`,
};

// =============================================================================
// DEBATE PRESETS
// =============================================================================

export const DEBATE_PRESETS = {
  quick: {
    maxTurns: 4,
    consensusThreshold: 0.7,
    requireUnanimity: false,
    allowDissent: true,
    earlyTermination: true,
    timeoutMs: 60000,
    agents: ['primary-analyst', 'critical-reviewer', 'consensus-builder'],
  },
  standard: {
    maxTurns: 6,
    consensusThreshold: 0.8,
    requireUnanimity: false,
    allowDissent: true,
    earlyTermination: true,
    timeoutMs: 120000,
    agents: ['primary-analyst', 'critical-reviewer', 'devils-advocate', 'consensus-builder'],
  },
  thorough: {
    maxTurns: 10,
    consensusThreshold: 0.85,
    requireUnanimity: false,
    allowDissent: true,
    earlyTermination: false,
    timeoutMs: 300000,
    agents: ['primary-analyst', 'critical-reviewer', 'devils-advocate', 'fact-validator', 'consensus-builder', 'final-arbitrator'],
  },
  highStakes: {
    maxTurns: 12,
    consensusThreshold: 0.95,
    requireUnanimity: true,
    allowDissent: false,
    earlyTermination: false,
    timeoutMs: 600000,
    agents: ['primary-analyst', 'critical-reviewer', 'devils-advocate', 'fact-validator', 'consensus-builder', 'final-arbitrator'],
  },
} as const;

// =============================================================================
// MULTI-AGENT DEBATE SERVICE
// =============================================================================

export class MultiAgentDebateService {
  private agents: Map<string, DebateAgent>;
  private llmCache: Map<string, ChatOpenAI>;

  constructor(customAgents?: DebateAgent[]) {
    this.agents = new Map();
    this.llmCache = new Map();

    const agentsToUse = customAgents || DEFAULT_AGENTS;
    agentsToUse.forEach(agent => {
      this.agents.set(agent.id, agent);
    });
  }

  /**
   * Conduct a multi-agent debate on a topic
   */
  async conductDebate(
    context: DebateContext,
    config: Partial<DebateConfig> = {},
    agentIds?: string[]
  ): Promise<DebateResult> {
    const startTime = Date.now();
    const fullConfig: DebateConfig = {
      maxTurns: config.maxTurns ?? 6,
      consensusThreshold: config.consensusThreshold ?? 0.8,
      requireUnanimity: config.requireUnanimity ?? false,
      allowDissent: config.allowDissent ?? true,
      earlyTermination: config.earlyTermination ?? true,
      timeoutMs: config.timeoutMs ?? 120000,
    };

    const turns: DebateTurn[] = [];
    let totalTokensUsed = 0;
    const participatingAgents = agentIds || Array.from(this.agents.keys());

    try {
      // Phase 1: Primary Analysis
      const primaryAgent = this.getAgentByRole('primary', participatingAgents);
      if (primaryAgent) {
        const primaryTurn = await this.executeAgentTurn(primaryAgent, context, turns, 'primary');
        turns.push(primaryTurn);
        totalTokensUsed += primaryTurn.tokensUsed;
      }

      // Phase 2: Critique Phase
      const criticAgent = this.getAgentByRole('critic', participatingAgents);
      if (criticAgent) {
        const criticTurn = await this.executeAgentTurn(criticAgent, context, turns, 'critique');
        turns.push(criticTurn);
        totalTokensUsed += criticTurn.tokensUsed;
      }

      // Phase 3: Devil's Advocate
      const advocateAgent = this.getAgentByRole('advocate', participatingAgents);
      if (advocateAgent && turns.length < fullConfig.maxTurns) {
        const advocateTurn = await this.executeAgentTurn(advocateAgent, context, turns, 'counter');
        turns.push(advocateTurn);
        totalTokensUsed += advocateTurn.tokensUsed;
      }

      // Phase 4: Fact Validation
      const validatorAgent = this.getAgentByRole('validator', participatingAgents);
      if (validatorAgent && turns.length < fullConfig.maxTurns) {
        const validatorTurn = await this.executeAgentTurn(validatorAgent, context, turns, 'validate');
        turns.push(validatorTurn);
        totalTokensUsed += validatorTurn.tokensUsed;
      }

      // Phase 5: Synthesis
      const synthesizerAgent = this.getAgentByRole('synthesizer', participatingAgents);
      let synthesisResult: { consensus: boolean; confidence: number; conclusion: string } | null = null;
      if (synthesizerAgent) {
        const synthesisTurn = await this.executeAgentTurn(synthesizerAgent, context, turns, 'synthesize');
        turns.push(synthesisTurn);
        totalTokensUsed += synthesisTurn.tokensUsed;
        synthesisResult = this.parseSynthesisResult(synthesisTurn.message);
      }

      // Phase 6: Arbitration (if needed)
      let finalConclusion = synthesisResult?.conclusion || '';
      let consensusReached = (synthesisResult?.confidence || 0) >= fullConfig.consensusThreshold;

      if (!consensusReached || (fullConfig.requireUnanimity && synthesisResult && synthesisResult.confidence < 0.95)) {
        const arbitratorAgent = this.getAgentByRole('arbitrator', participatingAgents);
        if (arbitratorAgent) {
          const arbitratorTurn = await this.executeAgentTurn(arbitratorAgent, context, turns, 'arbitrate');
          turns.push(arbitratorTurn);
          totalTokensUsed += arbitratorTurn.tokensUsed;
          const arbitrationResult = this.parseArbitrationResult(arbitratorTurn.message);
          finalConclusion = arbitrationResult.conclusion;
          consensusReached = arbitrationResult.confidence >= fullConfig.consensusThreshold;
        }
      }

      // Extract key arguments
      const keyArguments = this.extractKeyArguments(turns);

      // Check for dissent
      const dissent = this.detectDissent(turns, finalConclusion, fullConfig);

      // Calculate convergence score
      const convergenceScore = this.calculateConvergenceScore(turns);

      return {
        success: true,
        topic: context.topic,
        consensusReached,
        consensusConfidence: synthesisResult?.confidence || 0.5,
        finalConclusion,
        reasoning: this.generateReasoningSummary(turns),
        turns,
        keyArguments,
        dissent,
        metadata: {
          totalTurns: turns.length,
          totalTokensUsed,
          processingTimeMs: Date.now() - startTime,
          agentsParticipated: turns.map(t => t.agentId),
          convergenceScore,
        },
      };
    } catch (error) {
      return {
        success: false,
        topic: context.topic,
        consensusReached: false,
        consensusConfidence: 0,
        finalConclusion: `Debate failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        reasoning: '',
        turns,
        keyArguments: { supporting: [], opposing: [], unresolved: [] },
        metadata: {
          totalTurns: turns.length,
          totalTokensUsed,
          processingTimeMs: Date.now() - startTime,
          agentsParticipated: turns.map(t => t.agentId),
          convergenceScore: 0,
        },
      };
    }
  }

  /**
   * Execute a single agent's turn in the debate
   */
  private async executeAgentTurn(
    agent: DebateAgent,
    context: DebateContext,
    previousTurns: DebateTurn[],
    phase: string
  ): Promise<DebateTurn> {
    const startTime = Date.now();
    const llm = this.getLLMForAgent(agent);
    const systemPrompt = AGENT_PROMPTS[agent.role];

    const conversationHistory = previousTurns.map(turn => 
      `[${turn.agentName} - ${turn.role.toUpperCase()}]:\n${turn.message}`
    ).join('\n\n---\n\n');

    const userPrompt = `
Topic: ${context.topic}

${context.contractText ? `Contract Context:\n${context.contractText.substring(0, 4000)}...` : ''}

${context.initialAnalysis ? `Initial Analysis:\n${context.initialAnalysis}` : ''}

${conversationHistory ? `Previous Discussion:\n${conversationHistory}` : ''}

Current Phase: ${phase.toUpperCase()}
Your Focus Areas: ${agent.focusAreas.join(', ')}

Please provide your ${agent.role} perspective.`;

    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt),
    ]);

    const message = typeof response.content === 'string' 
      ? response.content 
      : JSON.stringify(response.content);

    const tokensUsed = response.usage_metadata?.total_tokens || 
      Math.ceil((systemPrompt.length + userPrompt.length + message.length) / 4);

    const arguments_ = this.extractArguments(message, agent.role);

    return {
      agentId: agent.id,
      agentName: agent.name,
      role: agent.role,
      message,
      arguments: arguments_,
      confidence: this.extractConfidence(message),
      timestamp: new Date(),
      tokensUsed,
      responseTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Get LLM instance for agent
   */
  private getLLMForAgent(agent: DebateAgent): ChatOpenAI {
    const cacheKey = `${agent.model}-${agent.temperature}`;
    
    if (this.llmCache.has(cacheKey)) {
      return this.llmCache.get(cacheKey)!;
    }

    // All models use OpenAI - Claude models fall back to gpt-4o
    // To enable Claude support, install @langchain/anthropic and implement dynamic import
    const modelName = agent.model.startsWith('claude') ? 'gpt-4o' : agent.model;
    const llm = new ChatOpenAI({
      modelName,
      temperature: agent.temperature,
      maxTokens: 4000,
      openAIApiKey: process.env.OPENAI_API_KEY || '',
      azureOpenAIApiKey: undefined,
    });

    this.llmCache.set(cacheKey, llm);
    return llm;
  }

  /**
   * Get agent by role from participating agents
   */
  private getAgentByRole(role: DebateRole, participatingIds: string[]): DebateAgent | undefined {
    for (const id of participatingIds) {
      const agent = this.agents.get(id);
      if (agent && agent.role === role) {
        return agent;
      }
    }
    return undefined;
  }

  /**
   * Extract arguments from agent message
   */
  private extractArguments(message: string, role: DebateRole): DebateArgument[] {
    const arguments_: DebateArgument[] = [];

    // Extract based on patterns in the message
    const supportPatterns = [
      /✓\s*(.+?)(?=\n|$)/g,
      /verified[:\s]+(.+?)(?=\n|$)/gi,
      /confirmed[:\s]+(.+?)(?=\n|$)/gi,
      /supports[:\s]+(.+?)(?=\n|$)/gi,
    ];

    const counterPatterns = [
      /✗\s*(.+?)(?=\n|$)/g,
      /however[,:\s]+(.+?)(?=\n|$)/gi,
      /but[,:\s]+(.+?)(?=\n|$)/gi,
      /counterargument[:\s]+(.+?)(?=\n|$)/gi,
      /alternative[:\s]+(.+?)(?=\n|$)/gi,
    ];

    const questionPatterns = [
      /\?\s*(.+?)(?=\n|$)/g,
      /question[:\s]+(.+?)(?=\n|$)/gi,
      /unclear[:\s]+(.+?)(?=\n|$)/gi,
    ];

    // Extract supporting arguments
    supportPatterns.forEach(pattern => {
      const matches = message.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && match[1].length > 10) {
          arguments_.push({
            type: 'support',
            claim: match[1].trim().substring(0, 200),
            strength: this.determineArgumentStrength(match[1]),
          });
        }
      }
    });

    // Extract counter arguments
    counterPatterns.forEach(pattern => {
      const matches = message.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && match[1].length > 10) {
          arguments_.push({
            type: 'counter',
            claim: match[1].trim().substring(0, 200),
            strength: this.determineArgumentStrength(match[1]),
          });
        }
      }
    });

    // Extract questions
    questionPatterns.forEach(pattern => {
      const matches = message.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && match[1].length > 10) {
          arguments_.push({
            type: 'question',
            claim: match[1].trim().substring(0, 200),
            strength: 'moderate',
          });
        }
      }
    });

    return arguments_.slice(0, 10); // Limit to 10 arguments per turn
  }

  /**
   * Determine argument strength based on language
   */
  private determineArgumentStrength(text: string): 'weak' | 'moderate' | 'strong' {
    const strongIndicators = ['clearly', 'definitely', 'certainly', 'undeniably', 'conclusively', 'strong evidence'];
    const weakIndicators = ['possibly', 'might', 'could', 'perhaps', 'uncertain', 'unclear'];

    const lowerText = text.toLowerCase();
    
    if (strongIndicators.some(ind => lowerText.includes(ind))) {
      return 'strong';
    }
    if (weakIndicators.some(ind => lowerText.includes(ind))) {
      return 'weak';
    }
    return 'moderate';
  }

  /**
   * Extract confidence level from message
   */
  private extractConfidence(message: string): number {
    // Look for explicit confidence mentions
    const confidenceMatch = message.match(/(\d+)%/);
    if (confidenceMatch) {
      return Math.min(parseInt(confidenceMatch[1]) / 100, 1);
    }

    const highConfidenceTerms = ['high confidence', 'very confident', 'certain', 'definitely'];
    const lowConfidenceTerms = ['low confidence', 'uncertain', 'unclear', 'possibly'];

    const lowerMessage = message.toLowerCase();

    if (highConfidenceTerms.some(term => lowerMessage.includes(term))) {
      return 0.85;
    }
    if (lowConfidenceTerms.some(term => lowerMessage.includes(term))) {
      return 0.5;
    }

    return 0.7; // Default moderate confidence
  }

  /**
   * Parse synthesis result
   */
  private parseSynthesisResult(message: string): { consensus: boolean; confidence: number; conclusion: string } {
    const confidenceMatch = message.match(/consensus confidence[:\s]+(\d+)%/i);
    const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) / 100 : 0.7;

    const conclusionMatch = message.match(/synthesized conclusion[:\s]+(.+?)(?=\n\n|## |$)/si);
    const conclusion = conclusionMatch ? conclusionMatch[1].trim() : message.substring(0, 500);

    return {
      consensus: confidence >= 0.7,
      confidence,
      conclusion,
    };
  }

  /**
   * Parse arbitration result
   */
  private parseArbitrationResult(message: string): { conclusion: string; confidence: number } {
    const rulingMatch = message.match(/final ruling[:\s]+(.+?)(?=\n\n|## |$)/si);
    const confidenceMatch = message.match(/confidence in ruling[:\s]+(\w+)/i);

    const conclusion = rulingMatch ? rulingMatch[1].trim() : message.substring(0, 500);
    let confidence = 0.75;

    if (confidenceMatch) {
      const level = confidenceMatch[1].toLowerCase();
      if (level === 'high') confidence = 0.9;
      else if (level === 'low') confidence = 0.5;
    }

    return { conclusion, confidence };
  }

  /**
   * Extract key arguments from all turns
   */
  private extractKeyArguments(turns: DebateTurn[]): {
    supporting: DebateArgument[];
    opposing: DebateArgument[];
    unresolved: DebateArgument[];
  } {
    const supporting: DebateArgument[] = [];
    const opposing: DebateArgument[] = [];
    const unresolved: DebateArgument[] = [];

    for (const turn of turns) {
      for (const arg of turn.arguments) {
        if (arg.type === 'support') {
          supporting.push(arg);
        } else if (arg.type === 'counter') {
          opposing.push(arg);
        } else if (arg.type === 'question') {
          unresolved.push(arg);
        }
      }
    }

    return {
      supporting: supporting.slice(0, 5),
      opposing: opposing.slice(0, 5),
      unresolved: unresolved.slice(0, 3),
    };
  }

  /**
   * Detect significant dissent
   */
  private detectDissent(
    turns: DebateTurn[],
    finalConclusion: string,
    config: DebateConfig
  ): DebateResult['dissent'] {
    if (!config.allowDissent) return undefined;

    const advocateTurn = turns.find(t => t.role === 'advocate');
    if (!advocateTurn) return undefined;

    // Check if advocate's concerns were addressed
    const strongCounterArgs = advocateTurn.arguments.filter(
      arg => arg.type === 'counter' && arg.strength === 'strong'
    );

    if (strongCounterArgs.length > 0 && advocateTurn.confidence > 0.6) {
      return {
        agentId: advocateTurn.agentId,
        agentName: advocateTurn.agentName,
        dissenterView: strongCounterArgs.map(a => a.claim).join('; '),
        strength: strongCounterArgs.length >= 2 ? 'significant' : 'minor',
      };
    }

    return undefined;
  }

  /**
   * Calculate convergence score
   */
  private calculateConvergenceScore(turns: DebateTurn[]): number {
    if (turns.length < 2) return 0.5;

    const confidences = turns.map(t => t.confidence);
    const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;

    // Calculate variance
    const variance = confidences.reduce((acc, conf) => 
      acc + Math.pow(conf - avgConfidence, 2), 0
    ) / confidences.length;

    // Lower variance = higher convergence
    const convergence = 1 - Math.min(variance * 4, 1);

    return Math.round(convergence * 100) / 100;
  }

  /**
   * Generate reasoning summary
   */
  private generateReasoningSummary(turns: DebateTurn[]): string {
    const summaryParts: string[] = [];

    for (const turn of turns) {
      summaryParts.push(`${turn.agentName} (${turn.role}): ${turn.message.substring(0, 200)}...`);
    }

    return summaryParts.join('\n\n');
  }

  /**
   * Get available debate presets
   */
  getPresets(): typeof DEBATE_PRESETS {
    return DEBATE_PRESETS;
  }

  /**
   * Add custom agent
   */
  addAgent(agent: DebateAgent): void {
    this.agents.set(agent.id, agent);
  }

  /**
   * Remove agent
   */
  removeAgent(agentId: string): boolean {
    return this.agents.delete(agentId);
  }

  /**
   * Get all agents
   */
  getAgents(): DebateAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Quick debate with preset
   */
  async quickDebate(
    topic: string,
    contractText: string,
    tenantId: string,
    preset: keyof typeof DEBATE_PRESETS = 'standard'
  ): Promise<DebateResult> {
    const presetConfig = DEBATE_PRESETS[preset];
    
    return this.conductDebate(
      {
        topic,
        contractText,
        tenantId,
        userId: 'system',
      },
      {
        maxTurns: presetConfig.maxTurns,
        consensusThreshold: presetConfig.consensusThreshold,
        requireUnanimity: presetConfig.requireUnanimity,
        allowDissent: presetConfig.allowDissent,
        earlyTermination: presetConfig.earlyTermination,
        timeoutMs: presetConfig.timeoutMs,
      },
      [...presetConfig.agents]
    );
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let debateServiceInstance: MultiAgentDebateService | null = null;

export function getMultiAgentDebateService(): MultiAgentDebateService {
  if (!debateServiceInstance) {
    debateServiceInstance = new MultiAgentDebateService();
  }
  return debateServiceInstance;
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

export async function conductDebate(
  context: DebateContext,
  config?: Partial<DebateConfig>,
  agentIds?: string[]
): Promise<DebateResult> {
  return getMultiAgentDebateService().conductDebate(context, config, agentIds);
}

export async function quickDebate(
  topic: string,
  contractText: string,
  tenantId: string,
  preset?: keyof typeof DEBATE_PRESETS
): Promise<DebateResult> {
  return getMultiAgentDebateService().quickDebate(topic, contractText, tenantId, preset);
}
