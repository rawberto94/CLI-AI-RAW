/**
 * Streaming AI Chat API
 * 
 * POST /api/ai/chat/stream - Real-time streaming responses from OpenAI
 */

import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { hybridSearch } from '@/lib/rag/advanced-rag.service';
import { getServerTenantId } from '@/lib/tenant-server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

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

    // Check if the query needs RAG search
    let ragContext = '';
    let ragSources: string[] = [];

    if (shouldUseRAG(message)) {
      try {
        const ragResults = await hybridSearch(message, {
          mode: 'hybrid',
          k: 5,
          rerank: true,
          expandQuery: true,
          filters: { tenantId },
        });

        if (ragResults.length > 0) {
          ragContext = `\n\n**Relevant Contract Information:**\n${ragResults.map((r, i) => 
            `[${i + 1}] From "${r.contractName}" (${Math.round(r.score * 100)}% match):\n${r.text.slice(0, 400)}...`
          ).join('\n\n')}`;
          
          ragSources = ragResults.map(r => r.contractName);
        }
      } catch (ragError) {
        console.error('RAG search error:', ragError);
      }
    }

    const systemPrompt = `You are an AI assistant for a Contract Lifecycle Management (CLM) system. You help users with:
- Searching and analyzing contracts
- Managing deadlines and renewals
- Identifying risks and compliance issues
- Generating reports and insights

${ragContext}

When answering:
1. Be concise and actionable
2. Use markdown formatting
3. Reference specific contracts when relevant
4. If contract information was found above, cite it`;

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-10).map((msg: any) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user', content: message },
    ];

    // Create streaming response
    const stream = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 1000,
      stream: true,
    });

    // Create a ReadableStream that sends chunks
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          // Send metadata first
          const metadata = JSON.stringify({ 
            type: 'metadata', 
            sources: ragSources,
            suggestions: ['Tell me more', 'Show related contracts', 'What are the risks?'],
          });
          controller.enqueue(encoder.encode(`data: ${metadata}\n\n`));

          // Stream the response
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              const data = JSON.stringify({ type: 'content', text: content });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          }

          // Send done signal
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);
          controller.error(error);
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: any) {
    console.error('Streaming chat error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to process request' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

function shouldUseRAG(query: string): boolean {
  const lowerQuery = query.toLowerCase();
  const ragKeywords = [
    'find', 'search', 'show me', 'where', 'what', 'which',
    'contract', 'clause', 'term', 'liability', 'termination',
    'payment', 'renewal', 'expire', 'obligation', 'risk',
    'indemnif', 'sla', 'warranty', 'confidential',
  ];
  return ragKeywords.some(keyword => lowerQuery.includes(keyword));
}
