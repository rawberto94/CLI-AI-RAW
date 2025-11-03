import { NextRequest } from 'next/server';
import { getEnhancedPrompt, validateExtractedData } from '@/lib/enhanced-prompts';
import { dbAdaptor } from 'data-orchestration/src/dal/database.adaptor';

/**
 * POST /api/contracts/[id]/artifacts/[artifactId]/improve-stream
 * 
 * Streaming endpoint for artifact improvements
 * Returns Server-Sent Events with token-by-token LLM output
 */
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string; artifactId: string }> }
) {
  const params = await props.params;
  const body = await request.json();
  const { userPrompt, userId } = body;

  if (!userId || !userPrompt) {
    return new Response(
      JSON.stringify({ error: 'userId and userPrompt required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const client = dbAdaptor.getClient();
  const artifact = await client.artifact.findUnique({ where: { id: params.artifactId } });

  if (!artifact) {
    return new Response(
      JSON.stringify({ error: 'Artifact not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (artifact.contractId !== params.id) {
    return new Response(
      JSON.stringify({ error: 'Artifact does not belong to contract' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const contract = await client.contract.findUnique({ where: { id: params.id } });
  const rawText = contract?.rawText || '';

  if (!rawText) {
    return new Response(
      JSON.stringify({ error: 'No rawText available' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const promptConfig = getEnhancedPrompt(artifact.type);
  if (!promptConfig) {
    return new Response(
      JSON.stringify({ error: 'No prompt config' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Mark as processing
  await client.artifact.update({
    where: { id: artifact.id },
    data: { 
      status: 'PROCESSING',
      metadata: { 
        ...(artifact.metadata || {}), 
        improvingAt: new Date().toISOString() 
      }
    }
  });

  const encoder = new TextEncoder();

  // Create streaming response
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const OpenAIClass = (await import('openai')).default;
        const openai = new OpenAIClass({ apiKey: process.env.OPENAI_API_KEY });

        const userContent = promptConfig.userPrompt(rawText, `REFINEMENT_INSTRUCTIONS: ${userPrompt}`);

        // Send initial event
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'start', artifactId: artifact.id })}\n\n`)
        );

        // Stream from OpenAI
        const streamResponse = await openai.chat.completions.create({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: promptConfig.systemPrompt },
            { role: 'user', content: userContent }
          ],
          temperature: promptConfig.temperature,
          stream: true,
        });

        let fullContent = '';

        for await (const chunk of streamResponse) {
          const delta = chunk.choices[0]?.delta?.content || '';
          if (delta) {
            fullContent += delta;
            
            // Send delta event
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'delta', content: delta })}\n\n`)
            );
          }
        }

        // Parse and validate final content
        let resultData: any = {};
        try {
          resultData = JSON.parse(fullContent);
        } catch (err) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', error: 'Failed to parse JSON response' })}\n\n`)
          );
          controller.close();
          return;
        }

        const validation = validateExtractedData(artifact.type, resultData);

        // Capture previous confidence for audit trail
        const previousConfidence = artifact.metadata?.confidence || 0;
        const newConfidence = validation?.confidence || 0;

        // Update artifact with enhanced metadata
        const { editableArtifactService } = await import('data-orchestration/src/services/editable-artifact.service');
        await editableArtifactService.updateArtifact(
          artifact.id,
          {
            ...resultData,
            metadata: {
              ...resultData.metadata,
              previousConfidence,
              newConfidence,
              improvedAt: new Date().toISOString(),
              improvementPrompt: userPrompt,
              changeType: 'ai_improvement'
            }
          },
          userId,
          `AI Improvement: ${userPrompt}`
        );

        // Send completion event
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ 
            type: 'complete', 
            artifactId: artifact.id,
            validation,
            success: true 
          })}\n\n`)
        );

        controller.close();
      } catch (error: any) {
        console.error('Streaming improvement error:', error);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ 
            type: 'error', 
            error: error.message || 'Streaming failed' 
          })}\n\n`)
        );
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
