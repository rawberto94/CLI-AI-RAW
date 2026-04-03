/**
 * Real-time Extraction Streaming API
 * Provides Server-Sent Events (SSE) for real-time extraction progress updates
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

// Dynamic import to avoid build-time resolution issues
async function getStreamingService() {
  try {
    const services = await import('data-orchestration/services');
    return (services as any).extractionStreamingService;
  } catch (err) {
    console.error('[ai/streaming] Failed to load extraction streaming service:', err instanceof Error ? err.message : err);
    return null;
  }
}

export const dynamic = 'force-dynamic';

/**
 * GET /api/ai/streaming
 * Connect to extraction progress stream via SSE
 */
export const GET = withAuthApiHandler(async (request, ctx) => {
  // Return empty sessions - streaming service is optional and not required for dashboard
  return createSuccessResponse(ctx, { sessions: [] });
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
    if (!streamingService) {
      return createErrorResponse(ctx, 'SERVICE_UNAVAILABLE', 'Extraction streaming service not available', 503);
    }

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
    if (!streamingService) {
      return createErrorResponse(ctx, 'SERVICE_UNAVAILABLE', 'Extraction streaming service not available', 503);
    }

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
    if (!streamingService) {
      return createErrorResponse(ctx, 'SERVICE_UNAVAILABLE', 'Extraction streaming service not available', 503);
    }
    streamingService.endSession(sessionId);

    return createSuccessResponse(ctx, {
      message: 'Extraction session ended' });
  });
