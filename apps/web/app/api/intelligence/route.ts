import { NextRequest, NextResponse } from 'next/server';

/**
 * Intelligence Hub API
 * Provides summary data for the intelligence module
 */

// Mock intelligence summary data
const mockIntelligenceSummary = {
  healthScores: {
    average: 72,
    healthy: 18,
    atRisk: 4,
    critical: 2,
    improving: 8,
    declining: 3,
  },
  insights: [
    {
      id: 'i1',
      type: 'risk',
      severity: 'high',
      title: 'High-Value Contract Expiring',
      description: 'GlobalSupply contract ($780K) expires in 17 days with auto-renewal trap.',
      recommendation: 'Review terms and negotiate before deadline.',
      contractId: 'c2',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'i2',
      type: 'opportunity',
      severity: 'medium',
      title: 'Cost Optimization Available',
      description: 'Consolidating cloud storage vendors could save $180K annually.',
      recommendation: 'Initiate vendor consolidation review.',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'i3',
      type: 'compliance',
      severity: 'low',
      title: 'GDPR Clause Update Needed',
      description: '3 contracts need updated data protection clauses by Q2.',
      recommendation: 'Schedule clause amendment reviews.',
      createdAt: new Date().toISOString(),
    },
  ],
  recentActivity: [
    { type: 'health_update', message: 'Contract health recalculated for 24 contracts', time: '5 min ago' },
    { type: 'insight_generated', message: 'New cost optimization opportunity identified', time: '1 hour ago' },
    { type: 'risk_detected', message: 'Auto-renewal deadline approaching for 2 contracts', time: '3 hours ago' },
  ],
  aiCapabilities: {
    searchEnabled: true,
    healthScoresEnabled: true,
    negotiationCopilotEnabled: true,
    knowledgeGraphEnabled: true,
    lastModelUpdate: '2024-03-10',
    processingQueue: 0,
  },
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const section = searchParams.get('section');

  let data: Record<string, unknown> = {};

  if (section === 'health') {
    data = { healthScores: mockIntelligenceSummary.healthScores };
  } else if (section === 'insights') {
    data = { insights: mockIntelligenceSummary.insights };
  } else if (section === 'activity') {
    data = { recentActivity: mockIntelligenceSummary.recentActivity };
  } else {
    data = mockIntelligenceSummary;
  }

  return NextResponse.json({
    success: true,
    data,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'refresh-scores') {
      return NextResponse.json({
        success: true,
        message: 'Health scores refresh initiated',
        data: {
          jobId: `refresh-${Date.now()}`,
          status: 'processing',
          estimatedTime: '30 seconds',
        },
      });
    }

    if (action === 'dismiss-insight') {
      return NextResponse.json({
        success: true,
        message: 'Insight dismissed',
        data: {
          insightId: body.insightId,
          dismissedAt: new Date().toISOString(),
        },
      });
    }

    if (action === 'act-on-insight') {
      return NextResponse.json({
        success: true,
        message: 'Action recorded',
        data: {
          insightId: body.insightId,
          actionTaken: body.actionType,
          actedAt: new Date().toISOString(),
        },
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
