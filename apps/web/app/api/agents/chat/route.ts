/**
 * Agent Chat API
 * 
 * POST /api/agents/chat - Send message to agent with @mention support
 * GET /api/agents/chat?threadId=xxx - Get chat history
 * DELETE /api/agents/chat?threadId=xxx - Clear chat history
 * 
 * Natural language interface to agents with @mention routing
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { redis } from '@/lib/redis';
import { z } from 'zod';
import pino from 'pino';
import { agenticChat } from '@/lib/ai/agentic-chat.service';
import { shouldUseAgent } from '@/lib/ai/agent-integration';
import { hybridSearch } from '@/lib/rag/advanced-rag.service';
import { createOpenAIClient, hasAIClientConfig } from '@/lib/openai-client';

// ── Structured logger ─────────────────────────────────────────────────
const log = pino({ name: 'agent-chat', level: process.env.LOG_LEVEL ?? 'info' });

// ── Timeout + Retry helpers ───────────────────────────────────────────

const AGENT_TIMEOUT_MS = 15_000; // 15 s per agent handler
const LLM_TIMEOUT_MS = 20_000;   // 20 s for OpenAI calls
const MAX_LLM_RETRIES = 2;

async function withTimeout<T>(
  promise: Promise<T>,
  fallback: T,
  timeoutMs = AGENT_TIMEOUT_MS,
  label = 'operation',
): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      log.warn({ timeoutMs, label }, 'Operation timed out, returning fallback');
      resolve(fallback);
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

async function withRetry<T>(
  fn: () => Promise<T>,
  retries = MAX_LLM_RETRIES,
  label = 'operation',
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < retries) {
        const delay = Math.min(1000 * 2 ** attempt, 4000); // exp backoff capped at 4 s
        log.warn({ attempt: attempt + 1, retries, delay, label, error: lastError.message }, 'Retrying after error');
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError!;
}

// ── AI Enhancement Helper ─────────────────────────────────────────────
/**
 * Enhance agent response with GPT reasoning.
 * Takes raw DB data + user query and produces intelligent, contextual responses.
 * Falls back to the template response if AI is unavailable.
 */
async function enhanceWithAI(
  agentName: string,
  agentRole: string,
  message: string,
  dbData: any,
  templateResponse: string,
): Promise<string> {
  if (!hasAIClientConfig()) return templateResponse;

  try {
    const OpenAI = (await import('openai')).default;
    const openai = createOpenAIClient();

    const completion = await withTimeout(
      openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are ${agentName}, a specialized AI agent in ConTigo (a contract management platform). Your specialty: ${agentRole}.

Analyze the data provided and respond to the user's query with specific, actionable insights.
Use markdown formatting. Link contracts as [Contract Name](/contracts/CONTRACT_ID).
Be concise but insightful — provide analysis and recommendations, not just data dumps.
If the data is empty or limited, acknowledge that and suggest next steps.`,
          },
          {
            role: 'user',
            content: `User query: "${message}"\n\nAvailable data:\n${JSON.stringify(dbData, null, 2).slice(0, 4000)}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
      null,
      LLM_TIMEOUT_MS,
      `${agentName}-enhance`,
    );

    return completion?.choices[0]?.message?.content || templateResponse;
  } catch (err) {
    log.warn({ err, agentName }, 'AI enhancement failed, using template response');
    return templateResponse;
  }
}

// Agent @mention handlers mapping
const AGENT_MENTION_MAP: Record<string, string> = {
  '@merchant': 'rfx-procurement-agent',
  '@scout': 'rfx-detection-agent',
  '@sage': 'intelligent-search-agent',
  '@sentinel': 'proactive-validation-agent',
  '@vigil': 'compliance-monitoring-agent',
  '@warden': 'proactive-risk-detector',
  '@architect': 'workflow-authoring-agent',
  '@prospector': 'opportunity-discovery-engine',
  '@clockwork': 'autonomous-deadline-manager',
  '@conductor': 'conflict-resolution-agent',
  '@navigator': 'onboarding-coach-agent',
  '@builder': 'template-generation-agent',
  '@memorykeeper': 'contract-transformation-agent',
  '@orchestrator': 'workflow-orchestrator-agent',
  '@synthesizer': 'data-synthesizer-agent',
};

const AGENT_CODENAMES: Record<string, { name: string; avatar: string; color: string }> = {
  'rfx-procurement-agent': { name: 'Merchant', avatar: '🤝', color: 'yellow' },
  'rfx-detection-agent': { name: 'Scout', avatar: '🎯', color: 'rose' },
  'intelligent-search-agent': { name: 'Sage', avatar: '🔮', color: 'violet' },
  'proactive-validation-agent': { name: 'Sentinel', avatar: '🛡️', color: 'blue' },
  'compliance-monitoring-agent': { name: 'Vigil', avatar: '⚖️', color: 'emerald' },
  'proactive-risk-detector': { name: 'Warden', avatar: '🔥', color: 'orange' },
  'workflow-authoring-agent': { name: 'Architect', avatar: '🏛️', color: 'slate' },
  'opportunity-discovery-engine': { name: 'Prospector', avatar: '💎', color: 'amber' },
  'autonomous-deadline-manager': { name: 'Clockwork', avatar: '⏰', color: 'cyan' },
  'conflict-resolution-agent': { name: 'Conductor', avatar: '🎼', color: 'indigo' },
  'onboarding-coach-agent': { name: 'Navigator', avatar: '🧭', color: 'teal' },
  'template-generation-agent': { name: 'Builder', avatar: '🏗️', color: 'lime' },
  'contract-transformation-agent': { name: 'Memorykeeper', avatar: '📚', color: 'fuchsia' },
  'workflow-orchestrator-agent': { name: 'Orchestrator', avatar: '🎼', color: 'purple' },
  'data-synthesizer-agent': { name: 'Synthesizer', avatar: '🔄', color: 'pink' },
};

const ChatMessageSchema = z.object({
  message: z.string().min(1).max(4000),
  threadId: z.string().optional(),
  context: z.object({
    contractId: z.string().optional(),
    rfxId: z.string().optional(),
  }).optional(),
});

/**
 * GET /api/agents/chat
 * 
 * Get chat history for a thread
 */
export const GET = withAuthApiHandler(async (req: NextRequest, ctx) => {
  const { tenantId } = ctx;
  const searchParams = req.nextUrl.searchParams;
  const threadId = searchParams.get('threadId');

  if (!threadId) {
    return createErrorResponse(ctx, 'MISSING_THREAD_ID', 'threadId is required', 400);
  }

  try {
    // Try cache first
    const cacheKey = `chat:${tenantId}:${threadId}`;
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      const messages = JSON.parse(cached);
      return createSuccessResponse(ctx, { messages, source: 'cache' }, { cached: true });
    }

    // Get from database
    const messages = await prisma.agentConversation.findMany({
      where: {
        tenantId,
        threadId,
      },
      orderBy: { timestamp: 'asc' },
      take: 100,
    });

    // Cache for 1 hour
    await redis.setex(cacheKey, 3600, JSON.stringify(messages));

    return createSuccessResponse(ctx, { messages, source: 'database' });
  } catch (error) {
    log.error({ err: error, threadId }, 'Failed to fetch chat history');
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to fetch chat history', 500);
  }
});

/**
 * POST /api/agents/chat
 * 
 * Send message to agent(s) with @mention support
 */
