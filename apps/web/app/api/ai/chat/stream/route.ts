/**
 * Enhanced Streaming AI Chat API v2 — Agentic Function Calling
 * 
 * POST /api/ai/chat/stream — Real-time streaming with:
 * - OpenAI function calling (tool use) for autonomous actions
 * - 18 tools: search, details, analytics, workflows, CRUD, navigation
 * - Multi-step tool chaining (up to 3 iterations)
 * - Semantic cache integration
 * - Episodic memory retrieval
 * - Parallel RAG search
 * - Dynamic confidence calculation
 * - Model failover (GPT-4o → GPT-4o-mini → Claude 3 Haiku → Sonnet)
 * - Role-based action permissions
 * 
 * SSE Event Types sent to client:
 *   metadata   — sources, confidence, model info, suggested actions
 *   tool_start — { toolName }  (tool execution beginning)
 *   tool_done  — { toolName, result summary, navigation }
 *   content    — { content: string }  (streamed tokens)
 *   done       — { totalTokens, confidence, toolsUsed, model }
 *   error      — { error: string }
 * 
 * @version 2.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/prisma';
import { parallelMultiQueryRAG } from '@/lib/rag/parallel-rag.service';
import { hybridSearch } from '@/lib/rag/advanced-rag.service';
import { semanticCache } from '@/lib/ai/semantic-cache.service';
import { calculateDynamicConfidence } from '@/lib/ai/confidence-calibration';
import { retrieveRelevantMemories, storeMemory } from '@/lib/ai/episodic-memory-integration';
import { STREAMING_TOOLS, executeTool, type ToolResult } from '@/lib/ai/streaming-tools';
import { withAuthApiHandler, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';
import { allocateBudget, getBudgetStats } from '@/lib/ai/token-budget';
import { shouldUseAgent, executeWithAgent } from '@/lib/ai/agent-integration';
import { routeToModel, recordAICost, estimateTokenCost, type TaskType } from '@/lib/ai/model-router.service';
import { shouldUseRAG } from '@/lib/ai/chat/response-builder';
import { getLearningContext, formatLearningContextForPrompt } from '@contigo/agents/learning-context';

// ─── Clients ────────────────────────────────────────────────────────────

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

// ─── Model Failover Chain ───────────────────────────────────────────────

interface ModelConfig {
  provider: 'openai' | 'anthropic';
  model: string;
  priority: number;
}

// Build failover chain dynamically based on available API keys
const MODEL_FAILOVER_CHAIN: ModelConfig[] = [
  { provider: 'openai', model: process.env.OPENAI_MODEL || 'gpt-4o-mini', priority: 1 },
  { provider: 'openai', model: 'gpt-4o', priority: 2 },
  // Only include Anthropic models if API key is configured
  ...(process.env.ANTHROPIC_API_KEY ? [
    { provider: 'anthropic' as const, model: 'claude-3-haiku-20240307', priority: 3 },
    { provider: 'anthropic' as const, model: 'claude-3-sonnet-20240229', priority: 4 },
  ] : []),
];

// Log available models at startup
if (typeof window === 'undefined') {
  console.log(`[AI Chat Stream] Available models: ${MODEL_FAILOVER_CHAIN.map(c => `${c.provider}/${c.model}`).join(', ')}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('[AI Chat Stream] Anthropic failover disabled (ANTHROPIC_API_KEY not set)');
  }
}

// ─── Role-based tool permissions ────────────────────────────────────────

const WRITE_TOOLS = new Set([
  'start_workflow',
  'approve_or_reject_step',
  'create_workflow',
  'cancel_workflow',
  'assign_approver',
  'escalate_workflow',
  'create_contract',
  'update_contract',
]);

const ADMIN_TOOLS = new Set<string>([
  // Future: tools that require admin role
]);

function canUseTool(toolName: string, userRole: string): boolean {
  if (ADMIN_TOOLS.has(toolName) && userRole !== 'ADMIN') return false;
  if (WRITE_TOOLS.has(toolName) && userRole === 'VIEWER') return false;
  return true;
}

// Maximum tool-calling iterations before forcing a final response
const MAX_TOOL_ITERATIONS = 3;

// ─── Smart Model Routing ────────────────────────────────────────────────

type QueryComplexity = 'simple' | 'moderate' | 'complex';

function detectQueryComplexity(message: string): QueryComplexity {
  const q = message.toLowerCase().trim();
  const wordCount = message.split(/\s+/).length;

  // Simple: greetings, confirmations, trivial lookups
  const simplePatterns = [
    /^(hi|hello|hey|thanks|thank you|ok|okay|yes|no|bye|sup|yo)\b/,
    /^what time/,
    /^(who|what) (is|are) (you|contigo|this)/,
    /^(show|go to|open|navigate)/,
  ];
  if (simplePatterns.some(p => p.test(q)) && wordCount <= 8) return 'simple';

  // Complex: multi-part analysis, comparisons, legal reasoning, strategy
  const complexIndicators = [
    'compare', 'analyze', 'summarize all', 'across all', 'trend',
    'risk assessment', 'compliance audit', 'negotiate', 'strategy',
    'implications', 'recommend', 'evaluate', 'what should',
    'how can we', 'optimize', 'consolidate', 'benchmark',
    'clause by clause', 'draft a', 'create a report', 'full analysis',
  ];
  const complexCount = complexIndicators.filter(k => q.includes(k)).length;
  if (complexCount >= 1 || wordCount > 50) return 'complex';

  return 'moderate';
}

function buildModelChain(complexity: QueryComplexity, query?: string): ModelConfig[] {
  const baseModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  // Use smart model router for dynamic selection
  if (query) {
    try {
      const taskTypeMap: Record<QueryComplexity, TaskType> = {
        simple: 'simple_qa',
        moderate: 'extraction',
        complex: 'analysis',
      };
      const routing = routeToModel({
        query,
        taskType: taskTypeMap[complexity],
        inputTokens: Math.round(query.length / 4),
      });
      // Build chain with routed model first, then fallbacks
      const chain: ModelConfig[] = [
        { provider: 'openai', model: routing.model, priority: 1 },
      ];
      if (routing.model !== 'gpt-4o') {
        chain.push({ provider: 'openai', model: 'gpt-4o', priority: 2 });
      }
      if (routing.model !== baseModel && routing.model !== 'gpt-4o') {
        chain.push({ provider: 'openai', model: baseModel, priority: 3 });
      }
      if (process.env.ANTHROPIC_API_KEY) {
        chain.push({ provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', priority: chain.length + 1 });
      }
      return chain;
    } catch {
      // Fall through to default logic
    }
  }

  if (complexity === 'complex') {
    // Route complex queries to gpt-4o first, then fall back
    return [
      { provider: 'openai', model: 'gpt-4o', priority: 1 },
      { provider: 'openai', model: baseModel, priority: 2 },
      ...(process.env.ANTHROPIC_API_KEY ? [
        { provider: 'anthropic' as const, model: 'claude-3-5-sonnet-20241022', priority: 3 },
      ] : []),
    ];
  }

  // Simple & moderate: use the default chain
  return MODEL_FAILOVER_CHAIN;
}

// ─── Main Handler ───────────────────────────────────────────────────────

export const POST = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const { tenantId, userId, userRole } = ctx;
  const { message, conversationHistory = [], context = {} } = await request.json();

  if (!message) {
    return new NextResponse(JSON.stringify({ error: 'Message is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // P0: Input length validation — prevent cost DoS via oversized messages
  const MAX_MESSAGE_LENGTH = 50_000;
  const MAX_HISTORY_ITEMS = 20;
  if (typeof message === 'string' && message.length > MAX_MESSAGE_LENGTH) {
    return new NextResponse(JSON.stringify({ error: `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (Array.isArray(conversationHistory) && conversationHistory.length > MAX_HISTORY_ITEMS) {
    conversationHistory.length = MAX_HISTORY_ITEMS;
  }

  if (!process.env.OPENAI_API_KEY) {
    return new NextResponse(JSON.stringify({ error: 'OpenAI API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 1 — SEMANTIC CACHE CHECK
  // ═══════════════════════════════════════════════════════════════════════

  const cached = await semanticCache.get(message, tenantId);
  if (cached) {
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'metadata',
          sources: cached.sources,
          cached: true,
          confidence: cached.metadata.confidence,
          suggestedActions: [
            { label: '🔄 Refresh', action: 'refresh-query' },
            { label: '📋 Browse Contracts', action: 'navigate:/contracts' },
          ],
        })}\n\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', content: cached.content })}\n\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', done: true, cached: true })}\n\n`));
        controller.close();
      },
    });

    return new NextResponse(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 2 — PARALLEL CONTEXT GATHERING (RAG + Episodic Memory)
  // ═══════════════════════════════════════════════════════════════════════

  const contextContractId = context?.contractId as string | undefined;

  // Wrap RAG calls with a timeout to prevent hanging when OpenAI is unavailable (quota/auth)
  const withTimeout = <T>(promise: Promise<T>, fallback: T, timeoutMs = 15_000): Promise<T> =>
    Promise.race([
      promise,
      new Promise<T>((resolve) => setTimeout(() => {
        console.warn('[Stream v2] RAG/memory call timed out after', timeoutMs, 'ms');
        resolve(fallback);
      }, timeoutMs)),
    ]);

  const emptyRag = { results: [], queryVariations: [], timingsMs: { total: 0, hyde: 0, expansion: 0, search: 0, fusion: 0 } };

  const [ragResults, contractScopedResults, memories] = await Promise.all([
    shouldUseRAG(message)
      ? withTimeout(parallelMultiQueryRAG(message, { tenantId, k: 7 }), emptyRag)
      : Promise.resolve(emptyRag),
    // When on a specific contract page, also do a contract-scoped search for higher relevance
    contextContractId && shouldUseRAG(message)
      ? withTimeout(hybridSearch(message, {
          mode: 'hybrid',
          k: 5,
          rerank: true,
          expandQuery: true,
          filters: { tenantId, contractIds: [contextContractId] },
        }).catch(() => []), [])
      : Promise.resolve([]),
    withTimeout(retrieveRelevantMemories(userId, tenantId, message, conversationHistory, {
      maxMemories: 3,
      types: ['preference', 'fact', 'decision'],
    }), []),
  ]);

  // ── Cross-conversation learning context (#6) ──────────────────────────
  let learningContextStr = '';
  try {
    const learningCtx = await withTimeout(getLearningContext(tenantId), {
      tenantId,
      correctionPatterns: [],
      historicalPatterns: [],
      qualityThresholds: {},
      builtAt: new Date(),
    } as any);
    learningContextStr = formatLearningContextForPrompt(learningCtx);
  } catch {
    // Learning context unavailable — continue without it
  }

  const searchResults = ragResults.results || [];
  const ragSources = searchResults.map(r => r.contractName);

  let ragContext = '';

  // Prioritize contract-scoped results when available
  if (contractScopedResults.length > 0) {
    ragContext += `\n\n**Contract-Specific Information (${contractScopedResults.length} matches):**\n${contractScopedResults
      .map((r, i) => {
        const label = r.metadata?.heading || r.metadata?.section || `Section ${i + 1}`;
        return `[${i + 1}] **${label}** (${Math.round((r.score || 0) * 100)}% match):\n> ${r.text.slice(0, 500)}...`;
      })
      .join('\n\n')}`;
  }

  if (searchResults.length > 0) {
    ragContext += `\n\n**Relevant Contract Information (${searchResults.length} matches):**\n${searchResults
      .map((r, i) => `[${i + 1}] **[${r.contractName}](/contracts/${r.contractId})** (${Math.round(r.score * 100)}% match):\n> ${r.text.slice(0, 400)}...`)
      .join('\n\n')}`;
  }

  let memoryContext = '';
  if (memories.length > 0) {
    memoryContext = `\n\n**Past Interactions:**\n${memories.map(m => `- [${m.type}] ${m.content.slice(0, 200)}`).join('\n')}`;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 3 — SYSTEM PROMPT (Agentic)
  // ═══════════════════════════════════════════════════════════════════════

  const systemPrompt = `You are ConTigo AI, an autonomous contract management assistant.

**Capabilities:**
You have access to tools that let you search contracts, view details, analyze spend & risk, fully manage workflows (start/approve/reject/cancel/escalate/assign/create/check status/suggest), create and update contracts, check compliance, retrieve AI intelligence insights (health scores, risk insights, portfolio analytics), navigate the user to any page, query background AI agent findings (risk alerts, compliance issues, learning patterns), run multi-agent debates on contracts (getting specialist perspectives from legal/pricing/compliance/risk/operations agents), and record user feedback on response quality.

**When to use tools:**
- ALWAYS use a tool when the user asks for data, actions, or navigation — do NOT guess or make up data.
- Call multiple tools if the question requires cross-referencing (e.g., "find expiring contracts from Acme" → search_contracts + list_expiring_contracts).
- For navigation requests ("go to dashboard", "show me analytics"), use navigate_to_page.
- For intelligence/insights ("health score", "portfolio health", "AI insights", "what needs attention", "intelligence"), use get_intelligence_insights.
- For workflow requests, use the appropriate workflow tool:
  • "start approval" / "kick off review" → start_workflow
  • "what needs my approval" / "pending tasks" → get_pending_approvals
  • "approve" / "reject" → approve_or_reject_step
  • "status of the workflow" / "where is the approval" → get_workflow_status
  • "cancel the workflow" / "stop the approval" → cancel_workflow
  • "assign Sarah to the review" / "delegate" → assign_approver
  • "escalate" / "this is stuck" → escalate_workflow
  • "which workflow should I use" / "suggest a workflow" → suggest_workflow
  • "create a new approval workflow" → create_workflow
  • "list workflows" / "show templates" → list_workflows
- For intelligence navigation ("show me the knowledge graph", "open health scores", "negotiation co-pilot"), use navigate_to_page with intelligence targets.
- For agent insights ("what have the agents found", "proactive alerts", "what should I know"), use get_agent_insights.
- For multi-agent debate ("second opinion", "multi-agent analysis", "comprehensive review"), use get_agent_debate with the contract ID.
- For user feedback ("good answer", "thumbs up", "bad response"), use rate_response.

**Response rules:**
1. Be concise and actionable.
2. Use markdown: headers, bullets, bold for key values, tables when appropriate.
3. Link to contracts: [Contract Name](/contracts/ID)
4. After tool results, summarize findings with specific numbers and recommendations.
5. If a tool returns a navigation URL, mention it so the user can click through.
6. Current user role: ${userRole}. Respect permissions.
7. If you used get_agent_insights, present findings organized by severity with actionable next steps.
8. If you used get_agent_debate, present each agent's perspective, highlight key conflicts and the consensus, then recommend action.
9. When users give feedback (positive/negative), acknowledge it warmly and adjust your approach.

${ragContext}
${memoryContext}
${learningContextStr ? `\n**Learned Patterns (from past interactions):**\n${learningContextStr}` : ''}`;

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 3.1 — AGENT PERSONA @MENTION DETECTION
  // ═══════════════════════════════════════════════════════════════════════

  let finalSystemPrompt = systemPrompt;
  let finalMessage = message;

  try {
    // @ts-ignore
    const { extractMention } = await import('@contigo/workers/agents/agent-personas');
    const mention = extractMention(message);
    if (mention) {
      // Inject the persona's system prompt overlay
      finalSystemPrompt += `\n\n**ACTIVE PERSONA — ${mention.persona.displayName} ${mention.persona.avatar}:**\n${mention.persona.systemPromptOverlay}\n\nThe user addressed you as @${mention.handle}. Respond in this persona's voice and expertise area. Focus on ${mention.persona.expertise.join(', ')}.`;
      finalMessage = mention.cleanMessage || message;
    }
  } catch {
    // Persona module unavailable — continue with default prompt
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 3.5 — AGENT DECISION & TOKEN BUDGET
  // ═══════════════════════════════════════════════════════════════════════
  
  // Check if query should use ReAct agent for complex multi-step reasoning
  const agentDecision = shouldUseAgent(message);
  
  if (agentDecision.useAgent && agentDecision.agentType === 'react') {
    // Route to ReAct agent for complex queries
    const agentResponse = await executeWithAgent({
      query: message,
      tenantId,
      userId,
      conversationHistory,
    });
    
    if (agentResponse.agentUsed && agentResponse.response) {
      // Stream agent response with plan visualization (#5)
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        start(controller) {
          // Emit plan event so frontend can show reasoning steps
          if (agentResponse.steps && agentResponse.steps.length > 0) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'plan',
              steps: agentResponse.steps,
              reasoning: agentResponse.reasoning,
              agentType: 'react',
            })}\n\n`));
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'metadata',
            sources: ragSources,
            agentUsed: true,
            agentSteps: agentResponse.steps,
            toolsUsed: agentResponse.toolsUsed,
            reasoning: agentResponse.reasoning,
            confidence: agentResponse.confidence,
          })}\n\n`));
          
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'content',
            content: agentResponse.response,
          })}\n\n`));
          
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'done',
            done: true,
            agentUsed: true,
            processingTimeMs: agentResponse.processingTimeMs,
          })}\n\n`));
          
          controller.close();
        },
      });
      
      return new NextResponse(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }
  }
  
  // Apply token budget management to prevent context overflow
  const budgetAllocation = allocateBudget(
    process.env.OPENAI_MODEL || 'gpt-4o-mini',
    {
      systemPrompt: finalSystemPrompt,
      ragContext,
      conversationHistory: conversationHistory.slice(-10).map((msg: { role: string; content: string }) => ({
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content,
      })),
      memoryContext,
    }
  );
  
  const budgetStats = getBudgetStats(budgetAllocation.totalUsed, process.env.OPENAI_MODEL || 'gpt-4o-mini');
  if (budgetStats.status === 'warning') {
    console.warn(`[Stream v2] Token budget at ${budgetStats.percentage}% - approaching limit`);
  }

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: budgetAllocation.systemPrompt.content || finalSystemPrompt },
    ...JSON.parse(budgetAllocation.conversationHistory.content || '[]').filter((m: { role: string }) => m.role !== 'system'),
    { role: 'user', content: finalMessage },
  ];

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 4 — STREAMING RESPONSE WITH AGENTIC TOOL CALLING
  // ═══════════════════════════════════════════════════════════════════════

  const encoder = new TextEncoder();
  let fullContent = '';
  let usedModel = '';
  let usedProvider = '';
  const toolsUsed: string[] = [];
  const allToolResults: ToolResult[] = [];
  const allSuggestedActions: Array<{ label: string; action: string }> = [];

  let cancelled = false;

  const readable = new ReadableStream({
    cancel() {
      // Client disconnected — signal upstream work to stop
      cancelled = true;
    },
    async start(controller) {
      try {
        // ── Send initial metadata ─────────────────────────────────────
        const initialConfidence = calculateDynamicConfidence(
          searchResults.map(r => ({ score: r.score, matchType: r.matchType, sources: r.sources })),
          '',
          message,
        );

        const firstResult = searchResults[0];
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'metadata',
          sources: ragSources,
          confidence: initialConfidence.confidence,
          confidenceTier: initialConfidence.tier,
          queryVariations: ragResults.queryVariations?.slice(0, 3),
          memoriesUsed: memories.length,
          toolsAvailable: STREAMING_TOOLS.length,
          suggestedActions: firstResult
            ? [
                { label: '📄 View Contract', action: `navigate:/contracts/${firstResult.contractId}` },
                { label: '🔍 Search More', action: 'search-contracts' },
                { label: '📊 Analytics', action: 'navigate:/analytics' },
              ]
            : [
                { label: '📋 Browse Contracts', action: 'navigate:/contracts' },
                { label: '📊 View Dashboard', action: 'navigate:/dashboard' },
              ],
        })}\n\n`));

        // ── Smart model routing based on query complexity ──────────
        const queryComplexity = detectQueryComplexity(message);
        const modelChain = buildModelChain(queryComplexity, message);

        // ── Agentic loop with tool calling ────────────────────────────
        let iteration = 0;

        while (iteration < MAX_TOOL_ITERATIONS && !cancelled) {
          iteration++;

          // Try models with true token-level streaming
          let assistantMessage: OpenAI.Chat.Completions.ChatCompletionMessage | null = null;

          for (const config of modelChain) {
            if (config.provider === 'anthropic' && !anthropic) continue;

            try {
              if (config.provider === 'openai') {
                // ── True token-level streaming with tool support ──────
                const stream = await openai.chat.completions.create({
                  model: config.model,
                  messages,
                  tools: STREAMING_TOOLS,
                  tool_choice: 'auto',
                  temperature: 0.3,
                  max_tokens: 2000,
                  stream: true,
                }, { signal: AbortSignal.timeout(30_000) });

                usedModel = config.model;
                usedProvider = 'openai';

                // Accumulate streamed content and tool-call deltas
                let streamedContent = '';
                const accToolCalls = new Map<number, {
                  id: string;
                  type: string;
                  function: { name: string; arguments: string };
                }>();

                for await (const chunk of stream) {
                  if (cancelled) break;
                  const delta = chunk.choices[0]?.delta;
                  if (!delta) continue;

                  // Forward content tokens to client in real-time
                  if (delta.content) {
                    streamedContent += delta.content;
                    fullContent += delta.content;
                    controller.enqueue(encoder.encode(
                      `data: ${JSON.stringify({ type: 'content', content: delta.content })}\n\n`
                    ));
                  }

                  // Accumulate tool-call deltas (streamed piece by piece)
                  if (delta.tool_calls) {
                    for (const tc of delta.tool_calls) {
                      const existing = accToolCalls.get(tc.index);
                      if (!existing) {
                        accToolCalls.set(tc.index, {
                          id: tc.id || '',
                          type: (tc.type as string) || 'function',
                          function: {
                            name: tc.function?.name || '',
                            arguments: tc.function?.arguments || '',
                          },
                        });
                      } else {
                        if (tc.function?.arguments) existing.function.arguments += tc.function.arguments;
                        if (tc.function?.name) existing.function.name += tc.function.name;
                        if (tc.id) existing.id = tc.id;
                      }
                    }
                  }
                }

                // Build assistantMessage from accumulated stream data
                if (accToolCalls.size > 0) {
                  assistantMessage = {
                    role: 'assistant',
                    content: streamedContent || null,
                    tool_calls: Array.from(accToolCalls.values()).map(tc => ({
                      id: tc.id,
                      type: 'function' as const,
                      function: { name: tc.function.name, arguments: tc.function.arguments },
                    })),
                    refusal: null,
                  } as OpenAI.Chat.Completions.ChatCompletionMessage;
                } else {
                  // Content already streamed to client — no tool calls
                  assistantMessage = null;
                }
                break;
              } else if (config.provider === 'anthropic' && anthropic) {
                // Anthropic fallback — true streaming, content-only (no tool calling)
                const anthropicMessages = conversationHistory.slice(-10).map((msg: { role: string; content: string }) => ({
                  role: msg.role === 'assistant' ? 'assistant' as const : 'user' as const,
                  content: msg.content,
                }));
                anthropicMessages.push({ role: 'user' as const, content: finalMessage });

                const anthropicStream = anthropic.messages.stream({
                  model: config.model,
                  max_tokens: 2000,
                  system: finalSystemPrompt,
                  messages: anthropicMessages,
                }, { signal: AbortSignal.timeout(30_000) });

                usedModel = config.model;
                usedProvider = 'anthropic';

                // Stream Anthropic tokens in real-time
                for await (const event of anthropicStream) {
                  if (cancelled) break;
                  if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                    const token = event.delta.text;
                    fullContent += token;
                    controller.enqueue(encoder.encode(
                      `data: ${JSON.stringify({ type: 'content', content: token })}\n\n`
                    ));
                  }
                }
                iteration = MAX_TOOL_ITERATIONS; // Exit agentic loop
                assistantMessage = null;
                break;
              }
            } catch (error) {
              const errMsg = error instanceof Error ? error.message : String(error);
              console.warn(`[Stream v2] ${config.provider}/${config.model} failed:`, errMsg);
              
              // FIX: Fail-fast on quota/auth errors — no point trying other models
              // with the same API key. Prevents cascading 30s timeouts.
              const isQuotaOrAuthError = errMsg.includes('429') || 
                errMsg.includes('quota') || 
                errMsg.includes('billing') ||
                errMsg.includes('401') ||
                errMsg.includes('authentication');
              if (isQuotaOrAuthError) {
                // Skip remaining models from the same provider
                const failedProvider = config.provider;
                // Send error event to client immediately
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'error',
                  error: `AI service temporarily unavailable (${failedProvider} rate limit). Please try again later.`,
                  done: true,
                })}\n\n`));
                controller.close();
                return;
              }
              continue;
            }
          }

          if (!assistantMessage) break; // Content already streamed or all models failed

          // ── Check if model wants to call tools ─────────────────────
          const toolCalls = assistantMessage.tool_calls;

          if (!toolCalls || toolCalls.length === 0) {
            // Content already streamed in real-time — done
            break;
          }

          // ── Execute tool calls in parallel ─────────────────────────
          messages.push({
            role: 'assistant',
            content: assistantMessage.content || null,
            tool_calls: toolCalls,
          } as OpenAI.Chat.Completions.ChatCompletionMessageParam);

          const toolPromises = toolCalls.map(async (tc) => {
            const toolName = tc.function.name;
            let args: Record<string, unknown>;
            try {
              args = JSON.parse(tc.function.arguments);
            } catch {
              args = {};
            }

            // Permission check
            if (!canUseTool(toolName, userRole ?? '')) {
              return {
                toolCallId: tc.id,
                result: {
                  toolName,
                  success: false,
                  data: null,
                  error: `Permission denied: ${userRole} cannot use ${toolName}`,
                  executionTimeMs: 0,
                } as ToolResult,
              };
            }

            // Notify client — tool starting
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'tool_start',
              toolName,
              args: Object.fromEntries(Object.entries(args).slice(0, 5)),
            })}\n\n`));

            const result = await executeTool(toolName, args, tenantId, userId);

            // Emit tool preview with partial data for streaming UX (#9)
            if (result.success && result.data) {
              const preview = buildToolPreview(result);
              if (preview) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'tool_preview',
                  toolName,
                  preview,
                })}\n\n`));
              }
            }

            // Notify client — tool done
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'tool_done',
              toolName,
              success: result.success,
              summary: summarizeToolResult(result),
              navigation: result.navigation,
              suggestedActions: result.suggestedActions,
              executionTimeMs: result.executionTimeMs,
            })}\n\n`));

            return { toolCallId: tc.id, result };
          });

          const toolResponses = await Promise.all(toolPromises);

          for (const { result } of toolResponses) {
            toolsUsed.push(result.toolName);
            allToolResults.push(result);
            if (result.suggestedActions) allSuggestedActions.push(...result.suggestedActions);
          }

          // Add tool results to messages
          for (const { toolCallId, result } of toolResponses) {
            messages.push({
              role: 'tool',
              tool_call_id: toolCallId,
              content: JSON.stringify(result.data || { error: result.error }),
            } as OpenAI.Chat.Completions.ChatCompletionMessageParam);
          }

          // Continue loop — model will see results and decide next
        }

        // ═══════════════════════════════════════════════════════════════
        // STEP 5 — POST-PROCESSING (Self-Critique, Cache, Memory, Done)
        // ═══════════════════════════════════════════════════════════════

        // ── Self-critique (#4): Quick quality check on generated response ──
        let selfCritiqueScore = 1.0;
        let selfCritiqueNote = '';
        if (fullContent.length > 50 && searchResults.length > 0) {
          try {
            // Check if response is grounded in RAG context
            const ragTexts = searchResults.map(r => r.text.toLowerCase()).join(' ');
            const responseWords = fullContent.toLowerCase().split(/\s+/).filter(w => w.length > 4);
            const groundedWords = responseWords.filter(w => ragTexts.includes(w));
            const groundingRatio = responseWords.length > 0 ? groundedWords.length / responseWords.length : 0;

            if (groundingRatio < 0.1 && !allToolResults.some(r => r.success)) {
              selfCritiqueScore = 0.5;
              selfCritiqueNote = 'Response may not be fully grounded in contract data';
            } else if (groundingRatio < 0.3) {
              selfCritiqueScore = 0.75;
              selfCritiqueNote = 'Partially grounded — some claims may need verification';
            } else {
              selfCritiqueScore = 1.0;
              selfCritiqueNote = 'Well-grounded in source data';
            }

            // Check for hallucination indicators
            const hallucinationPatterns = ['I believe', 'I think', 'probably', 'it seems like', 'I assume'];
            const hasHedging = hallucinationPatterns.some(p => fullContent.toLowerCase().includes(p));
            if (hasHedging && selfCritiqueScore > 0.6) {
              selfCritiqueScore -= 0.1;
              selfCritiqueNote += '. Contains hedging language';
            }
          } catch {
            // Self-critique is non-critical
          }
        }

        const finalConfidence = calculateDynamicConfidence(
          searchResults.map(r => ({ score: r.score, matchType: r.matchType, sources: r.sources })),
          fullContent,
          message,
        );

        const adjustedConfidence = allToolResults.length > 0 && allToolResults.every(r => r.success)
          ? Math.min(finalConfidence.confidence + 0.1, 1.0)
          : finalConfidence.confidence;

        // Factor in self-critique score
        const finalAdjustedConfidence = Math.round(adjustedConfidence * selfCritiqueScore * 100) / 100;

        // Cache asynchronously
        semanticCache
          .set(message, {
            content: fullContent,
            sources: ragSources,
            ragResults: searchResults.map(r => ({
              contractId: r.contractId,
              contractName: r.contractName,
              score: r.score,
              text: r.text.slice(0, 300),
            })),
            metadata: {
              intent: context.intent?.type,
              confidence: finalAdjustedConfidence,
              tokensUsed: Math.round(fullContent.length / 4),
            },
          }, tenantId)
          .catch(() => { /* ignore */ });

        // Store memory
        if (fullContent.length > 100) {
          storeMemory({
            tenantId,
            userId,
            type: 'interaction',
            content: `Q: ${message.slice(0, 200)}\nA: ${fullContent.slice(0, 300)}`,
            context: searchResults[0]?.contractName || detectTopic(message),
            importance: allToolResults.length > 0 ? 0.85 : searchResults.length > 0 ? 0.7 : 0.4,
          }).catch(() => { /* ignore */ });
        }

        // ── Server-side conversation persistence ──────────────────────
        // Save the exchange to DB so it persists across sessions/devices
        if (fullContent.length > 0) {
          const convId = (context as Record<string, unknown>).conversationId as string | undefined;
          const contractId = contextContractId || null;

          (async () => {
            try {
              let conversationId = convId;
              if (!conversationId) {
                const conv = await prisma.chatConversation.create({
                  data: {
                    tenantId,
                    userId,
                    title: message.slice(0, 80).replace(/\n/g, ' '),
                    context: contractId,
                    contextType: contractId ? 'CONTRACT' : 'GENERAL',
                    lastMessageAt: new Date(),
                    messageCount: 2,
                  },
                });
                conversationId = conv.id;
              }
              await prisma.chatMessage.createMany({
                data: [
                  { conversationId, role: 'user', content: message },
                  {
                    conversationId,
                    role: 'assistant',
                    content: fullContent,
                    model: usedModel,
                    tokensUsed: Math.round(fullContent.length / 4),
                    confidence: finalAdjustedConfidence,
                    sources: ragSources.slice(0, 10) as any,
                  },
                ],
              });
              await prisma.chatConversation.update({
                where: { id: conversationId },
                data: {
                  lastMessageAt: new Date(),
                  messageCount: { increment: 2 },
                },
              });
            } catch {
              // Non-critical — don't break streaming
            }
          })();
        }

        // Deduplicate suggested actions
        const uniqueActions = deduplicateActions([
          ...allSuggestedActions,
          ...(firstResult
            ? [{ label: '📄 View Contract', action: `navigate:/contracts/${firstResult.contractId}` }]
            : []),
        ]);

        // Record AI cost
        const estimatedInputTokens = Math.round(message.length / 4);
        const estimatedOutputTokens = Math.round(fullContent.length / 4);
        recordAICost({
          model: usedModel,
          inputTokens: estimatedInputTokens,
          outputTokens: estimatedOutputTokens,
          cost: estimateTokenCost(usedModel, estimatedInputTokens, estimatedOutputTokens),
          taskType: 'chat' as TaskType,
          tenantId,
          userId,
        });

        // Send done event
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'done',
          done: true,
          totalTokens: Math.round(fullContent.length / 4),
          confidence: finalAdjustedConfidence,
          confidenceTier: finalConfidence.tier,
          explanation: finalConfidence.explanation,
          selfCritique: {
            score: selfCritiqueScore,
            note: selfCritiqueNote,
            grounded: selfCritiqueScore >= 0.75,
          },
          model: usedModel,
          provider: usedProvider,
          toolsUsed,
          toolResults: allToolResults.map(r => ({
            toolName: r.toolName,
            success: r.success,
            executionTimeMs: r.executionTimeMs,
          })),
          suggestedActions: uniqueActions.slice(0, 5),
          cached: false,
        })}\n\n`));

        controller.close();
      } catch (error) {
        // P0: Sanitize error — never leak internal details (API keys, DB schema, etc.)
        const safeMessage = error instanceof Error && error.name === 'AbortError'
          ? 'Request timed out. Please try again.'
          : 'An error occurred while processing your request.';
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'error',
          error: safeMessage,
          done: true,
        })}\n\n`));
        controller.close();
      }
    },
  });

  return new NextResponse(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
});

