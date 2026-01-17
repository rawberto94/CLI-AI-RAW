/**
 * AI Copilot Completions API
 * 
 * Get auto-completions for partial clause text
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { getAICopilotService, type CopilotContext } from '@repo/data-orchestration';

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
    };

    const copilotService = getAICopilotService();
    const completions = await copilotService.getAutoCompletions(text, cursorPosition, context);

    return NextResponse.json({
      success: true,
      ...completions,
    });
  } catch (error) {
    console.error('Copilot completions error:', error);
    return NextResponse.json(
      { error: 'Failed to get completions' },
      { status: 500 }
    );
  }
}