export const POST = withAuthApiHandler(async (req: NextRequest, ctx) => {
  const { tenantId, userId } = ctx;

  try {
    const body = await req.json();
    const { message, threadId: existingThreadId, context } = ChatMessageSchema.parse(body);

    // Generate thread ID if not provided
    const threadId = existingThreadId || `thread-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Parse @mentions
    const mentions = parseMentions(message);
    const mentionedAgents = mentions.map(m => AGENT_MENTION_MAP[m.toLowerCase()]).filter(Boolean);

    // If no mentions, route to Sage (default conversational agent)
    const targetAgents = mentionedAgents.length > 0 ? mentionedAgents : ['intelligent-search-agent'];

    // Save user message
    const userMessage = await prisma.agentConversation.create({
      data: {
        tenantId,
        threadId,
        role: 'user',
        content: message,
        userId,
        context: context || {},
        timestamp: new Date(),
      },
    });

    // Get conversation history for context
    const history = await prisma.agentConversation.findMany({
      where: { tenantId, threadId },
      orderBy: { timestamp: 'asc' },
      take: 10,
    });

    const startMs = Date.now();
    log.info({ threadId, tenantId, targetAgents, mentionCount: mentions.length }, 'Processing agent chat request');

    // Process with target agent(s) — each wrapped in a timeout + error isolation
    const responses = await Promise.all(
      targetAgents.map(async (agentId) => {
        const agentStart = Date.now();
        const codename = AGENT_CODENAMES[agentId]?.name ?? agentId;
        const fallback: AgentResponse = {
          content: `Sorry, **${codename}** timed out while processing your request. Please try again.`,
          confidence: 0,
        };

        try {
          const result = await withTimeout(
            processWithAgent(agentId, message, history, context, tenantId, threadId, userId),
            fallback,
            AGENT_TIMEOUT_MS,
            codename,
          );
          log.info({ agentId, codename, durationMs: Date.now() - agentStart, confidence: result.confidence }, 'Agent completed');
          return result;
        } catch (err) {
          log.error({ err, agentId, codename, durationMs: Date.now() - agentStart }, 'Agent handler failed');
          return fallback;
        }
      })
    );

    // ── Multi-agent synthesis ─────────────────────────────────────────
    // When 2+ agents responded, produce a brief synthesis preamble.
    let synthesisNote = '';
    if (responses.length > 1) {
      const agentNames = targetAgents.map(id => `**${AGENT_CODENAMES[id]?.name ?? id}**`);
      synthesisNote = `_Insights from ${agentNames.join(', ')}:_\n\n---\n\n`;
    }

    // Save agent responses
    const savedResponses = await Promise.all(
      responses.map((response, i) => {
        const content = i === 0 && synthesisNote
          ? synthesisNote + response.content
          : response.content;
        return prisma.agentConversation.create({
          data: {
            tenantId,
            threadId,
            role: 'assistant',
            content,
            agentId: targetAgents[i],
            agentCodename: AGENT_CODENAMES[targetAgents[i]]?.name || 'Agent',
            metadata: {
              actions: response.actions,
              data: response.data,
              confidence: response.confidence,
              durationMs: Date.now() - startMs,
            },
            timestamp: new Date(),
          },
        });
      })
    );

    // Update cache
    const cacheKey = `chat:${tenantId}:${threadId}`;
    const allMessages = [...history, userMessage, ...savedResponses];
    await redis.setex(cacheKey, 3600, JSON.stringify(allMessages));

    log.info({ threadId, agentCount: targetAgents.length, totalDurationMs: Date.now() - startMs }, 'Chat request complete');

    return createSuccessResponse(ctx, {
      threadId,
      messages: savedResponses,
      agents: targetAgents.map(id => ({
        id,
        ...AGENT_CODENAMES[id],
      })),
    });
  } catch (error) {
    log.error({ err: error, tenantId }, 'Failed to process chat message');
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to process message', 500, {
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/agents/chat
 * 
 * Clear chat history
 */
export const DELETE = withAuthApiHandler(async (req: NextRequest, ctx) => {
  const { tenantId } = ctx;
  const searchParams = req.nextUrl.searchParams;
  const threadId = searchParams.get('threadId');

  if (!threadId) {
    return createErrorResponse(ctx, 'MISSING_THREAD_ID', 'threadId is required', 400);
  }

  try {
    // Delete from database
    await prisma.agentConversation.deleteMany({
      where: {
        tenantId,
        threadId,
      },
    });

    // Clear cache
    await redis.del(`chat:${tenantId}:${threadId}`);

    return createSuccessResponse(ctx, {
      message: 'Chat history cleared',
    });
  } catch (error) {
    log.error({ err: error, tenantId, threadId }, 'Failed to clear chat history');
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to clear chat history', 500);
  }
});

// ============================================================================
// AGENT PROCESSING FUNCTIONS
// ============================================================================

interface AgentResponse {
  content: string;
  actions?: Array<{
    type: string;
    label: string;
    payload: any;
  }>;
  data?: any;
  confidence?: number;
}

async function processWithAgent(
  agentId: string,
  message: string,
  history: any[],
  context: any,
  tenantId: string,
  threadId: string,
  userId?: string
): Promise<AgentResponse> {
  // Build context-enriched input
  const enrichedContext = await buildEnrichedContext(context, tenantId);

  // ── Intelligence Gate ───────────────────────────────────────────────
  // Complex multi-step queries bypass individual handlers for full AI reasoning.
  // The agentic loop has 8 tools (search, details, expiring, spend, risk, compare,
  // supplier info, clause extraction) and can call them iteratively.
  const decision = shouldUseAgent(message);
  if (decision.useAgent && hasAIClientConfig()) {
    const codename = AGENT_CODENAMES[agentId];
    log.info({ agentId, complexity: decision.complexity, steps: decision.estimatedSteps }, 'Routing to agentic AI reasoning');

    try {
      const conversationHistory = history.slice(-6).map((h: any) => ({
        role: (h.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: String(h.content || ''),
      }));

      const aiResult = await withTimeout(
        agenticChat(message, tenantId, conversationHistory, {
          maxIterations: Math.min(decision.estimatedSteps, 5),
          model: decision.complexity === 'high' ? 'gpt-4o' : undefined,
        }),
        null,
        LLM_TIMEOUT_MS * 2,
        'agentic-reasoning',
      );

      if (aiResult) {
        return {
          content: `${codename?.avatar || '🤖'} **${codename?.name || 'AI'}** _(deep analysis)_\n\n${aiResult.content}`,
          data: {
            toolsUsed: aiResult.toolsUsed,
            iterations: aiResult.totalIterations,
            confidence: aiResult.confidence,
            sources: aiResult.sources,
          },
          confidence: aiResult.confidence,
        };
      }
    } catch (err) {
      log.warn({ err, agentId }, 'Agentic reasoning failed, falling back to handler');
    }
  }

  // Route to appropriate agent handler
  switch (agentId) {
    case 'intelligent-search-agent':
      return handleSageQuery(message, history, enrichedContext, tenantId);
    
    case 'rfx-detection-agent':
      return handleScoutQuery(message, history, enrichedContext, tenantId);
    
    case 'rfx-procurement-agent':
      return handleMerchantQuery(message, history, enrichedContext, tenantId, userId);
    
    case 'compliance-monitoring-agent':
      return handleVigilQuery(message, history, enrichedContext, tenantId);
    
    case 'proactive-risk-detector':
      return handleWardenQuery(message, history, enrichedContext, tenantId);
    
    case 'autonomous-deadline-manager':
      return handleClockworkQuery(message, history, enrichedContext, tenantId);
    
    case 'opportunity-discovery-engine':
      return handleProspectorQuery(message, history, enrichedContext, tenantId);
    
    case 'proactive-validation-agent':
      return handleSentinelQuery(message, history, enrichedContext, tenantId);
    
    case 'workflow-authoring-agent':
      return handleArchitectQuery(message, history, enrichedContext, tenantId);
    
    case 'conflict-resolution-agent':
      return handleConductorQuery(message, history, enrichedContext, tenantId);
    
    case 'onboarding-coach-agent':
      return handleNavigatorQuery(message, history, enrichedContext, tenantId);
    
    case 'template-generation-agent':
      return handleBuilderQuery(message, history, enrichedContext, tenantId);
    
    case 'contract-transformation-agent':
      return handleMemorykeeperQuery(message, history, enrichedContext, tenantId);
    
    case 'workflow-orchestrator-agent':
      return handleOrchestratorQuery(message, history, enrichedContext, tenantId);
    
    case 'data-synthesizer-agent':
      return handleSynthesizerQuery(message, history, enrichedContext, tenantId);
    
    default:
      return handleGenericAgentQuery(agentId, message, history, enrichedContext);
  }
}

// ============================================================================
// AGENT-SPECIFIC HANDLERS
// ============================================================================

async function handleSageQuery(
  message: string,
  history: any[],
  context: any,
  tenantId: string
): Promise<AgentResponse> {
  // Sage: AI-powered contract intelligence — uses full agentic reasoning loop
  // with 8 tools (search, details, expiring, spend, risk, compare, supplier, clause)

  if (hasAIClientConfig()) {
    try {
      const conversationHistory = history.slice(-6).map((h: any) => ({
        role: (h.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: String(h.content || ''),
      }));

      const aiResult = await withTimeout(
        agenticChat(message, tenantId, conversationHistory),
        null,
        LLM_TIMEOUT_MS * 2,
        'sage-agentic',
      );

      if (aiResult) {
        return {
          content: aiResult.content,
          data: {
            toolsUsed: aiResult.toolsUsed,
            iterations: aiResult.totalIterations,
            sources: aiResult.sources,
          },
          actions: aiResult.sources?.slice(0, 3).map(s => ({
            type: 'navigate',
            label: `View: ${s}`,
            payload: { path: '/contracts' },
          })),
          confidence: aiResult.confidence,
        };
      }
    } catch (err) {
      log.warn({ err }, 'Sage AI reasoning failed, falling back to search');
    }
  }

  // Fallback: use hybrid search (semantic + keyword via RAG) or basic Prisma
  const isQuestion = message.match(/^(what|how|when|where|why|who|is|are|can|does)/i);
  const isSearch = message.match(/\b(find|search|show|list|get|look for)\b/i);
  
  if (isSearch || isQuestion) {
    const searchResults = await performContractSearch(message, tenantId, context.contractId);
    
    return {
      content: searchResults.count > 0
        ? `I found **${searchResults.count}** relevant results:\n\n${searchResults.summary}`
        : `I couldn't find contracts matching "${message}". Try different keywords or ask me a broader question about your portfolio.`,
      data: searchResults.results,
      actions: searchResults.results.slice(0, 3).map((r: any) => ({
        type: 'navigate',
        label: `View ${r.title || r.contractTitle || r.contractName}`,
        payload: { contractId: r.id || r.contractId },
      })),
      confidence: searchResults.confidence,
    };
  }

  // General conversation
  return {
    content: "I'm **Sage** 🔮, your AI-powered contract intelligence assistant. I can search, analyze, and reason across your entire contract portfolio.\n\nTry asking me:\n• \"What are our riskiest contracts?\"\n• \"Compare spending across IT vendors\"\n• \"Find contracts with auto-renewal clauses expiring soon\"\n• \"Analyze our supplier concentration risk\"\n\nI use advanced AI reasoning with multiple tools to give you deep insights, not just search results.",
    confidence: 0.95,
  };
}

