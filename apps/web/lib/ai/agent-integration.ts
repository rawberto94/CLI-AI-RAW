/**
 * Agent Integration Layer
 * 
 * Integrates the ReAct agent and Autonomous Orchestrator from packages/agents
 * into the chatbot for handling complex multi-step queries that require
 * reasoning and tool use beyond simple RAG retrieval.
 * 
 * @version 1.0.0
 */

import { ReActAgent, type ReActContext, type ReActResult, type ReActConfig, type ReActTool } from '@repo/agents';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import pino from 'pino';

const logger = pino({ name: 'agent-integration' });

// ============================================================================
// TYPES
// ============================================================================

export interface AgentQuery {
  query: string;
  tenantId: string;
  userId: string;
  contractId?: string;
  contractText?: string;
  conversationHistory?: Array<{ role: string; content: string }>;
}

export interface AgentDecision {
  useAgent: boolean;
  reason: string;
  agentType: 'react' | 'simple' | 'none';
  complexity: 'low' | 'medium' | 'high';
  estimatedSteps: number;
}

export interface AgentResponse {
  success: boolean;
  response: string;
  reasoning?: string[];
  toolsUsed?: string[];
  confidence: number;
  processingTimeMs: number;
  agentUsed: boolean;
  steps?: number;
}

// ============================================================================
// AGENT DECISION LOGIC
// ============================================================================

/**
 * Patterns that indicate a query needs multi-step reasoning
 */
const COMPLEX_QUERY_PATTERNS = [
  // Analysis requiring multiple data points
  /(?:analyze|compare|evaluate)\s+(?:all|multiple|several|the)/i,
  /(?:what|which)\s+(?:are\s+)?(?:the\s+)?(?:best|top|worst|riskiest|safest)/i,
  
  // Multi-step workflows
  /(?:first|then|after that|next|finally|step by step)/i,
  /(?:and also|as well as|in addition|furthermore)/i,
  
  // Deep analysis keywords
  /(?:thorough|comprehensive|detailed|in-depth|complete)\s+(?:analysis|review|assessment)/i,
  /(?:risk|compliance|legal|financial)\s+(?:analysis|assessment|review|audit)/i,
  
  // Contract-specific complex queries
  /(?:extract|identify|find)\s+(?:all|every|each)\s+(?:clause|term|obligation|risk)/i,
  /(?:what|which)\s+(?:clauses?|terms?|provisions?)\s+(?:relate|pertain|apply)\s+to/i,
  
  // Comparative analysis
  /(?:compare|contrast|difference|similar)\s+(?:between|across|among)/i,
  /(?:how)\s+(?:does|do|is|are)\s+(?:this|these|it)\s+(?:compare|differ|relate)/i,
  
  // Recommendations requiring reasoning
  /(?:recommend|suggest|advise|propose)\s+(?:how|what|which|whether)/i,
  /(?:should|could|would)\s+(?:I|we|they)\s+(?:renew|terminate|renegotiate|extend)/i,
];

/**
 * Simple queries that don't need the agent
 */
const SIMPLE_QUERY_PATTERNS = [
  // Direct lookups
  /(?:show|list|get|find)\s+(?:me\s+)?(?:the\s+)?(?:contract|contracts)\s+(?:with|from|by)/i,
  /(?:what|when|where|who)\s+(?:is|are)\s+(?:the\s+)?(?:expir|due|start)/i,
  
  // Status checks
  /(?:how many|count|total|number)\s+(?:of\s+)?contracts?/i,
  /(?:status|state)\s+(?:of|for)\s+(?:the\s+)?contract/i,
  
  // Simple navigation
  /(?:go\s+to|open|show\s+me)\s+(?:the\s+)?(?:dashboard|contracts|analytics)/i,
  
  // Greetings and help
  /^(?:hi|hello|hey|thanks|help|bye)/i,
];

/**
 * Determine if a query should use the ReAct agent
 */
