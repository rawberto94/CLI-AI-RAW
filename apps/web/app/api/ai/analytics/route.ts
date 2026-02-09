/**
 * AI Analytics API
 * 
 * Provides endpoints for:
 * - GET: Fetch aggregated AI usage metrics
 * - POST: Track new AI usage events
 */

import { NextRequest } from 'next/server';
import { aiAnalytics, type AIUsageEvent } from '@/lib/ai/analytics.service';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';

export const GET = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
  const userId = ctx.userId;
    const { searchParams } = new URL(request.url);
    const period = (searchParams.get('period') || '7d') as '7d' | '30d' | '90d';
    const view = searchParams.get('view') || 'full'; // full, today, user

    // Validate period
    if (!['7d', '30d', '90d'].includes(period)) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Invalid period. Use 7d, 30d, or 90d', 400);
    }

    if (view === 'today') {
      const todayUsage = await aiAnalytics.getTodayUsage(tenantId);
      return createSuccessResponse(ctx, todayUsage);
    }

    if (view === 'user') {
      const userUsage = await aiAnalytics.getUserUsage(userId, period);
      return createSuccessResponse(ctx, userUsage);
    }

    // Full metrics
    const metrics = await aiAnalytics.getMetrics(period, tenantId);

    return createSuccessResponse(ctx, metrics);
  });

export const POST = withAuthApiHandler(async (request, ctx) => {
    const body = await request.json();

    // Validate required fields
    const requiredFields = ['model', 'endpoint', 'feature', 'inputTokens', 'outputTokens', 'latencyMs', 'success'];
    for (const field of requiredFields) {
      if (body[field] === undefined) {
        return createErrorResponse(ctx, 'BAD_REQUEST', `Missing required field: ${field}`, 400);
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
      userId: ctx.userId as string,
      tenantId: ctx.tenantId as string | undefined,
      contractId: body.contractId,
      metadata: body.metadata };

    await aiAnalytics.trackUsage(event);

    return createSuccessResponse(ctx, { message: 'Usage tracked successfully' });
  });
