/**
 * Agentic Chat Service with OpenAI Function Calling
 * 
 * Enhances the chatbot with autonomous tool use capabilities.
 * The AI decides which tools to call based on the user's query.
 * 
 * Features:
 * - OpenAI Function Calling for dynamic tool selection
 * - Multi-step reasoning (chain of tool calls)
 * - Parallel tool execution when possible
 * - Automatic error recovery
 * 
 * @version 1.0.0
 */

import OpenAI from 'openai';
import { createOpenAIClient, hasAIClientConfig } from '@/lib/openai-client';
import { prisma } from '@/lib/prisma';
import { hybridSearch } from '@/lib/rag/advanced-rag.service';

// =============================================================================
// TYPES
// =============================================================================

export interface AgenticToolResult {
  toolName: string;
  success: boolean;
  data: unknown;
  error?: string;
  executionTimeMs: number;
}

export interface AgenticResponse {
  content: string;
  toolsUsed: string[];
  toolResults: AgenticToolResult[];
  totalIterations: number;
  confidence: number;
  sources: string[];
}

// =============================================================================
// TOOL DEFINITIONS
// =============================================================================

const CHAT_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'search_contracts',
      description: 'Search for contracts using semantic search. Use this when user asks to find, search, or look for contracts based on content, clauses, or terms.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query to find relevant contracts',
          },
          filters: {
            type: 'object',
            properties: {
              supplier: { type: 'string', description: 'Filter by supplier name' },
              status: { type: 'string', enum: ['ACTIVE', 'DRAFT', 'EXPIRED', 'PENDING'] },
              minValue: { type: 'number', description: 'Minimum contract value' },
              maxValue: { type: 'number', description: 'Maximum contract value' },
            },
          },
          limit: { type: 'number', description: 'Maximum number of results', default: 5 },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_contract_details',
      description: 'Get detailed information about a specific contract by ID or name. Use this when user asks about a specific contract.',
      parameters: {
        type: 'object',
        properties: {
          contractId: { type: 'string', description: 'The contract ID' },
          contractName: { type: 'string', description: 'The contract name to search for' },
          includeArtifacts: { type: 'boolean', description: 'Include extracted artifacts', default: true },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_expiring_contracts',
      description: 'List contracts expiring within a specified number of days. Use for renewal planning and risk management.',
      parameters: {
        type: 'object',
        properties: {
          days: { type: 'number', description: 'Number of days to look ahead', default: 30 },
          supplier: { type: 'string', description: 'Filter by supplier name' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_spend_analysis',
      description: 'Get spend analysis by supplier, category, or time period. Use for financial insights and reporting.',
      parameters: {
        type: 'object',
        properties: {
          groupBy: { type: 'string', enum: ['supplier', 'category', 'month', 'year'], default: 'supplier' },
          supplier: { type: 'string', description: 'Filter by specific supplier' },
          year: { type: 'number', description: 'Filter by year' },
          limit: { type: 'number', description: 'Top N results', default: 10 },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'compare_contracts',
      description: 'Compare two or more contracts side by side. Use when user wants to compare terms, values, or clauses.',
      parameters: {
        type: 'object',
        properties: {
          contractIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of contract IDs to compare',
          },
          contractNames: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of contract names to compare (will search for them)',
          },
          aspects: {
            type: 'array',
            items: { type: 'string', enum: ['value', 'duration', 'terms', 'risks', 'all'] },
            description: 'Aspects to compare',
            default: ['all'],
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_risk_assessment',
      description: 'Get risk assessment for contracts. Identifies high-risk contracts, compliance issues, and action items.',
      parameters: {
        type: 'object',
        properties: {
          riskType: {
            type: 'string',
            enum: ['expiration', 'value', 'compliance', 'auto_renewal', 'all'],
            default: 'all',
          },
          severity: {
            type: 'string',
            enum: ['critical', 'high', 'medium', 'low', 'all'],
            default: 'all',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_supplier_info',
      description: 'Get comprehensive information about a supplier including all their contracts, spend, and performance.',
      parameters: {
        type: 'object',
        properties: {
          supplierName: { type: 'string', description: 'The supplier name' },
          includeContracts: { type: 'boolean', default: true },
          includeSpend: { type: 'boolean', default: true },
        },
        required: ['supplierName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'extract_clause',
      description: 'Extract and analyze specific clause types from contracts. Use for clause-specific queries.',
      parameters: {
        type: 'object',
        properties: {
          clauseType: {
            type: 'string',
            enum: ['termination', 'liability', 'indemnification', 'confidentiality', 'payment', 'renewal', 'force_majeure', 'warranty', 'sla'],
          },
          contractId: { type: 'string', description: 'Specific contract ID' },
          searchAll: { type: 'boolean', description: 'Search across all contracts', default: false },
        },
        required: ['clauseType'],
      },
    },
  },
];

// =============================================================================
// TOOL EXECUTORS
// =============================================================================

async function executeSearchContracts(
  args: { query: string; filters?: { supplier?: string; status?: string; minValue?: number; maxValue?: number }; limit?: number },
  tenantId: string
): Promise<AgenticToolResult> {
  const start = Date.now();
  
  try {
    const results = await hybridSearch(args.query, {
      mode: 'hybrid',
      k: args.limit || 5,
      rerank: true,
      expandQuery: true,
      filters: {
        tenantId,
        suppliers: args.filters?.supplier ? [args.filters.supplier] : undefined,
        status: args.filters?.status ? [args.filters.status] : undefined,
      },
    });

    return {
      toolName: 'search_contracts',
      success: true,
      data: {
        count: results.length,
        contracts: results.map(r => ({
          contractId: r.contractId,
          contractName: r.contractName,
          supplier: r.supplierName,
          score: Math.round(r.score * 100),
          excerpt: r.text.slice(0, 300),
        })),
      },
      executionTimeMs: Date.now() - start,
    };
  } catch (error) {
    return {
      toolName: 'search_contracts',
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Search failed',
      executionTimeMs: Date.now() - start,
    };
  }
}

async function executeGetContractDetails(
  args: { contractId?: string; contractName?: string; includeArtifacts?: boolean },
  tenantId: string
): Promise<AgenticToolResult> {
  const start = Date.now();
  
  try {
    let contract;
    
    if (args.contractId) {
      contract = await prisma.contract.findFirst({
        where: { id: args.contractId, tenantId },
        include: {
          artifacts: args.includeArtifacts !== false,
          clauses: true,
          _count: { select: { versions: true } },
        },
      });
    } else if (args.contractName) {
      contract = await prisma.contract.findFirst({
        where: {
          tenantId,
          OR: [
            { contractTitle: { contains: args.contractName, mode: 'insensitive' } },
            { fileName: { contains: args.contractName, mode: 'insensitive' } },
          ],
        },
        include: {
          artifacts: args.includeArtifacts !== false,
          clauses: true,
          _count: { select: { versions: true } },
        },
      });
    }

    if (!contract) {
      return {
        toolName: 'get_contract_details',
        success: false,
        data: null,
        error: 'Contract not found',
        executionTimeMs: Date.now() - start,
      };
    }

    return {
      toolName: 'get_contract_details',
      success: true,
      data: {
        id: contract.id,
        title: contract.contractTitle,
        supplier: contract.supplierName,
        client: contract.clientName,
        status: contract.status,
        value: contract.totalValue,
        effectiveDate: contract.effectiveDate,
        expirationDate: contract.expirationDate,
        autoRenewal: contract.autoRenewalEnabled,
        daysUntilExpiry: contract.expirationDate 
          ? Math.ceil((new Date(contract.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : null,
        clauseCount: contract.clauses?.length || 0,
        versionsCount: contract._count.versions,
        notesCount: contract._count.notes,
        keyArtifacts: contract.artifacts?.slice(0, 5).map(a => ({
          type: a.artifactType,
          value: typeof a.value === 'string' ? a.value.slice(0, 200) : JSON.stringify(a.value).slice(0, 200),
        })),
      },
      executionTimeMs: Date.now() - start,
    };
  } catch (error) {
    return {
      toolName: 'get_contract_details',
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Failed to get contract details',
      executionTimeMs: Date.now() - start,
    };
  }
}

async function executeListExpiringContracts(
  args: { days?: number; supplier?: string },
  tenantId: string
): Promise<AgenticToolResult> {
  const start = Date.now();
  const days = args.days || 30;
  
  try {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + days);

    const contracts = await prisma.contract.findMany({
      where: {
        tenantId,
        expirationDate: { lte: expirationDate, gte: new Date() },
        status: 'ACTIVE',
        ...(args.supplier && { supplierName: { contains: args.supplier, mode: 'insensitive' } }),
      },
      orderBy: { expirationDate: 'asc' },
      take: 20,
      select: {
        id: true,
        contractTitle: true,
        supplierName: true,
        totalValue: true,
        expirationDate: true,
        autoRenewalEnabled: true,
      },
    });

    return {
      toolName: 'list_expiring_contracts',
      success: true,
      data: {
        count: contracts.length,
        daysAhead: days,
        contracts: contracts.map(c => ({
          id: c.id,
          title: c.contractTitle,
          supplier: c.supplierName,
          value: c.totalValue,
          expirationDate: c.expirationDate,
          daysUntilExpiry: c.expirationDate 
            ? Math.ceil((new Date(c.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            : null,
          autoRenewal: c.autoRenewalEnabled,
        })),
        totalValueAtRisk: contracts.reduce((sum, c) => sum + Number(c.totalValue || 0), 0),
      },
      executionTimeMs: Date.now() - start,
    };
  } catch (error) {
    return {
      toolName: 'list_expiring_contracts',
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Failed to list expiring contracts',
      executionTimeMs: Date.now() - start,
    };
  }
}

async function executeGetSpendAnalysis(
  args: { groupBy?: string; supplier?: string; year?: number; limit?: number },
  tenantId: string
): Promise<AgenticToolResult> {
  const start = Date.now();
  
  try {
    const where: Record<string, unknown> = { tenantId, status: 'ACTIVE' };
    if (args.supplier) {
      where.supplierName = { contains: args.supplier, mode: 'insensitive' };
    }
    if (args.year) {
      where.effectiveDate = {
        gte: new Date(`${args.year}-01-01`),
        lt: new Date(`${args.year + 1}-01-01`),
      };
    }

    const contracts = await prisma.contract.findMany({
      where,
      select: {
        supplierName: true,
        totalValue: true,
        categoryL1: true,
        category: true,
        effectiveDate: true,
      },
    });

    // Group by specified field
    const grouped = new Map<string, { count: number; value: number }>();
    
    for (const c of contracts) {
      let key: string;
      switch (args.groupBy) {
        case 'category':
          key = c.category || 'Uncategorized';
          break;
        case 'month':
          key = c.effectiveDate 
            ? `${new Date(c.effectiveDate).getFullYear()}-${String(new Date(c.effectiveDate).getMonth() + 1).padStart(2, '0')}`
            : 'Unknown';
          break;
        case 'year':
          key = c.effectiveDate 
            ? String(new Date(c.effectiveDate).getFullYear())
            : 'Unknown';
          break;
        default: // supplier
          key = c.supplierName || 'Unknown';
      }
      
      const existing = grouped.get(key) || { count: 0, value: 0 };
      existing.count++;
      existing.value += Number(c.totalValue || 0);
      grouped.set(key, existing);
    }

    // Sort by value and limit
    const sorted = Array.from(grouped.entries())
      .sort((a, b) => b[1].value - a[1].value)
      .slice(0, args.limit || 10);

    return {
      toolName: 'get_spend_analysis',
      success: true,
      data: {
        groupBy: args.groupBy || 'supplier',
        totalContracts: contracts.length,
        totalSpend: contracts.reduce((sum, c) => sum + Number(c.totalValue || 0), 0),
        breakdown: sorted.map(([name, data]) => ({
          name,
          contractCount: data.count,
          totalValue: data.value,
          percentage: contracts.length > 0 
            ? Math.round((data.value / contracts.reduce((sum, c) => sum + Number(c.totalValue || 0), 0)) * 100)
            : 0,
        })),
      },
      executionTimeMs: Date.now() - start,
    };
  } catch (error) {
    return {
      toolName: 'get_spend_analysis',
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Failed to analyze spend',
      executionTimeMs: Date.now() - start,
    };
  }
}

async function executeGetRiskAssessment(
  args: { riskType?: string; severity?: string },
  tenantId: string
): Promise<AgenticToolResult> {
  const start = Date.now();
  
  try {
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const ninetyDays = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const [expiringIn30, expiringIn90, autoRenewals, highValue] = await Promise.all([
      prisma.contract.findMany({
        where: { tenantId, status: 'ACTIVE', expirationDate: { gte: now, lte: thirtyDays } },
        select: { id: true, contractTitle: true, supplierName: true, totalValue: true, expirationDate: true },
      }),
      prisma.contract.findMany({
        where: { tenantId, status: 'ACTIVE', expirationDate: { gte: thirtyDays, lte: ninetyDays } },
        select: { id: true, contractTitle: true, supplierName: true, totalValue: true, expirationDate: true },
      }),
      prisma.contract.findMany({
        where: { tenantId, status: 'ACTIVE', autoRenewalEnabled: true, expirationDate: { gte: now, lte: ninetyDays } },
        select: { id: true, contractTitle: true, supplierName: true, totalValue: true, expirationDate: true },
      }),
      prisma.contract.findMany({
        where: { tenantId, status: 'ACTIVE', totalValue: { gte: 100000 }, expirationDate: { gte: now, lte: ninetyDays } },
        select: { id: true, contractTitle: true, supplierName: true, totalValue: true, expirationDate: true },
      }),
    ]);

    return {
      toolName: 'get_risk_assessment',
      success: true,
      data: {
        summary: {
          criticalRisks: expiringIn30.length,
          highRisks: expiringIn90.length,
          autoRenewalRisks: autoRenewals.length,
          highValueAtRisk: highValue.length,
        },
        expiringIn30Days: expiringIn30.map(c => ({
          id: c.id,
          title: c.contractTitle,
          supplier: c.supplierName,
          value: c.totalValue,
          expirationDate: c.expirationDate,
          severity: 'critical',
        })),
        expiringIn90Days: expiringIn90.map(c => ({
          id: c.id,
          title: c.contractTitle,
          supplier: c.supplierName,
          value: c.totalValue,
          expirationDate: c.expirationDate,
          severity: 'high',
        })),
        autoRenewalContracts: autoRenewals.map(c => ({
          id: c.id,
          title: c.contractTitle,
          supplier: c.supplierName,
          value: c.totalValue,
          expirationDate: c.expirationDate,
          risk: 'May auto-renew without review',
        })),
        recommendations: [
          expiringIn30.length > 0 && `Review ${expiringIn30.length} contracts expiring within 30 days`,
          autoRenewals.length > 0 && `Review ${autoRenewals.length} auto-renewing contracts`,
          highValue.length > 0 && `High-value contracts ($${highValue.reduce((s, c) => s + Number(c.totalValue || 0), 0).toLocaleString()}) expiring soon`,
        ].filter(Boolean),
      },
      executionTimeMs: Date.now() - start,
    };
  } catch (error) {
    return {
      toolName: 'get_risk_assessment',
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Failed to assess risks',
      executionTimeMs: Date.now() - start,
    };
  }
}

async function executeGetSupplierInfo(
  args: { supplierName: string; includeContracts?: boolean; includeSpend?: boolean },
  tenantId: string
): Promise<AgenticToolResult> {
  const start = Date.now();
  
  try {
    const contracts = await prisma.contract.findMany({
      where: {
        tenantId,
        supplierName: { contains: args.supplierName, mode: 'insensitive' },
      },
      select: {
        id: true,
        contractTitle: true,
        status: true,
        totalValue: true,
        effectiveDate: true,
        expirationDate: true,
        contractType: true,
      },
      orderBy: { totalValue: 'desc' },
    });

    const activeContracts = contracts.filter(c => c.status === 'ACTIVE');
    const totalSpend = contracts.reduce((sum, c) => sum + Number(c.totalValue || 0), 0);
    const avgContractValue = contracts.length > 0 ? totalSpend / contracts.length : 0;

    // Calculate relationship duration
    const oldestContract = contracts.reduce((oldest, c) => {
      if (!oldest || (c.effectiveDate && new Date(c.effectiveDate) < new Date(oldest.effectiveDate!))) {
        return c;
      }
      return oldest;
    }, null as typeof contracts[0] | null);

    const relationshipMonths = oldestContract?.effectiveDate
      ? Math.floor((Date.now() - new Date(oldestContract.effectiveDate).getTime()) / (1000 * 60 * 60 * 24 * 30))
      : 0;

    return {
      toolName: 'get_supplier_info',
      success: true,
      data: {
        supplierName: args.supplierName,
        summary: {
          totalContracts: contracts.length,
          activeContracts: activeContracts.length,
          totalSpend: totalSpend,
          avgContractValue: Math.round(avgContractValue),
          relationshipMonths: relationshipMonths,
        },
        contracts: args.includeContracts !== false ? contracts.slice(0, 10).map(c => ({
          id: c.id,
          title: c.contractTitle,
          status: c.status,
          value: c.totalValue,
          type: c.contractType,
          expirationDate: c.expirationDate,
        })) : undefined,
      },
      executionTimeMs: Date.now() - start,
    };
  } catch (error) {
    return {
      toolName: 'get_supplier_info',
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Failed to get supplier info',
      executionTimeMs: Date.now() - start,
    };
  }
}

// Tool executor registry
const TOOL_EXECUTORS: Record<string, (args: any, tenantId: string) => Promise<AgenticToolResult>> = {
  search_contracts: executeSearchContracts,
  get_contract_details: executeGetContractDetails,
  list_expiring_contracts: executeListExpiringContracts,
  get_spend_analysis: executeGetSpendAnalysis,
  get_risk_assessment: executeGetRiskAssessment,
  get_supplier_info: executeGetSupplierInfo,
};

// =============================================================================
// MAIN AGENTIC CHAT FUNCTION
// =============================================================================

export async function agenticChat(
  message: string,
  tenantId: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  options?: { maxIterations?: number; model?: string }
): Promise<AgenticResponse> {
  const openai = createOpenAIClient();
  const maxIterations = options?.maxIterations ?? 5;
  const model = options?.model ?? process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

  const toolsUsed: string[] = [];
  const toolResults: AgenticToolResult[] = [];
  let iterations = 0;

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: `You are ConTigo AI, an intelligent contract management assistant. You have access to powerful tools to search, analyze, and manage contracts. 

Use the available tools to gather information before answering. You can call multiple tools if needed to fully answer the user's question.

When responding:
1. Always link to contracts using markdown: [Contract Name](/contracts/CONTRACT_ID)
2. Provide specific data from tool results
3. Give actionable recommendations
4. Be concise but thorough`,
    },
    ...conversationHistory.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    { role: 'user', content: message },
  ];

  // Agentic loop - let the model decide which tools to use
  while (iterations < maxIterations) {
    iterations++;

    const response = await openai.chat.completions.create({
      model,
      messages,
      tools: CHAT_TOOLS,
      tool_choice: iterations === 1 ? 'auto' : 'auto', // Let model decide
      temperature: 0.7,
      max_tokens: 2000,
    });

    const choice = response.choices[0];
    
    // If no tool calls, we have the final response
    if (!choice.message.tool_calls || choice.message.tool_calls.length === 0) {
      return {
        content: choice.message.content || 'I apologize, but I could not generate a response.',
        toolsUsed,
        toolResults,
        totalIterations: iterations,
        confidence: toolResults.length > 0 && toolResults.every(r => r.success) ? 0.95 : 0.75,
        sources: toolResults
          .filter(r => r.success)
          .flatMap(r => {
            const data = r.data as any;
            if (data?.contracts) {
              return data.contracts.map((c: any) => c.contractName || c.title || 'Contract');
            }
            if (data?.title) {
              return [data.title];
            }
            return [];
          }),
      };
    }

    // Execute tool calls (potentially in parallel)
    const toolCallResults = await Promise.all(
      choice.message.tool_calls.map(async (toolCall) => {
        const toolName = toolCall.function.name;
        let args: Record<string, unknown>;
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch {
          return {
            toolCallId: toolCall.id,
            result: {
              toolName,
              success: false,
              data: null,
              error: `Invalid tool arguments for ${toolName}`,
              executionTimeMs: 0,
            },
          };
        }
        
        toolsUsed.push(toolName);
        
        const executor = TOOL_EXECUTORS[toolName];
        if (!executor) {
          return {
            toolCallId: toolCall.id,
            result: {
              toolName,
              success: false,
              data: null,
              error: `Unknown tool: ${toolName}`,
              executionTimeMs: 0,
            },
          };
        }

        const result = await executor(args, tenantId);
        toolResults.push(result);
        
        return {
          toolCallId: toolCall.id,
          result,
        };
      })
    );

    // Add assistant message with tool calls
    messages.push({
      role: 'assistant',
      content: choice.message.content || null,
      tool_calls: choice.message.tool_calls,
    } as OpenAI.Chat.Completions.ChatCompletionMessageParam);

    // Add tool results
    for (const { toolCallId, result } of toolCallResults) {
      messages.push({
        role: 'tool',
        tool_call_id: toolCallId,
        content: JSON.stringify(result.data || { error: result.error }),
      } as OpenAI.Chat.Completions.ChatCompletionMessageParam);
    }
  }

  // Max iterations reached
  return {
    content: 'I\'ve gathered the available information. Let me summarize what I found...',
    toolsUsed,
    toolResults,
    totalIterations: iterations,
    confidence: 0.7,
    sources: [],
  };
}

// Export for use in chat route
export { CHAT_TOOLS, TOOL_EXECUTORS };
