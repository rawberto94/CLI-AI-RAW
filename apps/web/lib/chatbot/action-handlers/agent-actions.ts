/**
 * Agent Action Handlers
 * 
 * Connects the chatbot to agentic AI services:
 * - ReAct Agent for autonomous reasoning
 * - Multi-Agent Debate for high-stakes decisions
 * - Self-Critique for quality validation
 * - Episodic Memory for personalization
 * 
 * @version 1.0.0
 */

import { DetectedIntent, ActionResponse, ChatContext } from '../types';

// =============================================================================
// TYPES
// =============================================================================

export interface AgentThought {
  type: 'thought' | 'action' | 'observation' | 'decision' | 'critique' | 'debate_turn';
  content: string;
  agentName?: string;
  confidence?: number;
  toolUsed?: string;
  timestamp: Date;
}

export interface AgentStreamEvent {
  type: 'thinking' | 'tool_call' | 'observation' | 'debate' | 'critique' | 'final';
  content: string;
  metadata?: Record<string, unknown>;
}

export interface MemoryContext {
  recentInteractions: string[];
  userPreferences: Record<string, unknown>;
  relevantHistory: string[];
}

// =============================================================================
// AGENT ACTION PATTERNS
// =============================================================================

export const agentActionPatterns = {
  // Deep analysis with ReAct agent
  deepAnalysis: [
    /(?:deep|thorough|comprehensive|detailed)\s+(?:analysis|analyze|review)/i,
    /(?:analyze|examine|investigate)\s+(?:this\s+)?(?:contract|document|agreement)\s+(?:thoroughly|in\s+detail|completely)/i,
    /(?:what|tell\s+me)\s+everything\s+(?:about|regarding)/i,
    /run\s+(?:full|complete|ai)\s+analysis/i,
  ],

  // Reasoning chain (show your work)
  showReasoning: [
    /(?:show|explain)\s+(?:your|the)\s+(?:reasoning|thinking|thought\s+process)/i,
    /how\s+did\s+you\s+(?:come\s+to|reach|arrive\s+at)\s+(?:this|that)\s+(?:conclusion|answer)/i,
    /walk\s+me\s+through\s+(?:your|the)\s+(?:analysis|logic)/i,
    /think\s+(?:step\s+by\s+step|out\s+loud|through\s+this)/i,
  ],

  // Multi-agent debate
  debateDecision: [
    /(?:debate|discuss|deliberate)\s+(?:about|on|whether)/i,
    /(?:should\s+we|is\s+it\s+(?:safe|wise|good|advisable)\s+to)\s+(?:accept|reject|sign|approve)/i,
    /(?:weigh|evaluate|assess)\s+(?:the\s+)?(?:pros\s+and\s+cons|options|alternatives)/i,
    /(?:get|need)\s+(?:multiple|different)\s+(?:perspectives|opinions|viewpoints)/i,
    /(?:what\s+are\s+the\s+)?(?:arguments\s+)?(?:for\s+and\s+against)/i,
  ],

  // Risk assessment with agent
  agentRiskAssessment: [
    /(?:ai|agent|deep)\s+risk\s+(?:analysis|assessment|evaluation)/i,
    /(?:what|identify)\s+(?:are\s+the\s+)?(?:hidden|potential|possible)\s+risks/i,
    /(?:thoroughly|carefully)\s+(?:assess|evaluate|analyze)\s+(?:the\s+)?risks/i,
  ],

  // Negotiation strategy
  negotiationStrategy: [
    /(?:help\s+me\s+)?(?:negotiate|negotiation)\s+(?:strategy|approach|tactics)/i,
    /(?:what|how)\s+(?:should|can)\s+(?:I|we)\s+(?:negotiate|counter|respond)/i,
    /(?:suggest|recommend)\s+(?:negotiation|counter)\s+(?:points|terms|positions)/i,
  ],

  // Contract comparison with reasoning
  smartComparison: [
    /(?:intelligently|smartly|thoroughly)\s+compare/i,
    /(?:ai|agent)\s+(?:powered\s+)?comparison/i,
    /(?:what|which)\s+(?:contract|option)\s+is\s+(?:better|worse|more\s+favorable)/i,
  ],
};

// =============================================================================
// INTENT DETECTION
// =============================================================================

