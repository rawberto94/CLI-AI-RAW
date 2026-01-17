/**
 * Legal Review API
 * 
 * Comprehensive legal review and redlining endpoints
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { getLegalReviewService } from '@repo/data-orchestration';

// ============================================================================
// POST - Perform legal review against playbook
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      contractText,
      playbookId = 'default_playbook',
      contractType,
      counterpartyName,
      includePatternAnalysis = false,
      includePrecedents = false,
    } = body;

    if (!contractText) {
      return NextResponse.json(
        { error: 'Contract text is required' },
        { status: 400 }
      );
    }

    const tenantId = (session.user as any).tenantId || 'default';

    const legalReviewService = getLegalReviewService();
    const result = await legalReviewService.reviewContract(contractText, playbookId, {
      tenantId,
      contractType,
      counterpartyName,
      includePatternAnalysis,
      includePrecedents,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Legal review error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to perform legal review',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
