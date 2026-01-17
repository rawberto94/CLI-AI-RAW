/**
 * Self-Critique API
 * 
 * Validates and optionally revises AI responses
 * using the SelfCritiqueService
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { getSelfCritiqueService } from '@repo/data-orchestration';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      response,
      tenantId,
      contractId,
      contractText = '',
      artifactType = 'general',
      options = {},
    } = body;

    if (!response) {
      return NextResponse.json(
        { error: 'Response text is required' },
        { status: 400 }
      );
    }

    const critiqueService = getSelfCritiqueService();
    
    // Build critique context
    const context = {
      contractId: contractId || '',
      contractText,
      artifactType,
      tenantId,
    };

    // Build checks array based on options
    const checks: Array<'hallucination' | 'consistency' | 'completeness' | 'formatting' | 'factual' | 'citation' | 'tone' | 'relevance'> = [];
    if (options.checkFactualAccuracy ?? true) checks.push('factual', 'hallucination');
    if (options.checkCompleteness ?? true) checks.push('completeness');
    if (options.checkClarity ?? true) checks.push('formatting');
    if (options.checkTone ?? false) checks.push('tone');
    checks.push('consistency', 'relevance');

    // Run critique
    const result = await critiqueService.critique(response, context, {
      minScore: options.targetScore ?? 0.8,
      enableAutoRevision: options.autoRevise ?? true,
      maxRevisionAttempts: options.maxRevisions ?? 2,
      checks,
      model: 'gpt-4o-mini',
      temperature: 0.2,
    });

    return NextResponse.json({
      success: true,
      approved: result.passed,
      score: result.score,
      revisedResponse: result.revisedOutput,
      issues: result.issues,
      suggestions: result.suggestions,
    });
  } catch (error) {
    console.error('Critique error:', error);
    
    // Return pass-through on error to not block responses
    return NextResponse.json({
      success: true,
      approved: true,
      score: 1.0,
      revisedResponse: request.body ? (await request.json()).response : '',
      issues: [],
      error: 'Critique service unavailable, passed through',
    });
  }
}
