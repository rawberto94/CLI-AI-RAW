/**
 * Streaming Contract Summarization API
 * 
 * POST /api/ai/summarize/stream - Generate AI summary with streaming response
 * 
 * Provides real-time streaming summaries for immediate user feedback.
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createOpenAIClient, getOpenAIApiKey, hasAIClientConfig } from '@/lib/openai-client';
import { prisma } from '@/lib/prisma';
import { aiContractSummarizationService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';
import { checkRateLimit, rateLimitResponse, AI_RATE_LIMITS } from '@/lib/ai/rate-limit';

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    const key = getOpenAIApiKey();
    if (!key) throw new Error('OPENAI_API_KEY is not configured');
    _openai = createOpenAIClient(key);
  }
  return _openai;
}
const openai = new Proxy({} as OpenAI, { get: (_, prop) => (getOpenAI() as any)[prop] });

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SUMMARY_PROMPTS: Record<string, string> = {
  executive: `Create a concise executive summary (2-3 paragraphs) covering:
- Contract purpose and parties involved
- Key financial terms and total value
- Critical dates and milestones
- Main risks and recommendations`,
  
  detailed: `Provide a comprehensive analysis including:
- Full summary of contract scope and purpose
- Detailed party obligations and responsibilities
- Payment terms, pricing, and financial commitments
- Duration, renewal, and termination provisions
- Key legal clauses and their implications
- Risk assessment and recommendations`,
  
  quick: `Provide a 3-5 bullet point quick summary:
- What is this contract about?
- Who are the parties?
- What is the value/duration?
- Key dates to remember`,
  
  legal: `Analyze the legal aspects:
- Governing law and jurisdiction
- Liability and indemnification clauses
- Intellectual property provisions
- Confidentiality requirements
- Dispute resolution mechanisms
- Compliance obligations` };

export const POST = withAuthApiHandler(async (request, ctx) => {
  const startTime = Date.now();

  // Rate limit before we spend any Azure OpenAI tokens.
  const rl = checkRateLimit(ctx.tenantId, ctx.userId, '/api/ai/summarize/stream', { ...AI_RATE_LIMITS.streaming, identifier: 'ai-summarize-stream' });
  if (!rl.allowed) return rateLimitResponse(rl, ctx.requestId);

  try {
    const body = await request.json();
    const { contractId, contractText, level = 'executive' } = body;

    if (!contractId && !contractText) {
      return new NextResponse(
        JSON.stringify({ error: 'Either contractId or contractText is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!hasAIClientConfig()) {
      return new NextResponse(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get contract text
    let text = contractText;
    let fileName = 'document';
    
    if (!text && contractId) {
      const contract = await prisma.contract.findUnique({
        where: { id: contractId },
        select: { rawText: true, fileName: true, tenantId: true } });
      
      if (!contract) {
        return new NextResponse(
          JSON.stringify({ error: 'Contract not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (contract.tenantId !== ctx.tenantId) {
        return new NextResponse(
          JSON.stringify({ error: 'Access denied' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }

      text = contract.rawText || '';
      fileName = contract.fileName;
    }

    if (!text) {
      return new NextResponse(
        JSON.stringify({ error: 'Contract text not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Truncate for token limits
    const maxTextLength = 15000;
    const truncatedText = text.slice(0, maxTextLength);
    const wasTruncated = text.length > maxTextLength;

    const summaryPrompt = SUMMARY_PROMPTS[level] || SUMMARY_PROMPTS.executive;

    // Create streaming response
    const stream = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert contract analyst. Provide clear, professional summaries that highlight critical business and legal points. Use markdown formatting for readability.` },
        {
          role: 'user',
          content: `${summaryPrompt}\n\nContract text:\n${truncatedText}${wasTruncated ? '\n\n[Contract truncated for analysis]' : ''}` },
      ],
      temperature: 0.3,
      max_tokens: level === 'quick' ? 500 : level === 'detailed' ? 2000 : 1000,
      stream: true });

    // Create a ReadableStream for SSE
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        let aborted = false;
        let closed = false;

        const safeEnqueue = (payload: Record<string, unknown>) => {
          if (closed || aborted) return;
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
          } catch {
            closed = true;
          }
        };
        const safeClose = () => {
          if (closed) return;
          closed = true;
          try { controller.close(); } catch { /* already closed */ }
        };

        request.signal.addEventListener('abort', () => {
          aborted = true;
          safeClose();
        });

        try {
          // Send initial metadata
          safeEnqueue({
            type: 'metadata',
            contractId,
            fileName,
            level,
            startTime,
            wasTruncated,
          });

          let fullContent = '';

          for await (const chunk of stream) {
            if (aborted || closed) break;
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              fullContent += content;
              safeEnqueue({ type: 'content', content });
            }
          }

          // Send completion event
          const processingTime = Date.now() - startTime;
          safeEnqueue({
            type: 'complete',
            processingTime,
            wordCount: truncatedText.split(/\s+/).length,
            summaryLength: fullContent.length,
            level,
          });

          safeClose();
        } catch (error) {
          safeEnqueue({
            type: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          safeClose();
        }
      } });

    return new NextResponse(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no' } });
  } catch (error) {
    return new NextResponse(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Summarization failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
