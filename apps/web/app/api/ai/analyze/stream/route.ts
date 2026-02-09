/**
 * Streaming AI Analysis API
 * 
 * POST /api/ai/analyze/stream - Deep analysis with streaming response
 * 
 * This endpoint provides real-time streaming analysis of contracts,
 * useful for long contracts where users want to see progress.
 */

import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { analyticalIntelligenceService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '' });

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = withAuthApiHandler(async (request, ctx) => {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { contractId, analysisType = 'full' } = body;

    if (!contractId) {
      return new Response(
        JSON.stringify({ error: 'contractId is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return new Response(
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

    if (!contract.rawText) {
      return new Response(
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
        try {
          // Send initial metadata
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'metadata',
                contractId,
                fileName: contract.fileName,
                startTime })}\n\n`
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

          // Send completion event with metadata
          const processingTime = Date.now() - startTime;
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'complete',
                processingTime,
                wordCount: contractText.split(/\s+/).length,
                totalLength: fullContent.length })}\n\n`
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