async function handleScoutQuery(
  message: string,
  history: any[],
  context: any,
  tenantId: string
): Promise<AgentResponse> {
  // Scout: RFx opportunity detection
  
  const isOpportunityRequest = message.match(/\b(opportunities|rfp|rfq|sourcing|detect|find|scan)\b/i);
  
  if (isOpportunityRequest) {
    // Get opportunities
    const opportunities = await prisma.rFxOpportunity.findMany({
      where: {
        tenantId,
        status: { in: ['IDENTIFIED', 'UNDER_REVIEW'] },
      },
      orderBy: { detectedAt: 'desc' },
      take: 10,
    });

    if (opportunities.length === 0) {
      return {
        content: "I've scanned your contract portfolio and didn't find any immediate RFx opportunities. Your contracts look healthy!\n\nI continuously monitor for:\n• Contracts expiring in the next 6 months\n• Pricing above market rates\n• Performance issues\n• Consolidation opportunities\n\nYou'll be notified when I detect something.",
        confidence: 0.9,
      };
    }

    const criticalCount = opportunities.filter(o => o.urgency === 'CRITICAL').length;
    
    return {
      content: `I found ${opportunities.length} RFx opportunities${criticalCount > 0 ? `, including ${criticalCount} critical items` : ''}:\n\n${opportunities.slice(0, 5).map(o => `• ${o.title} (${o.urgency.toLowerCase()})`).join('\n')}`,
      data: { opportunities },
      actions: [
        { type: 'navigate', label: 'View All Opportunities', payload: { path: '/contigo-lab?tab=opportunities' } },
        { type: 'action', label: 'Run New Scan', payload: { action: 'detect_all' } },
      ],
      confidence: 0.92,
    };
  }

  return {
    content: "I'm Scout, your RFx opportunity detector. I proactively scan your contract portfolio to identify sourcing opportunities before they become urgent.\n\nI can:\n• Detect contracts approaching expiration\n• Identify overpriced contracts vs. market rates\n• Find performance issues requiring vendor replacement\n• Spot consolidation opportunities\n\nAsk me to 'scan for opportunities' or 'show detected opportunities' to see what I've found.",
    confidence: 0.95,
  };
}

