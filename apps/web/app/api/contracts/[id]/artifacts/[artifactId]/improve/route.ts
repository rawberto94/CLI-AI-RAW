import { NextRequest, NextResponse } from 'next/server';
import { getEnhancedPrompt, validateExtractedData } from '@/lib/enhanced-prompts';
import { editableArtifactService } from 'data-orchestration/services';
import { dbAdaptor } from 'data-orchestration';
import { queueRAGReindex } from '@/lib/rag/reindex-helper';

// Improve an artifact using a user-supplied refinement prompt
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string; artifactId: string }> }
) {
  const params = await props.params;
  try {
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    const body = await request.json();
    const { userPrompt, userId } = body;

    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });
    if (!userPrompt) return NextResponse.json({ error: 'userPrompt required' }, { status: 400 });

    const client = dbAdaptor.getClient();
    const artifact = await client.artifact.findFirst({ where: { id: params.artifactId, tenantId } });
    if (!artifact) return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });
    if (artifact.contractId !== params.id) return NextResponse.json({ error: 'Artifact does not belong to contract' }, { status: 403 });

    const contract = await client.contract.findFirst({ where: { id: params.id, tenantId } });
    const artifactData = artifact.data as any;
    const rawText = contract?.rawText || artifactData?.text || '';
    if (!rawText) return NextResponse.json({ error: 'No rawText available to improve from' }, { status: 400 });

  const promptConfig = getEnhancedPrompt(artifact.type);
    if (!promptConfig) return NextResponse.json({ error: 'No prompt config for artifact type' }, { status: 400 });

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

    return NextResponse.json({ success: true, artifactId: artifact.id, validation });
  } catch (error) {
    console.error('Error improving artifact:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}
