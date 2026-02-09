/**
 * Streaming Contract Summarization API
 * 
 * POST /api/ai/summarize/stream - Generate AI summary with streaming response
 * 
 * Provides real-time streaming summaries for immediate user feedback.
 */

import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { aiContractSummarizationService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '' });

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

  try {
    const body = await request.json();
    const { contractId, contractText, level = 'executive' } = body;

    if (!contractId && !contractText) {
      return new Response(
        JSON.stringify({ error: 'Either contractId or contractText is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return new Response(
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
        return new Response(
          JSON.stringify({ error: 'Contract not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (contract.tenantId !== tenantId) {
        return new Response(
          JSON.stringify({ error: 'Access denied' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }

      text = contract.rawText || '';
      fileName = contract.fileName;
    }

    if (!text) {
      return new Response(
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
        try {
          // Send initial metadata
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'metadata',
                contractId,
                fileName,
                level,
                startTime,
                wasTruncated })}\n\n`
            )
          );

          let fullContent = '';
          
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              fullContent += content;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'content',
                    content })}\n\n`
                )
              );
            }
          }

          // Send completion event
          const processingTime = Date.now() - startTime;
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'complete',
                processingTime,
                wordCount: truncatedText.split(/\s+/).length,
                summaryLength: fullContent.length,
                level })}\n\n`
            )
          );

          controller.close();
        } catch (error) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'error',
                error: error instanceof Error ? error.message : 'Unknown error' })}\n\n`
            )
          );
          controller.close();
        }
      } });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no' } });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Summarization failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
