/**
 * Real-Time Analytics API
 * 
 * GET - Query metrics and dashboards
 * POST - Record custom events
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAnalyticsService, TimeSeriesQuery } from '@/lib/analytics/real-time-analytics.service';

// GET /api/analytics/real-time
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'dashboard';
    const tenantId = searchParams.get('tenantId') || undefined;

    const analytics = getAnalyticsService();

    switch (action) {
      case 'dashboard': {
        const metrics = await analytics.getDashboardMetrics(tenantId);
        return NextResponse.json({
          success: true,
          data: metrics,
          timestamp: new Date().toISOString(),
        });
      }

      case 'timeseries': {
        const metricId = searchParams.get('metricId');
        if (!metricId) {
          return NextResponse.json(
            { success: false, error: 'metricId is required' },
            { status: 400 }
          );
        }

        const query: TimeSeriesQuery = {
          metricId,
          startTime: new Date(searchParams.get('startTime') || Date.now() - 86400000),
          endTime: new Date(searchParams.get('endTime') || Date.now()),
          interval: (searchParams.get('interval') || '1h') as TimeSeriesQuery['interval'],
          aggregation: (searchParams.get('aggregation') || 'avg') as TimeSeriesQuery['aggregation'],
        };

        const tagsParam = searchParams.get('tags');
        if (tagsParam) {
          try {
            query.tags = JSON.parse(tagsParam);
          } catch {
            // Ignore invalid tags
          }
        }

        const result = await analytics.queryTimeSeries(query);
        return NextResponse.json({
          success: true,
          data: result,
        });
      }

      case 'alerts': {
        const limit = parseInt(searchParams.get('limit') || '20', 10);
        const alerts = await analytics.getAnomalyAlerts(limit);
        return NextResponse.json({
          success: true,
          data: alerts,
        });
      }

      case 'definitions': {
        const definitions = analytics.getMetricDefinitions();
        return NextResponse.json({
          success: true,
          data: definitions,
        });
      }

      case 'stream': {
        // Return SSE stream for real-time updates
        const metricIds = searchParams.get('metrics')?.split(',') || [
          'api.latency',
          'api.requests',
          'users.active',
        ];

        const stream = analytics.createMetricStream(metricIds);

        return new NextResponse(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Analytics API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}

// POST /api/analytics/real-time
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    const analytics = getAnalyticsService();

    switch (action) {
      case 'track': {
        const { eventType, entityType, entityId, metadata, userId, tenantId } = body;
        
        if (!eventType) {
          return NextResponse.json(
            { success: false, error: 'eventType is required' },
            { status: 400 }
          );
        }

        analytics.trackEvent({
          eventType,
          action: body.action || eventType,
          entityType,
          entityId,
          userId,
          tenantId,
          metadata,
        });

        return NextResponse.json({ success: true });
      }

      case 'record': {
        const { metricId, value, tags } = body;
        
        if (!metricId || value === undefined) {
          return NextResponse.json(
            { success: false, error: 'metricId and value are required' },
            { status: 400 }
          );
        }

        await analytics.recordMetric(metricId, value, tags);
        return NextResponse.json({ success: true });
      }

      case 'increment': {
        const { metricId, amount = 1, tags } = body;
        
        if (!metricId) {
          return NextResponse.json(
            { success: false, error: 'metricId is required' },
            { status: 400 }
          );
        }

        await analytics.incrementCounter(metricId, amount, tags);
        return NextResponse.json({ success: true });
      }

      case 'timing': {
        const { metricId, durationMs, tags } = body;
        
        if (!metricId || durationMs === undefined) {
          return NextResponse.json(
            { success: false, error: 'metricId and durationMs are required' },
            { status: 400 }
          );
        }

        await analytics.recordTiming(metricId, durationMs, tags);
        return NextResponse.json({ success: true });
      }

      case 'gauge': {
        const { metricId, value, tags } = body;
        
        if (!metricId || value === undefined) {
          return NextResponse.json(
            { success: false, error: 'metricId and value are required' },
            { status: 400 }
          );
        }

        await analytics.setGauge(metricId, value, tags);
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Analytics API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process analytics event' },
      { status: 500 }
    );
  }
}