export function shouldUseAgent(query: string): AgentDecision {
  const lowerQuery = query.toLowerCase();
  
  // Check for simple patterns first
  for (const pattern of SIMPLE_QUERY_PATTERNS) {
    if (pattern.test(query)) {
      return {
        useAgent: false,
        reason: 'Query matches simple lookup pattern',
        agentType: 'none',
        complexity: 'low',
        estimatedSteps: 1,
      };
    }
  }
  
  // Check for complex patterns
  let matchCount = 0;
  const matchedPatterns: string[] = [];
  
  for (const pattern of COMPLEX_QUERY_PATTERNS) {
    if (pattern.test(query)) {
      matchCount++;
      matchedPatterns.push(pattern.source.slice(0, 30));
    }
  }
  
  // Multiple conditions in query suggest complexity
  const hasMultipleConditions = (query.match(/\s+and\s+|\s+or\s+|\s+but\s+|,\s+(?:and|or|but)/gi) || []).length >= 2;
  
  // Question with multiple parts
  const hasMultipleParts = (query.match(/\?/g) || []).length > 1 || 
    (query.match(/(?:first|second|third|also|additionally)/gi) || []).length > 0;
  
  // Long queries often indicate complexity
  const wordCount = query.split(/\s+/).length;
  const isLongQuery = wordCount > 20;
  
  // Calculate complexity
  const complexityScore = matchCount + 
    (hasMultipleConditions ? 2 : 0) + 
    (hasMultipleParts ? 2 : 0) +
    (isLongQuery ? 1 : 0);
  
  if (complexityScore >= 3) {
    return {
      useAgent: true,
      reason: `Complex query detected (score: ${complexityScore}, patterns: ${matchedPatterns.join(', ')})`,
      agentType: 'react',
      complexity: complexityScore >= 5 ? 'high' : 'medium',
      estimatedSteps: Math.min(complexityScore + 2, 8),
    };
  }
  
  if (complexityScore >= 1) {
    return {
      useAgent: false,
      reason: 'Query has some complexity but can be handled with simple RAG',
      agentType: 'simple',
      complexity: 'medium',
      estimatedSteps: 2,
    };
  }
  
  return {
    useAgent: false,
    reason: 'Simple query, no agent needed',
    agentType: 'none',
    complexity: 'low',
    estimatedSteps: 1,
  };
}

// ============================================================================
// REACT AGENT INTEGRATION
// ============================================================================

// Singleton agent instance
let agentInstance: ReActAgent | null = null;

// Track config and tool count locally since ReActAgent doesn't expose getters
let agentConfig: Partial<ReActConfig> = {};
let agentToolCount = 0;

/**
 * Get or create the ReAct agent instance
 */
async function getAgent(): Promise<ReActAgent> {
  if (!agentInstance) {
    agentConfig = {
      maxIterations: 6,
      temperature: 0.3, // Lower temperature for factual contract queries
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      enableSelfReflection: true,
      confidenceThreshold: 0.7,
    };
    
    // Build contract-specific tools to pass to the agent constructor
    const contractTools = buildContractTools();
    agentToolCount = contractTools.length;
    agentInstance = new ReActAgent(agentConfig, contractTools);
    
    logger.info('ReAct agent initialized with custom contract tools');
  }
  
  return agentInstance;
}

/**
 * Build contract-specific tools for the agent
 */
