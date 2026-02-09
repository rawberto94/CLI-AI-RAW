import { NextRequest } from "next/server";
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, type AuthenticatedApiContext } from '@/lib/api-middleware';

interface ScheduleRequest {
  name: string;
  templateId: string;
  frequency: "daily" | "weekly" | "monthly";
  dayOfWeek?: number;
  dayOfMonth?: number;
  time: string;
  recipients: string[];
  enabled: boolean;
}

// Mock storage - in production, store in database
const schedules: any[] = [];

export const GET = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  return createSuccessResponse(ctx, { schedules });
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const body: ScheduleRequest = await request.json();

  // Calculate next run time
  const nextRun = calculateNextRun(body);

  const schedule = {
    id: Date.now().toString(),
    ...body,
    createdAt: new Date().toISOString(),
    lastRun: null,
    nextRun: nextRun.toISOString(),
  };

  schedules.push(schedule);

  // In production, this would:
  // 1. Save to database
  // 2. Register cron job with Vercel or similar service
  // 3. Set up email delivery system

  return createSuccessResponse(ctx, { schedule });
});

function calculateNextRun(schedule: ScheduleRequest): Date {
  const now = new Date();
  const [hours, minutes] = schedule.time.split(":").map(Number);

  if (schedule.frequency === "daily") {
    const next = new Date(now);
    next.setHours(hours, minutes, 0, 0);
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
    return next;
  } else if (schedule.frequency === "weekly") {
    const next = new Date(now);
    next.setHours(hours, minutes, 0, 0);
    const currentDay = next.getDay();
    const targetDay = schedule.dayOfWeek || 0;
    let daysUntilTarget = targetDay - currentDay;
    if (daysUntilTarget < 0 || (daysUntilTarget === 0 && next <= now)) {
      daysUntilTarget += 7;
    }
    next.setDate(next.getDate() + daysUntilTarget);
    return next;
  } else {
    // monthly
    const next = new Date(now);
    next.setHours(hours, minutes, 0, 0);
    next.setDate(schedule.dayOfMonth || 1);
    if (next <= now) {
      next.setMonth(next.getMonth() + 1);
    }
    return next;
  }
}
