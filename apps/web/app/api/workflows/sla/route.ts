import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import prisma from '@/lib/prisma';

// GET /api/workflows/sla - SLA definitions, metrics, breaches, active steps
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'overview';
  const timeRange = searchParams.get('timeRange') || '7d';

  const daysBack = timeRange === '24h' ? 1 : timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

  if (type === 'overview') {
    // Aggregate SLA metrics from workflow_instances and workflow_step_instances
    const [workflows, stepMetrics, breaches] = await Promise.all([
      prisma.$queryRawUnsafe(`
        SELECT 
          wi.status,
          COUNT(*)::int as count,
          AVG(EXTRACT(EPOCH FROM (COALESCE(wi.completed_at, NOW()) - wi.started_at)))::float as avg_duration_seconds
        FROM workflow_instances wi
        WHERE wi.tenant_id = $1 AND wi.created_at >= $2::timestamp
        GROUP BY wi.status
      `, ctx.tenantId, since),

      prisma.$queryRawUnsafe(`
        SELECT
          wsi.step_name,
          wsi.step_type,
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE wsi.status = 'COMPLETED')::int as completed,
          COUNT(*) FILTER (WHERE wsi.status = 'ACTIVE')::int as active,
          COUNT(*) FILTER (WHERE wsi.sla_deadline IS NOT NULL AND wsi.sla_deadline < NOW() AND wsi.status != 'COMPLETED')::int as breached,
          AVG(EXTRACT(EPOCH FROM (COALESCE(wsi.completed_at, NOW()) - wsi.started_at)))::float as avg_duration_seconds
        FROM workflow_step_instances wsi
        JOIN workflow_instances wi ON wi.id = wsi.workflow_instance_id
        WHERE wi.tenant_id = $1 AND wsi.created_at >= $2::timestamp
        GROUP BY wsi.step_name, wsi.step_type
        ORDER BY breached DESC, total DESC
      `, ctx.tenantId, since),

      prisma.$queryRawUnsafe(`
        SELECT
          wsi.id,
          wsi.step_name,
          wsi.step_type,
          wsi.sla_deadline,
          wsi.started_at,
          wsi.status,
          wi.workflow_name,
          wi.contract_id,
          EXTRACT(EPOCH FROM (NOW() - wsi.sla_deadline))::float as overdue_seconds
        FROM workflow_step_instances wsi
        JOIN workflow_instances wi ON wi.id = wsi.workflow_instance_id
        WHERE wi.tenant_id = $1
          AND wsi.sla_deadline IS NOT NULL
          AND wsi.sla_deadline < NOW()
          AND wsi.status NOT IN ('COMPLETED', 'SKIPPED')
        ORDER BY wsi.sla_deadline ASC
        LIMIT 50
      `, ctx.tenantId),
    ]);

    // Compute totals
    const totalWorkflows = (workflows as any[]).reduce((sum: number, w: any) => sum + w.count, 0);
    const completedWorkflows = (workflows as any[]).find((w: any) => w.status === 'COMPLETED')?.count || 0;
    const totalSteps = (stepMetrics as any[]).reduce((sum: number, s: any) => sum + s.total, 0);
    const completedSteps = (stepMetrics as any[]).reduce((sum: number, s: any) => sum + s.completed, 0);
    const totalBreached = (stepMetrics as any[]).reduce((sum: number, s: any) => sum + s.breached, 0);

    return createSuccessResponse(ctx, {
      metrics: {
        totalWorkflows,
        completedWorkflows,
        completionRate: totalWorkflows > 0 ? (completedWorkflows / totalWorkflows * 100).toFixed(1) : 0,
        totalSteps,
        completedSteps,
        stepCompletionRate: totalSteps > 0 ? (completedSteps / totalSteps * 100).toFixed(1) : 0,
        totalBreaches: totalBreached,
        activeBreach: (breaches as any[]).length,
        avgWorkflowDuration: (workflows as any[]).find((w: any) => w.status === 'COMPLETED')?.avg_duration_seconds || 0,
      },
      stepBreakdown: stepMetrics,
      activeBreaches: breaches,
      timeRange,
    });
  }

  if (type === 'active-steps') {
    const activeSteps = await prisma.$queryRawUnsafe(`
      SELECT
        wsi.id,
        wsi.step_name,
        wsi.step_type,
        wsi.status,
        wsi.assignee_id,
        wsi.sla_deadline,
        wsi.started_at,
        wi.workflow_name,
        wi.contract_id,
        CASE 
          WHEN wsi.sla_deadline IS NULL THEN 'NO_SLA'
          WHEN wsi.sla_deadline < NOW() THEN 'BREACHED'
          WHEN wsi.sla_deadline < NOW() + INTERVAL '4 hours' THEN 'AT_RISK'
          ELSE 'ON_TRACK'
        END as sla_status,
        EXTRACT(EPOCH FROM (wsi.sla_deadline - NOW()))::float as seconds_remaining
      FROM workflow_step_instances wsi
      JOIN workflow_instances wi ON wi.id = wsi.workflow_instance_id
      WHERE wi.tenant_id = $1
        AND wsi.status = 'ACTIVE'
      ORDER BY wsi.sla_deadline ASC NULLS LAST
      LIMIT 100
    `, ctx.tenantId);

    return createSuccessResponse(ctx, { activeSteps });
  }

  if (type === 'trends') {
    const trends = await prisma.$queryRawUnsafe(`
      SELECT
        DATE(wsi.completed_at) as date,
        COUNT(*)::int as completed,
        COUNT(*) FILTER (WHERE wsi.sla_deadline IS NOT NULL AND wsi.completed_at <= wsi.sla_deadline)::int as within_sla,
        COUNT(*) FILTER (WHERE wsi.sla_deadline IS NOT NULL AND wsi.completed_at > wsi.sla_deadline)::int as breached
      FROM workflow_step_instances wsi
      JOIN workflow_instances wi ON wi.id = wsi.workflow_instance_id
      WHERE wi.tenant_id = $1 AND wsi.completed_at >= $2::timestamp
      GROUP BY DATE(wsi.completed_at)
      ORDER BY date ASC
    `, ctx.tenantId, since);

    return createSuccessResponse(ctx, { trends, timeRange });
  }

  return createErrorResponse(ctx, 'INVALID_TYPE', 'type must be overview, active-steps, or trends', 400);
});