async function handleMerchantQuery(
  message: string,
  history: any[],
  context: any,
  tenantId: string,
  userId?: string
): Promise<AgentResponse> {
  // Feature flag check — return graceful message when RFx module is disabled
  if (process.env.RFX_AGENT_ENABLED === 'false') {
    return {
      content: "The RFx procurement module is currently disabled. Please contact your administrator to enable it.",
      confidence: 0.95,
    };
  }

  // Merchant: RFx procurement workflow — powered by real Merchant agent
  
  const lowerMsg = message.toLowerCase();
  
  // Detect intent: create RFx
  const isCreateRequest = lowerMsg.match(/\b(create|new|start|draft|initiate)\b.*\b(rfx|rfp|rfq|rfi|sourcing|procurement)\b/i)
    || lowerMsg.match(/\b(rfx|rfp|rfq|rfi|sourcing)\b.*\b(create|new|start|draft)\b/i);

  // Detect intent: compare/evaluate bids
  const isCompareRequest = lowerMsg.match(/\b(compare|evaluate|score|rank|assess)\b.*\b(bid|response|proposal|vendor)\b/i);

  // Detect intent: negotiate
  const isNegotiateRequest = lowerMsg.match(/\b(negotiate|counter|strategy|bargain|lever)\b/i);

  // Detect intent: award
  const isAwardRequest = lowerMsg.match(/\b(award|select|winner|recommend|justify)\b/i);

  // Detect intent: general RFx query
  const isRfxRequest = lowerMsg.match(/\b(rfx|rfp|rfq|bid|award|vendor|supplier|procurement|sourcing)\b/i);

  // ── Create RFx via direct Prisma call (no HTTP round-trip) ─────────────
  if (isCreateRequest) {
    // Extract title from message
    const titleMatch = message.match(/(?:for|called|titled|named)\s+"?([^"]+)"?$/i)
      || message.match(/(?:create|new|start)\s+(?:an?\s+)?(?:rfx|rfp|rfq)\s+(?:for\s+)?(.+)/i);
    const title = titleMatch?.[1]?.trim() || 'Untitled RFx';
    const type = lowerMsg.includes('rfq') ? 'RFQ' : lowerMsg.includes('rfi') ? 'RFI' : 'RFP';

    try {
      // AI enhancement — generate requirements via GPT (with retry + timeout)
      let aiRequirements: any[] = [];
      let evaluationCriteria: any[] = [];
      try {
        const OpenAI = (await import('openai')).default;
        const openai = createOpenAIClient();
        const prompt = `You are an expert procurement specialist. Generate comprehensive requirements for this ${type}:\n\nTitle: ${title}\nDescription: ${message}\n\nGenerate 6-10 requirements as JSON:\n{\n  "requirements": [{ "title": "...", "description": "...", "category": "technical|commercial|legal|delivery|quality|security|sla", "priority": "must-have|should-have|nice-to-have" }],\n  "evaluationCriteria": [{ "name": "...", "description": "...", "weight": 0.25, "scoringMethod": "numeric|pass-fail|ranking" }]\n}\nEnsure weights sum to 1.0.`;

        const aiRes = await withTimeout(
          withRetry(
            () => openai.chat.completions.create({
              model: process.env.RFX_AI_MODEL || 'gpt-4o-mini',
              messages: [{ role: 'user', content: prompt }],
              response_format: { type: 'json_object' },
              temperature: 0.4,
            }),
            MAX_LLM_RETRIES,
            'Merchant-RFx-AI',
          ),
          null,
          LLM_TIMEOUT_MS,
          'Merchant-RFx-AI',
        );

        if (aiRes) {
          const parsed = JSON.parse(aiRes.choices[0]?.message?.content || '{}');
          aiRequirements = (parsed.requirements || []).map((r: any) => ({
            title: r.title || 'Untitled', description: r.description || '', category: r.category || 'general',
            priority: r.priority || 'should-have', source: 'ai' as const,
          }));
          evaluationCriteria = parsed.evaluationCriteria || [];
          log.info({ reqCount: aiRequirements.length, criteriaCount: evaluationCriteria.length }, 'Merchant AI requirements generated');
        }
      } catch (aiErr) {
        log.warn({ err: aiErr }, 'Merchant AI requirement generation failed (best-effort)');
      }

      const defaultDeadlineDays = parseInt(process.env.RFX_DEFAULT_DEADLINE_DAYS || '30', 10);
      const rfx = await prisma.rFxEvent.create({
        data: {
          tenantId,
          title,
          description: message,
          type,
          status: 'draft',
          responseDeadline: new Date(Date.now() + defaultDeadlineDays * 24 * 60 * 60 * 1000),
          requirements: aiRequirements as any,
          evaluationCriteria: evaluationCriteria as any,
          invitedVendors: [],
          createdBy: userId || 'system',
        },
      });

      const reqCount = aiRequirements.length;
      return {
        content: `I've created a draft RFx: **"${rfx.title}"** (${rfx.type})\n\nAI generated ${reqCount} requirements.\n\nYou can now:\n• Review and edit requirements\n• Add vendors\n• Publish when ready`,
        data: { rfxEvent: rfx },
        actions: [
          { type: 'navigate', label: 'Edit RFx', payload: { path: `/contigo-labs/rfx/${rfx.id}` } },
          { type: 'navigate', label: 'View All RFx', payload: { path: '/contigo-labs?tab=events' } },
        ],
        confidence: 0.95,
      };
    } catch (err) {
      log.warn({ err, tenantId, title }, '[Merchant] Create RFx via chat failed');
    }
  }

  // ── Compare bids ───────────────────────────────────────────────────────
  if (isCompareRequest) {
    const activeRfxs = await prisma.rFxEvent.findMany({
      where: { tenantId, status: { in: ['open', 'closed'] }, NOT: { responses: { equals: Prisma.DbNull } } },
      orderBy: { updatedAt: 'desc' },
      take: 3,
    });

    if (activeRfxs.length > 0) {
      const rfx = activeRfxs[0];
      const responseCount = Array.isArray(rfx.responses) ? rfx.responses.length : 0;
      return {
        content: `I found ${activeRfxs.length} RFx events with bids. The most recent is **"${rfx.title}"** with ${responseCount} vendor responses.\n\nWould you like me to evaluate and score these bids?`,
        data: { rfxs: activeRfxs },
        actions: [
          { type: 'navigate', label: 'Evaluate Bids', payload: { path: `/contigo-labs/rfx/${rfx.id}` } },
          ...activeRfxs.slice(0, 3).map(r => ({ type: 'navigate' as const, label: `View: ${r.title}`, payload: { path: `/contigo-labs/rfx/${r.id}` } })),
        ],
        confidence: 0.9,
      };
    }
  }

  // ── Negotiation support ────────────────────────────────────────────────
  if (isNegotiateRequest) {
    return {
      content: "I can help you develop a negotiation strategy. To get started, I'll need:\n\n1. **Vendor name** — Who are you negotiating with?\n2. **Current bid** — Their latest offer amount\n3. **Target price** — Your ideal outcome\n\nYou can also open an existing RFx to generate a negotiation strategy directly.",
      actions: [
        { type: 'navigate', label: 'View Active RFx', payload: { path: '/contigo-labs?tab=events' } },
      ],
      confidence: 0.85,
    };
  }

  // ── General RFx status ─────────────────────────────────────────────────
  if (isRfxRequest || isAwardRequest) {
    const activeRfxs = await prisma.rFxEvent.findMany({
      where: {
        tenantId,
        status: { in: ['draft', 'published', 'open', 'closed'] },
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    });

    const draftCount = activeRfxs.filter(r => r.status === 'draft').length;
    const openCount = activeRfxs.filter(r => r.status === 'open' || r.status === 'published').length;

    return {
      content: `You have ${activeRfxs.length} active RFx events (${draftCount} drafts, ${openCount} open):\n\n${activeRfxs.map(r => `• **${r.title}** — ${r.status} (${r.type})`).join('\n') || 'No active RFx events currently.'}\n\nI can help you:\n• **Create** a new RFx/RFP/RFQ\n• **Compare** vendor bids\n• **Negotiate** with vendors\n• **Award** and justify decisions`,
      data: { rfxs: activeRfxs },
      actions: [
        { type: 'navigate', label: 'Create New RFx', payload: { path: '/contigo-labs?action=create_rfx' } },
        { type: 'navigate', label: 'View All RFx', payload: { path: '/contigo-labs?tab=events' } },
      ],
      confidence: 0.9,
    };
  }

  return {
    content: "I'm **Merchant**, your RFx procurement specialist. I manage the full sourcing lifecycle with AI-powered insights.\n\nTry:\n• *\"Create an RFP for cloud hosting services\"*\n• *\"Compare bids for my open RFx\"*\n• *\"Help me negotiate with vendor X\"*\n• *\"Show my active RFx events\"*\n\nAll actions include human checkpoints at critical decision points.",
    confidence: 0.95,
  };
}

