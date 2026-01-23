/**
 * AI Copilot Risk Analysis API
 * 
 * Dedicated endpoint for risk-only analysis
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/tenant-server';
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
      contractType,
      playbook,
    } = body;

    if (!text) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    const tenantId = getSessionTenantId(session);
    const userId = session.user.id || 'anonymous';

    const context: CopilotContext = {
      tenantId,
      userId,
      contractType,
      activePlaybook: playbook,
    };

    const copilotService = getAICopilotService();
    const risks = await copilotService.detectRisks(text, context);

    return NextResponse.json({
      success: true,
      risks,
      totalRisks: risks.length,
      criticalCount: risks.filter(r => r.severity === 'critical').length,
      highCount: risks.filter(r => r.severity === 'high').length,
      mediumCount: risks.filter(r => r.severity === 'medium').length,
      lowCount: risks.filter(r => r.severity === 'low').length,
    });
  } catch (error) {
    console.error('Copilot risk analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze risks' },
      { status: 500 }
    );
  }
}