// POST /api/workflows/sla - Create/update SLA definitions for workflow steps
export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const body = await request.json();
  const { action } = body;

  if (action === 'set-deadline') {
    const { stepInstanceId, deadlineHours } = body;
    if (!stepInstanceId) return createErrorResponse(ctx, 'MISSING_FIELD', 'stepInstanceId required', 400);

    const deadline = new Date(Date.now() + (deadlineHours || 24) * 60 * 60 * 1000);
    await prisma.$queryRawUnsafe(`
      UPDATE workflow_step_instances
      SET sla_deadline = $1
      WHERE id = $2
    `, deadline, stepInstanceId);

    return createSuccessResponse(ctx, { stepInstanceId, slaDeadline: deadline });
  }

  if (action === 'acknowledge-breach') {
    const { stepInstanceId, notes } = body;
    if (!stepInstanceId) return createErrorResponse(ctx, 'MISSING_FIELD', 'stepInstanceId required', 400);

    // Log the acknowledgement in audit trail
    await prisma.auditTrail.create({
      data: {
        tenantId: ctx.tenantId,
        userId: ctx.userId!,
        action: 'SLA_BREACH_ACKNOWLEDGED',
        entityType: 'workflow_step_instance',
        entityId: stepInstanceId,
        metadata: { notes: notes || '', acknowledgedAt: new Date().toISOString() },
      },
    });

    return createSuccessResponse(ctx, { acknowledged: true });
  }

  return createErrorResponse(ctx, 'INVALID_ACTION', 'action must be set-deadline or acknowledge-breach', 400);
});