export function detectAgentIntent(query: string): DetectedIntent | null {
  const lowerQuery = query.toLowerCase();

  // Deep Analysis
  if (agentActionPatterns.deepAnalysis.some(p => p.test(query))) {
    return {
      type: 'action',
      action: 'deep_analysis',
      entities: {
        analysisAspects: {
          value: true,
          duration: true,
          risk: true,
          terms: true,
        },
      },
      confidence: 0.9,
    };
  }

  // Show Reasoning
  if (agentActionPatterns.showReasoning.some(p => p.test(query))) {
    return {
      type: 'action',
      action: 'show_reasoning',
      entities: {},
      confidence: 0.85,
    };
  }

  // Debate Decision
  if (agentActionPatterns.debateDecision.some(p => p.test(query))) {
    const topicMatch = query.match(/(?:debate|about|whether|should\s+we)\s+(.+?)(?:\?|$)/i);
    return {
      type: 'action',
      action: 'debate_decision',
      entities: {
        topic: topicMatch?.[1]?.trim(),
      },
      confidence: 0.88,
    };
  }

  // Agent Risk Assessment
  if (agentActionPatterns.agentRiskAssessment.some(p => p.test(query))) {
    return {
      type: 'action',
      action: 'agent_risk_assessment',
      entities: {},
      confidence: 0.9,
    };
  }

  // Negotiation Strategy
  if (agentActionPatterns.negotiationStrategy.some(p => p.test(query))) {
    const aspectMatch = query.match(/(?:negotiate|negotiation)\s+(?:on\s+|about\s+|for\s+)?(.+?)(?:\?|$)/i);
    return {
      type: 'action',
      action: 'negotiation_strategy',
      entities: {
        topic: aspectMatch?.[1]?.trim(),
      },
      confidence: 0.85,
    };
  }

  // Smart Comparison
  if (agentActionPatterns.smartComparison.some(p => p.test(query))) {
    return {
      type: 'action',
      action: 'smart_comparison',
      entities: {
        comparisonAspects: {
          value: true,
          terms: true,
          risk: true,
          clauses: true,
        },
      },
      confidence: 0.85,
    };
  }

  return null;
}

// =============================================================================
// ACTION HANDLERS
// =============================================================================

/**
 * Handle agent-powered actions
 */
export async function handleAgentAction(
  intent: DetectedIntent,
  context: ChatContext
): Promise<ActionResponse> {
  const { action } = intent;

  switch (action) {
    case 'deep_analysis':
      return handleDeepAnalysis(intent, context);

    case 'show_reasoning':
      return handleShowReasoning(intent, context);

    case 'debate_decision':
      return handleDebateDecision(intent, context);

    case 'agent_risk_assessment':
      return handleAgentRiskAssessment(intent, context);

    case 'negotiation_strategy':
      return handleNegotiationStrategy(intent, context);

    case 'smart_comparison':
      return handleSmartComparison(intent, context);

    default:
      return {
        success: false,
        message: `Unknown agent action: ${action}`,
        error: 'UNKNOWN_AGENT_ACTION',
      };
  }
}

/**
 * Deep analysis using ReAct agent
 */
async function handleDeepAnalysis(
  intent: DetectedIntent,
  context: ChatContext
): Promise<ActionResponse> {
  const { currentContractId, tenantId, userId } = context;

  if (!currentContractId) {
    return {
      success: true,
      message: "I'd be happy to run a deep analysis! Please select a contract first, or tell me which contract you'd like me to analyze.",
      actions: [
        { label: '📂 Browse Contracts', action: 'navigate', params: { path: '/contracts' } },
        { label: '🔍 Search Contracts', action: 'search_contracts', params: {} },
      ],
    };
  }

  // Return streaming-ready response
  return {
    success: true,
    message: "🧠 **Starting Deep Analysis...**\n\nI'm now analyzing this contract using my ReAct reasoning engine. I'll think through this step-by-step:",
    data: {
      streamingEnabled: true,
      agentType: 'react',
      config: {
        goal: `Perform comprehensive analysis of contract ${currentContractId}`,
        maxIterations: 8,
        enableSelfReflection: true,
        aspects: intent.entities.analysisAspects,
      },
      contractId: currentContractId,
      tenantId,
      userId,
    },
    action: {
      type: 'start_agent_stream',
      data: {
        agentType: 'react',
        contractId: currentContractId,
      },
    },
  };
}

/**
 * Show reasoning chain
 */
