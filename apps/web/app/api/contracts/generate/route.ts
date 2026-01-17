/**
 * Contract Generation API
 * 
 * Generate contracts from natural language descriptions
 * 
 * @module api/contracts/generate
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { 
  getContractGenerationService, 
  ContractTemplateType,
  GenerationLanguage 
} from '@repo/data-orchestration/services/contract-generation.service';

/**
 * POST /api/contracts/generate
 * 
 * Generate a contract from natural language description
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      prompt,
      templateType,
      variables,
      options,
    } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    const generationService = getContractGenerationService();

    const result = await generationService.generateContract({
      prompt,
      templateType: templateType as ContractTemplateType,
      variables: variables || {},
      options: {
        language: options?.language as GenerationLanguage || 'en',
        tone: options?.tone || 'balanced',
        complexity: options?.complexity || 'standard',
        jurisdiction: options?.jurisdiction,
        includeSchedules: options?.includeSchedules,
        complianceRequirements: options?.complianceRequirements || [],
        playbookId: options?.playbookId,
        maxLength: options?.maxLength,
        styleGuide: options?.styleGuide,
      },
      tenantId: session.user.tenantId || 'default',
      userId: session.user.id,
    });

    return NextResponse.json({
      success: true,
      contract: result,
    });
  } catch (error) {
    console.error('Contract generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate contract' },
      { status: 500 }
    );
  }
}
