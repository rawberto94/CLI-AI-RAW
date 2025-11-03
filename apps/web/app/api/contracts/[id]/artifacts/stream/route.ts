import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/packages/clients/db';

/**
 * GET /api/contracts/[id]/artifacts/stream
 * 
 * Server-Sent Events (SSE) endpoint for streaming artifact generation progress
 * Returns real-time updates as artifacts are generated
 */
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const contractId = params.id;
  const tenantId = request.headers.get('x-tenant-id') || 'demo';

  // Validate contract exists
  const contract = await prisma.contract.findUnique({
    where: { id: contractId, tenantId }
  });

  if (!contract) {
    return NextResponse.json(
      { error: 'Contract not found' },
      { status: 404 }
    );
  }

  // Create SSE stream
  const encoder = new TextEncoder();
  let isClosed = false;
  let pollInterval: NodeJS.Timeout;

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'connected', contractId })}\n\n`)
      );

      // Poll for artifact updates every 500ms
      pollInterval = setInterval(async () => {
        if (isClosed) {
          clearInterval(pollInterval);
          return;
        }

        try {
          // Fetch current artifacts
          const artifacts = await prisma.artifact.findMany({
            where: { contractId, tenantId },
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              type: true,
              status: true,
              content: true,
              metadata: true,
              createdAt: true,
              updatedAt: true
            }
          });

          // Check contract status
          const updatedContract = await prisma.contract.findUnique({
            where: { id: contractId },
            select: { 
              status: true,
              processingStage: true,
              errorMessage: true
            }
          });

          // Send artifact update
          const data = {
            type: 'update',
            contractId,
            contractStatus: updatedContract?.status,
            processingStage: updatedContract?.processingStage,
            errorMessage: updatedContract?.errorMessage,
            artifacts: artifacts.map(a => ({
              id: a.id,
              type: a.type,
              status: a.status,
              hasContent: !!a.content,
              contentLength: a.content?.length || 0,
              metadata: a.metadata,
              createdAt: a.createdAt,
              updatedAt: a.updatedAt
            })),
            timestamp: new Date().toISOString()
          };

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );

          // If contract is completed or failed, close stream
          if (updatedContract?.status === 'COMPLETED' || updatedContract?.status === 'FAILED') {
            // Send final update
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ 
                type: 'complete', 
                contractId,
                status: updatedContract.status,
                artifactCount: artifacts.length
              })}\n\n`)
            );
            
            clearInterval(pollInterval);
            controller.close();
            isClosed = true;
          }
        } catch (error) {
          console.error('Error polling artifacts:', error);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ 
              type: 'error', 
              error: 'Failed to fetch artifacts' 
            })}\n\n`)
          );
        }
      }, 500); // Poll every 500ms

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        clearInterval(pollInterval);
        isClosed = true;
        try {
          controller.close();
        } catch (e) {
          // Already closed
        }
      });
    },

    cancel() {
      clearInterval(pollInterval);
      isClosed = true;
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
