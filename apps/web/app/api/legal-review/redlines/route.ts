/**
 * Redline Generation API
 * 
 * Generate redlines comparing two contract versions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { getLegalReviewService } from '@repo/data-orchestration';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      originalText,
      proposedText,
      playbookId,
      includeRiskAssessment = true,
    } = body;

    if (!originalText || !proposedText) {
      return NextResponse.json(
        { error: 'Both original and proposed text are required' },
        { status: 400 }
      );
    }

    const tenantId = session.user.tenantId || 'default';

    const legalReviewService = getLegalReviewService();
    const changes = await legalReviewService.generateRedlines(originalText, proposedText, {
      tenantId,
      playbookId,
      includeRiskAssessment,
    });

    // Calculate summary statistics
    const summary = {
      totalChanges: changes.length,
      additions: changes.filter(c => c.type === 'addition').length,
      deletions: changes.filter(c => c.type === 'deletion').length,
      modifications: changes.filter(c => c.type === 'modification').length,
      criticalRisks: changes.filter(c => c.riskAssessment?.severity === 'critical').length,
      highRisks: changes.filter(c => c.riskAssessment?.severity === 'high').length,
    };

    return NextResponse.json({
      success: true,
      changes,
      summary,
    });
  } catch (error) {
    console.error('Redline generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate redlines' },
      { status: 500 }
    );
  }
}
