/**
 * Orchestration Status API
 * 
 * Monitor the unified orchestration service
 */

import { NextRequest, NextResponse } from 'next/server';
import { unifiedOrchestrationService } from '@/packages/data-orchestration/src/services/unified-orchestration.service';

/**
 * GET /api/orchestration/status
 * Get orchestration status, metrics, and configuration
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'health') {
      const health = await unifiedOrchestrationService.healthCheck();
      return NextResponse.json(health);
    }

    if (action === 'metrics') {
      const metrics = unifiedOrchestrationService.getMetrics();
      return NextResponse.json({ success: true, metrics });
    }

    if (action === 'config') {
      const config = unifiedOrchestrationService.getConfig();
      return NextResponse.json({ success: true, config });
    }

    // Default: return all status info
    const [health, metrics, config] = await Promise.all([
      unifiedOrchestrationService.healthCheck(),
      Promise.resolve(unifiedOrchestrationService.getMetrics()),
      Promise.resolve(unifiedOrchestrationService.getConfig()),
    ]);

    return NextResponse.json({
      success: true,
      health,
      metrics,
      config,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Orchestration status error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/orchestration/status
 * Update orchestration configuration
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { config } = body;

    if (!config) {
      return NextResponse.json(
        { success: false, error: 'config object is required' },
        { status: 400 }
      );
    }

    unifiedOrchestrationService.updateConfig(config);

    return NextResponse.json({
      success: true,
      message: 'Configuration updated successfully',
      config: unifiedOrchestrationService.getConfig(),
    });
  } catch (error) {
    console.error('Orchestration config update error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
