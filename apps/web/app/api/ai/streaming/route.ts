/**
 * Real-time Extraction Streaming API
 * Provides Server-Sent Events (SSE) for real-time extraction progress updates
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';

// Dynamic import to avoid build-time resolution issues
async function getStreamingService() {
  const services = await import('@repo/data-orchestration/services');
  return (services as any).extractionStreamingService;
}

export const dynamic = 'force-dynamic';

/**
 * GET /api/ai/streaming
 * Connect to extraction progress stream via SSE
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = session.user.tenantId;

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
        },
      });
    }

    // If extractionId provided, get current progress
    if (extractionId) {
      const sessions = streamingService.getAllSessions();
      const matchedSession = sessions.find((s: any) => s.extractionId === extractionId);
      
      if (matchedSession) {
        const progress = streamingService.getProgress(matchedSession.sessionId);
        return NextResponse.json({
          success: true,
          sessionId: matchedSession.sessionId,
          progress,
        });
      }
      
      return NextResponse.json({ 
        success: false, 
        error: 'No active extraction session found for this extraction' 
      }, { status: 404 });
    }

    // Return list of active sessions for this tenant
    const allSessions = streamingService.getAllSessions();
    const activeSessions = allSessions.filter((s: any) => 
      s.tenantId === tenantId
    );

    return NextResponse.json({
      success: true,
      sessions: activeSessions.map((s: any) => ({
        sessionId: s.sessionId,
        extractionId: s.extractionId,
        phase: s.progress?.phase,
        overallProgress: s.progress?.overallProgress,
        startedAt: s.startedAt,
      })),
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to connect to extraction stream' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai/streaming
 * Start a new extraction session with streaming
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = session.user.tenantId;

    const body = await request.json();
    const { extractionId, config } = body;

    if (!extractionId) {
      return NextResponse.json(
        { error: 'extractionId is required' },
        { status: 400 }
      );
    }

    const streamingService = await getStreamingService();

    const sessionId = streamingService.startSession(
      extractionId,
      tenantId,
      config
    );

    return NextResponse.json({
      success: true,
      sessionId,
      streamUrl: `/api/ai/streaming?sessionId=${sessionId}`,
      message: 'Extraction session started. Connect to streamUrl for real-time updates.',
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to start streaming session' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/ai/streaming
 * Update extraction progress (internal use)
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { sessionId, phase, progress, fieldProgress, partialResult, message, error } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: 'Must provide phase+progress, fieldProgress, partialResult, or error' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: 'Failed to update streaming session' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/ai/streaming
 * End an extraction session
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    const streamingService = await getStreamingService();
    streamingService.endSession(sessionId);

    return NextResponse.json({
      success: true,
      message: 'Extraction session ended',
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to end streaming session' },
      { status: 500 }
    );
  }
}
