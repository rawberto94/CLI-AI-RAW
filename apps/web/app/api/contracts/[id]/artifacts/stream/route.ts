import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';
import { logger } from '@/lib/logger';

// Bulletproof constants
const FAST_POLL_MS = 500; // Poll every 500ms during active processing
const IDLE_POLL_MS = 3000; // Slow to 3s after no changes for a while
const _HEARTBEAT_INTERVAL_MS = 15000; // Heartbeat every 15 seconds
const MAX_POLL_SECONDS = 300; // 5 minute timeout (increased from 3)
const MAX_CONSECUTIVE_ERRORS = 5;
const IDLE_THRESHOLD = 5; // consecutive no-change polls before slowing

// --- P3-24: SSE Rate Limiting ---
// Track active SSE connections per tenant to prevent resource exhaustion
const activeConnections = new Map<string, Set<string>>(); // tenantId -> Set<contractId:timestamp-rand>
const MAX_CONNECTIONS_PER_TENANT = 10;
const MAX_CONNECTIONS_PER_CONTRACT = 3; // Allow a few concurrent viewers
const CONNECTION_TTL_MS = 10 * 60 * 1000; // 10 minutes - stale connection cleanup threshold

// Periodic cleanup of stale connections that failed to release properly
// Lazy-init to avoid accumulating intervals on hot reload
let connectionCleanupStarted = false;
function ensureConnectionCleanup() {
  if (connectionCleanupStarted) return;
  connectionCleanupStarted = true;
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [tenantId, connections] of activeConnections) {
      for (const key of connections) {
        // Key format: contractId:timestamp-rand
        const parts = key.split(':');
        const timestamp = parseInt(parts[1] || '0');
        if (timestamp > 0 && now - timestamp > CONNECTION_TTL_MS) {
          connections.delete(key);
        }
      }
      if (connections.size === 0) {
        activeConnections.delete(tenantId);
      }
    }
  }, 60_000);
  // unref() lets the process exit cleanly without waiting for this timer
  if (typeof interval.unref === 'function') interval.unref();
}

