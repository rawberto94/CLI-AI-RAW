import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, getApiContext} from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

// Saved Searches API — DB-backed with optional alert subscriptions
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const { prisma } = await import('@/lib/prisma');

    // Ensure table exists
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS saved_searches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        query TEXT NOT NULL,
        filters JSONB DEFAULT '{}',
        alert_enabled BOOLEAN DEFAULT false,
        alert_frequency TEXT DEFAULT 'daily',
        alert_channels JSONB DEFAULT '["in_app"]',
        last_alert_at TIMESTAMPTZ,
        result_count INTEGER DEFAULT 0,
        is_pinned BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    const searches = await prisma.$queryRaw`
      SELECT * FROM saved_searches 
      WHERE tenant_id = ${ctx.tenantId} AND user_id = ${ctx.userId}
      ORDER BY is_pinned DESC, updated_at DESC
    `;

    return createSuccessResponse(ctx, { searches });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'An internal error occurred. Please try again.', 500);
  }
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');

    const saved = await prisma.$queryRaw`
      INSERT INTO saved_searches (tenant_id, user_id, name, query, filters, alert_enabled, alert_frequency, alert_channels, is_pinned)
      VALUES (${ctx.tenantId}, ${ctx.userId}, ${body.name || 'Untitled Search'}, ${body.query || ''}, ${JSON.stringify(body.filters || {})}::jsonb, ${body.alertEnabled || false}, ${body.alertFrequency || 'daily'}, ${JSON.stringify(body.alertChannels || ['in_app'])}::jsonb, ${body.isPinned || false})
      RETURNING *
    `;

    return createSuccessResponse(ctx, { search: (saved as any[])[0] });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'An internal error occurred. Please try again.', 500);
  }
});

export const PATCH = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');

    if (body.action === 'toggle-alert') {
      await prisma.$executeRaw`
        UPDATE saved_searches SET alert_enabled = NOT alert_enabled, updated_at = NOW()
        WHERE id = ${body.id}::uuid AND tenant_id = ${ctx.tenantId} AND user_id = ${ctx.userId}
      `;
    } else if (body.action === 'toggle-pin') {
      await prisma.$executeRaw`
        UPDATE saved_searches SET is_pinned = NOT is_pinned, updated_at = NOW()
        WHERE id = ${body.id}::uuid AND tenant_id = ${ctx.tenantId} AND user_id = ${ctx.userId}
      `;
    } else {
      await prisma.$executeRaw`
        UPDATE saved_searches SET 
          name = COALESCE(${body.name}, name),
          query = COALESCE(${body.query}, query),
          filters = COALESCE(${body.filters ? JSON.stringify(body.filters) : null}::jsonb, filters),
          alert_enabled = COALESCE(${body.alertEnabled}, alert_enabled),
          alert_frequency = COALESCE(${body.alertFrequency}, alert_frequency),
          updated_at = NOW()
        WHERE id = ${body.id}::uuid AND tenant_id = ${ctx.tenantId} AND user_id = ${ctx.userId}
      `;
    }

    return createSuccessResponse(ctx, { updated: true });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'An internal error occurred. Please try again.', 500);
  }
});

export const DELETE = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return createErrorResponse(ctx, 'VALIDATION_ERROR', 'id required', 400);
    const { prisma } = await import('@/lib/prisma');

    await prisma.$executeRaw`
      DELETE FROM saved_searches WHERE id = ${id}::uuid AND tenant_id = ${ctx.tenantId} AND user_id = ${ctx.userId}
    `;

    return createSuccessResponse(ctx, { deleted: true });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'An internal error occurred. Please try again.', 500);
  }
});
