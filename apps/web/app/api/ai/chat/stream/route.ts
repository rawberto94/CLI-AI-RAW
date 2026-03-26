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
 * - Model failover (GPT-4o → GPT-4o-mini → Claude 3.5 Haiku → Claude Sonnet 4)
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
import { hasAIClientConfig } from '@/lib/openai-client';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/prisma';
import { semanticCache } from '@/lib/ai/semantic-cache.service';
import { calculateDynamicConfidence } from '@/lib/ai/confidence-calibration';
import { storeMemory } from '@/lib/ai/episodic-memory-integration';
import { STREAMING_TOOLS, executeTool, type ToolResult } from '@/lib/ai/streaming-tools';
import { withAuthApiHandler, type AuthenticatedApiContext } from '@/lib/api-middleware';
import { checkRateLimit, rateLimitResponse, AI_RATE_LIMITS } from '@/lib/ai/rate-limit';
import { allocateBudget, getBudgetStats } from '@/lib/ai/token-budget';
import { shouldUseAgent, executeWithAgent } from '@/lib/ai/agent-integration';
import { recordAICost, estimateTokenCost, type TaskType } from '@/lib/ai/model-router.service';
import { checkInputGuardrails, checkOutputGuardrails } from '@/lib/ai/guardrails';
import { summarizeConversationHistory } from '@/lib/ai/conversation-summarizer';
import { aiTracer } from '@/lib/ai/ai-tracing';
import { countTokens } from '@/lib/ai/token-counter';
import { logger } from '@/lib/logger';
import { getCircuitBreaker } from '@/lib/ai/circuit-breaker';

// ─── Decomposed modules ─────────────────────────────────────────────────
import {
  openai, anthropic, type ModelConfig,
  canUseTool, MAX_TOOL_ITERATIONS,
  detectQueryComplexity, buildModelChain,
} from '@/lib/ai/chat-stream/model-routing';
import { gatherContext } from '@/lib/ai/chat-stream/context-gathering';
import { buildSystemPrompt, applyAgentPersona } from '@/lib/ai/chat-stream/system-prompt';
import { detectTopic, summarizeToolResult, deduplicateActions, buildToolPreview } from '@/lib/ai/chat-stream/sse-helpers';

// ─── Main Handler ───────────────────────────────────────────────────────