// ─── Helpers ────────────────────────────────────────────────────────────

function detectTopic(query: string): string {
  const q = query.toLowerCase();
  if (q.includes('expir') || q.includes('renew')) return 'renewal';
  if (q.includes('risk') || q.includes('compliance')) return 'risk';
  if (q.includes('spend') || q.includes('value') || q.includes('cost')) return 'financial';
  if (q.includes('supplier') || q.includes('vendor')) return 'supplier';
  if (q.includes('workflow') || q.includes('approv')) return 'workflow';
  if (q.includes('clause') || q.includes('term')) return 'legal';
  return 'general';
}

/** Summarize a tool result into a short human-readable string. */
function summarizeToolResult(result: ToolResult): string {
  if (!result.success) return `Error: ${result.error}`;
  const d = result.data as Record<string, unknown>;
  if (!d) return 'Done';

  switch (result.toolName) {
    case 'search_contracts':
      return `Found ${d.count || 0} contracts`;
    case 'get_contract_details':
      return `Loaded: ${d.title || 'contract'}`;
    case 'list_expiring_contracts':
      return `${d.count || 0} contracts expiring in ${d.daysAhead || 30} days`;
    case 'get_spend_analysis':
      return `Analyzed ${d.totalContracts || 0} contracts, $${Number(d.totalSpend || 0).toLocaleString()} total`;
    case 'get_risk_assessment': {
      const summary = d.summary as Record<string, number> | undefined;
      return summary ? `${summary.criticalRisks || 0} critical, ${summary.highRisks || 0} high risks` : 'Risk assessed';
    }
    case 'get_supplier_info': {
      const s = d.summary as Record<string, unknown> | undefined;
      return s ? `${s.totalContracts || 0} contracts, $${Number(s.totalSpend || 0).toLocaleString()} spend` : 'Supplier loaded';
    }
    case 'start_workflow':
      return `Started "${d.workflowName}" workflow`;
    case 'list_workflows': {
      const templates = d.templates as unknown[];
      return `${templates?.length || 0} workflow templates`;
    }
    case 'get_pending_approvals':
      return `${d.total || 0} pending approvals`;
    case 'approve_or_reject_step':
      return `${d.decision === 'approve' ? 'Approved' : 'Rejected'}: ${d.step || 'step'}`;
    case 'create_contract':
      return `Created draft: ${d.title || 'contract'}`;
    case 'update_contract':
      return `Updated ${d.field}: ${d.newValue}`;
    case 'navigate_to_page':
      return `Navigate to ${d.page || 'page'}`;
    case 'get_compliance_summary':
      return `Compliance: ${d.complianceScore || 0}%`;
    case 'get_contract_stats':
      return `${d.totalContracts || 0} contracts, $${Number(d.totalValue || 0).toLocaleString()}`;
    case 'get_agent_insights':
      return `${d.totalInsights || 0} agent insights across ${(d.categories as string[])?.length || 0} categories`;
    case 'get_agent_debate': {
      const neg = d.negotiation as Record<string, unknown> | undefined;
      return neg ? `${neg.proposalCount || 0} agent proposals, ${neg.conflictCount || 0} conflicts resolved` : 'Debate complete';
    }
    case 'rate_response':
      return `Feedback recorded: ${d.rating}`;
    default:
      return 'Complete';
  }
}

