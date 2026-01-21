/**
 * AI Analytics API
 * 
 * Provides endpoints for:
 * - GET: Fetch aggregated AI usage metrics
 * - POST: Track new AI usage events
 */

import { NextRequest, NextResponse } from 'next/server';
import { aiAnalytics, type AIUsageEvent } from '@/lib/ai/analytics.service';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = (searchParams.get('period') || '7d') as '7d' | '30d' | '90d';
    const view = searchParams.get('view') || 'full'; // full, today, user

    // Validate period
    if (!['7d', '30d', '90d'].includes(period)) {
      return NextResponse.json(
        { error: 'Invalid period. Use 7d, 30d, or 90d' },
        { status: 400 }
      );
    }

    const tenantId = session.user.tenantId as string | undefined;

    if (view === 'today') {
      const todayUsage = await aiAnalytics.getTodayUsage(tenantId);
      return NextResponse.json({
        success: true,
        data: todayUsage,
      });
    }

    if (view === 'user') {
      const userId = session.user.id as string;
      const userUsage = await aiAnalytics.getUserUsage(userId, period);
      return NextResponse.json({
        success: true,
        data: userUsage,
      });
    }

    // Full metrics
    const metrics = await aiAnalytics.getMetrics(period, tenantId);

    return NextResponse.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error('AI Analytics GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate required fields
    const requiredFields = ['model', 'endpoint', 'feature', 'inputTokens', 'outputTokens', 'latencyMs', 'success'];
    for (const field of requiredFields) {
      if (body[field] === undefined) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    const event: AIUsageEvent = {
      model: body.model,
      endpoint: body.endpoint,
      feature: body.feature,
      inputTokens: body.inputTokens,
      outputTokens: body.outputTokens,
      latencyMs: body.latencyMs,
      success: body.success,
      errorType: body.errorType,
      userId: session.user.id as string,
      tenantId: session.user.tenantId as string | undefined,
      contractId: body.contractId,
      metadata: body.metadata,
    };

    await aiAnalytics.trackUsage(event);

    return NextResponse.json({
      success: true,
      message: 'Usage tracked successfully',
    });
  } catch (error) {
    console.error('AI Analytics POST error:', error);
    return NextResponse.json(
      { error: 'Failed to track usage' },
      { status: 500 }
    );
  }
}
