/**
 * Scheduled Reports API
 * 
 * Manages report schedules, executions, and templates
 */

import { NextRequest } from 'next/server';
import { getScheduledReportsService, ReportSchedule } from '@/lib/reports/scheduled-reports.service';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

// GET /api/reports/scheduled
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'list';
  const tenantId = searchParams.get('tenantId') || ctx.tenantId;

  const service = getScheduledReportsService();

  switch (action) {
    case 'list': {
      const enabled = searchParams.get('enabled');
      const type = searchParams.get('type');

      const schedules = await service.listSchedules(tenantId, {
        enabled: enabled !== null ? enabled === 'true' : undefined,
        type: type as ReportSchedule['reportType'] | undefined,
      });

      return createSuccessResponse(ctx, {
        data: schedules,
        count: schedules.length,
      });
    }

    case 'get': {
      const id = searchParams.get('id');
      if (!id) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'Schedule ID is required', 400);
      }

      const schedule = await service.getSchedule(id);
      if (!schedule) {
        return createErrorResponse(ctx, 'NOT_FOUND', 'Schedule not found', 404);
      }

      return createSuccessResponse(ctx, schedule);
    }

    case 'history': {
      const id = searchParams.get('id');
      if (!id) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'Schedule ID is required', 400);
      }

      const limit = parseInt(searchParams.get('limit') || '10', 10);
      const history = await service.getExecutionHistory(id, limit);

      return createSuccessResponse(ctx, history);
    }

    case 'due': {
      const dueSchedules = await service.getDueSchedules();

      return createSuccessResponse(ctx, {
        data: dueSchedules,
        count: dueSchedules.length,
      });
    }

    default:
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid action', 400);
  }
});

// POST /api/reports/scheduled
export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const body = await request.json();
  const { action } = body;

  const service = getScheduledReportsService();

  switch (action) {
    case 'create': {
      const { schedule } = body;
      
      if (!schedule?.name || !schedule?.reportType || !schedule?.frequency) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'name, reportType, and frequency are required', 400);
      }

      const newSchedule = await service.createSchedule({
        name: schedule.name,
        description: schedule.description,
        reportType: schedule.reportType,
        format: schedule.format || 'pdf',
        frequency: schedule.frequency,
        cronExpression: schedule.cronExpression,
        timezone: schedule.timezone || 'UTC',
        enabled: schedule.enabled !== false,
        config: schedule.config || {},
        delivery: schedule.delivery || {},
        tenantId: schedule.tenantId || ctx.tenantId,
        createdBy: schedule.createdBy || ctx.userId,
      });

      return createSuccessResponse(ctx, newSchedule);
    }

    case 'update': {
      const { id, updates } = body;
      
      if (!id) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'Schedule ID is required', 400);
      }

      const updated = await service.updateSchedule(id, updates);
      if (!updated) {
        return createErrorResponse(ctx, 'NOT_FOUND', 'Schedule not found', 404);
      }

      return createSuccessResponse(ctx, updated);
    }

    case 'trigger': {
      const { id, options } = body;
      
      if (!id) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'Schedule ID is required', 400);
      }

      const execution = await service.triggerReport(id, options);

      return createSuccessResponse(ctx, execution);
    }

    case 'execute': {
      const { id } = body;
      
      if (!id) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'Schedule ID is required', 400);
      }

      const execution = await service.executeReport(id);

      return createSuccessResponse(ctx, execution);
    }

    default:
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid action', 400);
  }
});

// DELETE /api/reports/scheduled
export const DELETE = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Schedule ID is required', 400);
  }

  const service = getScheduledReportsService();
  const deleted = await service.deleteSchedule(id);

  return createSuccessResponse(ctx, { deleted });
});
