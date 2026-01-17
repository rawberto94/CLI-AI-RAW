/**
 * AI Contract Copilot API
 * 
 * Real-time drafting assistance endpoints:
 * - POST /api/copilot - Get suggestions for current text
 * - POST /api/copilot/complete - Get auto-completions
 * - POST /api/copilot/risks - Analyze risks only
 * - POST /api/copilot/apply - Apply a suggestion
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { 
  getAICopilotService,
  type CopilotContext,
  type RealtimeSuggestion 
} from '@repo/data-orchestration';

// ============================================================================
// POST - Get real-time suggestions
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      text, 
      cursorPosition = text?.length || 0,
      contractType,
      counterpartyName,
      contractValue,
      isNegotiating = false,
      userRole = 'drafter',
      playbook,
    } = body;

    if (!text) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    const tenantId = session.user.tenantId || 'default';
    const userId = session.user.id || 'anonymous';

    const context: CopilotContext = {
      tenantId,
      userId,
      contractType,
      counterpartyName,
      contractValue,
      isNegotiating,
      userRole,
      activePlaybook: playbook,
    };

    const copilotService = getAICopilotService();
    const response = await copilotService.getSuggestions(text, cursorPosition, context);

    return NextResponse.json({
      success: true,
      ...response,
    });
  } catch (error) {
    console.error('Copilot error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get suggestions',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
