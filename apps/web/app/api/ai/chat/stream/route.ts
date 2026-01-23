/**
 * Enhanced Streaming AI Chat API
 * 
 * POST /api/ai/chat/stream - Real-time streaming responses with:
 * - Semantic cache integration
 * - Episodic memory retrieval
 * - Parallel RAG search
 * - Dynamic confidence calculation
 * - Agentic tool execution
 * - Model failover (GPT → Claude)
 */

import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { parallelMultiQueryRAG } from '@/lib/rag/parallel-rag.service';
import { semanticCache } from '@/lib/ai/semantic-cache.service';
import { calculateDynamicConfidence } from '@/lib/ai/confidence-calibration';
import { retrieveRelevantMemories, storeMemory } from '@/lib/ai/episodic-memory-integration';
import { getServerTenantId } from '@/lib/tenant-server';
import { getServerSession } from '@/lib/auth';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// Anthropic client for failover
const anthropic = process.env.ANTHROPIC_API_KEY 
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

// Model failover configuration
interface ModelConfig {
  provider: 'openai' | 'anthropic';
  model: string;
  priority: number;
}

const MODEL_FAILOVER_CHAIN: ModelConfig[] = [
  { provider: 'openai', model: process.env.OPENAI_MODEL || 'gpt-4o-mini', priority: 1 },
  { provider: 'openai', model: 'gpt-4o-mini', priority: 2 }, // Fallback to smaller model
  { provider: 'anthropic', model: 'claude-3-haiku-20240307', priority: 3 },
  { provider: 'anthropic', model: 'claude-3-sonnet-20240229', priority: 4 },
];

export async function POST(request: NextRequest) {
  try {
    const { message, conversationHistory = [], context = {} } = await request.json();

    if (!message) {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = await getServerTenantId();
    const session = await getServerSession();
    const userId = session?.user?.id || 'anonymous';

    // ============================================
    // STEP 1: CHECK SEMANTIC CACHE
    // ============================================
    const cached = await semanticCache.get(message, tenantId);
    if (cached) {
      // Return cached response as a non-streaming response with cache flag
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        start(controller) {
          // Send metadata with cache flag
          const metadata = JSON.stringify({
            sources: cached.sources,
            cached: true,
            confidence: cached.metadata.confidence,
            suggestedActions: [
              { label: '🔄 Refresh', action: 'refresh-query' },
              { label: '📋 Browse Contracts', action: 'navigate:/contracts' },
            ],
          });
          controller.enqueue(encoder.encode(`data: ${metadata}\n\n`));
          
          // Send full content immediately
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: cached.content })}\n\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, cached: true })}\n\n`));
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

    // ============================================
    // STEP 2: PARALLEL CONTEXT GATHERING
    // Run RAG, episodic memory, and proactive checks in parallel
    // ============================================
    const [ragResults, memories] = await Promise.all([
      shouldUseRAG(message)
        ? parallelMultiQueryRAG(message, { tenantId, k: 7 })
        : Promise.resolve({ results: [], queryVariations: [], timingsMs: { total: 0, hyde: 0, expansion: 0, search: 0, fusion: 0 } }),
      retrieveRelevantMemories(userId, tenantId, message, conversationHistory, {
        maxMemories: 3,
        types: ['preference', 'fact', 'decision'],
      }),
    ]);

    // Build RAG context
    let ragContext = '';
    let ragSources: string[] = [];
    const searchResults = ragResults.results || [];

    if (searchResults.length > 0) {
      ragContext = `\n\n**🔍 Relevant Contract Information (${searchResults.length} matches):**\n${searchResults.map((r, i) => 
        `[${i + 1}] **[${r.contractName}](/contracts/${r.contractId})** (${Math.round(r.score * 100)}% match):\n> ${r.text.slice(0, 400)}...`
      ).join('\n\n')}`;
      
      ragSources = searchResults.map(r => r.contractName);
    }

    // Build memory context
    let memoryContext = '';
    if (memories.length > 0) {
      memoryContext = `\n\n**💭 Relevant Past Interactions:**\n${memories.map(m => 
        `- [${m.type}] ${m.content.slice(0, 200)}${m.content.length > 200 ? '...' : ''}`
      ).join('\n')}`;
    }

    // ============================================
    // STEP 3: BUILD ENHANCED SYSTEM PROMPT
    // ============================================
    const systemPrompt = `You are ConTigo AI, an intelligent contract management assistant with access to:
- Contract database with semantic search
- Historical interaction memory
- Real-time contract analytics

${ragContext}
${memoryContext}

