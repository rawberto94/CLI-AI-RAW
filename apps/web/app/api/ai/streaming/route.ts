/**
 * Real-time Extraction Streaming API
 * Provides Server-Sent Events (SSE) for real-time extraction progress updates
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

// Dynamic import to avoid build-time resolution issues
async function getStreamingService() {
  const services = await import('data-orchestration/services');
  return (services as any).extractionStreamingService;
}

export const dynamic = 'force-dynamic';

/**
 * GET /api/ai/streaming
 * Connect to extraction progress stream via SSE
 */
export const GET = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const extractionId = searchParams.get('extractionId');

    const streamingService = await getStreamingService();

    // If sessionId provided, connect to existing session
    if (sessionId) {
      const sseStream = streamingService.createSSEStream(sessionId);
      
      return new Response(sseStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no', // Disable nginx buffering
        } });
    }

    // If extractionId provided, get current progress
    if (extractionId) {
      const sessions = streamingService.getAllSessions();
      const matchedSession = sessions.find((s: any) => s.extractionId === extractionId);
      
      if (matchedSession) {
        const progress = streamingService.getProgress(matchedSession.sessionId);
        return createSuccessResponse(ctx, {
          sessionId: matchedSession.sessionId,
          progress });
      }
      
      return createErrorResponse(ctx, 'NOT_FOUND', 'No active extraction session found for this extraction', 404);
    }

    // Return list of active sessions for this tenant
    const allSessions = streamingService.getAllSessions();
    const activeSessions = allSessions.filter((s: any) => 
      s.tenantId === tenantId
    );

    return createSuccessResponse(ctx, {
      sessions: activeSessions.map((s: any) => ({
        sessionId: s.sessionId,
        extractionId: s.extractionId,
        phase: s.progress?.phase,
        overallProgress: s.progress?.overallProgress,
        startedAt: s.startedAt })) });
  });

/**
 * POST /api/ai/streaming
 * Start a new extraction session with streaming
 */
export const POST = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
    const body = await request.json();
    const { extractionId, config } = body;

    if (!extractionId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'extractionId is required', 400);
    }

    const streamingService = await getStreamingService();

    const sessionId = streamingService.startSession(
      extractionId,
      tenantId,
      config
    );

    return createSuccessResponse(ctx, {
      sessionId,
      streamUrl: `/api/ai/streaming?sessionId=${sessionId}`,
      message: 'Extraction session started. Connect to streamUrl for real-time updates.' });
  });

/**
 * PATCH /api/ai/streaming
 * Update extraction progress (internal use)
 */
export const PATCH = withAuthApiHandler(async (request, ctx) => {
    const body = await request.json();
    const { sessionId, phase, progress, fieldProgress, partialResult, message, error } = body;

    if (!sessionId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'sessionId is required', 400);
    }

    const streamingService = await getStreamingService();

    // Update based on what's provided
    if (error) {
      streamingService.updateError(sessionId, error);
    } else if (partialResult) {
      streamingService.updatePartialResult(sessionId, partialResult);
    } else if (fieldProgress) {
      streamingService.updateFieldProgress(sessionId, fieldProgress);
    } else if (phase && progress !== undefined) {
      streamingService.updateProgress(sessionId, phase, progress, message);
    } else {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Must provide phase+progress, fieldProgress, partialResult, or error', 400);
    }

    return createSuccessResponse(ctx, {});
  });

/**
 * DELETE /api/ai/streaming
 * End an extraction session
 */
export const DELETE = withAuthApiHandler(async (request, ctx) => {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'sessionId is required', 400);
    }

    const streamingService = await getStreamingService();
    streamingService.endSession(sessionId);

    return createSuccessResponse(ctx, {
      message: 'Extraction session ended' });
  });
