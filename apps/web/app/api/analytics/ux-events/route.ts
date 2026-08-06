/**
 * POST /api/analytics/ux-events
 * Client-side fire-and-forget UX telemetry sink.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { emitUxEvent } from '@/lib/analytics/ux-events';

const BodySchema = z.object({
  event: z.string().min(1).max(128),
  props: z.record(z.unknown()).optional(),
});

export const POST = withAuthApiHandler(async (req: NextRequest, ctx) => {
  try {
    const body = BodySchema.parse(await req.json());
    await emitUxEvent({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      event: body.event,
      props: body.props,
    });
    return createSuccessResponse(ctx, { ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Invalid event payload', 400, {
        details: error.issues.map((i) => i.message).join('; '),
      });
    }
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to record event', 500);
  }
});