async function handleShowReasoning(
  _intent: DetectedIntent,
  context: ChatContext
): Promise<ActionResponse> {
  // This activates "thinking mode" in the UI
  return {
    success: true,
    message: "🔍 **Thinking Mode Activated**\n\nI'll now show my reasoning process for any analysis. You'll see:\n\n• 💭 **Thoughts** - What I'm considering\n• ⚡ **Actions** - Tools I'm using\n• 👁️ **Observations** - What I found\n• ✅ **Decisions** - My conclusions\n\nAsk me anything and I'll walk you through my thinking!",
    data: {
      thinkingModeEnabled: true,
      sessionId: context.conversationId,
    },
    action: {
      type: 'enable_thinking_mode',
      data: { enabled: true },
    },
  };
}

/**
 * Multi-agent debate for decisions
 */
async function handleDebateDecision(
  intent: DetectedIntent,
  context: ChatContext
): Promise<ActionResponse> {
  const { currentContractId, tenantId, userId } = context;
  const topic = intent.entities.topic || 'the terms of this contract';

  if (!currentContractId) {
    return {
      success: true,
      message: `I can help debate "${topic}"! Please select a contract to analyze, and I'll have multiple AI perspectives weigh in.`,
      actions: [
        { label: '📂 Select Contract', action: 'navigate', params: { path: '/contracts' } },
      ],
    };
  }

  return {
    success: true,
    message: `⚖️ **Starting Multi-Agent Debate**\n\nTopic: *"${topic}"*\n\nI'm assembling a panel of AI experts to debate this:\n\n• 📊 **Primary Analyst** - Initial assessment\n• 🔍 **Critical Reviewer** - Finding weaknesses\n• 😈 **Devil's Advocate** - Counter-arguments\n• ✓ **Fact Validator** - Verifying claims\n• 🤝 **Consensus Builder** - Finding common ground\n\n*Debate starting...*`,
    data: {
      streamingEnabled: true,
      agentType: 'debate',
      config: {
        topic,
        preset: 'standard',
        maxTurns: 6,
        consensusThreshold: 0.8,
      },
      contractId: currentContractId,
      tenantId,
      userId,
    },
    action: {
      type: 'start_agent_stream',
      data: {
        agentType: 'debate',
        topic,
        contractId: currentContractId,
      },
    },
  };
}

/**
 * Agent-powered risk assessment
 */
async function handleAgentRiskAssessment(
  _intent: DetectedIntent,
  context: ChatContext
): Promise<ActionResponse> {
  const { currentContractId, tenantId, userId } = context;

  if (!currentContractId) {
    return {
      success: true,
      message: "I can perform a thorough AI risk assessment! Please select a contract to analyze.",
      actions: [
        { label: '📂 Browse Contracts', action: 'navigate', params: { path: '/contracts' } },
      ],
    };
  }

  return {
    success: true,
    message: "🚨 **AI Risk Assessment Starting...**\n\nI'm deploying my reasoning agent to identify risks:\n\n• Analyzing termination clauses\n• Checking liability exposure\n• Evaluating compliance risks\n• Identifying hidden obligations\n• Assessing financial risks\n\n*Thinking...*",
    data: {
      streamingEnabled: true,
      agentType: 'react',
      config: {
        goal: 'Identify and assess all risks in this contract with severity ratings and mitigation recommendations',
        maxIterations: 10,
        preset: 'risk_analysis',
        enableSelfReflection: true,
      },
      contractId: currentContractId,
      tenantId,
      userId,
    },
    action: {
      type: 'start_agent_stream',
      data: {
        agentType: 'react',
        preset: 'risk_analysis',
        contractId: currentContractId,
      },
    },
  };
}

/**
 * Negotiation strategy assistance
 */
async function handleNegotiationStrategy(
  intent: DetectedIntent,
  context: ChatContext
): Promise<ActionResponse> {
  const { currentContractId, tenantId, userId } = context;
  const topic = intent.entities.topic || 'contract terms';

  if (!currentContractId) {
    return {
      success: true,
      message: "I can help develop a negotiation strategy! Please select a contract first.",
      actions: [
        { label: '📂 Select Contract', action: 'navigate', params: { path: '/contracts' } },
      ],
    };
  }

  return {
    success: true,
    message: `🎯 **Developing Negotiation Strategy**\n\nFocus: *${topic}*\n\nI'm analyzing the contract to develop recommendations:\n\n• Identifying weak points in current terms\n• Finding leverage opportunities\n• Drafting counter-proposals\n• Calculating acceptable ranges\n• Preparing fallback positions\n\n*Strategizing...*`,
    data: {
      streamingEnabled: true,
      agentType: 'debate',
      config: {
        topic: `Develop negotiation strategy for: ${topic}`,
        preset: 'thorough',
        maxTurns: 8,
      },
      contractId: currentContractId,
      tenantId,
      userId,
    },
    action: {
      type: 'start_agent_stream',
      data: {
        agentType: 'debate',
        topic: `negotiation: ${topic}`,
        contractId: currentContractId,
      },
    },
  };
}

