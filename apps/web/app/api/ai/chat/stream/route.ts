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

import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { parallelMultiQueryRAG } from '@/lib/rag/parallel-rag.service';
import { semanticCache } from '@/lib/ai/semantic-cache.service';
import { calculateDynamicConfidence } from '@/lib/ai/confidence-calibration';
import { retrieveRelevantMemories, storeMemory } from '@/lib/ai/episodic-memory-integration';
import { STREAMING_TOOLS, executeTool, type ToolResult } from '@/lib/ai/streaming-tools';
import { withAuthApiHandler, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

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

const MODEL_FAILOVER_CHAIN: ModelConfig[] = [
  { provider: 'openai', model: process.env.OPENAI_MODEL || 'gpt-4o-mini', priority: 1 },
  { provider: 'openai', model: 'gpt-4o-mini', priority: 2 },
  { provider: 'anthropic', model: 'claude-3-haiku-20240307', priority: 3 },
  { provider: 'anthropic', model: 'claude-3-sonnet-20240229', priority: 4 },
];

// ─── Role-based tool permissions ────────────────────────────────────────

const WRITE_TOOLS = new Set([
  'start_workflow',
  'approve_or_reject_step',
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

// ─── Main Handler ───────────────────────────────────────────────────────

export const POST = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const { tenantId, userId, userRole } = ctx;
  const { message, conversationHistory = [], context = {} } = await request.json();

  if (!message) {
    return new Response(JSON.stringify({ error: 'Message is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
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

    return new Response(readable, {
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

  const [ragResults, memories] = await Promise.all([
    shouldUseRAG(message)
      ? parallelMultiQueryRAG(message, { tenantId, k: 7 })
      : Promise.resolve({ results: [], queryVariations: [], timingsMs: { total: 0, hyde: 0, expansion: 0, search: 0, fusion: 0 } }),
    retrieveRelevantMemories(userId, tenantId, message, conversationHistory, {
      maxMemories: 3,
      types: ['preference', 'fact', 'decision'],
    }),
  ]);

  const searchResults = ragResults.results || [];
  const ragSources = searchResults.map(r => r.contractName);

  let ragContext = '';
  if (searchResults.length > 0) {
    ragContext = `\n\n**Relevant Contract Information (${searchResults.length} matches):**\n${searchResults
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
You have access to tools that let you search contracts, view details, analyze spend & risk, manage workflows (start/approve/reject), create and update contracts, check compliance, and navigate the user to any page.

**When to use tools:**
- ALWAYS use a tool when the user asks for data, actions, or navigation — do NOT guess or make up data.
- Call multiple tools if the question requires cross-referencing (e.g., "find expiring contracts from Acme" → search_contracts + list_expiring_contracts).
- For navigation requests ("go to dashboard", "show me analytics"), use navigate_to_page.
- For workflow requests ("start approval", "what needs my approval"), use workflow tools.

**Response rules:**
1. Be concise and actionable.
2. Use markdown: headers, bullets, bold for key values, tables when appropriate.
3. Link to contracts: [Contract Name](/contracts/ID)
4. After tool results, summarize findings with specific numbers and recommendations.
5. If a tool returns a navigation URL, mention it so the user can click through.
6. Current user role: ${userRole}. Respect permissions.

${ragContext}
${memoryContext}`;

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-10).map((msg: { role: string; content: string }) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    { role: 'user', content: message },
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

  const readable = new ReadableStream({
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

        // ── Agentic loop with tool calling ────────────────────────────
        let iteration = 0;

        while (iteration < MAX_TOOL_ITERATIONS) {
          iteration++;

          // Try OpenAI with function calling
          let assistantMessage: OpenAI.Chat.Completions.ChatCompletionMessage | null = null;

          for (const config of MODEL_FAILOVER_CHAIN) {
            if (config.provider === 'anthropic' && !anthropic) continue;

            try {
              if (config.provider === 'openai') {
                // Non-streaming call for tool-calling iterations
                const response = await openai.chat.completions.create({
                  model: config.model,
                  messages,
                  tools: STREAMING_TOOLS,
                  tool_choice: 'auto',
                  temperature: 0.7,
                  max_tokens: 2000,
                });

                usedModel = config.model;
                usedProvider = 'openai';
                assistantMessage = response.choices[0].message;
                break;
              } else if (config.provider === 'anthropic' && anthropic) {
                // Anthropic fallback — content-only (no tool calling)
                const anthropicMessages = conversationHistory.slice(-10).map((msg: { role: string; content: string }) => ({
                  role: msg.role === 'assistant' ? 'assistant' as const : 'user' as const,
                  content: msg.content,
                }));
                anthropicMessages.push({ role: 'user' as const, content: message });

                const response = await anthropic.messages.create({
                  model: config.model,
                  max_tokens: 2000,
                  system: systemPrompt,
                  messages: anthropicMessages,
                });

                usedModel = config.model;
                usedProvider = 'anthropic';

                // Stream Anthropic response as final content
                const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
                fullContent = text;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', content: text })}\n\n`));
                iteration = MAX_TOOL_ITERATIONS; // Exit loop
                assistantMessage = null;
                break;
              }
            } catch (error) {
              console.warn(`[Stream v2] ${config.provider}/${config.model} failed:`, error);
              continue;
            }
          }

          if (!assistantMessage) break;

          // ── Check if model wants to call tools ─────────────────────
          const toolCalls = assistantMessage.tool_calls;

          if (!toolCalls || toolCalls.length === 0) {
            // No tool calls — stream final text response
            const finalText = assistantMessage.content || '';
            if (finalText) {
              const words = finalText.split(/(?<=\s)/);
              for (let i = 0; i < words.length; i += 3) {
                const chunk = words.slice(i, i + 3).join('');
                fullContent += chunk;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', content: chunk })}\n\n`));
                if (words.length > 20 && i % 12 === 0) {
                  await new Promise(r => setTimeout(r, 10));
                }
              }
            }
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
            if (!canUseTool(toolName, userRole)) {
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
        // STEP 5 — POST-PROCESSING (Cache, Memory, Done signal)
        // ═══════════════════════════════════════════════════════════════

        const finalConfidence = calculateDynamicConfidence(
          searchResults.map(r => ({ score: r.score, matchType: r.matchType, sources: r.sources })),
          fullContent,
          message,
        );

        const adjustedConfidence = allToolResults.length > 0 && allToolResults.every(r => r.success)
          ? Math.min(finalConfidence.confidence + 0.1, 1.0)
          : finalConfidence.confidence;

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
              confidence: adjustedConfidence,
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

        // Deduplicate suggested actions
        const uniqueActions = deduplicateActions([
          ...allSuggestedActions,
          ...(firstResult
            ? [{ label: '📄 View Contract', action: `navigate:/contracts/${firstResult.contractId}` }]
            : []),
        ]);

        // Send done event
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'done',
          done: true,
          totalTokens: Math.round(fullContent.length / 4),
          confidence: adjustedConfidence,
          confidenceTier: finalConfidence.tier,
          explanation: finalConfidence.explanation,
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
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'error',
          error: error instanceof Error ? error.message : 'Stream interrupted',
          done: true,
        })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
});

// ─── Helpers ────────────────────────────────────────────────────────────

function shouldUseRAG(query: string): boolean {
  const q = query.toLowerCase();
  const keywords = [
    'find', 'search', 'show me', 'where', 'what', 'which', 'list',
    'contract', 'clause', 'term', 'liability', 'termination',
    'payment', 'renewal', 'expire', 'obligation', 'risk',
    'indemnif', 'sla', 'warranty', 'confidential', 'vendor', 'supplier',
    'compare', 'analyze', 'summary', 'expiring', 'value', 'spend',
  ];
  return keywords.some(k => q.includes(k));
}

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