async function handleVigilQuery(
  message: string,
  history: any[],
  context: any,
  tenantId: string
): Promise<AgentResponse> {
  const pendingAlerts = await prisma.riskDetectionLog.findMany({
    where: {
      tenantId,
      acknowledged: false,
      severity: { in: ['HIGH', 'CRITICAL'] },
    },
    orderBy: { detectedAt: 'desc' },
    take: 5,
  });

  // Enrich with contract titles (RiskDetectionLog has no Prisma relation)
  const contractIds = [...new Set(pendingAlerts.map(a => a.contractId))];
  const contracts = contractIds.length > 0 ? await prisma.contract.findMany({
    where: { id: { in: contractIds } },
    select: { id: true, contractTitle: true },
  }) : [];
  const contractMap = new Map(contracts.map(c => [c.id, c.contractTitle]));

  const criticalCount = pendingAlerts.filter(a => a.severity === 'CRITICAL').length;

  const templateContent = `I found ${pendingAlerts.length} compliance items requiring attention${criticalCount > 0 ? `, including ${criticalCount} critical alerts` : ''}:\n\n${pendingAlerts.map(a => `• ${contractMap.get(a.contractId) || 'Contract'}: ${a.riskType}`).join('\n') || 'No pending compliance alerts. Great job staying compliant!'}`;

  const content = pendingAlerts.length > 0
    ? await enhanceWithAI('Vigil', 'compliance monitoring, regulatory risk detection, and obligation tracking', message, { alerts: pendingAlerts.map(a => ({ ...a, contractTitle: contractMap.get(a.contractId) })), criticalCount }, templateContent)
    : templateContent;

  return {
    content,
    data: { alerts: pendingAlerts },
    actions: pendingAlerts.length > 0 ? [
      { type: 'navigate', label: 'Review All Alerts', payload: { path: '/contigo-lab?tab=alerts' } },
    ] : [],
    confidence: 0.9,
  };
}

async function handleWardenQuery(
  message: string,
  history: any[],
  context: any,
  tenantId: string
): Promise<AgentResponse> {
  const risks = await prisma.riskDetectionLog.findMany({
    where: {
      tenantId,
      acknowledged: false,
      riskType: { in: ['FINANCIAL_RISK', 'LEGAL_RISK', 'OPERATIONAL_RISK'] },
    },
    orderBy: { detectedAt: 'desc' },
    take: 5,
  });

  // Enrich with contract titles (RiskDetectionLog has no Prisma relation)
  const riskContractIds = [...new Set(risks.map(r => r.contractId))];
  const riskContracts = riskContractIds.length > 0 ? await prisma.contract.findMany({
    where: { id: { in: riskContractIds } },
    select: { id: true, contractTitle: true },
  }) : [];
  const riskContractMap = new Map(riskContracts.map(c => [c.id, c.contractTitle]));

  const templateContent = `I've detected ${risks.length} risk items in your portfolio:\n\n${risks.map(r => `• ${riskContractMap.get(r.contractId) || 'Contract'}: ${r.description}`).join('\n') || 'No active risk detections. Your portfolio risk profile looks good.'}`;

  const content = risks.length > 0
    ? await enhanceWithAI('Warden', 'proactive risk detection, financial/legal/operational risk analysis, and mitigation recommendations', message, { risks: risks.map(r => ({ ...r, contractTitle: riskContractMap.get(r.contractId) })) }, templateContent)
    : templateContent;

  return {
    content,
    data: { risks },
    actions: risks.length > 0 ? [
      { type: 'navigate', label: 'View Risk Dashboard', payload: { path: '/contigo-lab?tab=risks' } },
    ] : [],
    confidence: 0.9,
  };
}

async function handleClockworkQuery(
  message: string,
  history: any[],
  context: any,
  tenantId: string
): Promise<AgentResponse> {
  const upcomingDeadlines = await prisma.contract.findMany({
    where: {
      tenantId,
      status: { in: ['ACTIVE', 'COMPLETED'] },
      expirationDate: {
        lte: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        gte: new Date(),
      },
    },
    orderBy: { expirationDate: 'asc' },
    take: 5,
  });

  const deadlineData = upcomingDeadlines.map(c => {
    const days = c.expirationDate ? Math.ceil((c.expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
    return { id: c.id, title: c.contractTitle, daysRemaining: days, expirationDate: c.expirationDate, status: c.status, value: (c as any).totalValue };
  });

  const templateContent = `I found ${upcomingDeadlines.length} contracts with upcoming deadlines:\n\n${deadlineData.map(d => `• ${d.title}: ${d.daysRemaining} days remaining`).join('\n') || 'No upcoming deadlines in the next 60 days.'}`;

  const content = upcomingDeadlines.length > 0
    ? await enhanceWithAI('Clockwork', 'deadline management, expiration tracking, and proactive renewal/action recommendations', message, { deadlines: deadlineData }, templateContent)
    : templateContent;

  return {
    content,
    data: { deadlines: upcomingDeadlines },
    actions: upcomingDeadlines.length > 0 ? [
      { type: 'navigate', label: 'View Calendar', payload: { path: '/contigo-lab?tab=calendar' } },
    ] : [],
    confidence: 0.92,
  };
}

async function handleProspectorQuery(
  message: string,
  history: any[],
  context: any,
  tenantId: string
): Promise<AgentResponse> {
  // Prospector: Opportunity discovery — analyze portfolio for hidden value

  const [contracts, opportunities] = await Promise.all([
    prisma.contract.findMany({
      where: { tenantId, status: 'ACTIVE' },
      select: {
        id: true, contractTitle: true, supplierName: true, totalValue: true,
        expirationDate: true, contractType: true, categoryL1: true, category: true,
      },
      take: 100,
    }),
    prisma.opportunityDiscovery.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }).catch(() => [] as any[]),
  ]);

  // Consolidation analysis: group by supplier
  const supplierSpend = new Map<string, { count: number; total: number }>();
  contracts.forEach(c => {
    const key = c.supplierName || 'Unknown';
    const existing = supplierSpend.get(key) || { count: 0, total: 0 };
    existing.count++;
    existing.total += Number(c.totalValue || 0);
    supplierSpend.set(key, existing);
  });

  const dbData = {
    activeContracts: contracts.length,
    supplierBreakdown: Object.fromEntries(
      [...supplierSpend.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 10)
    ),
    opportunities: opportunities.slice(0, 5),
    totalPortfolioValue: contracts.reduce((s, c) => s + Number(c.totalValue || 0), 0),
  };

  const templateContent = `I'm **Prospector**, scanning your portfolio of ${contracts.length} active contracts for hidden opportunities.\n\nTop suppliers by spend:\n${[...supplierSpend.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 5).map(([name, data]) => `• **${name}**: ${data.count} contracts, $${data.total.toLocaleString()}`).join('\n')}`;

  const content = await enhanceWithAI(
    'Prospector',
    'opportunity discovery — finding consolidation opportunities, volume discounts, underutilized contracts, savings potential, and alternative vendors',
    message, dbData, templateContent,
  );

  return {
    content,
    data: dbData,
    actions: [
      { type: 'navigate', label: 'View Opportunities', payload: { path: '/contigo-lab?tab=opportunities' } },
    ],
    confidence: 0.9,
  };
}