export const POST = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const { tenantId, userId, userRole } = ctx;

  // ── Rate limit: shared bucket with legacy endpoint (10 req/min) ──
  const rl = checkRateLimit(tenantId, userId, '/api/ai/chat/stream', { ...AI_RATE_LIMITS.streaming, identifier: 'ai-chat' });
  if (!rl.allowed) return rateLimitResponse(rl, ctx.requestId);

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

  // Validate conversation history items — reject malformed entries
  if (Array.isArray(conversationHistory)) {
    for (let i = conversationHistory.length - 1; i >= 0; i--) {
      const item = conversationHistory[i];
      if (
        !item ||
        typeof item.role !== 'string' ||
        !['user', 'assistant', 'system'].includes(item.role) ||
        typeof item.content !== 'string'
      ) {
        conversationHistory.splice(i, 1);
      }
    }
  }

  if (!hasAIClientConfig()) {
    return new NextResponse(JSON.stringify({ 
      error: 'AI_NOT_CONFIGURED',
      message: 'AI service is not configured. Please contact your administrator to set up OpenAI API keys.',
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 0.5 — INPUT GUARDRAILS (prompt injection + content moderation)
  // ═══════════════════════════════════════════════════════════════════════

  const guardrailCheck = await checkInputGuardrails(message);
  if (!guardrailCheck.safe) {
    return new NextResponse(JSON.stringify({
      error: guardrailCheck.reason || 'Message blocked by safety filter.',
      guardrail: true,
      category: guardrailCheck.category,
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 0.7 — CONVERSATION SUMMARIZATION (compress long history)
  // ═══════════════════════════════════════════════════════════════════════

  let conversationSummary = '';
  let effectiveHistory = conversationHistory;
  if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
    try {
      const summarized = await summarizeConversationHistory(conversationHistory);
      conversationSummary = summarized.summary;
      effectiveHistory = summarized.recentMessages;
    } catch {
      // Non-critical — fall back to raw history
      effectiveHistory = conversationHistory.slice(-10);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 1 — SEMANTIC CACHE CHECK
  // ═══════════════════════════════════════════════════════════════════════

  const cached = await semanticCache.get(message, tenantId).catch((err) => {
    logger.warn('[Stream v2] Semantic cache lookup failed', { action: 'semantic-cache', error: err instanceof Error ? err.message : String(err) });
    return null;
  });
  if (cached && cached.content && cached.content.length > 0) {
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'metadata',
          sources: cached.sources,
          ragSources: (cached.ragResults || []).map((r: { contractId: string; contractName: string; score: number }) => ({
            contractId: r.contractId,
            contractName: r.contractName,
            score: r.score,
          })),
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

  const {
    searchResults, ragSources, ragContext, memoryContext,
    contractProfileContext, learningContextStr, memories, ragResults,
  } = await gatherContext(message, tenantId, userId, effectiveHistory, contextContractId);

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 3 — SYSTEM PROMPT (Agentic) + PERSONA DETECTION
  // ═══════════════════════════════════════════════════════════════════════

  const baseSystemPrompt = buildSystemPrompt({
    userRole: userRole ?? 'USER',
    contextContractId,
    contractProfileContext,
    ragContext,
    memoryContext,
    learningContextStr,
    conversationSummary,
  });

  const { systemPrompt: finalSystemPrompt, message: finalMessage } = await applyAgentPersona(baseSystemPrompt, message);

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 3.5 — AGENT DECISION & TOKEN BUDGET
  // ═══════════════════════════════════════════════════════════════════════
  
  // Check if query should use ReAct agent for complex multi-step reasoning
  const agentDecision = shouldUseAgent(message);
  
  if (agentDecision.useAgent && agentDecision.agentType === 'react') {
    // Route to ReAct agent for complex queries
    try {
    const agentResponse = await executeWithAgent({
      query: message,
      tenantId,
      userId,
      conversationHistory: effectiveHistory,
    });
    
    if (agentResponse.agentUsed && agentResponse.response) {
      // Stream agent response with plan visualization (#5)
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        start(controller) {
          // Emit plan event so frontend can show reasoning steps
          if (agentResponse.steps && agentResponse.steps > 0) {
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
            ragSources: searchResults.slice(0, 5).map(r => ({
              contractId: r.contractId,
              contractName: r.contractName,
              score: r.score,
            })),
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
    } catch (agentErr) {
      logger.warn('[Stream v2] Agent execution failed, falling through to standard flow', { action: 'agent-execution', error: agentErr instanceof Error ? agentErr.message : String(agentErr) });
    }
  }
  
  // Apply token budget management to prevent context overflow
  const budgetAllocation = allocateBudget(
    process.env.OPENAI_MODEL || 'gpt-4o-mini',
    {
      systemPrompt: finalSystemPrompt,
      ragContext,
      conversationHistory: effectiveHistory.slice(-10).map((msg: { role: string; content: string }) => ({
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content,
      })),
      memoryContext,
    }
  );
  
  const budgetStats = getBudgetStats(budgetAllocation.totalUsed, process.env.OPENAI_MODEL || 'gpt-4o-mini');
  if (budgetStats.status === 'warning') {
    logger.warn(`[Stream v2] Token budget at ${budgetStats.percentage}% - approaching limit`);
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
          ragSources: searchResults.slice(0, 5).map(r => ({
            contractId: r.contractId,
            contractName: r.contractName,
            score: r.score,
          })),
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

        // ── Circuit breaker — reject if AI service is overwhelmed ──
        const chatBreaker = getCircuitBreaker('ai-chat', { failureThreshold: 5, resetTimeoutMs: 60_000 });
        const breakerCheck = chatBreaker.canExecute();
        if (!breakerCheck.allowed) {
          logger.warn('[Chat] Circuit breaker OPEN — rejecting request');
          emit('error', { error: 'AI service is temporarily unavailable due to high error rate. Please try again in a minute.' });
          controller.close();
          return;
        }

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

            const llmSpan = aiTracer.startLLMSpan({
              model: config.model,
              operation: 'chat',
              provider: config.provider as 'openai' | 'anthropic',
              tenantId: tenantId,
              userId: userId,
              feature: 'chatbot',
              tags: { iteration: String(iteration), complexity: queryComplexity },
            });

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
                aiTracer.endLLMSpan(llmSpan, { success: true });
                break;
              } else if (config.provider === 'anthropic' && anthropic) {
                // Anthropic fallback — true streaming WITH tool calling
                const anthropicMessages: Anthropic.MessageParam[] = effectiveHistory.slice(-10).map((msg: { role: string; content: string }) => ({
                  role: msg.role === 'assistant' ? 'assistant' as const : 'user' as const,
                  content: msg.content,
                }));
                // Also add tool-result messages from prior iterations
                for (const m of messages) {
                  if ((m as { role: string }).role === 'tool') {
                    const toolMsg = m as { role: string; tool_call_id: string; content: string };
                    anthropicMessages.push({
                      role: 'user' as const,
                      content: [{ type: 'tool_result' as const, tool_use_id: toolMsg.tool_call_id, content: toolMsg.content }],
                    });
                  }
                }
                anthropicMessages.push({ role: 'user' as const, content: finalMessage });

                // Convert OpenAI tools to Anthropic format
                const anthropicTools: Anthropic.Tool[] = STREAMING_TOOLS.map(t => ({
                  name: t.function.name,
                  description: t.function.description || '',
                  input_schema: t.function.parameters as Anthropic.Tool.InputSchema,
                }));

                const anthropicStream = anthropic.messages.stream({
                  model: config.model,
                  max_tokens: 2000,
                  system: finalSystemPrompt,
                  messages: anthropicMessages,
                  tools: anthropicTools,
                  tool_choice: { type: 'auto' },
                }, { signal: AbortSignal.timeout(30_000) });

                usedModel = config.model;
                usedProvider = 'anthropic';

                // Accumulate streamed content and tool-use blocks
                let anthropicContent = '';
                const anthropicToolCalls: Array<{ id: string; name: string; input: string }> = [];
                let currentToolUseId = '';
                let currentToolUseName = '';
                let currentToolUseInput = '';

                for await (const event of anthropicStream) {
                  if (cancelled) break;
                  if (event.type === 'content_block_start') {
                    if (event.content_block.type === 'tool_use') {
                      currentToolUseId = event.content_block.id;
                      currentToolUseName = event.content_block.name;
                      currentToolUseInput = '';
                    }
                  } else if (event.type === 'content_block_delta') {
                    if (event.delta.type === 'text_delta') {
                      const token = event.delta.text;
                      anthropicContent += token;
                      fullContent += token;
                      controller.enqueue(encoder.encode(
                        `data: ${JSON.stringify({ type: 'content', content: token })}\n\n`
                      ));
                    } else if (event.delta.type === 'input_json_delta') {
                      currentToolUseInput += event.delta.partial_json;
                    }
                  } else if (event.type === 'content_block_stop') {
                    if (currentToolUseId) {
                      anthropicToolCalls.push({
                        id: currentToolUseId,
                        name: currentToolUseName,
                        input: currentToolUseInput,
                      });
                      currentToolUseId = '';
                      currentToolUseName = '';
                      currentToolUseInput = '';
                    }
                  }
                }

                // If Anthropic requested tool calls, convert to OpenAI format
                if (anthropicToolCalls.length > 0) {
                  assistantMessage = {
                    role: 'assistant',
                    content: anthropicContent || null,
                    tool_calls: anthropicToolCalls.map(tc => ({
                      id: tc.id,
                      type: 'function' as const,
                      function: { name: tc.name, arguments: tc.input },
                    })),
                    refusal: null,
                  } as OpenAI.Chat.Completions.ChatCompletionMessage;
                } else {
                  // Content-only response, no tools needed
                  assistantMessage = null;
                }
                aiTracer.endLLMSpan(llmSpan, { success: true });
                break;
              }
            } catch (error) {
              const errMsg = error instanceof Error ? error.message : String(error);
              aiTracer.endLLMSpan(llmSpan, {
                success: false,
                errorType: error instanceof Error ? error.name : 'Error',
                errorMessage: errMsg,
              });
              logger.warn(`[Stream v2] ${config.provider}/${config.model} failed`, { action: 'model-call', error: errMsg });
              
              // Record transient failures in circuit breaker
              if (chatBreaker.isTransientError(error)) {
                chatBreaker.recordFailure(errMsg);
              }
              
              // FIX: Fail-fast on quota/auth/deployment errors — no point trying other models
              // with the same API key. Prevents cascading 30s timeouts.
              const isQuotaOrAuthError = errMsg.includes('429') || 
                errMsg.includes('quota') || 
                errMsg.includes('billing') ||
                errMsg.includes('401') ||
                errMsg.includes('authentication');
              const isDeploymentError = errMsg.includes('DeploymentNotFound') ||
                errMsg.includes('deployment') ||
                (errMsg.includes('404') && errMsg.includes('deployment'));
              if (isQuotaOrAuthError || isDeploymentError) {
                // Skip remaining models from the same provider
                const failedProvider = config.provider;
                const userMessage = isDeploymentError
                  ? `AI model deployment not found. Please contact your administrator to configure an Azure OpenAI deployment.`
                  : `AI service temporarily unavailable (${failedProvider} rate limit). Please try again later.`;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'error',
                  error: userMessage,
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
              // Invalid tool arguments — return an immediate failure instead
              // of executing with empty args (which produces confusing errors)
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'tool_done',
                toolName,
                success: false,
                summary: 'Error: Invalid tool arguments',
                executionTimeMs: 0,
              })}\n\n`));
              return {
                toolCallId: tc.id,
                result: {
                  toolName,
                  success: false,
                  data: null,
                  error: 'Invalid tool arguments — could not parse JSON',
                  executionTimeMs: 0,
                } as ToolResult,
              };
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

            const result = await Promise.race([
              executeTool(toolName, args, tenantId, userId),
              new Promise<ToolResult>((_, reject) =>
                setTimeout(() => reject(new Error(`Tool '${toolName}' timed out after 15s`)), 15_000)
              ),
            ]).catch(err => ({
              toolName,
              success: false,
              data: null,
              error: err instanceof Error ? err.message : 'Tool execution failed',
              executionTimeMs: 15_000,
            } as ToolResult));

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

          const toolSettled = await Promise.allSettled(toolPromises);
          const toolResponses = toolSettled
            .filter((r): r is PromiseFulfilledResult<{ toolCallId: string; result: any }> => r.status === 'fulfilled')
            .map(r => r.value);

          // Log any rejected tool calls (non-fatal)
          for (const r of toolSettled) {
            if (r.status === 'rejected') {
      logger.warn('[ChatStream] Tool execution failed (non-fatal)', { reason: r.reason });
            }
          }

          for (const { result } of toolResponses) {
            toolsUsed.push(result.toolName);
            allToolResults.push(result);
            if (result.suggestedActions) allSuggestedActions.push(...result.suggestedActions);
          }

          // Add tool results to messages (T15: cap size to prevent context overflow)
          const MAX_TOOL_RESULT_CHARS = 30_000;
          for (const { toolCallId, result } of toolResponses) {
            let resultJson = JSON.stringify(result.data || { error: result.error });
            if (resultJson.length > MAX_TOOL_RESULT_CHARS) {
              resultJson = resultJson.slice(0, MAX_TOOL_RESULT_CHARS) + '... [truncated — result too large]';
            }
            messages.push({
              role: 'tool',
              tool_call_id: toolCallId,
              content: resultJson,
            } as OpenAI.Chat.Completions.ChatCompletionMessageParam);
          }

          // Continue loop — model will see results and decide next
        }

        // ── Safety net: if no content was generated AND no tools were used,
        //    all models failed silently (non-quota errors). Send an explicit
        //    error rather than an empty message. ──────────────────────────
        if (fullContent.length === 0 && toolsUsed.length === 0) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            error: 'All AI models are currently unavailable. Please try again in a moment.',
            done: true,
          })}\n\n`));
          controller.close();
          return;
        }

        // ── Warn if content was partially streamed but model chain exhausted ──
        if (fullContent.length > 0 && fullContent.length < 50 && toolsUsed.length === 0) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'content',
            content: '\n\n⚠️ *Response may be incomplete due to a temporary AI service issue. Please try again.*',
          })}\n\n`));
          fullContent += '\n\n⚠️ *Response may be incomplete due to a temporary AI service issue. Please try again.*';
        }

        // ═══════════════════════════════════════════════════════════════
        // STEP 5 — POST-PROCESSING (Self-Critique, Cache, Memory, Done)
        // ═══════════════════════════════════════════════════════════════

        // ── Output guardrails: check LLM output for policy violations/prompt leakage ──
        if (fullContent.length > 20) {
          const outputCheck = await checkOutputGuardrails(fullContent).catch(() => ({ safe: true }) as { safe: boolean });
          if (!outputCheck.safe) {
            logger.warn('[Stream v2] Output guardrail triggered — replacing response');
            fullContent = 'I apologize, but I was unable to generate an appropriate response. Please try rephrasing your question.';
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ type: 'content', content: '\n\n_[Response filtered by safety system]_' })}\n\n`
            ));
          }
        }

        // ── Self-critique (#4): Quick quality check on generated response ──
        let selfCritiqueScore = 1.0;
        let selfCritiqueNote = '';
        if (fullContent.length > 50 && searchResults.length > 0) {
          try {
            // Check if response is grounded in RAG context using n-gram overlap.
            // Single-word matching fails for paraphrases ("contractual obligations"
            // won't match "duties under the agreement"). Using bigrams + trigrams
            // captures phrase-level grounding more accurately.
            const ragTexts = searchResults.map(r => r.text.toLowerCase()).join(' ');

            // Extract n-grams (bigrams + trigrams) from response
            const responseWords = fullContent.toLowerCase().split(/\s+/).filter(w => w.length > 3);
            const responsePhrases = new Set<string>();
            for (let i = 0; i < responseWords.length - 1; i++) {
              responsePhrases.add(responseWords[i] + ' ' + responseWords[i + 1]); // bigram
              if (i < responseWords.length - 2) {
                responsePhrases.add(responseWords[i] + ' ' + responseWords[i + 1] + ' ' + responseWords[i + 2]); // trigram
              }
            }
            // Also include significant single words (>6 chars, likely domain terms)
            for (const w of responseWords) {
              if (w.length > 6) responsePhrases.add(w);
            }

            const groundedPhrases = Array.from(responsePhrases).filter(p => ragTexts.includes(p));
            const groundingRatio = responsePhrases.size > 0 ? groundedPhrases.length / responsePhrases.size : 0;

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

        // Cache asynchronously — only if there is actual content to cache
        if (fullContent.length > 0) {
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
                tokensUsed: countTokens(fullContent).tokens,
              },
            }, tenantId)
            .catch(() => { /* ignore */ });
        }

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
        // We await this so we can return the conversationId in the done event
        let persistedConversationId: string | null = null;
        if (fullContent.length > 0) {
          const convId = (context as Record<string, unknown>).conversationId as string | undefined;
          const contractId = contextContractId || null;

          try {
            let conversationId = convId || null;
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
                  tokensUsed: countTokens(fullContent).tokens,
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
            persistedConversationId = conversationId;
          } catch {
            // Non-critical — don't break streaming
          }
        }

        // Deduplicate suggested actions
        const uniqueActions = deduplicateActions([
          ...allSuggestedActions,
          ...(firstResult
            ? [{ label: '📄 View Contract', action: `navigate:/contracts/${firstResult.contractId}` }]
            : []),
        ]);

        // Record AI cost
        const estimatedInputTokens = countTokens(message).tokens;
        const estimatedOutputTokens = countTokens(fullContent).tokens;
        recordAICost({
          model: usedModel,
          inputTokens: estimatedInputTokens,
          outputTokens: estimatedOutputTokens,
          cost: estimateTokenCost(usedModel, estimatedInputTokens, estimatedOutputTokens),
          taskType: 'chat' as TaskType,
          tenantId,
          userId,
        });

        // Record success in circuit breaker
        chatBreaker.recordSuccess();

        // Send done event
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'done',
          done: true,
          conversationId: persistedConversationId,
          totalTokens: countTokens(fullContent).tokens,
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
