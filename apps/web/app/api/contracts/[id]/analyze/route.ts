/**
 * Custom AI Analysis API
 * 
 * POST /api/contracts/[id]/analyze
 * 
 * Allows users to ask custom questions about a contract
 * or use pre-built analysis templates.
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  customContractAnalysis, 
  continueConversation,
  getAnalysisTemplates,
  type AnalysisTemplate,
  type ConversationMessage,
} from '@/lib/ai/custom-analysis';

// ============================================================================
// POST - Custom Analysis
// ============================================================================

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const contractId = params.id;

  try {
    const body = await request.json();
    const {
      prompt,
      template,
      conversationHistory,
      focusAreas,
      language,
      format,
    } = body;

    // Validate request
    if (!prompt && !template) {
      return NextResponse.json(
        { error: 'Either prompt or template is required' },
        { status: 400 }
      );
    }

    // Fetch contract text
    const { dbAdaptor } = await import('data-orchestration');
    const contract = await dbAdaptor.getClient().contract.findUnique({
      where: { id: contractId },
      select: {
        id: true,
        fileName: true,
        rawText: true,
        contractArtifacts: {
          select: {
            type: true,
            value: true,
          },
        },
      },
    });

    if (!contract) {
      return NextResponse.json(
        { error: 'Contract not found' },
        { status: 404 }
      );
    }

    // Get contract text - prefer rawText, fall back to artifact data
    let contractText = contract.rawText || '';
    
    if (!contractText && contract.contractArtifacts) {
      // Compile text from artifacts
      const textParts: string[] = [];
      for (const artifact of contract.contractArtifacts) {
        if (artifact.value && typeof artifact.value === 'object') {
          textParts.push(JSON.stringify(artifact.value, null, 2));
        }
      }
      contractText = textParts.join('\n\n');
    }

    if (!contractText) {
      return NextResponse.json(
        { error: 'No contract text available for analysis' },
        { status: 400 }
      );
    }

    // Perform analysis
    const result = await customContractAnalysis({
      prompt: prompt || '',
      contractText,
      template: template as AnalysisTemplate || 'custom',
      conversationHistory: conversationHistory as ConversationMessage[],
      focusAreas,
      language,
      format,
    });

    return NextResponse.json({
      success: true,
      contractId,
      contractName: contract.fileName,
      analysis: result,
    });
  } catch (error) {
    console.error('Custom analysis error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET - Get Available Templates
// ============================================================================

export async function GET() {
  try {
    const templates = getAnalysisTemplates();
    
    return NextResponse.json({
      templates,
      supportedLanguages: ['en', 'de', 'fr', 'it'],
      supportedFormats: ['text', 'json', 'markdown', 'bullet-points'],
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}