// ── Sentinel: Contract validation & completeness checks ───────────────

async function handleSentinelQuery(
  message: string,
  history: any[],
  context: any,
  tenantId: string,
): Promise<AgentResponse> {
  // If a specific contract is in context, validate it
  if (context?.contractId) {
    const contract = await prisma.contract.findUnique({
      where: { id: context.contractId },
      include: { clauses: true },
    });

    if (contract) {
      const issues: string[] = [];
      if (!contract.startDate) issues.push('Missing **start date**');
      if (!contract.expirationDate) issues.push('Missing **expiration date**');
      if (!contract.totalValue || Number(contract.totalValue) === 0) issues.push('Missing or zero **contract value**');
      if (!contract.supplierName) issues.push('Missing **supplier name**');
      if (!contract.clauses || contract.clauses.length === 0) issues.push('No **clauses** extracted');

      const score = Math.round(((5 - issues.length) / 5) * 100);
      return {
        content: `**Sentinel Validation Report** for "${contract.contractTitle}":\n\n` +
          `Completeness score: **${score}%**\n\n` +
          (issues.length > 0
            ? `Issues found:\n${issues.map(i => `• ${i}`).join('\n')}\n\nFix these to improve contract quality.`
            : '✅ All critical fields are populated. Contract looks well-structured.'),
        data: { completenessScore: score, issues },
        actions: [
          { type: 'navigate', label: 'Edit Contract', payload: { path: `/contracts/${contract.id}` } },
        ],
        confidence: 0.92,
      };
    }
  }

  // No contract in context — show aggregate validation stats
  const contracts = await prisma.contract.findMany({
    where: { tenantId, status: 'ACTIVE' },
    select: { id: true, contractTitle: true, startDate: true, expirationDate: true, totalValue: true, supplierName: true },
    take: 100,
  });

  const incomplete = contracts.filter(c => !c.startDate || !c.expirationDate || !c.totalValue || Number(c.totalValue) === 0);

  return {
    content: `I'm **Sentinel**, your contract validation specialist.\n\nI've scanned ${contracts.length} active contracts:\n• ✅ ${contracts.length - incomplete.length} fully validated\n• ⚠️ ${incomplete.length} with missing fields\n\n` +
      (incomplete.length > 0
        ? `Top incomplete contracts:\n${incomplete.slice(0, 5).map(c => `• ${c.contractTitle}`).join('\n')}\n\nOpen a specific contract and mention me to get a detailed validation.`
        : 'All active contracts look great!'),
    data: { total: contracts.length, incomplete: incomplete.length },
    confidence: 0.9,
  };
}

// ── Architect: Workflow design & authoring ─────────────────────────────

async function handleArchitectQuery(
  message: string,
  history: any[],
  context: any,
  tenantId: string,
): Promise<AgentResponse> {
  const lowerMsg = message.toLowerCase();

  // Check for existing workflow templates
  const workflows = await prisma.workflow.findMany({
    where: { tenantId },
    orderBy: { updatedAt: 'desc' },
    take: 5,
  }).catch(() => [] as any[]);

  // Intent detection
  const isCreateRequest = lowerMsg.match(/\b(create|new|design|build|make)\b.*\b(workflow|process|pipeline|automation)\b/i);

  if (isCreateRequest) {
    return {
      content: "I'm **Architect**, your workflow designer. Let's build your workflow!\n\nTo design an effective workflow, tell me:\n1. **Purpose** — What process should this automate?\n2. **Trigger** — What starts the workflow? (e.g., contract upload, deadline, status change)\n3. **Steps** — What actions should happen? (approvals, notifications, escalations)\n4. **Stakeholders** — Who needs to be involved?\n\nI'll generate a workflow definition you can review and activate.",
      actions: [
        { type: 'navigate', label: 'Workflow Templates', payload: { path: '/contigo-lab?tab=workflows' } },
      ],
      confidence: 0.9,
    };
  }

  return {
    content: `I'm **Architect**, your workflow designer. I help you create and manage automated contract workflows.\n\n` +
      (workflows.length > 0
        ? `You have ${workflows.length} workflow template(s):\n${workflows.map((w: any) => `• **${w.name || w.id}** — ${w.status || 'draft'}`).join('\n')}\n\n`
        : 'You don\'t have any workflow templates yet.\n\n') +
      'I can help you:\n• **Design** a new approval workflow\n• **Automate** contract lifecycle stages\n• **Set up** escalation rules\n• **Configure** notification triggers',
    data: { workflows },
    confidence: 0.88,
  };
}

// ── Conductor: Conflict resolution between contract terms ─────────────

async function handleConductorQuery(
  message: string,
  history: any[],
  context: any,
  tenantId: string,
): Promise<AgentResponse> {
  if (context?.contractId) {
    const clauses = await prisma.clause.findMany({
      where: { contractId: context.contractId },
      take: 20,
    });

    const categories = new Map<string, number>();
    clauses.forEach(c => {
      const cat = (c as any).category || 'general';
      categories.set(cat, (categories.get(cat) || 0) + 1);
    });

    const clauseData = {
      clauseCount: clauses.length,
      categories: Object.fromEntries(categories),
      clauses: clauses.slice(0, 15).map(c => ({
        id: c.id,
        title: (c as any).title || (c as any).clauseTitle,
        category: (c as any).category || 'general',
        text: (c as any).text?.slice(0, 300) || (c as any).content?.slice(0, 300),
      })),
    };

    const templateContent = `I'm **Conductor**, analyzing clause relationships in your contract.\n\nFound ${clauses.length} clauses across ${categories.size} categories:\n` +
        Array.from(categories.entries()).map(([cat, count]) => `• **${cat}**: ${count} clause(s)`).join('\n') +
        '\n\nI can identify:\n• Conflicting terms across clauses\n• Redundant provisions\n• Missing standard protections';

    const content = await enhanceWithAI(
      'Conductor',
      'clause conflict detection — finding contradictions, redundancies, gaps, and potential legal risks between contract clauses and provisions',
      message, clauseData, templateContent,
    );

    return {
      content,
      data: { clauseCount: clauses.length, categories: Object.fromEntries(categories) },
      confidence: 0.88,
    };
  }

  return {
    content: "I'm **Conductor**, your conflict resolution specialist. I analyze contract clauses to find contradictions, redundancies, and gaps.\n\nOpen a specific contract and mention me to:\n• **Detect conflicts** between clauses\n• **Find redundancies** in terms\n• **Identify gaps** in coverage\n• **Compare** clause language across contracts",
    confidence: 0.88,
  };
}

// ── Navigator: Onboarding & platform guidance ─────────────────────────

