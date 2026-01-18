/**
 * Scheduled Reports API
 * 
 * Manages report schedules, executions, and templates
 */

import { NextRequest, NextResponse } from 'next/server';
import { getScheduledReportsService, ReportSchedule } from '@/lib/reports/scheduled-reports.service';

// GET /api/reports/scheduled
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'list';
    const tenantId = searchParams.get('tenantId') || 'default-tenant';

    const service = getScheduledReportsService();

    switch (action) {
      case 'list': {
        const enabled = searchParams.get('enabled');
        const type = searchParams.get('type');

        const schedules = await service.listSchedules(tenantId, {
          enabled: enabled !== null ? enabled === 'true' : undefined,
          type: type as ReportSchedule['reportType'] | undefined,
        });

        return NextResponse.json({
          success: true,
          data: schedules,
          count: schedules.length,
        });
      }

      case 'get': {
        const id = searchParams.get('id');
        if (!id) {
          return NextResponse.json(
            { success: false, error: 'Schedule ID is required' },
            { status: 400 }
          );
        }

        const schedule = await service.getSchedule(id);
        if (!schedule) {
          return NextResponse.json(
            { success: false, error: 'Schedule not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          data: schedule,
        });
      }

      case 'history': {
        const id = searchParams.get('id');
        if (!id) {
          return NextResponse.json(
            { success: false, error: 'Schedule ID is required' },
            { status: 400 }
          );
        }

        const limit = parseInt(searchParams.get('limit') || '10', 10);
        const history = await service.getExecutionHistory(id, limit);

        return NextResponse.json({
          success: true,
          data: history,
        });
      }

      case 'due': {
        const dueSchedules = await service.getDueSchedules();

        return NextResponse.json({
          success: true,
          data: dueSchedules,
          count: dueSchedules.length,
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Scheduled Reports API] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch scheduled reports' },
      { status: 500 }
    );
  }
}

// POST /api/reports/scheduled
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    const service = getScheduledReportsService();

    switch (action) {
      case 'create': {
        const { schedule } = body;
        
        if (!schedule?.name || !schedule?.reportType || !schedule?.frequency) {
          return NextResponse.json(
            { success: false, error: 'name, reportType, and frequency are required' },
            { status: 400 }
          );
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
          tenantId: schedule.tenantId || 'default-tenant',
          createdBy: schedule.createdBy || 'system',
        });

        return NextResponse.json({
          success: true,
          data: newSchedule,
        });
      }

      case 'update': {
        const { id, updates } = body;
        
        if (!id) {
          return NextResponse.json(
            { success: false, error: 'Schedule ID is required' },
            { status: 400 }
          );
        }

        const updated = await service.updateSchedule(id, updates);
        if (!updated) {
          return NextResponse.json(
            { success: false, error: 'Schedule not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          data: updated,
        });
      }

      case 'trigger': {
        const { id, options } = body;
        
        if (!id) {
          return NextResponse.json(
            { success: false, error: 'Schedule ID is required' },
            { status: 400 }
          );
        }

        const execution = await service.triggerReport(id, options);

        return NextResponse.json({
          success: true,
          data: execution,
        });
      }

      case 'execute': {
        const { id } = body;
        
        if (!id) {
          return NextResponse.json(
            { success: false, error: 'Schedule ID is required' },
            { status: 400 }
          );
        }

        const execution = await service.executeReport(id);

        return NextResponse.json({
          success: true,
          data: execution,
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Scheduled Reports API] POST error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to process request' },
      { status: 500 }
    );
  }
}

// DELETE /api/reports/scheduled
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Schedule ID is required' },
        { status: 400 }
      );
    }

    const service = getScheduledReportsService();
    const deleted = await service.deleteSchedule(id);

    return NextResponse.json({
      success: true,
      deleted,
    });
  } catch (error) {
    console.error('[Scheduled Reports API] DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete schedule' },
      { status: 500 }
    );
  }
}
