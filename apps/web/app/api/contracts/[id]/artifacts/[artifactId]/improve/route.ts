import { NextRequest } from 'next/server';
import { getEnhancedPrompt, validateExtractedData } from '@/lib/enhanced-prompts';
import { editableArtifactService } from 'data-orchestration/services';
import { dbAdaptor } from 'data-orchestration';
import { queueRAGReindex } from '@/lib/rag/reindex-helper';
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

// Improve an artifact using a user-supplied refinement prompt
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string; artifactId: string }> }
) {
  const params = await props.params;
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const tenantId = ctx.tenantId;
    if (!tenantId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant ID is required', 400);
    }

    const body = await request.json();
    const { userPrompt, userId } = body;

    if (!userId) return createErrorResponse(ctx, 'BAD_REQUEST', 'userId required', 400);
    if (!userPrompt) return createErrorResponse(ctx, 'BAD_REQUEST', 'userPrompt required', 400);

    const client = dbAdaptor.getClient();
    const artifact = await client.artifact.findFirst({ where: { id: params.artifactId, tenantId } });
    if (!artifact) return createErrorResponse(ctx, 'NOT_FOUND', 'Artifact not found', 404);
    if (artifact.contractId !== params.id) return createErrorResponse(ctx, 'FORBIDDEN', 'Artifact does not belong to contract', 403);

    const contract = await client.contract.findFirst({ where: { id: params.id, tenantId } });
    const artifactData = artifact.data as any;
    const rawText = contract?.rawText || artifactData?.text || '';
    if (!rawText) return createErrorResponse(ctx, 'BAD_REQUEST', 'No rawText available to improve from', 400);

  const promptConfig = getEnhancedPrompt(artifact.type);
    if (!promptConfig) return createErrorResponse(ctx, 'BAD_REQUEST', 'No prompt config for artifact type', 400);

  // Mark artifact as processing so UI/SSE show progress
  await client.artifact.update({ where: { id: artifact.id }, data: { validationStatus: 'PROCESSING', lastEditedAt: new Date() } });

  // Build messages
    const OpenAIClass = (await import('openai')).default;
    const openai = new OpenAIClass({ apiKey: process.env['OPENAI_API_KEY'] });

    const userContent = promptConfig.userPrompt(rawText, `REFINEMENT_INSTRUCTIONS: ${userPrompt}`);

    const response = await openai.chat.completions.create({
      model: process.env['OPENAI_MODEL'] || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: promptConfig.systemPrompt },
        { role: 'user', content: userContent }
      ],
      temperature: promptConfig.temperature,
      ...(Array.isArray(process.env['JSON_MODE']) || true ? { response_format: { type: 'json_object' } } : {}),
    });

    const responseMessage = response.choices[0]?.message;
    const resultData = JSON.parse(responseMessage?.content || '{}');

    const validation = validateExtractedData(artifact.type, resultData);

    // Persist via editable service so versioning and propagation happen
    await editableArtifactService.updateArtifact(
      artifact.id,
      resultData,
      userId,
      `Improved via user prompt: ${userPrompt}`
    );

    // Queue RAG re-indexing when artifact is improved
    await queueRAGReindex({
      contractId: params.id,
      tenantId,
      reason: `artifact ${artifact.type} improved`,
    });

    return createSuccessResponse(ctx, { success: true, artifactId: artifact.id, validation });
  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
}
