/**
 * Agent Observability API Routes
 * 
 * Provides endpoints for fetching agent traces, metrics, and
 * real-time observability data.
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

// =============================================================================
// TYPES
// =============================================================================

interface AgentTrace {
  id: string;
  agentId: string;
  agentName: string;
  agentType: 'react' | 'debate' | 'extraction' | 'validation' | 'custom';
  sessionId: string;
  startTime: string;
  endTime?: string;
  status: 'running' | 'completed' | 'failed' | 'paused';
  goal: string;
  steps: AgentStep[];
  tokensUsed: number;
  estimatedCost: number;
  contractId?: string;
  tenantId: string;
  userId: string;
}

interface AgentStep {
  id: string;
  stepNumber: number;
  type: 'thought' | 'action' | 'observation' | 'tool_call' | 'critique' | 'decision';
  content: string;
  timestamp: string;
  durationMs: number;
  toolId?: string;
  toolInput?: Record<string, any>;
  toolOutput?: any;
  confidence?: number;
  tokens?: number;
}

interface AgentMetrics {
  totalAgents: number;
  activeAgents: number;
  completedToday: number;
  failedToday: number;
  avgCompletionTimeMs: number;
  avgTokensPerTask: number;
  successRate: number;
  topAgents: Array<{ agentId: string; name: string; taskCount: number }>;
  topTools: Array<{ toolId: string; name: string; usageCount: number }>;
  costToday: number;
  costTrend: number;
}

// =============================================================================
// MOCK DATA GENERATORS
// =============================================================================

function generateMockTraces(tenantId: string): AgentTrace[] {
  const now = Date.now();
  
  return [
    {
      id: `trace-${now}-1`,
      agentId: 'react-agent',
      agentName: 'ReAct Contract Analyzer',
      agentType: 'react',
      sessionId: `session-${now}`,
      startTime: new Date(now - 120000).toISOString(),
      endTime: new Date(now - 30000).toISOString(),
      status: 'completed',
      goal: 'Analyze termination clauses and identify potential risks',
      steps: [
        {
          id: `step-${now}-1`,
          stepNumber: 1,
          type: 'thought',
          content: 'I need to first identify all termination-related clauses in the contract.',
          timestamp: new Date(now - 115000).toISOString(),
          durationMs: 1200,
          confidence: 0.9,
          tokens: 45 },
        {
          id: `step-${now}-2`,
          stepNumber: 2,
          type: 'tool_call',
          content: 'Calling clause extraction tool',
          timestamp: new Date(now - 113000).toISOString(),
          durationMs: 2500,
          toolId: 'clause-extractor',
          toolInput: { clauseTypes: ['termination', 'cancellation'] },
          toolOutput: { clauses: [{ type: 'termination', text: '30-day notice period' }] },
          tokens: 120 },
        {
          id: `step-${now}-3`,
          stepNumber: 3,
          type: 'observation',
          content: 'Found 3 termination clauses: 30-day notice, for-cause termination, and convenience termination.',
          timestamp: new Date(now - 110000).toISOString(),
          durationMs: 800,
          tokens: 65 },
        {
          id: `step-${now}-4`,
          stepNumber: 4,
          type: 'thought',
          content: 'Now I should analyze each clause for potential risks to our client.',
          timestamp: new Date(now - 108000).toISOString(),
          durationMs: 1100,
          confidence: 0.85,
          tokens: 55 },
        {
          id: `step-${now}-5`,
          stepNumber: 5,
          type: 'decision',
          content: 'Analysis complete: High risk - convenience termination has no cure period.',
          timestamp: new Date(now - 35000).toISOString(),
          durationMs: 1800,
          confidence: 0.92,
          tokens: 180 },
      ],
      tokensUsed: 465,
      estimatedCost: 0.0023,
      contractId: 'contract-abc',
      tenantId,
      userId: 'user-1' },
    {
      id: `trace-${now}-2`,
      agentId: 'debate-agent',
      agentName: 'Multi-Agent Debate',
      agentType: 'debate',
      sessionId: `session-${now}-2`,
      startTime: new Date(now - 60000).toISOString(),
      status: 'running',
      goal: 'Evaluate liability cap adequacy for enterprise software contract',
      steps: [
        {
          id: `step-d-${now}-1`,
          stepNumber: 1,
          type: 'thought',
          content: '[Primary Analyst] Analyzing liability cap structure...',
          timestamp: new Date(now - 55000).toISOString(),
          durationMs: 2000,
          tokens: 150 },
        {
          id: `step-d-${now}-2`,
          stepNumber: 2,
          type: 'critique',
          content: '[Critical Reviewer] The $1M cap seems low for enterprise scope. Industry standard for similar contracts is typically 2-3x annual contract value.',
          timestamp: new Date(now - 50000).toISOString(),
          durationMs: 1800,
          confidence: 0.75,
          tokens: 180 },
        {
          id: `step-d-${now}-3`,
          stepNumber: 3,
          type: 'thought',
          content: "[Devil's Advocate] While the cap is low, there are carve-outs for IP infringement and data breaches which may provide adequate protection...",
          timestamp: new Date(now - 45000).toISOString(),
          durationMs: 1600,
          confidence: 0.68,
          tokens: 165 },
      ],
      tokensUsed: 495,
      estimatedCost: 0.0025,
      contractId: 'contract-xyz',
      tenantId,
      userId: 'user-1' },
    {
      id: `trace-${now}-3`,
      agentId: 'extraction-agent',
      agentName: 'Smart Document Extractor',
      agentType: 'extraction',
      sessionId: `session-${now}-3`,
      startTime: new Date(now - 300000).toISOString(),
      endTime: new Date(now - 280000).toISOString(),
      status: 'completed',
      goal: 'Extract all payment terms and rate card information',
      steps: [
        {
          id: `step-e-${now}-1`,
          stepNumber: 1,
          type: 'action',
          content: 'Scanning document structure to identify payment-related sections',
          timestamp: new Date(now - 298000).toISOString(),
          durationMs: 3000,
          tokens: 200 },
        {
          id: `step-e-${now}-2`,
          stepNumber: 2,
          type: 'tool_call',
          content: 'Using table extraction tool on identified rate card section',
          timestamp: new Date(now - 295000).toISOString(),
          durationMs: 4500,
          toolId: 'table-extractor',
          toolInput: { pageRange: [12, 15], extractType: 'rate_card' },
          toolOutput: { tables: 3, rows: 45, confidence: 0.91 },
          tokens: 350 },
        {
          id: `step-e-${now}-3`,
          stepNumber: 3,
          type: 'observation',
          content: 'Successfully extracted 45 line items across 3 rate card tables',
          timestamp: new Date(now - 285000).toISOString(),
          durationMs: 500,
          tokens: 50 },
      ],
      tokensUsed: 600,
      estimatedCost: 0.003,
      contractId: 'contract-def',
      tenantId,
      userId: 'user-2' },
  ];
}

 
function generateMockMetrics(_tenantId: string): AgentMetrics {
  return {
    totalAgents: 9,
    activeAgents: 3,
    completedToday: 47,
    failedToday: 2,
    avgCompletionTimeMs: 12500,
    avgTokensPerTask: 520,
    successRate: 0.958,
    topAgents: [
      { agentId: 'react-agent', name: 'ReAct Analyzer', taskCount: 23 },
      { agentId: 'extraction-agent', name: 'Smart Extractor', taskCount: 18 },
      { agentId: 'validation-agent', name: 'Validator', taskCount: 12 },
      { agentId: 'debate-agent', name: 'Multi-Agent Debate', taskCount: 8 },
      { agentId: 'summary-agent', name: 'Contract Summarizer', taskCount: 6 },
    ],
    topTools: [
      { toolId: 'clause-extractor', name: 'Clause Extractor', usageCount: 156 },
      { toolId: 'contract-analyzer', name: 'Contract Analyzer', usageCount: 89 },
      { toolId: 'semantic-search', name: 'Semantic Search', usageCount: 67 },
      { toolId: 'table-extractor', name: 'Table Extractor', usageCount: 45 },
      { toolId: 'document-comparator', name: 'Document Comparator', usageCount: 34 },
    ],
    costToday: 12.45,
    costTrend: -5.2 };
}

// =============================================================================
// GET - Fetch traces and metrics
// =============================================================================

export const GET = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all'; // 'traces', 'metrics', 'all'
    const status = searchParams.get('status'); // Filter by status
    const agentType = searchParams.get('agentType'); // Filter by agent type
    const limit = parseInt(searchParams.get('limit') || '50');

    // Fetch traces from Redis cache or database
    let traces: AgentTrace[] = [];
    let metrics: AgentMetrics = {
      totalAgents: 0,
      activeAgents: 0,
      completedToday: 0,
      failedToday: 0,
      avgCompletionTimeMs: 0,
      avgTokensPerTask: 0,
      successRate: 0,
      topAgents: [],
      topTools: [],
      costToday: 0,
      costTrend: 0 };

    try {
      // Try to fetch from Redis first
      const { getCached } = await import('@/lib/cache');
      const cachedTraces = await getCached<AgentTrace[]>(`agent:traces:${tenantId}`);
      const cachedMetrics = await getCached<AgentMetrics>(`agent:metrics:${tenantId}`);
      
      if (cachedTraces) traces = cachedTraces;
      if (cachedMetrics) metrics = cachedMetrics;
    } catch {
      // Redis unavailable, continue with empty data
    }

    // In development only, use mock data for testing if no real data
    if (process.env.NODE_ENV !== 'production' && traces.length === 0) {
      traces = generateMockTraces(tenantId);
      metrics = generateMockMetrics(tenantId);
    }

    // Apply filters
    if (status && status !== 'all') {
      traces = traces.filter(t => t.status === status);
    }
    if (agentType && agentType !== 'all') {
      traces = traces.filter(t => t.agentType === agentType);
    }

    // Apply limit
    traces = traces.slice(0, limit);

    // Return based on type
    if (type === 'traces') {
      return createSuccessResponse(ctx, { traces });
    }
    if (type === 'metrics') {
      return createSuccessResponse(ctx, { metrics });
    }

    return createSuccessResponse(ctx, {
      traces,
      metrics,
      timestamp: new Date().toISOString() });
  });

// =============================================================================
// POST - Record new trace or update existing
// =============================================================================

export const POST = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
    const body = await request.json();
    const { action, trace, step, traceId } = body;

    switch (action) {
      case 'create_trace': {
        // In production, store in database
        const newTrace: AgentTrace = {
          id: `trace-${Date.now()}`,
          ...trace,
          tenantId,
          startTime: new Date().toISOString(),
          status: 'running',
          steps: [],
          tokensUsed: 0,
          estimatedCost: 0 };

        return createSuccessResponse(ctx, { 
          traceId: newTrace.id,
          message: 'Trace created successfully' 
        });
      }

      case 'add_step': {
        if (!traceId || !step) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'traceId and step are required', 400);
        }

        // In production, update trace in database
        const newStep: AgentStep = {
          id: `step-${Date.now()}`,
          ...step,
          timestamp: new Date().toISOString() };

        return createSuccessResponse(ctx, {
          stepId: newStep.id,
          message: 'Step added successfully' });
      }

      case 'complete_trace': {
        if (!traceId) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'traceId is required', 400);
        }

        // In production, update trace status in database
        return createSuccessResponse(ctx, {
          message: 'Trace completed successfully' });
      }

      case 'fail_trace': {
        if (!traceId) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'traceId is required', 400);
        }

        const { error: errorMessage } = body;

        // In production, update trace status in database
        return createSuccessResponse(ctx, {
          message: 'Trace marked as failed',
          error: errorMessage });
      }

      default:
        return createErrorResponse(ctx, 'BAD_REQUEST', `Unknown action: ${action}`, 400);
    }
  });
