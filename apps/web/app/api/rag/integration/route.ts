/**
 * RAG Integration Management API
 * 
 * Endpoints for monitoring and managing RAG integration:
 * - GET: Get integration status and metrics
 * - POST: Manually trigger RAG indexing
 * - PUT: Update configuration
 * - DELETE: Remove contract from RAG
 */

import { NextRequest, NextResponse } from 'next/server';
import { ragIntegrationService } from '@/packages/data-orchestration/src/services/rag-integration.service';

/**
 * GET /api/rag/integration
 * Get RAG integration status, metrics, and retry queue
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'health') {
      const health = await ragIntegrationService.healthCheck();
      return NextResponse.json(health);
    }

    if (action === 'metrics') {
      const metrics = ragIntegrationService.getMetrics();
      return NextResponse.json({ success: true, metrics });
    }

    if (action === 'queue') {
      const queue = ragIntegrationService.getRetryQueue();
      return NextResponse.json({ success: true, queue });
    }

    // Default: return all status info
    const [health, metrics, queue] = await Promise.all([
      ragIntegrationService.healthCheck(),
      Promise.resolve(ragIntegrationService.getMetrics()),
      Promise.resolve(ragIntegrationService.getRetryQueue()),
    ]);

    return NextResponse.json({
      success: true,
      health,
      metrics,
      queue,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('RAG integration status error:', error);
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
 * POST /api/rag/integration
 * Manually trigger RAG indexing for a contract
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, contractId, tenantId, userId, artifacts, contracts } = body;

    if (action === 'index') {
      // Single contract indexing
      if (!contractId || !tenantId) {
        return NextResponse.json(
          { success: false, error: 'contractId and tenantId are required' },
          { status: 400 }
        );
      }

      const result = await ragIntegrationService.manualIndex(
        contractId,
        tenantId,
        userId || 'manual',
        artifacts || []
      );

      return NextResponse.json({
        success: result.success,
        result,
        message: result.success
          ? 'Contract indexed successfully'
          : 'Indexing failed',
      });
    }

    if (action === 'batch') {
      // Batch indexing
      if (!contracts || !Array.isArray(contracts)) {
        return NextResponse.json(
          { success: false, error: 'contracts array is required' },
          { status: 400 }
        );
      }

      const results = await ragIntegrationService.batchIndex(contracts);

      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.filter((r) => !r.success).length;

      return NextResponse.json({
        success: true,
        results,
        summary: {
          total: results.length,
          successful: successCount,
          failed: failureCount,
        },
      });
    }

    if (action === 'reindex') {
      // Re-index a contract
      if (!contractId || !tenantId) {
        return NextResponse.json(
          { success: false, error: 'contractId and tenantId are required' },
          { status: 400 }
        );
      }

      const result = await ragIntegrationService.reindexContract(
        contractId,
        tenantId,
        userId || 'manual',
        artifacts || []
      );

      return NextResponse.json({
        success: result.success,
        result,
        message: result.success
          ? 'Contract re-indexed successfully'
          : 'Re-indexing failed',
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action. Use: index, batch, or reindex' },
      { status: 400 }
    );
  } catch (error) {
    console.error('RAG integration action error:', error);
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
 * PUT /api/rag/integration
 * Update RAG integration configuration
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

    ragIntegrationService.updateConfig(config);

    return NextResponse.json({
      success: true,
      message: 'Configuration updated successfully',
      config: ragIntegrationService.getMetrics().config,
    });
  } catch (error) {
    console.error('RAG integration config update error:', error);
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
 * DELETE /api/rag/integration
 * Remove a contract from RAG system
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get('contractId');
    const tenantId = searchParams.get('tenantId');

    if (!contractId || !tenantId) {
      return NextResponse.json(
        { success: false, error: 'contractId and tenantId are required' },
        { status: 400 }
      );
    }

    await ragIntegrationService.removeFromRAG(contractId, tenantId);

    return NextResponse.json({
      success: true,
      message: 'Contract removed from RAG successfully',
    });
  } catch (error) {
    console.error('RAG integration removal error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
