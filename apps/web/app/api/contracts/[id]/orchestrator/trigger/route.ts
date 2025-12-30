import { NextRequest, NextResponse } from 'next/server';
import { getApiTenantId } from '@/lib/security/tenant';
import { getContractQueue } from '@/lib/queue/contract-queue';
import { v4 as uuidv4 } from 'uuid';

/**
 * POST /api/contracts/[id]/orchestrator/trigger
 * 
 * Manually trigger the agent orchestrator
 */
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const contractId = params.id;
  const tenantId = await getApiTenantId(request);

  try {
    const queueManager = getContractQueue();
    const requestId = uuidv4();
    const traceId = uuidv4();

    // Enqueue orchestrator job
    const jobId = await queueManager.queueAgentOrchestration(
      {
        contractId,
        tenantId,
        traceId,
        requestId,
        iteration: 0,
      },
      {
        priority: 40,
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Orchestrator triggered successfully',
      jobId,
      traceId,
    });
  } catch (error) {
    console.error('Error triggering orchestrator:', error);
    return NextResponse.json(
      { error: 'Failed to trigger orchestrator' },
      { status: 500 }
    );
  }
}
