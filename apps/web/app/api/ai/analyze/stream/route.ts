/**
 * Streaming AI Analysis API
 * 
 * POST /api/ai/analyze/stream - Deep analysis with streaming response
 * 
 * This endpoint provides real-time streaming analysis of contracts,
 * useful for long contracts where users want to see progress.
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createOpenAIClient, getOpenAIApiKey, hasAIClientConfig } from '@/lib/openai-client';
import { prisma } from '@/lib/prisma';
import { analyticalIntelligenceService } from 'data-orchestration/services';
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

export const POST = withAuthApiHandler(async (request, ctx) => {
  const startTime = Date.now();

  // Rate limit before we spend any Azure OpenAI tokens.
  const rl = checkRateLimit(ctx.tenantId, ctx.userId, '/api/ai/analyze/stream', { ...AI_RATE_LIMITS.streaming, identifier: 'ai-analyze-stream' });
  if (!rl.allowed) return rateLimitResponse(rl, ctx.requestId);

  try {
    const body = await request.json();
    const { contractId, analysisType = 'full' } = body;

    if (!contractId) {
      return new NextResponse(
        JSON.stringify({ error: 'contractId is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!hasAIClientConfig()) {
      return new NextResponse(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch contract
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: {
        id: true,
        fileName: true,
        rawText: true,
        tenantId: true } });

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

    if (!contract.rawText) {
      return new NextResponse(
        JSON.stringify({ error: 'Contract has no text content to analyze' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Truncate for token limits
    const maxTextLength = 15000;
    const contractText = contract.rawText.slice(0, maxTextLength);

    // Build analysis prompt based on type
    const analysisPrompt = getAnalysisPrompt(analysisType, contractText);

    // Create streaming response
    const stream = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert legal contract analyst. Analyze contracts thoroughly and provide structured insights.
          
Output your analysis in the following markdown format:

## Summary
[Brief summary of the contract]

## Key Terms
- **Term**: Value (Category: financial/temporal/legal/operational, Importance: high/medium/low)

## Risks
### [Risk Title] (Severity: critical/high/medium/low)
[Description]
- **Mitigation**: [Suggested mitigation]

## Obligations
### [Obligation Title]
- **Party**: us/them/mutual
- **Type**: payment/delivery/compliance/reporting/other
- **Description**: [Details]

## Recommendations
1. [Recommendation 1]
2. [Recommendation 2]` },
        {
          role: 'user',
          content: analysisPrompt },
      ],
      temperature: 0.3,
      max_tokens: 2000,
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

        // Handle client disconnect to stop wasting OpenAI tokens
        request.signal.addEventListener('abort', () => {
          aborted = true;
          safeClose();
        });

        try {
          // Send initial metadata
          safeEnqueue({
            type: 'metadata',
            contractId,
            fileName: contract.fileName,
            startTime,
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

          // Send completion event with metadata
          const processingTime = Date.now() - startTime;
          safeEnqueue({
            type: 'complete',
            processingTime,
            wordCount: contractText.split(/\s+/).length,
            totalLength: fullContent.length,
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
        error: error instanceof Error ? error.message : 'Analysis failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

function getAnalysisPrompt(type: string, contractText: string): string {
  const basePrompt = `Analyze this contract and provide a comprehensive analysis:\n\n${contractText}\n\n`;

  switch (type) {
    case 'quick':
      return basePrompt + 'Provide a brief summary and top 3 risks only.';
    case 'risks':
      return basePrompt + 'Focus on identifying all potential risks and liabilities.';
    case 'obligations':
      return basePrompt + 'Focus on extracting all obligations and deadlines.';
    case 'terms':
      return basePrompt + 'Focus on extracting all key terms and conditions.';
    case 'full':
    default:
      return basePrompt + 'Provide a complete analysis including summary, key terms, risks, obligations, and recommendations.';
  }
}
