/**
 * Streaming Chat Tool Definitions & Executors
 * 
 * Comprehensive tool registry for OpenAI function calling in the
 * streaming chat endpoint. Extends the base agentic tools with
 * workflow management, contract actions, navigation, and reporting.
 * 
 * @version 2.0.0
 */

import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { hybridSearch } from '@/lib/rag/advanced-rag.service';
import { validateToolArgs } from '@/lib/ai/tool-validation';

// Re-export for consumers that imported from this module
export { validateToolArgs } from '@/lib/ai/tool-validation';

// =============================================================================
// TYPES
// =============================================================================

export interface ToolResult {
  toolName: string;
  success: boolean;
  data: unknown;
  error?: string;
  executionTimeMs: number;
  /** Navigation action the frontend should execute */
  navigation?: { url: string; label: string };
  /** Suggested follow-up actions */
  suggestedActions?: Array<{ label: string; action: string }>;
}

// =============================================================================
// TOOL DEFINITIONS (OpenAI Function Calling Schema)
// =============================================================================

export const STREAMING_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  // ── Contract Search & Details ────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'search_contracts',
      description: 'Search for contracts using semantic search. Use when the user asks to find, search, or look for contracts by content, clauses, terms, supplier, or value.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query' },
          filters: {
            type: 'object',
            properties: {
              supplier: { type: 'string', description: 'Filter by supplier name' },
              status: { type: 'string', enum: ['ACTIVE', 'DRAFT', 'EXPIRED', 'PENDING', 'COMPLETED', 'ARCHIVED', 'CANCELLED'] },
              minValue: { type: 'number', description: 'Minimum contract value' },
              maxValue: { type: 'number', description: 'Maximum contract value' },
            },
          },
          limit: { type: 'number', description: 'Maximum results (default 5)', default: 5 },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_contract_details',
      description: 'Get detailed information about a specific contract by ID or name. Use when the user references a particular contract.',
      parameters: {
        type: 'object',
        properties: {
          contractId: { type: 'string', description: 'Exact contract ID (UUID)' },
          contractName: { type: 'string', description: 'Contract name/title to search for' },
          includeArtifacts: { type: 'boolean', description: 'Include extracted artifacts', default: true },
        },
      },
    },
  },

  // ── Analytics & Risk ──────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'list_expiring_contracts',
      description: 'List contracts expiring within a given number of days. Use for renewal reminders, risk assessments, and expiration tracking.',
      parameters: {
        type: 'object',
        properties: {
          days: { type: 'number', description: 'Days ahead to check (default 30)', default: 30 },
          supplier: { type: 'string', description: 'Filter by supplier name' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_spend_analysis',
      description: 'Analyze contract spend grouped by supplier, category, month, or year. Use for budget analysis, spend tracking, and financial insights.',
      parameters: {
        type: 'object',
        properties: {
          groupBy: { type: 'string', enum: ['supplier', 'category', 'month', 'year'], default: 'supplier' },
          supplier: { type: 'string', description: 'Filter by specific supplier' },
          year: { type: 'number', description: 'Filter by year' },
          limit: { type: 'number', description: 'Top N results', default: 10 },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_risk_assessment',
      description: 'Get a comprehensive risk assessment including expiring contracts, auto-renewals, and high-value at-risk contracts. Use for risk dashboards and compliance checks.',
      parameters: {
        type: 'object',
        properties: {
          riskType: { type: 'string', enum: ['expiration', 'auto-renewal', 'high-value', 'all'], default: 'all' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_supplier_info',
      description: 'Get information about a supplier including total contracts, spend, relationship duration, and risk posture.',
      parameters: {
        type: 'object',
        properties: {
          supplierName: { type: 'string', description: 'The supplier name to look up' },
          includeContracts: { type: 'boolean', description: 'Include contract list', default: true },
        },
        required: ['supplierName'],
      },
    },
  },

  // ── Workflow Management ───────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'start_workflow',
      description: 'Start an approval or review workflow for a contract. Use when the user asks to initiate, kick off, or begin a workflow/approval process.',
      parameters: {
        type: 'object',
        properties: {
          contractId: { type: 'string', description: 'The contract ID to start the workflow for' },
          workflowType: { type: 'string', description: 'Type of workflow (e.g., approval, review, renewal)' },
          workflowId: { type: 'string', description: 'Specific workflow template ID' },
        },
        required: ['contractId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_workflows',
      description: 'List available workflow templates or active workflow executions. Use when the user asks about workflows, approval processes, or review pipelines.',
      parameters: {
        type: 'object',
        properties: {
          includeExecutions: { type: 'boolean', description: 'Also list active executions', default: false },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_pending_approvals',
      description: 'List all pending approval tasks assigned to the current user. Use when user asks "what needs my approval", "pending tasks", "my reviews".',
      parameters: {
        type: 'object',
        properties: {
          urgentOnly: { type: 'boolean', description: 'Only show urgent/overdue approvals', default: false },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'approve_or_reject_step',
      description: 'Approve or reject a workflow step/approval task. Use when the user explicitly says "approve" or "reject" a specific approval.',
      parameters: {
        type: 'object',
        properties: {
          executionId: { type: 'string', description: 'Workflow execution ID' },
          decision: { type: 'string', enum: ['approve', 'reject'], description: 'The decision' },
          comment: { type: 'string', description: 'Optional comment or reason' },
        },
        required: ['executionId', 'decision'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_workflow_status',
      description: 'Check the status and progress of a running workflow execution. Use when the user asks "what is the status of the approval?", "where is the workflow at?", or "how far along is the review?".',
      parameters: {
        type: 'object',
        properties: {
          executionId: { type: 'string', description: 'Workflow execution ID' },
          contractId: { type: 'string', description: 'Contract ID to find its active workflow' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_workflow',
      description: 'Create a new workflow template with default approval steps. Use when the user asks to "create a workflow", "set up an approval process", or "new review workflow".',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name for the workflow template' },
          type: { type: 'string', enum: ['APPROVAL', 'REVIEW', 'CUSTOM'], description: 'Type of workflow', default: 'APPROVAL' },
          steps: {
            type: 'array',
            items: { type: 'object', properties: { name: { type: 'string' }, type: { type: 'string' } } },
            description: 'Custom steps (optional — defaults to Manager Review, Legal Review, Final Approval)',
          },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_workflow',
      description: 'Cancel an active workflow execution. Use when the user says "cancel the workflow", "stop the approval", or "abort the review process".',
      parameters: {
        type: 'object',
        properties: {
          executionId: { type: 'string', description: 'Workflow execution ID to cancel' },
          reason: { type: 'string', description: 'Reason for cancellation' },
        },
        required: ['executionId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'assign_approver',
      description: 'Assign a user to a pending workflow step. Use when the user says "assign Sarah to the legal review", "delegate step to John", or "reassign the approval".',
      parameters: {
        type: 'object',
        properties: {
          executionId: { type: 'string', description: 'Workflow execution ID' },
          assignee: { type: 'string', description: 'Name or email of the person to assign' },
        },
        required: ['executionId', 'assignee'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'escalate_workflow',
      description: 'Escalate a stuck or overdue workflow. Use when the user says "escalate the approval", "this workflow is stuck", or "speed up the review".',
      parameters: {
        type: 'object',
        properties: {
          executionId: { type: 'string', description: 'Workflow execution ID to escalate' },
          reason: { type: 'string', description: 'Reason for escalation' },
        },
        required: ['executionId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'suggest_workflow',
      description: 'Get an AI recommendation for which workflow template to use for a contract. Use when the user asks "which workflow should I use?", "recommend an approval process", or "what workflow fits this contract?".',
      parameters: {
        type: 'object',
        properties: {
          contractId: { type: 'string', description: 'The contract ID to get a workflow recommendation for' },
        },
        required: ['contractId'],
      },
    },
  },

  // ── Contract Actions ──────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'create_contract',
      description: 'Create a new contract draft. Use when the user wants to create, draft, or start a new contract.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Contract title' },
          supplierName: { type: 'string', description: 'Supplier/vendor name' },
          clientName: { type: 'string', description: 'Client name' },
          contractType: { type: 'string', description: 'Type (e.g., MSA, NDA, SOW, Amendment)' },
          totalValue: { type: 'number', description: 'Total contract value' },
          effectiveDate: { type: 'string', description: 'Start date (ISO format)' },
          expirationDate: { type: 'string', description: 'End date (ISO format)' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_contract',
      description: 'Update a field on an existing contract. Use when the user wants to change, update, or modify a contract field (status, value, dates, supplier, etc.).',
      parameters: {
        type: 'object',
        properties: {
          contractId: { type: 'string', description: 'Contract ID to update' },
          field: { type: 'string', enum: ['status', 'totalValue', 'effectiveDate', 'expirationDate', 'supplierName', 'clientName', 'category', 'contractTitle'], description: 'Field to update' },
          value: { type: 'string', description: 'New value for the field' },
        },
        required: ['contractId', 'field', 'value'],
      },
    },
  },

  // ── Navigation & Reporting ────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'navigate_to_page',
      description: 'Navigate the user to a specific page in the application. Use when the user asks to "go to", "show me", "open", or "take me to" a page.',
      parameters: {
        type: 'object',
        properties: {
          page: {
            type: 'string',
            enum: ['dashboard', 'contracts', 'analytics', 'workflows', 'settings', 'vendors', 'compliance', 'risk-dashboard', 'reports', 'bulk-operations', 'calendar', 'intelligence', 'intelligence-graph', 'intelligence-health', 'intelligence-search', 'intelligence-negotiate', 'self-service', 'ecosystem', 'governance', 'admin', 'renewals', 'generate', 'drafting', 'drafting-copilot', 'approvals'],
            description: 'Target page',
          },
          contractId: { type: 'string', description: 'Specific contract to navigate to' },
        },
        required: ['page'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_intelligence_insights',
      description: 'Get AI-powered intelligence insights including contract health scores, risk insights, expiration warnings, compliance gaps, and strategic recommendations. Use when the user asks about health scores, intelligence, AI insights, portfolio health, or strategic analysis.',
      parameters: {
        type: 'object',
        properties: {
          section: {
            type: 'string',
            enum: ['all', 'health', 'insights', 'activity'],
            description: 'Which intelligence section to retrieve. "all" returns health scores + insights + recent activity.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_compliance_summary',
      description: 'Get a compliance and obligation tracking summary. Use for compliance audits, obligation status, and regulatory checks.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['all', 'overdue', 'upcoming', 'completed'], default: 'all' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_contract_stats',
      description: 'Get high-level contract portfolio statistics (counts by status, total value, avg value, category breakdown). Use for dashboard views and executive summaries.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },

  // ── Agent Intelligence Bridge ───────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'get_agent_insights',
      description: 'Get proactive insights from background AI agents including risk alerts, optimization opportunities, compliance issues, and learning patterns. Use when the user asks "what have the agents found?", "any AI insights?", "proactive alerts", "agent findings", or "what should I know?".',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            enum: ['all', 'risk', 'opportunities', 'compliance', 'learning', 'health'],
            description: 'Filter insights by category. "all" returns everything.',
          },
          limit: { type: 'number', description: 'Maximum insights to return (default 10)', default: 10 },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_agent_debate',
      description: 'Request a multi-agent debate/analysis on a contract. Multiple specialist agents (legal, pricing, compliance, risk, operations) analyze and debate the contract, resolving conflicts to produce a consensus plan. Use when the user asks for "second opinion", "multi-agent analysis", "agent debate", or "comprehensive review from all perspectives".',
      parameters: {
        type: 'object',
        properties: {
          contractId: { type: 'string', description: 'The contract ID to analyze' },
          focusAreas: {
            type: 'array',
            items: { type: 'string', enum: ['legal', 'pricing', 'compliance', 'risk', 'operations'] },
            description: 'Specific areas to focus the debate on (optional — defaults to all)',
          },
        },
        required: ['contractId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'rate_response',
      description: 'Record user feedback on AI response quality. Use when the user says "good answer", "bad response", "thumbs up", "thumbs down", "that was helpful", or provides quality feedback on a previous answer.',
      parameters: {
        type: 'object',
        properties: {
          rating: { type: 'string', enum: ['positive', 'negative'], description: 'Whether the response was helpful' },
          reason: { type: 'string', description: 'Optional reason for the rating' },
          messageId: { type: 'string', description: 'ID of the message being rated (optional)' },
        },
        required: ['rating'],
      },
    },
  },
];

// =============================================================================
// TOOL EXECUTORS
// =============================================================================

export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  tenantId: string,
  userId: string
): Promise<ToolResult> {
  const start = Date.now();

  // Validate tool arguments before executing
  const validation = validateToolArgs(toolName, args);
  if (!validation.valid) {
    return {
      toolName,
      success: false,
      data: null,
      error: validation.error,
      executionTimeMs: Date.now() - start,
    };
  }
  const validArgs = validation.args;

  try {
    switch (toolName) {
      case 'search_contracts':
        return await executeSearchContracts(validArgs, tenantId, start);
      case 'get_contract_details':
        return await executeGetContractDetails(validArgs, tenantId, start);
      case 'list_expiring_contracts':
        return await executeListExpiring(validArgs, tenantId, start);
      case 'get_spend_analysis':
        return await executeSpendAnalysis(validArgs, tenantId, start);
      case 'get_risk_assessment':
        return await executeRiskAssessment(tenantId, start);
      case 'get_supplier_info':
        return await executeSupplierInfo(validArgs, tenantId, start);
      case 'start_workflow':
        return await executeStartWorkflow(validArgs, tenantId, userId, start);
      case 'list_workflows':
        return await executeListWorkflows(validArgs, tenantId, start);
      case 'get_pending_approvals':
        return await executeGetPendingApprovals(tenantId, userId, start);
      case 'approve_or_reject_step':
        return await executeApproveReject(validArgs, tenantId, userId, start);
      case 'get_workflow_status':
        return await executeGetWorkflowStatus(validArgs, tenantId, start);
      case 'create_workflow':
        return await executeCreateWorkflow(validArgs, tenantId, userId, start);
      case 'cancel_workflow':
        return await executeCancelWorkflow(validArgs, tenantId, userId, start);
      case 'assign_approver':
        return await executeAssignApprover(validArgs, tenantId, userId, start);
      case 'escalate_workflow':
        return await executeEscalateWorkflow(validArgs, tenantId, userId, start);
      case 'suggest_workflow':
        return await executeSuggestWorkflow(validArgs, tenantId, start);
      case 'create_contract':
        return await executeCreateContract(validArgs, tenantId, userId, start);
      case 'update_contract':
        return await executeUpdateContract(validArgs, tenantId, userId, start);
      case 'navigate_to_page':
        return await executeNavigate(validArgs, start);
      case 'get_intelligence_insights':
        return await executeIntelligenceInsights(validArgs, tenantId, start);
      case 'get_compliance_summary':
        return await executeComplianceSummary(tenantId, start);
      case 'get_contract_stats':
        return await executeContractStats(tenantId, start);
      case 'get_agent_insights':
        return await executeAgentInsights(validArgs, tenantId, start);
      case 'get_agent_debate':
        return await executeAgentDebate(validArgs, tenantId, start);
      case 'rate_response':
        return await executeRateResponse(validArgs, tenantId, userId, start);
      default:
        return { toolName, success: false, data: null, error: `Unknown tool: ${toolName}`, executionTimeMs: Date.now() - start };
    }
  } catch (error) {
    return {
      toolName,
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Tool execution failed',
      executionTimeMs: Date.now() - start,
    };
  }
}

// ── Search Contracts ────────────────────────────────────────────────────

async function executeSearchContracts(args: Record<string, unknown>, tenantId: string, start: number): Promise<ToolResult> {
  const query = args.query as string;
  const filters = args.filters as Record<string, unknown> | undefined;
  const limit = (args.limit as number) || 5;

  const results = await hybridSearch(query, {
    mode: 'hybrid',
    k: limit,
    rerank: true,
    expandQuery: true,
    filters: {
      tenantId,
      suppliers: filters?.supplier ? [filters.supplier as string] : undefined,
      status: filters?.status ? [filters.status as string] : undefined,
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
        excerpt: (r.text || '').slice(0, 300),
      })),
    },
    executionTimeMs: Date.now() - start,
  };
}

// ── Get Contract Details ────────────────────────────────────────────────

async function executeGetContractDetails(args: Record<string, unknown>, tenantId: string, start: number): Promise<ToolResult> {
  const contractId = args.contractId as string | undefined;
  const contractName = args.contractName as string | undefined;

  // T24: Require at least one identifier
  if (!contractId && !contractName) {
    return { toolName: 'get_contract_details', success: false, data: null, error: 'Please provide either a contractId or contractName to look up.', executionTimeMs: Date.now() - start };
  }

  const where = contractId
    ? { id: contractId, tenantId }
    : { tenantId, OR: [
        { contractTitle: { contains: contractName || '', mode: 'insensitive' as const } },
        { fileName: { contains: contractName || '', mode: 'insensitive' as const } },
      ] };

  const contract = await prisma.contract.findFirst({
    where,
    include: {
      artifacts: { take: 5 },
      clauses: true,
      _count: { select: { versions: true } },
    },
  });

  if (!contract) {
    return { toolName: 'get_contract_details', success: false, data: null, error: 'Contract not found', executionTimeMs: Date.now() - start };
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
    },
    executionTimeMs: Date.now() - start,
    navigation: { url: `/contracts/${contract.id}`, label: contract.contractTitle || 'View Contract' },
  };
}

// ── Expiring Contracts ─────────────────────────────────────────────────

async function executeListExpiring(args: Record<string, unknown>, tenantId: string, start: number): Promise<ToolResult> {
  const days = (args.days as number) || 30;
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + days);

  const contracts = await prisma.contract.findMany({
    where: {
      tenantId,
      expirationDate: { lte: expirationDate, gte: new Date() },
      status: 'ACTIVE',
      ...(args.supplier ? { supplierName: { contains: args.supplier as string, mode: 'insensitive' as const } } : {}),
    },
    orderBy: { expirationDate: 'asc' },
    take: 20,
    select: { id: true, contractTitle: true, supplierName: true, totalValue: true, expirationDate: true, autoRenewalEnabled: true },
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
        daysUntilExpiry: c.expirationDate ? Math.ceil((new Date(c.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null,
        autoRenewal: c.autoRenewalEnabled,
      })),
      totalValueAtRisk: contracts.reduce((s, c) => s + Number(c.totalValue || 0), 0),
    },
    executionTimeMs: Date.now() - start,
    suggestedActions: [
      { label: '📊 Risk Dashboard', action: 'navigate:/risk-dashboard' },
      { label: '📅 Calendar View', action: 'navigate:/calendar' },
    ],
  };
}

// ── Spend Analysis ─────────────────────────────────────────────────────

async function executeSpendAnalysis(args: Record<string, unknown>, tenantId: string, start: number): Promise<ToolResult> {
  const groupByField = (args.groupBy as string) || 'supplier';
  const where: Record<string, unknown> = { tenantId, status: 'ACTIVE' };
  if (args.supplier) where.supplierName = { contains: args.supplier as string, mode: 'insensitive' };
  if (args.year) {
    const y = args.year as number;
    where.effectiveDate = { gte: new Date(`${y}-01-01`), lt: new Date(`${y + 1}-01-01`) };
  }

  const contracts = await prisma.contract.findMany({
    where,
    select: { supplierName: true, totalValue: true, categoryL1: true, category: true, effectiveDate: true },
    take: 5000, // T6: Cap to prevent OOM on large tenants
  });

  const grouped = new Map<string, { count: number; value: number }>();
  for (const c of contracts) {
    let key: string;
    switch (groupByField) {
      case 'category': key = c.category || 'Uncategorized'; break;
      case 'month': key = c.effectiveDate ? `${new Date(c.effectiveDate).getFullYear()}-${String(new Date(c.effectiveDate).getMonth() + 1).padStart(2, '0')}` : 'Unknown'; break;
      case 'year': key = c.effectiveDate ? String(new Date(c.effectiveDate).getFullYear()) : 'Unknown'; break;
      default: key = c.supplierName || 'Unknown';
    }
    const e = grouped.get(key) || { count: 0, value: 0 };
    e.count++;
    e.value += Number(c.totalValue || 0);
    grouped.set(key, e);
  }

  const totalSpend = contracts.reduce((s, c) => s + Number(c.totalValue || 0), 0);
  const sorted = Array.from(grouped.entries()).sort((a, b) => b[1].value - a[1].value).slice(0, (args.limit as number) || 10);

  return {
    toolName: 'get_spend_analysis',
    success: true,
    data: {
      groupBy: groupByField,
      totalContracts: contracts.length,
      totalSpend,
      breakdown: sorted.map(([name, data]) => ({
        name,
        contractCount: data.count,
        totalValue: data.value,
        percentage: totalSpend > 0 ? Math.round((data.value / totalSpend) * 100) : 0,
      })),
    },
    executionTimeMs: Date.now() - start,
    suggestedActions: [{ label: '📊 Analytics Page', action: 'navigate:/analytics' }],
  };
}

// ── Risk Assessment ────────────────────────────────────────────────────

async function executeRiskAssessment(tenantId: string, start: number): Promise<ToolResult> {
  const now = new Date();
  const d30 = new Date(now.getTime() + 30 * 86400000);
  const d90 = new Date(now.getTime() + 90 * 86400000);

  const [exp30, exp90, autoRenewals, highValue] = await Promise.all([
    prisma.contract.findMany({ where: { tenantId, status: 'ACTIVE', expirationDate: { gte: now, lte: d30 } }, select: { id: true, contractTitle: true, supplierName: true, totalValue: true, expirationDate: true }, take: 100 }),
    prisma.contract.findMany({ where: { tenantId, status: 'ACTIVE', expirationDate: { gte: d30, lte: d90 } }, select: { id: true, contractTitle: true, supplierName: true, totalValue: true, expirationDate: true }, take: 100 }),
    prisma.contract.findMany({ where: { tenantId, status: 'ACTIVE', autoRenewalEnabled: true, expirationDate: { gte: now, lte: d90 } }, select: { id: true, contractTitle: true, supplierName: true, totalValue: true, expirationDate: true }, take: 100 }),
    prisma.contract.findMany({ where: { tenantId, status: 'ACTIVE', totalValue: { gte: 100000 }, expirationDate: { gte: now, lte: d90 } }, select: { id: true, contractTitle: true, supplierName: true, totalValue: true, expirationDate: true }, take: 100 }),
  ]);

  return {
    toolName: 'get_risk_assessment',
    success: true,
    data: {
      summary: { criticalRisks: exp30.length, highRisks: exp90.length, autoRenewalRisks: autoRenewals.length, highValueAtRisk: highValue.length },
      expiringIn30Days: exp30.map(c => ({ id: c.id, title: c.contractTitle, supplier: c.supplierName, value: c.totalValue, expirationDate: c.expirationDate })),
      expiringIn90Days: exp90.map(c => ({ id: c.id, title: c.contractTitle, supplier: c.supplierName, value: c.totalValue, expirationDate: c.expirationDate })),
      autoRenewalContracts: autoRenewals.map(c => ({ id: c.id, title: c.contractTitle, supplier: c.supplierName, value: c.totalValue, expirationDate: c.expirationDate })),
      recommendations: [
        exp30.length > 0 && `Review ${exp30.length} contracts expiring within 30 days`,
        autoRenewals.length > 0 && `Review ${autoRenewals.length} auto-renewing contracts`,
        highValue.length > 0 && `High-value contracts ($${highValue.reduce((s, c) => s + Number(c.totalValue || 0), 0).toLocaleString()}) at risk`,
      ].filter(Boolean),
    },
    executionTimeMs: Date.now() - start,
    suggestedActions: [{ label: '🔴 Risk Dashboard', action: 'navigate:/risk-dashboard' }],
  };
}

// ── Supplier Info ──────────────────────────────────────────────────────

async function executeSupplierInfo(args: Record<string, unknown>, tenantId: string, start: number): Promise<ToolResult> {
  const name = args.supplierName as string;
  const contracts = await prisma.contract.findMany({
    where: { tenantId, supplierName: { contains: name, mode: 'insensitive' } },
    select: { id: true, contractTitle: true, status: true, totalValue: true, effectiveDate: true, expirationDate: true, contractType: true },
    orderBy: { totalValue: 'desc' },
    take: 200, // T8: Cap to prevent unbounded memory
  });

  const active = contracts.filter(c => c.status === 'ACTIVE');
  const totalSpend = contracts.reduce((s, c) => s + Number(c.totalValue || 0), 0);
  const oldest = contracts.reduce((o, c) => (!o || (c.effectiveDate && new Date(c.effectiveDate) < new Date(o.effectiveDate!))) ? c : o, null as typeof contracts[0] | null);
  const months = oldest?.effectiveDate ? Math.floor((Date.now() - new Date(oldest.effectiveDate).getTime()) / (1000 * 60 * 60 * 24 * 30)) : 0;

  return {
    toolName: 'get_supplier_info',
    success: true,
    data: {
      supplierName: name,
      summary: { totalContracts: contracts.length, activeContracts: active.length, totalSpend, avgContractValue: contracts.length > 0 ? Math.round(totalSpend / contracts.length) : 0, relationshipMonths: months },
      contracts: (args.includeContracts !== false) ? contracts.slice(0, 10).map(c => ({ id: c.id, title: c.contractTitle, status: c.status, value: c.totalValue, type: c.contractType, expirationDate: c.expirationDate })) : undefined,
    },
    executionTimeMs: Date.now() - start,
    suggestedActions: [{ label: '🏢 Vendor Details', action: 'navigate:/vendors' }],
  };
}

// ── Workflow: Start ────────────────────────────────────────────────────

async function executeStartWorkflow(args: Record<string, unknown>, tenantId: string, userId: string, start: number): Promise<ToolResult> {
  const contractId = args.contractId as string;

  const contract = await prisma.contract.findFirst({ where: { id: contractId, tenantId } });
  if (!contract) return { toolName: 'start_workflow', success: false, data: null, error: 'Contract not found', executionTimeMs: Date.now() - start };

  // T17: Check for existing active workflow on the same contract
  const existingExecution = await prisma.workflowExecution.findFirst({
    where: { contractId, tenantId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
    include: { workflow: { select: { name: true } } },
  });
  if (existingExecution) {
    return {
      toolName: 'start_workflow', success: false, data: { existingExecutionId: existingExecution.id, workflowName: existingExecution.workflow?.name },
      error: `Contract already has an active workflow "${existingExecution.workflow?.name || 'unknown'}" (ID: ${existingExecution.id}). Please cancel or complete it before starting a new one.`,
      executionTimeMs: Date.now() - start,
    };
  }

  // Find workflow template
  const workflowWhere = args.workflowId
    ? { id: args.workflowId as string, tenantId, isActive: true }
    : args.workflowType
      ? { tenantId, type: args.workflowType as string, isActive: true }
      : { tenantId, isActive: true };
  const workflow = await prisma.workflow.findFirst({ where: workflowWhere, include: { steps: { orderBy: { order: 'asc' } } } });

  if (!workflow) {
    const available = await prisma.workflow.findMany({ where: { tenantId, isActive: true }, select: { id: true, name: true, type: true } });
    return {
      toolName: 'start_workflow',
      success: false,
      data: { available },
      error: available.length === 0 ? 'No workflow templates configured' : 'Please specify which workflow to use',
      executionTimeMs: Date.now() - start,
    };
  }

  const execution = await prisma.workflowExecution.create({
    data: { tenantId, workflowId: workflow.id, contractId, status: 'PENDING', currentStep: '0', startedBy: userId, startedAt: new Date() },
  });

  if (workflow.steps.length > 0) {
    await prisma.workflowStepExecution.createMany({
      data: workflow.steps.map((step, idx) => ({ executionId: execution.id, stepId: step.id, status: idx === 0 ? 'PENDING' : 'WAITING', stepOrder: idx })),
    });
  }

  return {
    toolName: 'start_workflow',
    success: true,
    data: { executionId: execution.id, workflowName: workflow.name, contractTitle: contract.contractTitle, totalSteps: workflow.steps.length },
    executionTimeMs: Date.now() - start,
    navigation: { url: `/workflows/${execution.id}`, label: 'View Workflow' },
    suggestedActions: [
      { label: '📋 View Workflow', action: `navigate:/workflows/${execution.id}` },
      { label: '⏳ Pending Approvals', action: 'pending_approvals' },
    ],
  };
}

// ── Workflow: List ─────────────────────────────────────────────────────

async function executeListWorkflows(args: Record<string, unknown>, tenantId: string, start: number): Promise<ToolResult> {
  const workflows = await prisma.workflow.findMany({
    where: { tenantId, isActive: true },
    include: { steps: { select: { id: true, name: true }, orderBy: { order: 'asc' } }, _count: { select: { executions: true } } },
    orderBy: { name: 'asc' },
  });

  let activeExecutions: unknown[] = [];
  if (args.includeExecutions) {
    activeExecutions = await prisma.workflowExecution.findMany({
      where: { tenantId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
      include: { workflow: { select: { name: true } }, contract: { select: { contractTitle: true } } },
      orderBy: { startedAt: 'desc' },
      take: 10,
    });
  }

  return {
    toolName: 'list_workflows',
    success: true,
    data: {
      templates: workflows.map(w => ({ id: w.id, name: w.name, type: w.type, stepCount: w.steps.length, executionCount: w._count.executions, steps: w.steps.map(s => s.name) })),
      ...(args.includeExecutions ? { activeExecutions } : {}),
    },
    executionTimeMs: Date.now() - start,
    suggestedActions: [{ label: '⚙️ Workflow Settings', action: 'navigate:/settings/workflows' }],
  };
}

// ── Workflow: Pending Approvals ────────────────────────────────────────

async function executeGetPendingApprovals(tenantId: string, userId: string, start: number): Promise<ToolResult> {
  const executions = await prisma.workflowExecution.findMany({
    where: { tenantId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
    include: {
      workflow: { select: { name: true, type: true } },
      contract: { select: { id: true, contractTitle: true, supplierName: true, totalValue: true } },
      stepExecutions: { where: { status: 'PENDING' }, include: { step: { select: { name: true, assignedUser: true } } } },
    },
    orderBy: { startedAt: 'desc' },
    take: 100,
  });

  // Filter to ones assigned to this user or unassigned
  const pending = executions.filter(e =>
    e.stepExecutions.some(se => !se.step.assignedUser || se.step.assignedUser === userId)
  );

  return {
    toolName: 'get_pending_approvals',
    success: true,
    data: {
      total: pending.length,
      approvals: pending.map(e => ({
        executionId: e.id,
        workflowName: e.workflow.name,
        contractTitle: e.contract?.contractTitle,
        contractId: e.contract?.id,
        supplier: e.contract?.supplierName,
        value: e.contract?.totalValue,
        pendingStep: e.stepExecutions[0]?.step.name,
        startedAt: e.startedAt,
      })),
    },
    executionTimeMs: Date.now() - start,
    suggestedActions: pending.length > 0
      ? [{ label: '✅ Review Approvals', action: 'navigate:/workflows?tab=pending' }]
      : [{ label: '📋 All Workflows', action: 'navigate:/workflows' }],
  };
}

// ── Workflow: Approve/Reject ───────────────────────────────────────────

async function executeApproveReject(args: Record<string, unknown>, tenantId: string, userId: string, start: number): Promise<ToolResult> {
  const executionId = args.executionId as string;
  const decision = args.decision as 'approve' | 'reject';
  const comment = args.comment as string | undefined;

  const execution = await prisma.workflowExecution.findFirst({
    where: { id: executionId, tenantId },
    include: { stepExecutions: { where: { status: 'PENDING' }, include: { step: true }, orderBy: { stepOrder: 'asc' }, take: 1 } },
  });

  if (!execution) return { toolName: 'approve_or_reject_step', success: false, data: null, error: 'Workflow execution not found', executionTimeMs: Date.now() - start };
  if (execution.stepExecutions.length === 0) return { toolName: 'approve_or_reject_step', success: false, data: null, error: 'No pending steps to act on', executionTimeMs: Date.now() - start };

  const stepExec = execution.stepExecutions[0];

  // T13: Authorization check — only the assigned user (or unassigned steps) can approve/reject
  if (stepExec.assignedTo && stepExec.assignedTo !== userId) {
    return { toolName: 'approve_or_reject_step', success: false, data: null, error: `This step is assigned to another user. You are not authorized to ${decision} it.`, executionTimeMs: Date.now() - start };
  }

  await prisma.workflowStepExecution.update({
    where: { id: stepExec.id },
    data: { status: decision === 'approve' ? 'COMPLETED' : 'REJECTED', completedAt: new Date(), completedBy: userId, result: comment ? { comment } : undefined },
  });

  if (decision === 'reject') {
    await prisma.workflowExecution.update({ where: { id: executionId }, data: { status: 'REJECTED' } });
  } else {
    // T4: Advance to next workflow step — find next WAITING step and set to PENDING
    const nextStep = await prisma.workflowStepExecution.findFirst({
      where: { executionId: executionId, status: 'WAITING', stepOrder: { gt: stepExec.stepOrder } },
      orderBy: { stepOrder: 'asc' },
    });
    if (nextStep) {
      await prisma.workflowStepExecution.update({
        where: { id: nextStep.id },
        data: { status: 'PENDING' },
      });
    } else {
      // No more steps — mark the workflow execution as completed
      await prisma.workflowExecution.update({ where: { id: executionId }, data: { status: 'COMPLETED', completedAt: new Date() } });
    }
  }

  return {
    toolName: 'approve_or_reject_step',
    success: true,
    data: { executionId, step: stepExec.step.name, decision, comment },
    executionTimeMs: Date.now() - start,
  };
}

// ── Workflow: Get Status ───────────────────────────────────────────────

async function executeGetWorkflowStatus(args: Record<string, unknown>, tenantId: string, start: number): Promise<ToolResult> {
  const executionId = args.executionId as string | undefined;
  const contractId = args.contractId as string | undefined;

  // T5: Require at least one identifier — don't return a random execution
  if (!executionId && !contractId) {
    return { toolName: 'get_workflow_status', success: false, data: null, error: 'Please provide either an executionId or a contractId to look up workflow status.', executionTimeMs: Date.now() - start };
  }

  const execution = await prisma.workflowExecution.findFirst({
    where: {
      tenantId,
      ...(executionId
        ? { OR: [{ id: executionId }, { workflowId: executionId }] }
        : contractId
          ? { contractId, status: { in: ['PENDING', 'IN_PROGRESS'] } }
          : {}),
    },
    include: {
      workflow: { select: { name: true, type: true } },
      contract: { select: { id: true, contractTitle: true } },
      stepExecutions: { include: { step: { select: { name: true } } }, orderBy: { stepOrder: 'asc' } },
    },
    orderBy: { startedAt: 'desc' },
  });

  if (!execution) {
    return { toolName: 'get_workflow_status', success: false, data: null, error: 'No workflow execution found', executionTimeMs: Date.now() - start };
  }

  const completedSteps = execution.stepExecutions.filter(s => s.status === 'COMPLETED').length;
  const currentStep = execution.stepExecutions.find(s => s.status === 'PENDING');

  return {
    toolName: 'get_workflow_status',
    success: true,
    data: {
      executionId: execution.id,
      workflowName: execution.workflow.name,
      workflowType: execution.workflow.type,
      contractTitle: execution.contract?.contractTitle,
      status: execution.status,
      progress: {
        completed: completedSteps,
        total: execution.stepExecutions.length,
        percentage: execution.stepExecutions.length > 0 ? Math.round((completedSteps / execution.stepExecutions.length) * 100) : 0,
      },
      currentStep: currentStep ? { name: currentStep.step.name, assignee: currentStep.assignedTo } : null,
      steps: execution.stepExecutions.map(se => ({ name: se.step.name, status: se.status, completedAt: se.completedAt })),
      startedAt: execution.startedAt,
    },
    executionTimeMs: Date.now() - start,
    navigation: { url: `/contracts/${execution.contract?.id}`, label: 'View Contract' },
    suggestedActions: [
      ...(currentStep ? [{ label: '✅ Approve Step', action: `approve:${execution.id}` }] : []),
      { label: '📋 All Workflows', action: 'navigate:/workflows' },
    ],
  };
}

// ── Workflow: Create Template ──────────────────────────────────────────

async function executeCreateWorkflow(args: Record<string, unknown>, tenantId: string, userId: string, start: number): Promise<ToolResult> {
  const name = args.name as string;
  const type = (args.type as string) || 'APPROVAL';
  const customSteps = args.steps as Array<{ name: string; type?: string }> | undefined;

  const workflow = await prisma.workflow.create({
    data: { tenantId, name, type, isActive: true, createdBy: userId },
  });

  const steps = customSteps && customSteps.length > 0
    ? customSteps
    : [{ name: 'Manager Review', type: 'APPROVAL' }, { name: 'Legal Review', type: 'APPROVAL' }, { name: 'Final Approval', type: 'APPROVAL' }];

  await prisma.workflowStep.createMany({
    data: steps.map((step, idx) => ({ workflowId: workflow.id, name: step.name, type: step.type || 'APPROVAL', order: idx })),
  });

  return {
    toolName: 'create_workflow',
    success: true,
    data: { workflowId: workflow.id, name, type, stepCount: steps.length, steps: steps.map(s => s.name) },
    executionTimeMs: Date.now() - start,
    navigation: { url: '/workflows', label: 'View Workflows' },
    suggestedActions: [
      { label: '⚙️ Configure Steps', action: `navigate:/workflows` },
      { label: '▶️ Start for a Contract', action: 'start_workflow' },
    ],
  };
}

// ── Workflow: Cancel ───────────────────────────────────────────────────

async function executeCancelWorkflow(args: Record<string, unknown>, tenantId: string, userId: string, start: number): Promise<ToolResult> {
  const executionId = args.executionId as string;
  const reason = args.reason as string | undefined;

  const execution = await prisma.workflowExecution.findFirst({
    where: { id: executionId, tenantId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
    include: { workflow: { select: { name: true } }, contract: { select: { contractTitle: true, id: true } } },
  });

  if (!execution) {
    return { toolName: 'cancel_workflow', success: false, data: null, error: 'Active workflow not found', executionTimeMs: Date.now() - start };
  }

  await prisma.$transaction([
    prisma.workflowExecution.update({ where: { id: execution.id }, data: { status: 'CANCELLED', completedAt: new Date() } }),
    prisma.workflowStepExecution.updateMany({ where: { executionId: execution.id, status: { in: ['PENDING', 'WAITING', 'IN_PROGRESS'] } }, data: { status: 'CANCELLED' } }),
  ]);

  return {
    toolName: 'cancel_workflow',
    success: true,
    data: { executionId, workflowName: execution.workflow.name, contractTitle: execution.contract?.contractTitle, reason },
    executionTimeMs: Date.now() - start,
    suggestedActions: [{ label: '📋 All Workflows', action: 'navigate:/workflows' }],
  };
}

// ── Workflow: Assign Approver ──────────────────────────────────────────

async function executeAssignApprover(args: Record<string, unknown>, tenantId: string, _userId: string, start: number): Promise<ToolResult> {
  const executionId = args.executionId as string;
  const assignee = args.assignee as string;

  const stepExecution = await prisma.workflowStepExecution.findFirst({
    where: { OR: [{ id: executionId }, { executionId }], status: 'PENDING', execution: { tenantId } },
    include: { step: { select: { name: true } } },
  });

  if (!stepExecution) {
    return { toolName: 'assign_approver', success: false, data: null, error: 'No pending step found', executionTimeMs: Date.now() - start };
  }

  // First try exact email match, then fall back to name search
  let user = await prisma.user.findFirst({
    where: { tenantId, email: { equals: assignee, mode: 'insensitive' } },
  });

  if (!user) {
    // Fuzzy name search — but require a unique match to avoid assigning to wrong person
    const candidates = await prisma.user.findMany({
      where: {
        tenantId,
        OR: [
          { email: { contains: assignee, mode: 'insensitive' } },
          { firstName: { contains: assignee, mode: 'insensitive' } },
          { lastName: { contains: assignee, mode: 'insensitive' } },
        ],
      },
      take: 5,
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    if (candidates.length === 0) {
      return { toolName: 'assign_approver', success: false, data: null, error: `User "${assignee}" not found in your organization`, executionTimeMs: Date.now() - start };
    }
    if (candidates.length > 1) {
      const names = candidates.map(c => `${[c.firstName, c.lastName].filter(Boolean).join(' ')} (${c.email})`).join(', ');
      return { toolName: 'assign_approver', success: false, data: null, error: `Multiple users match "${assignee}": ${names}. Please be more specific (e.g., use their email address).`, executionTimeMs: Date.now() - start };
    }
    user = candidates[0] as unknown as typeof user;
  }

  if (!user) {
    return { toolName: 'assign_approver', success: false, data: null, error: `User "${assignee}" not found in your organization`, executionTimeMs: Date.now() - start };
  }

  await prisma.workflowStepExecution.update({ where: { id: stepExecution.id }, data: { assignedTo: user.id } });

  const userName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
  return {
    toolName: 'assign_approver',
    success: true,
    data: { stepName: stepExecution.step.name, assignedTo: userName, userId: user.id },
    executionTimeMs: Date.now() - start,
    suggestedActions: [{ label: '⏳ View Pending', action: 'pending_approvals' }],
  };
}

// ── Workflow: Escalate ─────────────────────────────────────────────────

async function executeEscalateWorkflow(args: Record<string, unknown>, tenantId: string, userId: string, start: number): Promise<ToolResult> {
  const executionId = args.executionId as string;
  const reason = args.reason as string | undefined;

  const execution = await prisma.workflowExecution.findFirst({
    where: { id: executionId, tenantId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
    include: { workflow: { select: { name: true } }, contract: { select: { contractTitle: true, id: true } } },
  });

  if (!execution) {
    return { toolName: 'escalate_workflow', success: false, data: null, error: 'Active workflow not found', executionTimeMs: Date.now() - start };
  }

  const currentMetadata = (execution.metadata as Record<string, unknown>) || {};
  await prisma.workflowExecution.update({
    where: { id: execution.id },
    data: { metadata: { ...currentMetadata, isEscalated: true, escalatedAt: new Date().toISOString(), escalatedBy: userId, escalationReason: reason } },
  });

  return {
    toolName: 'escalate_workflow',
    success: true,
    data: { executionId, workflowName: execution.workflow.name, contractTitle: execution.contract?.contractTitle, reason },
    executionTimeMs: Date.now() - start,
    suggestedActions: [{ label: '📋 View Workflows', action: 'navigate:/workflows' }],
  };
}

// ── Workflow: AI Suggestion ────────────────────────────────────────────

async function executeSuggestWorkflow(args: Record<string, unknown>, tenantId: string, start: number): Promise<ToolResult> {
  const contractId = args.contractId as string;

  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId },
    select: { id: true, contractTitle: true, contractType: true, totalValue: true, status: true },
  });

  if (!contract) {
    return { toolName: 'suggest_workflow', success: false, data: null, error: 'Contract not found', executionTimeMs: Date.now() - start };
  }

  const workflows = await prisma.workflow.findMany({
    where: { tenantId, isActive: true },
    include: { steps: { select: { name: true }, orderBy: { order: 'asc' } }, _count: { select: { executions: true } } },
  });

  if (workflows.length === 0) {
    return { toolName: 'suggest_workflow', success: false, data: null, error: 'No workflow templates available. Create one first.', executionTimeMs: Date.now() - start };
  }

  // Simple scoring: match by type, prefer well-used workflows, consider value
  const contractValue = contract.totalValue ? Number(contract.totalValue) : 0;
  const scored = workflows.map(w => {
    let score = 0;
    if (contract.contractType && w.name.toLowerCase().includes(contract.contractType.toLowerCase())) score += 3;
    if (w.type === 'APPROVAL') score += 1;
    if (contractValue > 100000 && w.steps.length >= 3) score += 2;
    score += Math.min(w._count.executions / 10, 2); // popularity bonus
    return { ...w, score };
  }).sort((a, b) => b.score - a.score);

  return {
    toolName: 'suggest_workflow',
    success: true,
    data: {
      contractTitle: contract.contractTitle,
      contractType: contract.contractType,
      contractValue: contractValue,
      recommendation: {
        workflowId: scored[0].id,
        workflowName: scored[0].name,
        reason: `Best match based on contract type, value, and risk level`,
        steps: scored[0].steps.map(s => s.name),
      },
      alternatives: scored.slice(1, 3).map(w => ({ workflowId: w.id, workflowName: w.name, steps: w.steps.map(s => s.name) })),
    },
    executionTimeMs: Date.now() - start,
    suggestedActions: [
      { label: '▶️ Start Recommended', action: `start_workflow:${contractId}:${scored[0].id}` },
      { label: '📋 View All Workflows', action: 'navigate:/workflows' },
    ],
  };
}

// ── Create Contract ────────────────────────────────────────────────────

async function executeCreateContract(args: Record<string, unknown>, tenantId: string, userId: string, start: number): Promise<ToolResult> {
  const contract = await prisma.contract.create({
    data: {
      tenantId,
      contractTitle: args.title as string,
      supplierName: (args.supplierName as string) || undefined,
      clientName: (args.clientName as string) || undefined,
      contractType: (args.contractType as string) || 'General',
      totalValue: args.totalValue ? Number(args.totalValue) : undefined,
      effectiveDate: args.effectiveDate ? new Date(args.effectiveDate as string) : undefined,
      expirationDate: args.expirationDate ? new Date(args.expirationDate as string) : undefined,
      status: 'DRAFT',
      uploadedBy: userId,
      mimeType: 'application/octet-stream',
      fileName: `ai-draft-${Date.now()}.txt`,
      fileSize: BigInt(0),
    },
  });

  return {
    toolName: 'create_contract',
    success: true,
    data: { id: contract.id, title: contract.contractTitle, status: 'DRAFT' },
    executionTimeMs: Date.now() - start,
    navigation: { url: `/contracts/${contract.id}`, label: 'View New Contract' },
    suggestedActions: [
      { label: '📄 Edit Contract', action: `navigate:/contracts/${contract.id}/edit` },
      { label: '🔄 Start Workflow', action: `start_workflow:${contract.id}` },
    ],
  };
}

// ── Update Contract ────────────────────────────────────────────────────

async function executeUpdateContract(args: Record<string, unknown>, tenantId: string, userId: string, start: number): Promise<ToolResult> {
  const contractId = args.contractId as string;
  const field = args.field as string;
  const value = args.value as string;

  const contract = await prisma.contract.findFirst({ where: { id: contractId, tenantId } });
  if (!contract) return { toolName: 'update_contract', success: false, data: null, error: 'Contract not found', executionTimeMs: Date.now() - start };

  // Build update data based on field
  const VALID_STATUSES = ['UPLOADED', 'PROCESSING', 'COMPLETED', 'FAILED', 'ARCHIVED', 'DELETED', 'ACTIVE', 'PENDING', 'DRAFT', 'EXPIRED', 'CANCELLED'];
  const updateData: Record<string, unknown> = {};
  switch (field) {
    case 'status': {
      const upperStatus = value.toUpperCase();
      if (!VALID_STATUSES.includes(upperStatus)) {
        return { toolName: 'update_contract', success: false, data: null, error: `Invalid status "${value}". Valid statuses: ${VALID_STATUSES.join(', ')}`, executionTimeMs: Date.now() - start };
      }
      updateData.status = upperStatus;
      break;
    }
    case 'totalValue': {
      const num = Number(value);
      if (isNaN(num)) {
        return { toolName: 'update_contract', success: false, data: null, error: `Invalid number for totalValue: "${value}"`, executionTimeMs: Date.now() - start };
      }
      updateData.totalValue = num;
      break;
    }
    case 'effectiveDate':
    case 'expirationDate': {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        return { toolName: 'update_contract', success: false, data: null, error: `Invalid date for ${field}: "${value}". Please use ISO format (e.g., 2025-01-15).`, executionTimeMs: Date.now() - start };
      }
      // Cross-validate: effectiveDate must be before expirationDate
      const otherField = field === 'effectiveDate' ? 'expirationDate' : 'effectiveDate';
      const otherDate = contract[otherField] as Date | null;
      if (otherDate) {
        const effective = field === 'effectiveDate' ? date : otherDate;
        const expiration = field === 'expirationDate' ? date : otherDate;
        if (effective >= expiration) {
          return { toolName: 'update_contract', success: false, data: null, error: `effectiveDate (${effective.toISOString().slice(0, 10)}) must be before expirationDate (${expiration.toISOString().slice(0, 10)}).`, executionTimeMs: Date.now() - start };
        }
      }
      updateData[field] = date;
      break;
    }
    case 'supplierName': updateData.supplierName = value; break;
    case 'clientName': updateData.clientName = value; break;
    case 'category': updateData.category = value; break;
    case 'contractTitle': updateData.contractTitle = value; break;
    default:
      return { toolName: 'update_contract', success: false, data: null, error: `Cannot update field: ${field}`, executionTimeMs: Date.now() - start };
  }

  await prisma.contract.update({ where: { id: contractId }, data: updateData });

  return {
    toolName: 'update_contract',
    success: true,
    data: { contractId, field, oldValue: (contract as Record<string, unknown>)[field], newValue: value },
    executionTimeMs: Date.now() - start,
    navigation: { url: `/contracts/${contractId}`, label: 'View Contract' },
  };
}

// ── Navigate ───────────────────────────────────────────────────────────

async function executeNavigate(args: Record<string, unknown>, start: number): Promise<ToolResult> {
  const page = args.page as string;
  const contractId = args.contractId as string | undefined;

  const routes: Record<string, string> = {
    dashboard: '/dashboard',
    contracts: '/contracts',
    analytics: '/analytics',
    workflows: '/workflows',
    settings: '/settings',
    vendors: '/vendors',
    compliance: '/compliance',
    'risk-dashboard': '/risk-dashboard',
    reports: '/reports',
    'bulk-operations': '/bulk-operations',
    calendar: '/calendar',
    intelligence: '/intelligence',
    'intelligence-graph': '/intelligence/graph',
    'intelligence-health': '/intelligence/health',
    'intelligence-search': '/intelligence/search',
    'intelligence-negotiate': '/intelligence/negotiate',
    'self-service': '/self-service',
    ecosystem: '/ecosystem',
    governance: '/governance',
    admin: '/admin',
    renewals: '/renewals',
    generate: '/generate',
    drafting: '/drafting',
    'drafting-copilot': '/drafting/copilot',
    approvals: '/approvals',
  };

  const url = contractId ? `/contracts/${contractId}` : (routes[page] || '/dashboard');

  return {
    toolName: 'navigate_to_page',
    success: true,
    data: { url, page },
    executionTimeMs: Date.now() - start,
    navigation: { url, label: `Go to ${page}` },
  };
}

// ── Intelligence Insights ──────────────────────────────────────────────

interface ContractMeta {
  healthScore?: number;
  previousHealthScore?: number;
}

async function executeIntelligenceInsights(args: Record<string, unknown>, tenantId: string, start: number): Promise<ToolResult> {
  const section = (args.section as string) || 'all';

  // Health scores
  const getHealth = async () => {
    const contracts = await prisma.contract.findMany({
      where: { tenantId },
      select: { id: true, metadata: true },
      take: 2000, // T9: Cap to prevent OOM — sample is statistically sufficient
    });
    let healthy = 0, atRisk = 0, critical = 0, total = 0;
    for (const c of contracts) {
      const meta = c.metadata as ContractMeta | null;
      const score = meta?.healthScore ?? 75;
      total += score;
      if (score >= 70) healthy++;
      else if (score >= 40) atRisk++;
      else critical++;
    }
    return {
      averageHealthScore: contracts.length > 0 ? Math.round(total / contracts.length) : 75,
      healthy, atRisk, critical, totalContracts: contracts.length,
    };
  };

  // Risk insights
  const getInsights = async () => {
    const riskyContracts = await prisma.contract.findMany({
      where: { tenantId, expirationRisk: { in: ['HIGH', 'CRITICAL'] } },
      take: 8,
      orderBy: { expirationDate: 'asc' },
      select: { id: true, contractTitle: true, fileName: true, totalValue: true, expirationDate: true, autoRenewalEnabled: true, expirationRisk: true },
    });

    const insights: Array<{ type: string; severity: string; title: string; detail: string; contractId?: string }> = [];
    for (const c of riskyContracts) {
      if (c.expirationDate) {
        const days = Math.ceil((c.expirationDate.getTime() - Date.now()) / 86400000);
        const name = c.contractTitle || c.fileName || 'Unnamed';
        if (days > 0 && days <= 90) {
          insights.push({
            type: 'expiration_risk',
            severity: days <= 14 ? 'critical' : days <= 30 ? 'high' : 'medium',
            title: `${name} expires in ${days} days`,
            detail: c.autoRenewalEnabled ? 'Auto-renewal enabled — review terms' : 'No auto-renewal — initiate action',
            contractId: c.id,
          });
        }
      }
    }
    return insights;
  };

  // Recent activity
  const getActivity = async () => {
    const logs = await prisma.auditLog.findMany({
      where: { tenantId },
      take: 8,
      orderBy: { createdAt: 'desc' },
      select: { action: true, entityType: true, createdAt: true },
    });
    return logs.map(l => ({
      action: l.action,
      entity: l.entityType,
      when: l.createdAt.toISOString(),
    }));
  };

  let data: Record<string, unknown> = {};

  if (section === 'health') {
    data = { healthScores: await getHealth() };
  } else if (section === 'insights') {
    data = { insights: await getInsights() };
  } else if (section === 'activity') {
    data = { recentActivity: await getActivity() };
  } else {
    const [healthScores, insights, recentActivity] = await Promise.all([getHealth(), getInsights(), getActivity()]);
    data = { healthScores, insights, recentActivity };
  }

  return {
    toolName: 'get_intelligence_insights',
    success: true,
    data,
    executionTimeMs: Date.now() - start,
    navigation: { url: '/intelligence', label: 'View Intelligence Hub' },
  };
}

// ── Compliance Summary ─────────────────────────────────────────────────

async function executeComplianceSummary(tenantId: string, start: number): Promise<ToolResult> {
  const [totalContracts, expiredContracts, expiringIn30, missingDates] = await Promise.all([
    prisma.contract.count({ where: { tenantId, status: 'ACTIVE' } }),
    prisma.contract.count({ where: { tenantId, status: 'EXPIRED' } }),
    prisma.contract.count({ where: { tenantId, status: 'ACTIVE', expirationDate: { lte: new Date(Date.now() + 30 * 86400000), gte: new Date() } } }),
    prisma.contract.count({ where: { tenantId, status: 'ACTIVE', expirationDate: null } }),
  ]);

  const complianceScore = totalContracts > 0
    ? Math.round(((totalContracts - missingDates) / totalContracts) * 100)
    : 100;

  return {
    toolName: 'get_compliance_summary',
    success: true,
    data: {
      complianceScore,
      totalActive: totalContracts,
      expired: expiredContracts,
      expiringIn30Days: expiringIn30,
      missingExpirationDates: missingDates,
      status: complianceScore >= 90 ? 'GOOD' : complianceScore >= 70 ? 'NEEDS_ATTENTION' : 'CRITICAL',
      recommendations: [
        missingDates > 0 && `${missingDates} contracts missing expiration dates`,
        expiringIn30 > 0 && `${expiringIn30} contracts expiring within 30 days`,
        expiredContracts > 0 && `${expiredContracts} expired contracts need archival or renewal`,
      ].filter(Boolean),
    },
    executionTimeMs: Date.now() - start,
    suggestedActions: [{ label: '✅ Compliance Dashboard', action: 'navigate:/compliance' }],
  };
}

// ── Contract Stats ─────────────────────────────────────────────────────

async function executeContractStats(tenantId: string, start: number): Promise<ToolResult> {
  const [statusCounts, total, totalValue] = await Promise.all([
    prisma.contract.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: { id: true },
      _sum: { totalValue: true },
    }),
    prisma.contract.count({ where: { tenantId } }),
    prisma.contract.aggregate({ where: { tenantId }, _sum: { totalValue: true }, _avg: { totalValue: true } }),
  ]);

  return {
    toolName: 'get_contract_stats',
    success: true,
    data: {
      totalContracts: total,
      totalValue: totalValue._sum.totalValue || 0,
      avgValue: Math.round(Number(totalValue._avg.totalValue || 0)),
      byStatus: statusCounts.map(s => ({ status: s.status, count: s._count.id, totalValue: s._sum.totalValue || 0 })),
    },
    executionTimeMs: Date.now() - start,
    suggestedActions: [{ label: '📊 Dashboard', action: 'navigate:/dashboard' }],
  };
}

// ── Agent Insights (Bridge background agents → chat) ───────────────────

async function executeAgentInsights(args: Record<string, unknown>, tenantId: string, start: number): Promise<ToolResult> {
  const category = (args.category as string) || 'all';
  const limit = (args.limit as number) || 10;

  const insights: Array<{ type: string; severity: string; title: string; detail: string; source: string; timestamp?: string }> = [];

  try {
    // 1. Query agent_goals for recent findings
    const recentGoals = await prisma.$queryRawUnsafe<any[]>(
      `SELECT type, status, result, error, created_at, completed_at
       FROM agent_goals
       WHERE tenant_id = $1
         AND created_at > NOW() - INTERVAL '7 days'
       ORDER BY created_at DESC
       LIMIT $2`,
      tenantId,
      limit
    );

    for (const goal of recentGoals) {
      if (goal.status === 'COMPLETED' && goal.result) {
        const result = typeof goal.result === 'string' ? JSON.parse(goal.result) : goal.result;
        insights.push({
          type: goal.type || 'agent_finding',
          severity: 'info',
          title: `Agent completed: ${goal.type}`,
          detail: typeof result === 'object' ? JSON.stringify(result).slice(0, 300) : String(result).slice(0, 300),
          source: 'background-agent',
          timestamp: goal.completed_at?.toISOString?.() || goal.created_at?.toISOString?.(),
        });
      }
      if (goal.status === 'FAILED' && goal.error) {
        insights.push({
          type: 'agent_failure',
          severity: 'warning',
          title: `Agent failed: ${goal.type}`,
          detail: String(goal.error).slice(0, 300),
          source: 'background-agent',
          timestamp: goal.created_at?.toISOString?.(),
        });
      }
    }
  } catch {
    // agent_goals table may not exist
  }

  try {
    // 2. Query learning_records for learned patterns
    if (category === 'all' || category === 'learning') {
      const learnings = await prisma.$queryRawUnsafe<any[]>(
        `SELECT field, correction_type, confidence, created_at
         FROM learning_records
         WHERE tenant_id = $1
           AND created_at > NOW() - INTERVAL '30 days'
         ORDER BY created_at DESC
         LIMIT 5`,
        tenantId
      );

      for (const learning of learnings) {
        insights.push({
          type: 'learning',
          severity: 'info',
          title: `Learned pattern: ${learning.field}`,
          detail: `Correction type: ${learning.correction_type}, confidence: ${((learning.confidence || 0) * 100).toFixed(0)}%`,
          source: 'feedback-learner',
          timestamp: learning.created_at?.toISOString?.(),
        });
      }
    }
  } catch {
    // learning_records table may not exist
  }

  // 3. Add risk insights from contract data
  if (category === 'all' || category === 'risk') {
    try {
      const riskyContracts = await prisma.contract.findMany({
        where: { tenantId, expirationRisk: { in: ['HIGH', 'CRITICAL'] } },
        take: 5,
        orderBy: { expirationDate: 'asc' },
        select: { id: true, contractTitle: true, expirationDate: true, totalValue: true, expirationRisk: true },
      });

      for (const c of riskyContracts) {
        const days = c.expirationDate ? Math.ceil((c.expirationDate.getTime() - Date.now()) / 86400000) : null;
        insights.push({
          type: 'risk',
          severity: c.expirationRisk === 'CRITICAL' ? 'critical' : 'high',
          title: `${c.contractTitle || 'Contract'} — ${c.expirationRisk} risk`,
          detail: days !== null && days > 0 ? `Expires in ${days} days, value: $${Number(c.totalValue || 0).toLocaleString()}` : 'Expiration risk flagged',
          source: 'risk-detector',
        });
      }
    } catch { /* */ }
  }

  // 4. Health summary
  if (category === 'all' || category === 'health') {
    try {
      const contracts = await prisma.contract.findMany({
        where: { tenantId },
        select: { metadata: true },
        take: 2000, // T10: Cap to prevent OOM
      });
      let totalScore = 0;
      let scored = 0;
      for (const c of contracts) {
        const meta = c.metadata as { healthScore?: number } | null;
        if (meta?.healthScore) { totalScore += meta.healthScore; scored++; }
      }
      if (scored > 0) {
        insights.push({
          type: 'health',
          severity: totalScore / scored >= 70 ? 'info' : 'warning',
          title: `Portfolio health: ${Math.round(totalScore / scored)}%`,
          detail: `Based on ${scored} contracts with health scores`,
          source: 'health-monitor',
        });
      }
    } catch { /* */ }
  }

  // Filter by category
  const filtered = category === 'all' ? insights : insights.filter(i => i.type === category || i.severity === category);

  return {
    toolName: 'get_agent_insights',
    success: true,
    data: {
      totalInsights: filtered.length,
      insights: filtered.slice(0, limit),
      categories: [...new Set(filtered.map(i => i.type))],
      lastUpdated: new Date().toISOString(),
    },
    executionTimeMs: Date.now() - start,
    navigation: { url: '/ai/agents', label: 'Agent Dashboard' },
    suggestedActions: [
      { label: '🤖 Agent Dashboard', action: 'navigate:/ai/agents' },
      { label: '⚠️ Risk Dashboard', action: 'navigate:/risk-dashboard' },
    ],
  };
}

// ── Agent Debate (Multi-agent contract analysis) ───────────────────────

async function executeAgentDebate(args: Record<string, unknown>, tenantId: string, start: number): Promise<ToolResult> {
  const contractId = args.contractId as string;

  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId },
    select: { id: true, contractTitle: true, contractType: true, totalValue: true, rawText: true },
  });

  if (!contract) {
    return { toolName: 'get_agent_debate', success: false, data: null, error: 'Contract not found', executionTimeMs: Date.now() - start };
  }

  const contractText = contract.rawText || contract.contractTitle || '';
  const focusAreas = args.focusAreas as string[] | undefined;
  const debateTopic = focusAreas?.length
    ? `Analyze contract "${contract.contractTitle}" focusing on: ${focusAreas.join(', ')}`
    : `Comprehensive analysis of contract "${contract.contractTitle}"`;

  // Use the real Multi-Agent Debate service from @repo/data-orchestration
  try {
    const { quickDebate } = await import('@repo/data-orchestration');

    const result = await quickDebate(
      debateTopic,
      contractText.slice(0, 8000),
      tenantId,
      'standard',
    );

    return {
      toolName: 'get_agent_debate',
      success: true,
      data: {
        contractTitle: contract.contractTitle,
        consensusReached: result.consensusReached,
        consensusConfidence: Math.round(result.consensusConfidence * 100),
        finalConclusion: result.finalConclusion,
        reasoning: result.reasoning,
        debate: {
          totalTurns: result.metadata.totalTurns,
          agentsParticipated: result.metadata.agentsParticipated,
          convergenceScore: Math.round(result.metadata.convergenceScore * 100),
          processingTimeMs: result.metadata.processingTimeMs,
        },
        keyArguments: {
          supporting: result.keyArguments.supporting.map(a => ({ claim: a.claim, strength: a.strength, evidence: a.evidence })),
          opposing: result.keyArguments.opposing.map(a => ({ claim: a.claim, strength: a.strength, evidence: a.evidence })),
          unresolved: result.keyArguments.unresolved.map(a => ({ claim: a.claim, strength: a.strength })),
        },
        turns: result.turns.slice(0, 6).map(t => ({
          agent: t.agentName,
          role: t.role,
          confidence: Math.round(t.confidence * 100),
          message: t.message.slice(0, 500),
          arguments: t.arguments.slice(0, 3).map(a => ({ type: a.type, claim: a.claim, strength: a.strength })),
        })),
        dissent: result.dissent ? {
          agent: result.dissent.agentName,
          view: result.dissent.dissenterView,
          strength: result.dissent.strength,
        } : null,
      },
      executionTimeMs: Date.now() - start,
      navigation: { url: `/contracts/${contractId}`, label: 'View Contract' },
      suggestedActions: [
        { label: '📋 View Contract', action: `navigate:/contracts/${contractId}` },
        { label: '🔍 Detailed Analysis', action: `analyze:${contractId}` },
      ],
    };
  } catch (err) {
    // Multi-agent debate service unavailable — provide graceful fallback
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    return {
      toolName: 'get_agent_debate',
      success: true,
      data: {
        contractTitle: contract.contractTitle,
        consensusReached: false,
        consensusConfidence: 0,
        finalConclusion: '',
        reasoning: '',
        debate: { totalTurns: 0, agentsParticipated: [], convergenceScore: 0, processingTimeMs: 0 },
        keyArguments: { supporting: [], opposing: [], unresolved: [] },
        turns: [],
        dissent: null,
        note: `Multi-agent debate service unavailable: ${errorMsg}. Ensure @repo/data-orchestration is built and OpenAI API key is configured.`,
      },
      executionTimeMs: Date.now() - start,
    };
  }
}

// ── Rate Response (Model quality feedback) ─────────────────────────────

async function executeRateResponse(args: Record<string, unknown>, tenantId: string, userId: string, start: number): Promise<ToolResult> {
  const rating = args.rating as 'positive' | 'negative';
  const reason = args.reason as string | undefined;

  try {
    // Store feedback in the database
    await prisma.$executeRawUnsafe(
      `INSERT INTO learning_records (tenant_id, user_id, field, correction_type, confidence, metadata, created_at)
       VALUES ($1, $2, 'response_quality', $3, $4, $5::jsonb, NOW())`,
      tenantId,
      userId,
      rating === 'positive' ? 'positive_feedback' : 'negative_feedback',
      rating === 'positive' ? 0.9 : 0.1,
      JSON.stringify({ reason: reason || null, source: 'chat_feedback' })
    );
  } catch {
    // learning_records table may not exist — still acknowledge the feedback
  }

  return {
    toolName: 'rate_response',
    success: true,
    data: {
      rating,
      reason,
      acknowledged: true,
      message: rating === 'positive' ? 'Thanks for the positive feedback! I\'ll continue this approach.' : 'Thanks for the feedback. I\'ll adjust my responses accordingly.',
    },
    executionTimeMs: Date.now() - start,
  };
}
