/**
 * Real-Time Analytics API
 * 
 * GET - Query metrics and dashboards
 * POST - Record custom events
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAnalyticsService, TimeSeriesQuery } from '@/lib/analytics/real-time-analytics.service';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

// GET /api/analytics/real-time
export const GET = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'dashboard';
  const tenantId = searchParams.get('tenantId') || undefined;

  const analytics = getAnalyticsService();

  switch (action) {
    case 'dashboard': {
      const metrics = await analytics.getDashboardMetrics(tenantId);
      return createSuccessResponse(ctx, {
        ...metrics,
        timestamp: new Date().toISOString(),
      });
    }

    case 'timeseries': {
      const metricId = searchParams.get('metricId');
      if (!metricId) {
        return createErrorResponse(ctx, 'MISSING_METRIC_ID', 'metricId is required', 400);
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
      return createSuccessResponse(ctx, result);
    }

    case 'alerts': {
      const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20), 200);
      const alerts = await analytics.getAnomalyAlerts(limit);
      return createSuccessResponse(ctx, alerts);
    }

    case 'definitions': {
      const definitions = analytics.getMetricDefinitions();
      return createSuccessResponse(ctx, definitions);
    }

    case 'stream': {
      // Return SSE stream for real-time updates - raw NextResponse
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
      return createErrorResponse(ctx, 'INVALID_ACTION', 'Invalid action', 400);
  }
});

// POST /api/analytics/real-time
export const POST = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const body = await request.json();
  const { action } = body;

  const analytics = getAnalyticsService();

  switch (action) {
    case 'track': {
      const { eventType, entityType, entityId, metadata, userId, tenantId } = body;
      
      if (!eventType) {
        return createErrorResponse(ctx, 'MISSING_EVENT_TYPE', 'eventType is required', 400);
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

      return createSuccessResponse(ctx, { tracked: true });
    }

    case 'record': {
      const { metricId, value, tags } = body;
      
      if (!metricId || value === undefined) {
        return createErrorResponse(ctx, 'MISSING_FIELDS', 'metricId and value are required', 400);
      }

      await analytics.recordMetric(metricId, value, tags);
      return createSuccessResponse(ctx, { recorded: true });
    }

    case 'increment': {
      const { metricId, amount = 1, tags } = body;
      
      if (!metricId) {
        return createErrorResponse(ctx, 'MISSING_METRIC_ID', 'metricId is required', 400);
      }

      await analytics.incrementCounter(metricId, amount, tags);
      return createSuccessResponse(ctx, { incremented: true });
    }

    case 'timing': {
      const { metricId, durationMs, tags } = body;
      
      if (!metricId || durationMs === undefined) {
        return createErrorResponse(ctx, 'MISSING_FIELDS', 'metricId and durationMs are required', 400);
      }

      await analytics.recordTiming(metricId, durationMs, tags);
      return createSuccessResponse(ctx, { recorded: true });
    }

    case 'gauge': {
      const { metricId, value, tags } = body;
      
      if (!metricId || value === undefined) {
        return createErrorResponse(ctx, 'MISSING_FIELDS', 'metricId and value are required', 400);
      }

      await analytics.setGauge(metricId, value, tags);
      return createSuccessResponse(ctx, { set: true });
    }

    default:
      return createErrorResponse(ctx, 'INVALID_ACTION', 'Invalid action', 400);
  }
});