function buildContractTools(): ReActTool[] {
  const tools: ReActTool[] = [];

  // Tool: Search contracts in database
  tools.push({
    name: 'search_database_contracts',
    description: 'Search for contracts in the database by name, supplier, status, or value range',
    parameters: z.object({
      searchTerm: z.string().optional(),
      supplierName: z.string().optional(),
      status: z.enum(['ACTIVE', 'DRAFT', 'EXPIRED', 'PENDING', 'TERMINATED']).optional(),
      minValue: z.number().optional(),
      maxValue: z.number().optional(),
      limit: z.number().optional().default(10),
    }),
    execute: async (params, context) => {
      try {
        const where: Record<string, unknown> = { tenantId: context.tenantId };
        
        if (params.searchTerm) {
          where.OR = [
            { contractTitle: { contains: params.searchTerm, mode: 'insensitive' } },
            { supplierName: { contains: params.searchTerm, mode: 'insensitive' } },
          ];
        }
        if (params.supplierName) {
          where.supplierName = { contains: params.supplierName, mode: 'insensitive' };
        }
        if (params.status) {
          where.status = params.status;
        }
        if (params.minValue !== undefined || params.maxValue !== undefined) {
          where.totalValue = {};
          if (params.minValue !== undefined) (where.totalValue as Record<string, number>).gte = params.minValue;
          if (params.maxValue !== undefined) (where.totalValue as Record<string, number>).lte = params.maxValue;
        }
        
        const contracts = await prisma.contract.findMany({
          where,
          select: {
            id: true,
            contractTitle: true,
            supplierName: true,
            status: true,
            totalValue: true,
            expirationDate: true,
            contractType: true,
          },
          take: params.limit,
          orderBy: { updatedAt: 'desc' },
        });
        
        return {
          success: true,
          data: {
            contracts: contracts.map(c => ({
              id: c.id,
              title: c.contractTitle,
              supplier: c.supplierName,
              status: c.status,
              value: c.totalValue?.toString() || 'N/A',
              expires: c.expirationDate?.toISOString().split('T')[0] || 'N/A',
              type: c.contractType || 'CONTRACT',
            })),
            count: contracts.length,
          },
        };
      } catch (error) {
        return {
          success: false,
          data: null,
          error: `Database search failed: ${(error as Error).message}`,
        };
      }
    },
  });

  // Tool: Get contract artifacts
  tools.push({
    name: 'get_contract_artifacts',
    description: 'Get extracted artifacts (obligations, clauses, parties, financial terms) from a specific contract',
    parameters: z.object({
      contractId: z.string(),
      artifactTypes: z.array(z.string()).optional(),
    }),
    execute: async (params, context) => {
      try {
        const contract = await prisma.contract.findFirst({
          where: { 
            id: params.contractId,
            tenantId: context.tenantId,
          },
          include: {
            artifacts: true,
          },
        });
        
        if (!contract) {
          return { success: false, data: null, error: 'Contract not found' };
        }
        
        let artifacts = contract.artifacts;
        if (params.artifactTypes?.length) {
          artifacts = artifacts.filter(a => params.artifactTypes!.includes(a.type));
        }
        
        return {
          success: true,
          data: {
            contractTitle: contract.contractTitle,
            artifacts: artifacts.map(a => ({
              type: a.type,
              name: a.title,
              value: a.data,
              confidence: a.confidence,
            })),
            count: artifacts.length,
          },
        };
      } catch (error) {
        return {
          success: false,
          data: null,
          error: `Failed to fetch artifacts: ${(error as Error).message}`,
        };
      }
    },
  });

  // Tool: Analyze risk across contracts
  tools.push({
    name: 'analyze_portfolio_risk',
    description: 'Analyze risk factors across the entire contract portfolio or filtered subset',
    parameters: z.object({
      supplierFilter: z.string().optional(),
      daysUntilExpiry: z.number().optional().default(90),
    }),
    execute: async (params, context) => {
      try {
        const where: Record<string, unknown> = { tenantId: context.tenantId };
        
        if (params.supplierFilter) {
          where.supplierName = { contains: params.supplierFilter, mode: 'insensitive' };
        }
        
        const contracts = await prisma.contract.findMany({
          where,
          select: {
            id: true,
            contractTitle: true,
            supplierName: true,
            status: true,
            totalValue: true,
            expirationDate: true,
            expirationRisk: true,
          },
        });
        
        const now = new Date();
        const expiryThreshold = new Date(now.getTime() + params.daysUntilExpiry * 24 * 60 * 60 * 1000);
        
        const expiring = contracts.filter(c => 
          c.expirationDate && new Date(c.expirationDate) <= expiryThreshold
        );
        
        const highValue = contracts.filter(c => 
          c.totalValue && Number(c.totalValue) > 100000
        );
        
        const highRisk = contracts.filter(c => 
          c.expirationRisk && ['HIGH', 'CRITICAL'].includes(c.expirationRisk)
        );
        
        const totalValue = contracts.reduce(
          (sum, c) => sum + Number(c.totalValue || 0), 
          0
        );
        const atRiskValue = expiring.reduce(
          (sum, c) => sum + Number(c.totalValue || 0), 
          0
        );
        
        return {
          success: true,
          data: {
            totalContracts: contracts.length,
            expiringSoon: expiring.length,
            highValueContracts: highValue.length,
            highRiskContracts: highRisk.length,
            totalPortfolioValue: totalValue,
            valueAtRisk: atRiskValue,
            riskSummary: {
              expirationRisk: expiring.length > 0 ? 'HIGH' : 'LOW',
              concentrationRisk: highValue.length > contracts.length * 0.2 ? 'MEDIUM' : 'LOW',
              overallRisk: highRisk.length > 0 ? 'ELEVATED' : 'NORMAL',
            },
            recommendations: [
              expiring.length > 0 ? `Review ${expiring.length} contracts expiring within ${params.daysUntilExpiry} days` : null,
              highRisk.length > 0 ? `Address ${highRisk.length} high-risk contracts` : null,
              atRiskValue > totalValue * 0.3 ? 'Consider diversifying supplier base' : null,
            ].filter(Boolean),
          },
        };
      } catch (error) {
        return {
          success: false,
          data: null,
          error: `Risk analysis failed: ${(error as Error).message}`,
        };
      }
    },
  });

  return tools;
}