function acquireConnection(tenantId: string, contractId: string): string | null {
  if (!activeConnections.has(tenantId)) {
    activeConnections.set(tenantId, new Set());
  }
  const tenantConns = activeConnections.get(tenantId)!;

  // Check tenant-level limit
  if (tenantConns.size >= MAX_CONNECTIONS_PER_TENANT) {
    return null;
  }

  // Check per-contract limit (count how many entries match this contractId)
  let contractCount = 0;
  for (const key of tenantConns) {
    if (key.startsWith(contractId + ':')) contractCount++;
  }
  if (contractCount >= MAX_CONNECTIONS_PER_CONTRACT) {
    return null;
  }

  const connKey = `${contractId}:${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  tenantConns.add(connKey);
  return connKey;
}

function releaseConnectionByKey(tenantId: string, connKey: string): void {
  const tenantConns = activeConnections.get(tenantId);
  if (!tenantConns) return;
  tenantConns.delete(connKey);
  if (tenantConns.size === 0) {
    activeConnections.delete(tenantId);
  }
}

// --- P3-23: SSE Backpressure ---
// Track queue depth per stream to throttle writes when client can't keep up
const BACKPRESSURE_QUEUE_LIMIT = 50; // Max queued events before throttling
const BACKPRESSURE_POLL_SLOWDOWN_MS = 3000; // Slow polling when backpressure detected

// Processing stage mapping for richer status tracking
const PROCESSING_STAGES = [
  'uploading', 'ocr_processing', 'text_enhancement', 'type_detection',
  'artifact_generation', 'quality_validation', 'rag_indexing', 'complete'
] as const;

type ProcessingStage = typeof PROCESSING_STAGES[number];

function inferProcessingStage(contractStatus: string, artifactCount: number, completedCount: number): ProcessingStage {
  if (contractStatus === 'COMPLETED' || contractStatus === 'FAILED') return 'complete';
  if (completedCount > 0 && completedCount < artifactCount) return 'artifact_generation';
  if (artifactCount > 0 && completedCount === 0) return 'quality_validation';
  if (contractStatus === 'PROCESSING') return 'artifact_generation';
  if (contractStatus === 'UPLOADED') return 'ocr_processing';
  return 'uploading';
}

/**
 * GET /api/contracts/[id]/artifacts/stream
 * 
 * Server-Sent Events (SSE) endpoint for streaming artifact generation progress
 * Returns real-time updates as artifacts are generated
 * 
 * Enhanced features:
 * - Per-artifact status tracking with transition events
 * - Overall progress percentage calculation
 * - Processing stage inference (OCR → enhancement → generation → validation)
 * - Graceful degradation on database errors
 * - Automatic completion detection when all artifacts done
 * - Heartbeat to keep connection alive
 * - Timeout protection
 */
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  ensureConnectionCleanup();
  const params = await props.params;
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  const contractId = params.id;
  
  // Use the middleware-injected tenant ID from the authenticated context.
  // The middleware overwrites x-tenant-id with the session tenant, so ctx.tenantId
  // is authoritative. Do NOT use query param tenantId — it comes from client-side
  // localStorage which may be stale/mismatched with the session.
  const tenantId = ctx.tenantId;

  // --- P3-24: Rate limiting check ---
  const connKey = acquireConnection(tenantId, contractId);
  if (!connKey) {
    return new Response(
      JSON.stringify({ error: 'Too many active streams. Please close other contract views and retry.' }),
      { 
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '5' }
      }
    );
  }
  const connectionKey: string = connKey;

  // Check initial contract status - if already completed, we can send data immediately
  let contract: { id: string; status: string; aiMetadata?: any } | null = null;
  let isInitiallyCompleted = false;
  
  try {
    // Use findFirst with tenant filter for proper multi-tenant isolation
    contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: { id: true, status: true, aiMetadata: true }
    });
    
    if (!contract) {
      // Contract doesn't exist - return 404
      releaseConnectionByKey(tenantId, connectionKey);
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
    // Database error - return 503 instead of silently using mock data
    releaseConnectionByKey(tenantId, connectionKey);
    return new Response(
      JSON.stringify({ error: 'Database unavailable' }),
      { 
        status: 503,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '5' }
      }
    );
  }

  // Create SSE stream
  const encoder = new TextEncoder();
  let isClosed = false;
  let pollInterval: NodeJS.Timeout;
  let heartbeatInterval: NodeJS.Timeout;

  const stream = new ReadableStream({
    async start(controller) {
      // --- P3-23: Backpressure tracking ---
      let queuedEventsCount = 0;
      let isBackpressured = false;
      let currentPollInterval = FAST_POLL_MS;
      let noChangeCount = 0; // Tracks consecutive polls with no changes

      // Send initial connection message with event ID for resume support
      let eventId = 0;
      const sendEvent = (data: object) => {
        if (isClosed) return;
        eventId++;
        queuedEventsCount++;
        
        // Backpressure detection: if we're queuing too many events, slow down
        if (queuedEventsCount > BACKPRESSURE_QUEUE_LIMIT && !isBackpressured) {
          isBackpressured = true;
          currentPollInterval = BACKPRESSURE_POLL_SLOWDOWN_MS;
          logger.warn(`[SSE] Backpressure detected for contract ${contractId}, slowing to ${BACKPRESSURE_POLL_SLOWDOWN_MS}ms`);
          // Restart the poll interval with slower rate
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = setInterval(pollFn, currentPollInterval);
          }
        } else if (queuedEventsCount <= BACKPRESSURE_QUEUE_LIMIT / 2 && isBackpressured) {
          isBackpressured = false;
          currentPollInterval = FAST_POLL_MS;
          noChangeCount = 0;
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = setInterval(pollFn, currentPollInterval);
          }
        }

        try {
          controller.enqueue(
            encoder.encode(`id: ${eventId}\ndata: ${JSON.stringify(data)}\n\n`)
          );
          // Decrement after successful write
          queuedEventsCount = Math.max(0, queuedEventsCount - 1);
        } catch (_e) {
          // Stream closed
        }
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
      // Track per-artifact status for transition detection
      let previousArtifactStatuses: Record<string, string> = {};
      let lastContractStatus = '';

      // Helper to build artifact payload with enhanced fields
      const buildArtifactPayload = (dbArtifacts: Array<{ id: string; type: string; validationStatus: string | null; data: any; qualityScore: number | null; completenessScore: number | null; confidence: any; createdAt: Date; updatedAt: Date }>) => {
        return dbArtifacts.map(a => {
          const dataStr = JSON.stringify(a.data);
          return {
            id: a.id,
            type: a.type,
            status: (!!a.data && dataStr.length > 2) ? 'COMPLETED' : 'PROCESSING',
            hasContent: !!a.data,
            contentLength: dataStr.length || 0,
            qualityScore: a.qualityScore ?? null,
            completenessScore: a.completenessScore ?? null,
            confidence: Number(a.confidence) || null,
            metadata: {},
            createdAt: a.createdAt,
            updatedAt: a.updatedAt
          };
        });
      };

      // Detect which artifacts changed between polls
      const detectTransitions = (artifacts: Array<{ id: string; type: string; status: string }>) => {
        const transitions: Array<{ artifactId: string; type: string; from: string; to: string }> = [];
        for (const a of artifacts) {
          const prev = previousArtifactStatuses[a.id];
          if (prev && prev !== a.status) {
            transitions.push({ artifactId: a.id, type: a.type, from: prev, to: a.status });
          } else if (!prev && a.status) {
            transitions.push({ artifactId: a.id, type: a.type, from: 'NONE', to: a.status });
          }
        }
        // Update tracking
        for (const a of artifacts) {
          previousArtifactStatuses[a.id] = a.status;
        }
        return transitions;
      };
      
      // If already completed, send data once and close immediately
      if (isInitiallyCompleted) {
        try {
          const dbArtifacts = await prisma.artifact.findMany({
            where: { contractId, tenantId },
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              type: true,
              validationStatus: true,
              data: true,
              qualityScore: true,
              completenessScore: true,
              confidence: true,
              createdAt: true,
              updatedAt: true
            }
          });
          
          const artifacts = buildArtifactPayload(dbArtifacts);
          const completedCount = artifacts.filter(a => a.status === 'COMPLETED').length;
          
          // Send update
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'update',
              contractId,
              contractStatus: contract!.status,
              processingStage: 'complete',
              progress: 100,
              errorMessage: null,
              artifacts,
              completedCount,
              totalCount: artifacts.length,
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
              completedCount,
              progress: 100,
              artifacts
            })}\n\n`)
          );
          
          releaseConnectionByKey(tenantId, connectionKey);
          controller.close();
          isClosed = true;
          return;
        } catch {
          // Fall through to polling
        }
      }
      
      pollInterval = setInterval(pollFn, currentPollInterval);

      // Cleanup on close — release rate limit slot
      request.signal.addEventListener('abort', () => {
        clearInterval(pollInterval);
        clearInterval(heartbeatInterval);
        isClosed = true;
        releaseConnectionByKey(tenantId, connectionKey);
        try {
          controller.close();
        } catch (_e) {
          // Already closed
        }
      });

      // Named poll function for backpressure re-scheduling
      async function pollFn() {
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
            completedCount: 0,
            progress: 0,
            artifacts: [],
            message: 'Processing timeout - please retry'
          });
          clearInterval(pollInterval);
          releaseConnectionByKey(tenantId, connectionKey);
          controller.close();
          isClosed = true;
          return;
        }
        
        // Also timeout if we have some artifacts but processing seems stuck
        if (updateCount >= maxPolls && lastArtifactCount > 0) {
          sendEvent({
            type: 'complete', 
            contractId,
            status: 'PARTIAL',
            artifactCount: lastArtifactCount,
            progress: 50,
            message: 'Processing partially complete - some artifacts may still be generating'
          });
          clearInterval(pollInterval);
          releaseConnectionByKey(tenantId, connectionKey);
          controller.close();
          isClosed = true;
          return;
        }

        try {
          let contractStatus = 'PROCESSING';
          
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
                qualityScore: true,
                completenessScore: true,
                confidence: true,
                createdAt: true,
                updatedAt: true
              }
            }),
            shouldCheckStatus ? prisma.contract.findFirst({
              where: { id: contractId, tenantId },
              select: { 
                status: true,
                aiMetadata: true, // Include metadata for expected artifact count
              }
            }) : Promise.resolve(contract)
          ]);
          
          const artifacts = buildArtifactPayload(dbArtifacts);
          contractStatus = updatedContract?.status || 'PROCESSING';

          // Use expectedArtifactCount from worker metadata for accurate progress
          // (instead of just dividing by current DB count which would always be 100%)
          const aiMeta = (updatedContract as any)?.aiMetadata;
          const expectedTotal = aiMeta?.expectedArtifactCount || 0;

          // Detect per-artifact status transitions
          const transitions = detectTransitions(artifacts);
          const completedCount = artifacts.filter(a => a.status === 'COMPLETED').length;
          const totalCount = expectedTotal > 0 ? expectedTotal : artifacts.length;
          const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
          const stage = inferProcessingStage(contractStatus, totalCount, completedCount);

          // Send update if anything changed: new artifacts, status transitions, or contract status changes
          const hasChanges = artifacts.length !== lastArtifactCount 
            || transitions.length > 0 
            || contractStatus !== lastContractStatus
            || contractStatus === 'COMPLETED' 
            || contractStatus === 'FAILED';
          
          if (hasChanges) {
            lastArtifactCount = artifacts.length;
            lastContractStatus = contractStatus;
            consecutiveErrors = 0; // Reset on successful update
            noChangeCount = 0; // Reset idle counter

            // Speed up polling when changes are detected
            if (!isBackpressured && currentPollInterval !== FAST_POLL_MS) {
              currentPollInterval = FAST_POLL_MS;
              clearInterval(pollInterval);
              pollInterval = setInterval(pollFn, currentPollInterval);
            }
            
            const data = {
              type: 'update',
              contractId,
              contractStatus,
              processingStage: stage,
              progress,
              completedCount,
              totalCount,
              transitions: transitions.length > 0 ? transitions : undefined,
              errorMessage: null,
              artifacts,
              timestamp: new Date().toISOString()
            };

            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
            );
          } else {
            // No changes detected — increment idle counter and slow down polling
            noChangeCount++;
            if (noChangeCount >= IDLE_THRESHOLD && !isBackpressured && currentPollInterval !== IDLE_POLL_MS) {
              currentPollInterval = IDLE_POLL_MS;
              clearInterval(pollInterval);
              pollInterval = setInterval(pollFn, currentPollInterval);
            }
          }

          // If contract is completed or failed, close stream
          // Also close if all fetched artifacts are complete (dynamic, not hardcoded)
          const allArtifactsComplete = artifacts.length > 0 && completedCount >= artifacts.length;
          
          if (contractStatus === 'COMPLETED' || contractStatus === 'FAILED' || allArtifactsComplete) {
            // Send final update with artifacts
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ 
                type: 'complete', 
                contractId,
                status: allArtifactsComplete ? 'COMPLETED' : contractStatus,
                artifactCount: artifacts.length,
                completedCount,
                progress: allArtifactsComplete ? 100 : progress,
                artifacts
              })}\n\n`)
            );
            
            clearInterval(pollInterval);
            releaseConnectionByKey(tenantId, connectionKey);
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
            releaseConnectionByKey(tenantId, connectionKey);
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
      }

    },

    cancel() {
      clearInterval(pollInterval);
      clearInterval(heartbeatInterval);
      isClosed = true;
      releaseConnectionByKey(tenantId, connectionKey);
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