/**
 * Smart comparison with agent reasoning
 */
async function handleSmartComparison(
  intent: DetectedIntent,
  context: ChatContext
): Promise<ActionResponse> {
  const { tenantId, userId } = context;
  const contractIds = intent.entities.contractIds || [];

  if (contractIds.length < 2) {
    return {
      success: true,
      message: "I can perform an intelligent comparison with detailed reasoning! Please select 2 or more contracts to compare.",
      actions: [
        { label: '📂 Select Contracts', action: 'navigate', params: { path: '/contracts?mode=compare' } },
      ],
    };
  }

  return {
    success: true,
    message: `📊 **Smart Comparison Starting...**\n\nComparing ${contractIds.length} contracts with AI reasoning:\n\n• Analyzing value propositions\n• Comparing risk profiles\n• Evaluating term fairness\n• Identifying best options\n• Generating recommendations\n\n*Analyzing...*`,
    data: {
      streamingEnabled: true,
      agentType: 'react',
      config: {
        goal: `Compare contracts ${contractIds.join(', ')} and recommend the best option with detailed reasoning`,
        maxIterations: 8,
        aspects: intent.entities.comparisonAspects,
      },
      contractIds,
      tenantId,
      userId,
    },
    action: {
      type: 'start_agent_stream',
      data: {
        agentType: 'react',
        preset: 'comparison',
        contractIds,
      },
    },
  };
}

// =============================================================================
// MEMORY INTEGRATION
// =============================================================================

/**
 * Build context from episodic memory for personalized responses
 * Connects to the EpisodicMemoryService for semantic memory recall
 */
export async function buildMemoryContext(
  context: ChatContext,
  currentQuery: string
): Promise<MemoryContext> {
  try {
    // Call the memory service API to recall relevant memories
    const response = await fetch('/api/ai/memory/recall', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: currentQuery,
        tenantId: context.tenantId,
        userId: context.userId,
        contractId: context.currentContractId,
        limit: 5,
        recencyBias: 0.3,
      }),
    });

    if (!response.ok) {
      console.warn('[Memory] Failed to recall memories:', response.status);
      return {
        recentInteractions: [],
        userPreferences: {},
        relevantHistory: [],
      };
    }

    const data = await response.json();
    
    if (data.success && data.memories) {
      // Format memories for context injection
      return {
        recentInteractions: data.memories
          .filter((m: any) => m.memory.type === 'conversation')
          .map((m: any) => m.memory.content)
          .slice(0, 3),
        userPreferences: data.memories
          .filter((m: any) => m.memory.type === 'preference')
          .reduce((acc: Record<string, unknown>, m: any) => {
            try {
              const parsed = JSON.parse(m.memory.content);
              return { ...acc, ...parsed };
            } catch {
              return acc;
            }
          }, {}),
        relevantHistory: data.memories
          .filter((m: any) => m.memory.type !== 'conversation' && m.memory.type !== 'preference')
          .map((m: any) => m.memory.content)
          .slice(0, 5),
      };
    }

    return {
      recentInteractions: [],
      userPreferences: {},
      relevantHistory: [],
    };
  } catch (error) {
    console.warn('[Memory] Error building memory context:', error);
    return {
      recentInteractions: [],
      userPreferences: {},
      relevantHistory: [],
    };
  }
}

/**
 * Store interaction in episodic memory
 * Connects to the EpisodicMemoryService for persistent storage
 */
export async function storeInteraction(
  context: ChatContext,
  userMessage: string,
  assistantResponse: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    // Call the memory service API to store the interaction
    await fetch('/api/ai/memory/store', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: context.tenantId,
        userId: context.userId || 'anonymous',
        type: 'conversation',
        content: `User: ${userMessage}\nAssistant: ${assistantResponse}`,
        context: {
          contractId: context.currentContractId,
          conversationId: context.conversationId,
        },
        importance: calculateImportance(userMessage, assistantResponse),
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
        },
      }),
    });
  } catch (error) {
    console.warn('[Memory] Failed to store interaction:', error);
  }
}

/**
 * Calculate importance score for memory storage
 * Higher importance = more likely to be recalled
 */