/**
 * Execute a query using the ReAct agent
 */
export async function executeWithAgent(
  query: AgentQuery
): Promise<AgentResponse> {
  const startTime = Date.now();
  
  try {
    // Check if we have OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      return {
        success: false,
        response: 'Agent requires OpenAI API key to be configured.',
        confidence: 0,
        processingTimeMs: Date.now() - startTime,
        agentUsed: false,
      };
    }
    
    const agent = await getAgent();
    
    // Build agent context
    const context: ReActContext = {
      goal: query.query,
      contractId: query.contractId,
      contractText: query.contractText,
      tenantId: query.tenantId,
      userId: query.userId,
      additionalContext: {
        conversationHistory: query.conversationHistory?.slice(-5), // Last 5 messages
      },
    };
    
    logger.info({ goal: query.query, tenantId: query.tenantId }, 'Starting ReAct agent execution');
    
    // Execute the agent
    const result: ReActResult = await agent.run(context);
    
    logger.info({ 
      success: result.success, 
      steps: result.totalIterations,
      tools: result.toolsUsed,
      timeMs: result.processingTimeMs,
    }, 'ReAct agent completed');
    
    // Format the response
    const reasoning = result.steps
      .filter(s => s.thought)
      .map(s => s.thought);
    
    return {
      success: result.success,
      response: result.finalAnswer,
      reasoning: reasoning.length > 0 ? reasoning : undefined,
      toolsUsed: result.toolsUsed.length > 0 ? result.toolsUsed : undefined,
      confidence: result.success ? 0.85 : 0.4,
      processingTimeMs: Date.now() - startTime,
      agentUsed: true,
      steps: result.totalIterations,
    };
  } catch (error) {
    logger.error({ error, query: query.query }, 'Agent execution failed');
    
    return {
      success: false,
      response: `I encountered an issue while processing your request: ${(error as Error).message}`,
      confidence: 0,
      processingTimeMs: Date.now() - startTime,
      agentUsed: true,
    };
  }
}

/**
 * Process a chat query, deciding whether to use agent or simple RAG
 */
export async function processWithAgentDecision(
  query: AgentQuery
): Promise<AgentResponse & { decision: AgentDecision }> {
  const decision = shouldUseAgent(query.query);
  
  if (decision.useAgent && decision.agentType === 'react') {
    const response = await executeWithAgent(query);
    return { ...response, decision };
  }
  
  // Return a marker indicating agent was not used
  return {
    success: true,
    response: '', // Empty - caller should use regular processing
    confidence: 0,
    processingTimeMs: 0,
    agentUsed: false,
    decision,
  };
}

/**
 * Get agent status and statistics
 */
export function getAgentStatus(): {
  initialized: boolean;
  toolCount: number;
  config: Partial<ReActConfig>;
} {
  if (!agentInstance) {
    return {
      initialized: false,
      toolCount: 0,
      config: {},
    };
  }
  
  return {
    initialized: true,
    toolCount: agentToolCount,
    config: agentConfig,
  };
}

export default {
  shouldUseAgent,
  executeWithAgent,
  processWithAgentDecision,
  getAgentStatus,
};
