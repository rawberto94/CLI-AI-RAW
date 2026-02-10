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
              status: { type: 'string', enum: ['ACTIVE', 'DRAFT', 'EXPIRED', 'PENDING', 'TERMINATED'] },
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
            enum: ['dashboard', 'contracts', 'analytics', 'workflows', 'settings', 'vendors', 'compliance', 'risk-dashboard', 'reports', 'bulk-operations', 'calendar'],
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

  try {
    switch (toolName) {
      case 'search_contracts':
        return await executeSearchContracts(args, tenantId, start);
      case 'get_contract_details':
        return await executeGetContractDetails(args, tenantId, start);
      case 'list_expiring_contracts':
        return await executeListExpiring(args, tenantId, start);
      case 'get_spend_analysis':
        return await executeSpendAnalysis(args, tenantId, start);
      case 'get_risk_assessment':
        return await executeRiskAssessment(tenantId, start);
      case 'get_supplier_info':
        return await executeSupplierInfo(args, tenantId, start);
      case 'start_workflow':
        return await executeStartWorkflow(args, tenantId, userId, start);
      case 'list_workflows':
        return await executeListWorkflows(args, tenantId, start);
      case 'get_pending_approvals':
        return await executeGetPendingApprovals(tenantId, userId, start);
      case 'approve_or_reject_step':
        return await executeApproveReject(args, tenantId, userId, start);
      case 'create_contract':
        return await executeCreateContract(args, tenantId, userId, start);
      case 'update_contract':
        return await executeUpdateContract(args, tenantId, userId, start);
      case 'navigate_to_page':
        return await executeNavigate(args, start);
      case 'get_compliance_summary':
        return await executeComplianceSummary(tenantId, start);
      case 'get_contract_stats':
        return await executeContractStats(tenantId, start);
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
        excerpt: r.text.slice(0, 300),
      })),
    },
    executionTimeMs: Date.now() - start,
  };
}

// ── Get Contract Details ────────────────────────────────────────────────

async function executeGetContractDetails(args: Record<string, unknown>, tenantId: string, start: number): Promise<ToolResult> {
  const contractId = args.contractId as string | undefined;
  const contractName = args.contractName as string | undefined;

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
      ...(args.supplier && { supplierName: { contains: args.supplier as string, mode: 'insensitive' as const } }),
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
    prisma.contract.findMany({ where: { tenantId, status: 'ACTIVE', expirationDate: { gte: now, lte: d30 } }, select: { id: true, contractTitle: true, supplierName: true, totalValue: true, expirationDate: true } }),
    prisma.contract.findMany({ where: { tenantId, status: 'ACTIVE', expirationDate: { gte: d30, lte: d90 } }, select: { id: true, contractTitle: true, supplierName: true, totalValue: true, expirationDate: true } }),
    prisma.contract.findMany({ where: { tenantId, status: 'ACTIVE', autoRenewalEnabled: true, expirationDate: { gte: now, lte: d90 } }, select: { id: true, contractTitle: true, supplierName: true, totalValue: true, expirationDate: true } }),
    prisma.contract.findMany({ where: { tenantId, status: 'ACTIVE', totalValue: { gte: 100000 }, expirationDate: { gte: now, lte: d90 } }, select: { id: true, contractTitle: true, supplierName: true, totalValue: true, expirationDate: true } }),
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

  // Find workflow template
  let workflow = null;
  if (args.workflowId) {
    workflow = await prisma.workflow.findFirst({ where: { id: args.workflowId as string, tenantId, isActive: true }, include: { steps: { orderBy: { order: 'asc' } } } });
  } else if (args.workflowType) {
    workflow = await prisma.workflow.findFirst({ where: { tenantId, type: args.workflowType as string, isActive: true }, include: { steps: { orderBy: { order: 'asc' } } } });
  } else {
    // Default: first active workflow
    workflow = await prisma.workflow.findFirst({ where: { tenantId, isActive: true }, include: { steps: { orderBy: { order: 'asc' } } } });
  }

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
      ...(args.includeExecutions && { activeExecutions }),
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
      stepExecutions: { where: { status: 'PENDING' }, include: { step: { select: { name: true, assigneeId: true } } } },
    },
    orderBy: { startedAt: 'desc' },
  });

  // Filter to ones assigned to this user or unassigned
  const pending = executions.filter(e =>
    e.stepExecutions.some(se => !se.step.assigneeId || se.step.assigneeId === userId)
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
  await prisma.workflowStepExecution.update({
    where: { id: stepExec.id },
    data: { status: decision === 'approve' ? 'COMPLETED' : 'REJECTED', completedAt: new Date(), completedBy: userId, comment },
  });

  if (decision === 'reject') {
    await prisma.workflowExecution.update({ where: { id: executionId }, data: { status: 'REJECTED' } });
  }

  return {
    toolName: 'approve_or_reject_step',
    success: true,
    data: { executionId, step: stepExec.step.name, decision, comment },
    executionTimeMs: Date.now() - start,
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
  const updateData: Record<string, unknown> = {};
  switch (field) {
    case 'status': updateData.status = value; break;
    case 'totalValue': updateData.totalValue = Number(value); break;
    case 'effectiveDate': updateData.effectiveDate = new Date(value); break;
    case 'expirationDate': updateData.expirationDate = new Date(value); break;
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