**Response Guidelines:**
1. Be concise and actionable
2. Use markdown formatting with headers and bullets
3. Link to contracts: [Contract Name](/contracts/ID)
4. Cite sources from the contract information above
5. Provide specific recommendations based on data
6. Suggest relevant follow-up actions`;

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-10).map((msg: { role: string; content: string }) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user', content: message },
    ];

    // ============================================
    // STEP 4: STREAMING RESPONSE WITH MODEL FAILOVER
    // ============================================
    const encoder = new TextEncoder();
    let fullContent = '';
    let usedModel = '';
    let usedProvider = '';
    
    // Try models in failover chain until one succeeds
    async function tryStreamWithFailover() {
      let lastError: Error | null = null;
      
      for (const config of MODEL_FAILOVER_CHAIN) {
        // Skip Anthropic if not configured
        if (config.provider === 'anthropic' && !anthropic) continue;
        
        try {
          if (config.provider === 'openai') {
            const stream = await openai.chat.completions.create({
              model: config.model,
              messages,
              temperature: 0.7,
              max_tokens: 2000,
              stream: true,
            });
            usedModel = config.model;
            usedProvider = 'openai';
            return { type: 'openai' as const, stream };
          } else if (config.provider === 'anthropic' && anthropic) {
            // Convert messages to Anthropic format
            const anthropicMessages = conversationHistory.slice(-10).map((msg: { role: string; content: string }) => ({
              role: msg.role === 'assistant' ? 'assistant' as const : 'user' as const,
              content: msg.content,
            }));
            anthropicMessages.push({ role: 'user' as const, content: message });
            
            const stream = anthropic.messages.stream({
              model: config.model,
              max_tokens: 2000,
              system: systemPrompt,
              messages: anthropicMessages,
            });
            usedModel = config.model;
            usedProvider = 'anthropic';
            return { type: 'anthropic' as const, stream };
          }
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Unknown error');
          console.warn(`[Model Failover] ${config.provider}/${config.model} failed:`, error);
          continue;
        }
      }
      
      throw lastError || new Error('All models failed');
    }
    
    const streamResult = await tryStreamWithFailover();
    
    const readable = new ReadableStream({
      async start(controller) {
        try {
          // Send metadata first
          const firstResult = searchResults[0];
          const initialConfidence = calculateDynamicConfidence(
            searchResults.map(r => ({ score: r.score, matchType: r.matchType, sources: r.sources })),
            '', // Empty response at this stage
            message
          );

          const metadata = JSON.stringify({ 
            type: 'metadata',
            sources: ragSources,
            confidence: initialConfidence.confidence,
            confidenceTier: initialConfidence.tier,
            queryVariations: ragResults.queryVariations?.slice(0, 3),
            memoriesUsed: memories.length,
            model: usedModel,
            provider: usedProvider,
            suggestedActions: firstResult ? [
              { label: '📄 View Contract', action: `navigate:/contracts/${firstResult.contractId}` },
              { label: '🔍 Search More', action: 'search-contracts' },
              { label: '📊 Analytics', action: 'navigate:/analytics' },
            ] : [
              { label: '📋 Browse Contracts', action: 'navigate:/contracts' },
              { label: '📊 View Dashboard', action: 'navigate:/dashboard' },
            ],
          });
          controller.enqueue(encoder.encode(`data: ${metadata}\n\n`));

          // Stream the response content based on provider
          if (streamResult.type === 'openai') {
            for await (const chunk of streamResult.stream) {
              const content = chunk.choices[0]?.delta?.content || '';
              if (content) {
                fullContent += content;
                const data = JSON.stringify({ type: 'content', content });
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
              }
            }
          } else if (streamResult.type === 'anthropic') {
            // Handle Anthropic streaming
            for await (const event of streamResult.stream) {
              if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                const content = event.delta.text || '';
                if (content) {
                  fullContent += content;
                  const data = JSON.stringify({ type: 'content', content });
                  controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                }
              }
            }
          }

          // ============================================
          // STEP 5: POST-PROCESSING
          // Cache response and store memory
          // ============================================
          const finalConfidence = calculateDynamicConfidence(
            searchResults.map(r => ({ score: r.score, matchType: r.matchType, sources: r.sources })),
            fullContent,
            message
          );

          // Cache the response asynchronously (don't block)
          semanticCache.set(message, {
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
              confidence: finalConfidence.confidence,
              tokensUsed: Math.round(fullContent.length / 4),
            },
          }, tenantId).catch(() => { /* Ignore cache errors */ });

          // Store interaction as memory for future reference
          if (fullContent.length > 100) {
            storeMemory({
              tenantId,
              userId,
              type: 'interaction',
              content: `Q: ${message.slice(0, 200)}\nA: ${fullContent.slice(0, 300)}`,
              context: firstResult?.contractName || detectTopic(message),
              importance: searchResults.length > 0 ? 0.7 : 0.4,
            }).catch(() => { /* Ignore memory errors */ });
          }

          // Send completion signal with model info
          const doneData = JSON.stringify({ 
            type: 'done',
            done: true,
            totalTokens: Math.round(fullContent.length / 4),
            confidence: finalConfidence.confidence,
            confidenceTier: finalConfidence.tier,
            explanation: finalConfidence.explanation,
            model: usedModel,
            provider: usedProvider,
            cached: false,
          });
          controller.enqueue(encoder.encode(`data: ${doneData}\n\n`));
          controller.close();
        } catch (error) {
          const errorData = JSON.stringify({ 
            type: 'error',
            error: error instanceof Error ? error.message : 'Stream interrupted',
            done: true,
          });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
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

  } catch (error: unknown) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to process request' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

function shouldUseRAG(query: string): boolean {
  const lowerQuery = query.toLowerCase();
  const ragKeywords = [
    'find', 'search', 'show me', 'where', 'what', 'which', 'list',
    'contract', 'clause', 'term', 'liability', 'termination',
    'payment', 'renewal', 'expire', 'obligation', 'risk',
    'indemnif', 'sla', 'warranty', 'confidential', 'vendor', 'supplier',
    'compare', 'analyze', 'summary', 'expiring', 'value', 'spend',
  ];
  return ragKeywords.some(keyword => lowerQuery.includes(keyword));
}

function detectTopic(query: string): string {
  const q = query.toLowerCase();
  if (q.includes('expir') || q.includes('renew')) return 'renewal';
  if (q.includes('risk') || q.includes('compliance')) return 'risk';
  if (q.includes('spend') || q.includes('value') || q.includes('cost')) return 'financial';
  if (q.includes('supplier') || q.includes('vendor')) return 'supplier';
  if (q.includes('clause') || q.includes('term')) return 'legal';
  return 'general';
}
