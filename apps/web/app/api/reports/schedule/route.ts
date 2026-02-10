import { NextRequest } from "next/server";
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, type AuthenticatedApiContext } from '@/lib/api-middleware';
import prisma from '@/lib/prisma';

// Ensure table exists (idempotent)
const ensureTable = async () => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS report_schedules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      created_by UUID,
      name TEXT NOT NULL,
      template_id TEXT NOT NULL,
      frequency TEXT NOT NULL DEFAULT 'weekly',
      day_of_week INT,
      day_of_month INT,
      time_of_day TEXT NOT NULL DEFAULT '09:00',
      recipients JSONB NOT NULL DEFAULT '[]',
      enabled BOOLEAN NOT NULL DEFAULT true,
      last_run TIMESTAMPTZ,
      next_run TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
};

export const GET = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  await ensureTable();
  const schedules = await prisma.$queryRawUnsafe(
    `SELECT * FROM report_schedules WHERE tenant_id = $1 ORDER BY created_at DESC`,
    ctx.tenantId
  );
  return createSuccessResponse(ctx, { schedules });
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  await ensureTable();
  const body = await request.json();
  const { name, templateId, frequency, dayOfWeek, dayOfMonth, time, recipients, enabled } = body;

  if (!name || !templateId) {
    return createErrorResponse(ctx, 'MISSING_FIELDS', 'name and templateId are required', 400);
  }

  const nextRun = calculateNextRun({ frequency: frequency || 'weekly', dayOfWeek, dayOfMonth, time: time || '09:00' });

  const [schedule] = await prisma.$queryRawUnsafe(`
    INSERT INTO report_schedules (tenant_id, created_by, name, template_id, frequency, day_of_week, day_of_month, time_of_day, recipients, enabled, next_run)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11)
    RETURNING *
  `,
    ctx.tenantId, ctx.userId, name, templateId,
    frequency || 'weekly', dayOfWeek || null, dayOfMonth || null,
    time || '09:00', JSON.stringify(recipients || []),
    enabled !== false, nextRun
  ) as any[];

  return createSuccessResponse(ctx, { schedule });
});

export const DELETE = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return createErrorResponse(ctx, 'MISSING_ID', 'id is required', 400);

  await ensureTable();
  await prisma.$queryRawUnsafe(
    `DELETE FROM report_schedules WHERE id = $1::uuid AND tenant_id = $2`,
    id, ctx.tenantId
  );
  return createSuccessResponse(ctx, { deleted: true });
});

function calculateNextRun(schedule: { frequency: string; dayOfWeek?: number; dayOfMonth?: number; time: string }): Date {
  const now = new Date();
  const [hours, minutes] = schedule.time.split(":").map(Number);

  if (schedule.frequency === "daily") {
    const next = new Date(now);
    next.setHours(hours!, minutes!, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next;
  } else if (schedule.frequency === "weekly") {
    const next = new Date(now);
    next.setHours(hours!, minutes!, 0, 0);
    const currentDay = next.getDay();
    const targetDay = schedule.dayOfWeek || 0;
    let daysUntilTarget = targetDay - currentDay;
    if (daysUntilTarget < 0 || (daysUntilTarget === 0 && next <= now)) daysUntilTarget += 7;
    next.setDate(next.getDate() + daysUntilTarget);
    return next;
  } else {
    const next = new Date(now);
    next.setHours(hours!, minutes!, 0, 0);
    next.setDate(schedule.dayOfMonth || 1);
    if (next <= now) next.setMonth(next.getMonth() + 1);
    return next;
  }
}
