/**
 * API Route: POST /api/agents/execute
 * Manually trigger an agent execution
 */

import { NextRequest, NextResponse } from 'next/server';
import { agentRegistry } from '@repo/workers/agents';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentName, contractId, tenantId, context } = body;

    if (!agentName || !contractId || !tenantId) {
      return NextResponse.json(
        { error: 'agentName, contractId, and tenantId are required' },
        { status: 400 }
      );
    }

    // Get agent from registry
    const agent = agentRegistry.get(agentName);
    if (!agent) {
      return NextResponse.json(
        { error: `Agent '${agentName}' not found` },
        { status: 404 }
      );
    }

    // Execute agent
    const result = await agent.executeWithTracking({
      contractId,
      tenantId,
      context: context || {},
      metadata: {
        triggeredBy: 'user',
        priority: 'medium',
        timestamp: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      agent: agentName,
      result,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
