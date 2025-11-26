import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

  console.log('[SSE] Stream requested:', { contractId, tenantId });

  // Check initial contract status - if already completed, we can send data immediately
  let contract;
  let useMockData = false;
  let isInitiallyCompleted = false;
  
  try {
    contract = await prisma.contract.findUnique({
      where: { id: contractId, tenantId },
      select: { id: true, status: true }
    });
    
    console.log('[SSE] Contract found:', !!contract, 'status:', contract?.status);
    
    if (!contract) {
      // Contract doesn't exist - return 404
      console.log('[SSE] Contract not found, returning 404');
      return new Response(
        JSON.stringify({ error: 'Contract not found' }),
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    } else {
      isInitiallyCompleted = contract.status === 'COMPLETED' || contract.status === 'FAILED';
    }
  } catch (dbError) {
    console.log('[SSE] Database unavailable, using mock stream data');
    useMockData = true;
  }

  // Create SSE stream
  const encoder = new TextEncoder();
  let isClosed = false;
  let pollInterval: NodeJS.Timeout;

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection message with event ID for resume support
      let eventId = 0;
      const sendEvent = (data: object) => {
        eventId++;
        controller.enqueue(
          encoder.encode(`id: ${eventId}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };
      
      sendEvent({
        type: 'connected',
        contractId,
        timestamp: new Date().toISOString()
      });
      
      console.log('[SSE] Stream started for contract:', contractId);
      
      // Heartbeat interval to keep connection alive (every 15 seconds)
      const heartbeatInterval = setInterval(() => {
        if (!isClosed) {
          try {
            sendEvent({
              type: 'heartbeat',
              contractId,
              timestamp: new Date().toISOString()
            });
          } catch (e) {
            // Connection closed
            clearInterval(heartbeatInterval);
          }
        } else {
          clearInterval(heartbeatInterval);
        }
      }, 15000);
      
      // Poll for artifact updates every 1 second (optimized)
      let updateCount = 0;
      let lastArtifactCount = 0;
      let maxPolls = 180; // 3 minutes timeout (180 seconds)
      
      // If already completed, send data once and close immediately
      if (isInitiallyCompleted && !useMockData) {
        try {
          const dbArtifacts = await prisma.artifact.findMany({
            where: { contractId, tenantId },
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              type: true,
              validationStatus: true,
              data: true,
              createdAt: true,
              updatedAt: true
            }
          });
          
          const artifacts = dbArtifacts.map(a => ({
            id: a.id,
            type: a.type,
            status: (a.validationStatus === 'valid') ? 'COMPLETED' : 'PROCESSING',
            hasContent: !!a.data,
            contentLength: JSON.stringify(a.data).length || 0,
            metadata: {},
            createdAt: a.createdAt,
            updatedAt: a.updatedAt
          }));
          
          // Send update
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'update',
              contractId,
              contractStatus: contract!.status,
              processingStage: 'complete',
              errorMessage: null,
              artifacts,
              timestamp: new Date().toISOString()
            })}\n\n`)
          );
          
          // Send complete
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ 
              type: 'complete', 
              contractId,
              status: contract!.status,
              artifactCount: artifacts.length,
              artifacts
            })}\\n\\n`)
          );
          
          controller.close();
          isClosed = true;
          return;
        } catch (error) {
          console.error('[SSE] Error fetching completed artifacts:', error);
          // Fall through to polling
        }
      }
      
      pollInterval = setInterval(async () => {
        if (isClosed) {
          clearInterval(pollInterval);
          return;
        }
        
        updateCount++;
        
        // Timeout after max polls with no progress
        if (updateCount >= maxPolls && lastArtifactCount === 0) {
          console.log('[SSE] Timeout: No artifacts generated after', maxPolls, 'seconds');
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'complete',
              contractId,
              status: 'TIMEOUT',
              artifactCount: 0,
              artifacts: [],
              message: 'Processing timeout - please retry'
            })}\n\n`)
          );
          clearInterval(pollInterval);
          controller.close();
          isClosed = true;
          return;
        }

        try {
          let artifacts: any[] = [];
          let contractStatus = 'PROCESSING';
          
          if (useMockData) {
            // Mock data for when database is unavailable
            const progress = Math.min(updateCount * 10, 100);
            
            // Simulate artifact generation
            const mockArtifacts = [
              { type: 'OVERVIEW', status: progress >= 20 ? 'valid' : 'pending' },
              { type: 'CLAUSES', status: progress >= 40 ? 'valid' : 'pending' },
              { type: 'FINANCIAL', status: progress >= 60 ? 'valid' : 'pending' },
              { type: 'RISK', status: progress >= 80 ? 'valid' : 'pending' },
              { type: 'COMPLIANCE', status: progress >= 100 ? 'valid' : 'pending' },
            ].filter(a => progress >= 20 || a.type === 'OVERVIEW');
            
            artifacts = mockArtifacts.map((a, i) => ({
              id: `mock-artifact-${i}`,
              type: a.type,
              status: a.status,
              hasContent: a.status === 'valid',
              contentLength: a.status === 'valid' ? 1024 : 0,
              metadata: {},
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }));
            
            contractStatus = progress >= 100 ? 'COMPLETED' : 'PROCESSING';
          } else {
            // If initially completed, we can skip contract status check after first fetch
            const shouldCheckStatus = !isInitiallyCompleted || updateCount === 0;
            
            // Fetch current artifacts from database (with connection pooling)
            const [dbArtifacts, updatedContract] = await Promise.all([
              prisma.artifact.findMany({
                where: { contractId, tenantId },
                orderBy: { createdAt: 'asc' },
                select: {
                  id: true,
                  type: true,
                  validationStatus: true,
                  data: true,
                  createdAt: true,
                  updatedAt: true
                }
              }),
              shouldCheckStatus ? prisma.contract.findUnique({
                where: { id: contractId },
                select: { 
                  status: true
                }
              }) : Promise.resolve(contract)
            ]);
            
            artifacts = dbArtifacts.map(a => ({
              id: a.id,
              type: a.type,
              status: (a.validationStatus === 'valid') ? 'COMPLETED' : 'PROCESSING',
              hasContent: !!a.data,
              contentLength: JSON.stringify(a.data).length || 0,
              metadata: {},
              createdAt: a.createdAt,
              updatedAt: a.updatedAt
            }));
            
            contractStatus = updatedContract?.status || 'PROCESSING';
          }

          // Only send update if artifacts changed or status changed
          if (artifacts.length !== lastArtifactCount || contractStatus === 'COMPLETED' || contractStatus === 'FAILED') {
            lastArtifactCount = artifacts.length;
            
            const data = {
              type: 'update',
              contractId,
              contractStatus,
              processingStage: contractStatus === 'COMPLETED' ? 'complete' : 'processing',
              errorMessage: null,
              artifacts,
              timestamp: new Date().toISOString()
            };

            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
            );
          }

          // If contract is completed or failed, close stream
          if (contractStatus === 'COMPLETED' || contractStatus === 'FAILED') {
            // Send final update with artifacts
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ 
                type: 'complete', 
                contractId,
                status: contractStatus,
                artifactCount: artifacts.length,
                artifacts
              })}\n\n`)
            );
            
            clearInterval(pollInterval);
            controller.close();
            isClosed = true;
          }
        } catch (error) {
          console.error('Error polling artifacts:', error);
          
          // Send error notification but keep stream alive
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'error',
              error: 'Temporary polling error',
              recoverable: true,
              timestamp: new Date().toISOString()
            })}\n\n`)
          );
        }
      }, 1000); // Poll every 1 second (optimized)

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        clearInterval(pollInterval);
        clearInterval(heartbeatInterval);
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
      clearInterval(heartbeatInterval);
      isClosed = true;
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