function calculateImportance(userMessage: string, assistantResponse: string): number {
  let importance = 0.5; // Base importance

  // Increase for longer, more detailed interactions
  if (userMessage.length > 100) importance += 0.1;
  if (assistantResponse.length > 500) importance += 0.1;

  // Increase for questions (learning opportunities)
  if (userMessage.includes('?')) importance += 0.1;

  // Increase for action-oriented responses
  if (assistantResponse.includes('✅') || assistantResponse.includes('completed')) importance += 0.1;

  // Increase for corrections or feedback
  if (userMessage.toLowerCase().includes('no,') || userMessage.toLowerCase().includes('actually')) importance += 0.15;

  return Math.min(1, importance);
}

// =============================================================================
// SELF-CRITIQUE INTEGRATION
// =============================================================================

export interface CritiqueResult {
  approved: boolean;
  revisedResponse?: string;
  issues?: Array<{ type: string; description: string; severity: 'low' | 'medium' | 'high' }>;
  score?: number;
}

/**
 * Apply self-critique to AI responses before returning
 * Connects to the SelfCritiqueService for quality validation
 */
export async function critiqueResponse(
  response: string,
  context: ChatContext,
  sourceData?: unknown
): Promise<CritiqueResult> {
  try {
    // Call the critique service API
    const result = await fetch('/api/ai/critique', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        response,
        tenantId: context.tenantId,
        contractId: context.currentContractId,
        sourceData,
        options: {
          checkFactualAccuracy: true,
          checkCompleteness: true,
          checkClarity: true,
          checkActionability: true,
          autoRevise: true,
        },
      }),
    });

    if (!result.ok) {
      console.warn('[Critique] Service unavailable, passing through');
      return { approved: true, revisedResponse: response };
    }

    const data = await result.json();
    
    if (data.success) {
      return {
        approved: data.approved !== false,
        revisedResponse: data.revisedResponse || response,
        issues: data.issues || [],
        score: data.score,
      };
    }

    return { approved: true, revisedResponse: response };
  } catch (error) {
    console.warn('[Critique] Error during critique, passing through:', error);
    return { approved: true, revisedResponse: response };
  }
}

/**
 * Critique and optionally revise a response before sending
 * Use this wrapper for important responses that need validation
 */
export async function validateAndRefineResponse(
  response: string,
  context: ChatContext,
  options?: {
    minScore?: number;
    maxRevisions?: number;
    requireApproval?: boolean;
  }
): Promise<{ response: string; wasRevised: boolean; score: number }> {
  const { minScore = 0.7, maxRevisions = 2, requireApproval = false } = options || {};
  
  let currentResponse = response;
  let wasRevised = false;
  let score = 1.0;
  let revisionCount = 0;

  while (revisionCount < maxRevisions) {
    const critique = await critiqueResponse(currentResponse, context);
    score = critique.score || 1.0;

    if (critique.approved && score >= minScore) {
      if (critique.revisedResponse && critique.revisedResponse !== currentResponse) {
        currentResponse = critique.revisedResponse;
        wasRevised = true;
      }
      break;
    }

    if (critique.revisedResponse) {
      currentResponse = critique.revisedResponse;
      wasRevised = true;
      revisionCount++;
    } else {
      break; // No revision available, exit loop
    }
  }

  return { response: currentResponse, wasRevised, score };
}

// =============================================================================
// STREAMING HELPERS
// =============================================================================

/**
 * Format agent step for streaming to UI
 */
export function formatAgentStep(step: AgentThought): string {
  const icons = {
    thought: '💭',
    action: '⚡',
    observation: '👁️',
    decision: '✅',
    critique: '🔍',
    debate_turn: '💬',
  };

  const icon = icons[step.type] || '•';
  const confidence = step.confidence ? ` (${Math.round(step.confidence * 100)}% confident)` : '';
  const agent = step.agentName ? `**${step.agentName}**: ` : '';
  const tool = step.toolUsed ? ` [using ${step.toolUsed}]` : '';

  return `${icon} ${agent}${step.content}${confidence}${tool}`;
}

/**
 * Format debate turn for streaming to UI
 */
export function formatDebateTurn(turn: {
  agentName: string;
  role: string;
  message: string;
  confidence: number;
}): string {
  const roleIcons: Record<string, string> = {
    primary: '📊',
    critic: '🔍',
    advocate: '😈',
    validator: '✓',
    synthesizer: '🤝',
    arbitrator: '⚖️',
  };

  const icon = roleIcons[turn.role] || '💬';
  return `${icon} **${turn.agentName}** (${Math.round(turn.confidence * 100)}%):\n${turn.message}`;
}