/** Deduplicate actions by their action string. */
function deduplicateActions(actions: Array<{ label: string; action: string }>): Array<{ label: string; action: string }> {
  const seen = new Set<string>();
  return actions.filter(a => {
    if (seen.has(a.action)) return false;
    seen.add(a.action);
    return true;
  });
}

/** Build a rich preview from tool results for streaming UI (#9). */
function buildToolPreview(result: ToolResult): Record<string, unknown> | null {
  const d = result.data as Record<string, unknown>;
  if (!d) return null;

  switch (result.toolName) {
    case 'search_contracts': {
      const contracts = d.contracts as Array<Record<string, unknown>> | undefined;
      if (!contracts || contracts.length === 0) return null;
      return {
        type: 'contract_list',
        items: contracts.slice(0, 3).map(c => ({
          id: c.contractId,
          name: c.contractName,
          supplier: c.supplier,
          score: c.score,
        })),
        totalCount: d.count,
      };
    }
    case 'get_contract_details':
      return {
        type: 'contract_card',
        title: d.title,
        supplier: d.supplier,
        status: d.status,
        value: d.value,
        daysUntilExpiry: d.daysUntilExpiry,
      };
    case 'list_expiring_contracts': {
      const contracts = d.contracts as Array<Record<string, unknown>> | undefined;
      return {
        type: 'expiring_list',
        count: d.count,
        totalValueAtRisk: d.totalValueAtRisk,
        items: (contracts || []).slice(0, 3).map(c => ({
          title: c.title,
          supplier: c.supplier,
          daysUntilExpiry: c.daysUntilExpiry,
          value: c.value,
        })),
      };
    }
    case 'get_agent_insights': {
      const insights = d.insights as Array<Record<string, unknown>> | undefined;
      if (!insights || insights.length === 0) return null;
      return {
        type: 'insights_list',
        count: d.totalInsights,
        topInsights: insights.slice(0, 3).map(i => ({
          severity: i.severity,
          title: i.title,
          source: i.source,
        })),
      };
    }
    case 'get_agent_debate': {
      const negotiation = d.negotiation as Record<string, unknown> | undefined;
      if (!negotiation) return null;
      return {
        type: 'debate_summary',
        proposalCount: negotiation.proposalCount,
        conflictCount: negotiation.conflictCount,
        consensusCount: negotiation.consensusCount,
      };
    }
    case 'get_pending_approvals':
      return {
        type: 'approvals_count',
        total: d.total,
        urgent: (d.approvals as Array<Record<string, unknown>> | undefined)?.filter(a => {
          const started = a.startedAt as string | undefined;
          return started && (Date.now() - new Date(started).getTime() > 3 * 86400000);
        }).length || 0,
      };
    default:
      return null;
  }
}
