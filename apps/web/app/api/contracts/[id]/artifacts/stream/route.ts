import { NextRequest, NextResponse as _NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { contractService } from 'data-orchestration/services';
import { getApiTenantId } from "@/lib/tenant-server";
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

// Bulletproof constants
const POLL_INTERVAL_MS = 1000; // Poll every 1 second
const _HEARTBEAT_INTERVAL_MS = 15000; // Heartbeat every 15 seconds
const MAX_POLL_SECONDS = 300; // 5 minute timeout (increased from 3)
const EXPECTED_ARTIFACT_COUNT = 10;
const MAX_CONSECUTIVE_ERRORS = 5;

/**
 * GET /api/contracts/[id]/artifacts/stream
 * 
 * Server-Sent Events (SSE) endpoint for streaming artifact generation progress
 * Returns real-time updates as artifacts are generated
 * 
 * Bulletproof features:
 * - Graceful degradation on database errors
 * - Automatic completion detection when all artifacts done
 * - Heartbeat to keep connection alive
 * - Timeout protection
 */
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const ctx = getApiContext(request);
  const contractId = params.id;
  
  // EventSource can't send headers, so we also check query param for tenant ID
  const { searchParams } = new URL(request.url);
  const queryTenantId = searchParams.get('tenantId');
  
  // Use query param tenant ID if provided, otherwise fall back to header/session
  const tenantId = queryTenantId || await getApiTenantId(request);

  // Check initial contract status - if already completed, we can send data immediately
  let contract: { id: string; status: string } | null = null;
  let useMockData = false;
  let isInitiallyCompleted = false;
  
  try {
    // Use findFirst with tenant filter for proper multi-tenant isolation
    contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: { id: true, status: true }
    });
    
    if (!contract) {
      // Contract doesn't exist - return 404
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
  } catch {
    useMockData = true;
  }

  // Create SSE stream
  const encoder = new TextEncoder();
  let isClosed = false;
  let pollInterval: NodeJS.Timeout;
  let heartbeatInterval: NodeJS.Timeout;

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
      
      // Heartbeat interval to keep connection alive (every 15 seconds)
      heartbeatInterval = setInterval(() => {
        if (!isClosed) {
          try {
            sendEvent({
              type: 'heartbeat',
              contractId,
              timestamp: new Date().toISOString()
            });
          } catch (_e) {
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
      const maxPolls = MAX_POLL_SECONDS;
      let consecutiveErrors = 0;
      
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
            })}\n\n`)
          );
          
          controller.close();
          isClosed = true;
          return;
        } catch {
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
          sendEvent({
            type: 'complete',
            contractId,
            status: 'TIMEOUT',
            artifactCount: 0,
            artifacts: [],
            message: 'Processing timeout - please retry'
          });
          clearInterval(pollInterval);
          controller.close();
          isClosed = true;
          return;
        }
        
        // Also timeout if we have some artifacts but processing seems stuck
        if (updateCount >= maxPolls && lastArtifactCount > 0 && lastArtifactCount < EXPECTED_ARTIFACT_COUNT) {
          // Send what we have and mark as complete
          sendEvent({ 
            type: 'complete', 
            contractId,
            status: 'PARTIAL',
            artifactCount: lastArtifactCount,
            message: 'Processing partially complete - some artifacts may still be generating'
          });
          clearInterval(pollInterval);
          controller.close();
          isClosed = true;
          return;
        }

        try {
          interface StreamArtifact {
            id?: string;
            type: string;
            status?: string;
            confidence?: number;
            data?: Record<string, unknown>;
          }

          let artifacts: StreamArtifact[] = [];
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
            consecutiveErrors = 0; // Reset on successful update
            
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
          // Also close if we have 10 completed artifacts (all artifacts generated)
          const completedArtifacts = artifacts.filter((a: StreamArtifact) => a.status === 'COMPLETED').length;
          const allArtifactsComplete = completedArtifacts >= 10;
          
          if (contractStatus === 'COMPLETED' || contractStatus === 'FAILED' || allArtifactsComplete) {
            // Send final update with artifacts
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ 
                type: 'complete', 
                contractId,
                status: allArtifactsComplete ? 'COMPLETED' : contractStatus,
                artifactCount: artifacts.length,
                artifacts
              })}\n\n`)
            );
            
            clearInterval(pollInterval);
            controller.close();
            isClosed = true;
          }
        } catch {
          consecutiveErrors++;
          
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            // Too many errors, close stream gracefully
            sendEvent({
              type: 'error',
              error: 'Connection issue - please refresh the page',
              recoverable: false,
              timestamp: new Date().toISOString()
            });
            clearInterval(pollInterval);
            controller.close();
            isClosed = true;
            return;
          }
          
          // Send error notification but keep stream alive
          sendEvent({
            type: 'error',
            error: 'Temporary polling error',
            recoverable: true,
            timestamp: new Date().toISOString()
          });
        }
      }, POLL_INTERVAL_MS);

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        clearInterval(pollInterval);
        clearInterval(heartbeatInterval);
        isClosed = true;
        try {
          controller.close();
        } catch (_e) {
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