async function handleNavigatorQuery(
  message: string,
  history: any[],
  context: any,
  tenantId: string,
): Promise<AgentResponse> {
  const lowerMsg = message.toLowerCase();

  // Count user's assets to gauge experience level
  const [contractCount, rfxCount] = await Promise.all([
    prisma.contract.count({ where: { tenantId } }),
    prisma.rFxEvent.count({ where: { tenantId } }).catch(() => 0),
  ]);

  // Tailor response based on experience
  const isNewUser = contractCount < 3;

  if (isNewUser) {
    return {
      content: "Welcome! I'm **Navigator**, your onboarding guide. 🧭\n\n" +
        "Here's your quick-start checklist:\n" +
        "1. **Upload a contract** — Drag & drop a PDF or Word document\n" +
        "2. **Review AI extraction** — I'll automatically extract key terms, dates, and clauses\n" +
        "3. **Explore your dashboard** — See contract health scores and upcoming deadlines\n" +
        "4. **Try an agent** — Type `@merchant` to start sourcing, or `@sage` to search contracts\n\n" +
        "Need help with anything specific? Just ask!",
      actions: [
        { type: 'navigate', label: 'Upload Contract', payload: { path: '/contracts?action=upload' } },
        { type: 'navigate', label: 'View Dashboard', payload: { path: '/dashboard' } },
      ],
      confidence: 0.95,
    };
  }

  // Detect help topic
  if (lowerMsg.match(/\b(agent|mention|@)\b/)) {
    return {
      content: "Here's your **agent roster** — mention any agent with `@name`:\n\n" +
        "| Agent | Expertise |\n|-------|----------|\n" +
        "| `@sage` | Search & analysis |\n" +
        "| `@merchant` | RFx procurement |\n" +
        "| `@scout` | Opportunity detection |\n" +
        "| `@vigil` | Compliance monitoring |\n" +
        "| `@warden` | Risk detection |\n" +
        "| `@clockwork` | Deadline management |\n" +
        "| `@sentinel` | Contract validation |\n" +
        "| `@architect` | Workflow design |\n" +
        "| `@builder` | Template generation |\n" +
        "| `@conductor` | Conflict resolution |\n\n" +
        "You can mention multiple agents in one message for cross-functional insights!",
      confidence: 0.95,
    };
  }

  return {
    content: `I'm **Navigator**, your platform guide. You have **${contractCount}** contracts and **${rfxCount}** RFx events.\n\n` +
      "I can help you with:\n• **Feature walkthroughs** — Learn what each module does\n• **Agent introductions** — Meet the AI team (ask me about \"agents\")\n• **Best practices** — Tips for contract management\n• **Troubleshooting** — Fix common issues",
    data: { contractCount, rfxCount },
    confidence: 0.9,
  };
}

// ── Builder: Template generation ──────────────────────────────────────

async function handleBuilderQuery(
  message: string,
  history: any[],
  context: any,
  tenantId: string,
): Promise<AgentResponse> {
  const lowerMsg = message.toLowerCase();

  // Fetch existing templates to avoid duplication
  const templates = await prisma.contractTemplate.findMany({
    where: { tenantId },
    orderBy: { updatedAt: 'desc' },
    take: 5,
  }).catch(() => [] as any[]);

  const isCreateRequest = lowerMsg.match(/\b(create|generate|build|make|new)\b.*\b(template|boilerplate|standard)\b/i);

  if (isCreateRequest) {
    return {
      content: "I'm **Builder**. Let's create a contract template!\n\nTell me:\n1. **Type** — NDA, MSA, SLA, SOW, etc.\n2. **Industry** — Tech, healthcare, finance, etc.\n3. **Key terms** — Any specific clauses or provisions needed?\n\nI'll generate a template with standard protective clauses you can customize.",
      actions: [
        { type: 'navigate', label: 'View Templates', payload: { path: '/templates' } },
      ],
      confidence: 0.9,
    };
  }

  return {
    content: `I'm **Builder**, your template specialist.\n\n` +
      (templates.length > 0
        ? `You have ${templates.length} template(s):\n${templates.map((t: any) => `• **${t.name || t.id}** — ${t.type || 'general'}`).join('\n')}\n\n`
        : 'No templates yet — I can help you create your first!\n\n') +
      'I can:\n• **Generate** contract templates from scratch\n• **Extract** templates from existing contracts\n• **Standardize** clause libraries\n• **Recommend** templates based on your industry',
    data: { templates },
    confidence: 0.88,
  };
}

// ── Memorykeeper: Contract history & version tracking ─────────────────

