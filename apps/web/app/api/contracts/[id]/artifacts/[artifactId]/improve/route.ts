import { NextRequest, NextResponse } from 'next/server';
import { getEnhancedPrompt, validateExtractedData } from '@/lib/enhanced-prompts';
import { editableArtifactService } from 'data-orchestration/services';
import { dbAdaptor } from 'data-orchestration';

// Improve an artifact using a user-supplied refinement prompt
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string; artifactId: string }> }
) {
  const params = await props.params;
  try {
    const body = await request.json();
    const { userPrompt, userId } = body;

    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });
    if (!userPrompt) return NextResponse.json({ error: 'userPrompt required' }, { status: 400 });

    const client = dbAdaptor.getClient();
    const artifact = await client.artifact.findUnique({ where: { id: params.artifactId } });
    if (!artifact) return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });
    if (artifact.contractId !== params.id) return NextResponse.json({ error: 'Artifact does not belong to contract' }, { status: 403 });

    const contract = await client.contract.findUnique({ where: { id: params.id } });
    const rawText = contract?.rawText || artifact.data?.text || '';
    if (!rawText) return NextResponse.json({ error: 'No rawText available to improve from' }, { status: 400 });

  const promptConfig = getEnhancedPrompt(artifact.type);
    if (!promptConfig) return NextResponse.json({ error: 'No prompt config for artifact type' }, { status: 400 });

  // Mark artifact as processing so UI/SSE show progress
  await client.artifact.update({ where: { id: artifact.id }, data: { status: 'PROCESSING', metadata: { ...(artifact.metadata || {}), improvingAt: new Date().toISOString() } } });

  // Build messages
    const OpenAIClass = (await import('openai')).default;
    const openai = new OpenAIClass({ apiKey: process.env.OPENAI_API_KEY });

    const userContent = promptConfig.userPrompt(rawText, `REFINEMENT_INSTRUCTIONS: ${userPrompt}`);

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: promptConfig.systemPrompt },
        { role: 'user', content: userContent }
      ],
      temperature: promptConfig.temperature,
      ...(Array.isArray(process.env.JSON_MODE) || true ? { response_format: { type: 'json_object' } } : {}),
    });

    const resultData = JSON.parse(response.choices[0].message.content || '{}');

    const validation = validateExtractedData(artifact.type, resultData);

    // Persist via editable service so versioning and propagation happen
    await editableArtifactService.updateArtifact(
      artifact.id,
      resultData,
      userId,
      `Improved via user prompt: ${userPrompt}`
    );

    return NextResponse.json({ success: true, artifactId: artifact.id, validation });
  } catch (error) {
    console.error('Error improving artifact:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}