async function handleMemorykeeperQuery(
  message: string,
  history: any[],
  context: any,
  tenantId: string,
): Promise<AgentResponse> {
  if (context?.contractId) {
    const [contract, artifacts] = await Promise.all([
      prisma.contract.findUnique({
        where: { id: context.contractId },
        select: { id: true, contractTitle: true, status: true, createdAt: true, updatedAt: true },
      }),
      prisma.artifact.findMany({
        where: { contractId: context.contractId, tenantId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    if (contract) {
      const daysSinceCreation = Math.floor((Date.now() - contract.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      return {
        content: `I'm **Memorykeeper**, tracking the history of "${contract.contractTitle}".\n\n` +
          `Created **${daysSinceCreation}** days ago • Status: **${contract.status}**\n\n` +
          (artifacts.length > 0
            ? `**${artifacts.length}** artifacts on record:\n${artifacts.slice(0, 5).map(a => `• ${(a as any).type || 'document'} — ${a.createdAt.toLocaleDateString()}`).join('\n')}`
            : 'No artifacts recorded yet.') +
          '\n\nI can help you:\n• View the full change timeline\n• Compare contract versions\n• Track amendment history',
        data: { contract, artifactCount: artifacts.length },
        actions: [
          { type: 'navigate', label: 'View Contract', payload: { path: `/contracts/${contract.id}` } },
        ],
        confidence: 0.9,
      };
    }
  }

  // Aggregate view
  const recentlyModified = await prisma.contract.findMany({
    where: { tenantId },
    orderBy: { updatedAt: 'desc' },
    take: 5,
    select: { id: true, contractTitle: true, updatedAt: true },
  });

  return {
    content: "I'm **Memorykeeper**, guardian of your contract history. I track every change, version, and transformation.\n\n" +
      (recentlyModified.length > 0
        ? `Recently modified contracts:\n${recentlyModified.map(c => `• **${c.contractTitle}** — updated ${c.updatedAt.toLocaleDateString()}`).join('\n')}\n\n`
        : '') +
      'Open a specific contract and mention me to:\n• View **change history**\n• Compare **versions**\n• Track **amendments**\n• Export **audit trail**',
    data: { recentlyModified },
    confidence: 0.88,
  };
}

// ── Orchestrator: Workflow execution status ────────────────────────────

async function handleOrchestratorQuery(
  message: string,
  history: any[],
  context: any,
  tenantId: string,
): Promise<AgentResponse> {
  // Check for active workflow instances
  const activeWorkflows = await prisma.workflowExecution.findMany({
    where: { tenantId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
    orderBy: { updatedAt: 'desc' },
    take: 5,
  }).catch(() => [] as any[]);

  const pendingStepCount = await prisma.workflowStepExecution.count({
    where: {
      status: 'PENDING',
      execution: { tenantId },
    },
  }).catch(() => 0);

  return {
    content: `I'm **Orchestrator**, managing your active workflows.\n\n` +
      `**${activeWorkflows.length}** active workflow(s) • **${pendingStepCount}** pending approval(s)\n\n` +
      (activeWorkflows.length > 0
        ? `Active workflows:\n${activeWorkflows.map((w: any) => `• **${w.name || w.templateId || w.id}** — ${w.status}`).join('\n')}\n\n`
        : 'No active workflows right now.\n\n') +
      (pendingStepCount > 0
        ? `⏳ Pending approvals: ${pendingStepCount} — these need your attention.\n\n`
        : '') +
      'I can:\n• **Monitor** workflow progress\n• **Escalate** stalled approvals\n• **Re-route** blocked workflows\n• **Report** on execution metrics',
    data: { activeWorkflows, pendingApprovals: pendingStepCount },
    actions: activeWorkflows.length > 0 ? [
      { type: 'navigate', label: 'View Workflows', payload: { path: '/contigo-lab?tab=workflows' } },
    ] : [],
    confidence: 0.88,
  };
}

// ── Synthesizer: Data aggregation & reporting ─────────────────────────

async function handleSynthesizerQuery(
  message: string,
  history: any[],
  context: any,
  tenantId: string,
): Promise<AgentResponse> {
  // Gather portfolio-level stats
  const [totalContracts, activeContracts, totalValue, expiringContracts] = await Promise.all([
    prisma.contract.count({ where: { tenantId } }),
    prisma.contract.count({ where: { tenantId, status: 'ACTIVE' } }),
    prisma.contract.aggregate({
      where: { tenantId },
      _sum: { totalValue: true },
    }),
    prisma.contract.count({
      where: {
        tenantId,
        status: 'ACTIVE',
        expirationDate: {
          lte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          gte: new Date(),
        },
      },
    }),
  ]);

  const totalVal = Number(totalValue._sum?.totalValue || 0);
  const formattedValue = totalVal > 1_000_000
    ? `$${(totalVal / 1_000_000).toFixed(1)}M`
    : totalVal > 1_000
      ? `$${(totalVal / 1_000).toFixed(0)}K`
      : `$${totalVal.toFixed(0)}`;

  const portfolioData = { totalContracts, activeContracts, totalValue: totalVal, formattedValue, expiringContracts };

  const templateContent = `I'm **Synthesizer**, your data analyst. Here's your portfolio snapshot:\n\n` +
      `| Metric | Value |\n|--------|-------|\n` +
      `| Total contracts | **${totalContracts}** |\n` +
      `| Active | **${activeContracts}** |\n` +
      `| Portfolio value | **${formattedValue}** |\n` +
      `| Expiring (90 days) | **${expiringContracts}** |\n`;

  const content = await enhanceWithAI(
    'Synthesizer',
    'portfolio data analysis and reporting — generating insights about spend distribution, risk concentration, contract health trends, and actionable recommendations',
    message, portfolioData, templateContent,
  );

  return {
    content,
    data: { totalContracts, activeContracts, totalValue: totalVal, expiringContracts },
    confidence: 0.92,
  };
}

async function handleGenericAgentQuery(
  agentId: string,
  message: string,
  history: any[],
  context: any
): Promise<AgentResponse> {
  const codename = AGENT_CODENAMES[agentId]?.name || 'Agent';
  
  return {
    content: `I'm ${codename}. I've received your message and will process it according to my capabilities. How can I help you today?`,
    confidence: 0.8,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function parseMentions(message: string): string[] {
  const mentionRegex = /@\w+/g;
  return message.match(mentionRegex) || [];
}

async function buildEnrichedContext(context: any, tenantId: string): Promise<any> {
  const enriched: any = { ...context };

  // ── Try deep enrichment via AgentContextEnrichmentService ──────────
  if (context?.contractId) {
    try {
      const { agentContextEnrichmentService } = await import('@repo/data-orchestration');
      const deepCtx = await withTimeout(
        agentContextEnrichmentService.enrichContext(context.contractId, tenantId, {
          includeArtifacts: true,
          similarContractLimit: 3,
          includeGraphInsights: false,   // skip Neo4j to stay fast
          includeSemanticContext: false,  // skip RAG for the @mention path
        }),
        null, // fallback on timeout
        5_000,
        'context-enrichment',
      );

      if (deepCtx) {
        enriched.contractDetails = deepCtx.contract;
        enriched.artifacts = deepCtx.artifacts;
        enriched.similarContracts = deepCtx.similarContracts;
        enriched.patterns = deepCtx.patterns;
        enriched._enrichmentMeta = deepCtx._meta;
        log.info({ contractId: context.contractId, durationMs: deepCtx._meta?.enrichmentTimeMs }, 'Deep context enrichment succeeded');
        // Return early — we already have everything
        if (context.rfxId) {
          const rfx = await prisma.rFxEvent.findUnique({ where: { id: context.rfxId } });
          enriched.rfxDetails = rfx;
        }
        return enriched;
      }
    } catch (err) {
      log.warn({ err, contractId: context.contractId }, 'Deep context enrichment failed, falling back to basic');
    }

    // Fallback: basic enrichment
    const contract = await prisma.contract.findUnique({
      where: { id: context.contractId },
      include: {
        clauses: { take: 10 },
      },
    });
    enriched.contractDetails = contract;
  }

  if (context?.rfxId) {
    const rfx = await prisma.rFxEvent.findUnique({
      where: { id: context.rfxId },
    });
    enriched.rfxDetails = rfx;
  }

  return enriched;
}

async function performContractSearch(
  query: string,
  tenantId: string,
  contractId?: string
): Promise<{ count: number; summary: string; results: any[]; confidence: number }> {
  // ── Try hybrid search (semantic + keyword via RAG) first ──────────
  try {
    if (hasAIClientConfig()) {
      const ragResults = await withTimeout(
        hybridSearch(query, {
          mode: 'hybrid',
          k: 10,
          minScore: 0.3,
          filters: {
            tenantId,
            ...(contractId ? { contractIds: [contractId] } : {}),
          },
          rerank: true,
          expandQuery: true,
        }),
        null,
        10_000,
        'hybrid-search',
      );

      if (ragResults && ragResults.length > 0) {
        return {
          count: ragResults.length,
          summary: ragResults.map(r =>
            `• **${r.contractName}** (${r.status || 'N/A'}) — relevance: ${(r.score * 100).toFixed(0)}%${r.highlights?.length ? `\n  _"${r.highlights[0]}"_` : ''}`
          ).join('\n'),
          results: ragResults.map(r => ({
            id: r.contractId,
            contractId: r.contractId,
            contractName: r.contractName,
            contractTitle: r.contractName,
            supplierName: r.supplierName,
            status: r.status,
            totalValue: r.totalValue,
            score: r.score,
            matchType: r.matchType,
            text: r.text?.slice(0, 300),
          })),
          confidence: Math.max(...ragResults.map(r => r.score)),
        };
      }
    }
  } catch (err) {
    log.warn({ err, query }, 'Hybrid search failed, falling back to database search');
  }

  // ── Fallback: basic Prisma text search ────────────────────────────
  const whereClause: any = { tenantId };
  if (contractId) {
    whereClause.id = contractId;
  }

  const contracts = await prisma.contract.findMany({
    where: {
      ...whereClause,
      OR: [
        { contractTitle: { contains: query, mode: 'insensitive' } },
        { supplierName: { contains: query, mode: 'insensitive' } },
      ],
    },
    take: 10,
  });

  return {
    count: contracts.length,
    summary: contracts.map(c => `• **${c.contractTitle}** (${c.status})`).join('\n'),
    results: contracts,
    confidence: contracts.length > 0 ? 0.75 : 0.3,
  };
}
