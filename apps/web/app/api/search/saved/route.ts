import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, getApiContext} from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

// Saved Searches API — DB-backed with optional alert subscriptions
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const { prisma } = await import('@/lib/prisma');

    // Ensure table exists
    await prisma.$executeRawUnsafe(`
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
    `);

    const searches = await prisma.$queryRawUnsafe(`
      SELECT * FROM saved_searches 
      WHERE tenant_id = $1 AND user_id = $2
      ORDER BY is_pinned DESC, updated_at DESC
    `, ctx.tenantId, ctx.userId);

    return createSuccessResponse(ctx, { searches });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'An internal error occurred. Please try again.', 500);
  }
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');

    const saved = await prisma.$queryRawUnsafe(`
      INSERT INTO saved_searches (tenant_id, user_id, name, query, filters, alert_enabled, alert_frequency, alert_channels, is_pinned)
      VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8::jsonb, $9)
      RETURNING *
    `,
      ctx.tenantId,
      ctx.userId,
      body.name || 'Untitled Search',
      body.query || '',
      JSON.stringify(body.filters || {}),
      body.alertEnabled || false,
      body.alertFrequency || 'daily',
      JSON.stringify(body.alertChannels || ['in_app']),
      body.isPinned || false
    );

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
      await prisma.$executeRawUnsafe(`
        UPDATE saved_searches SET alert_enabled = NOT alert_enabled, updated_at = NOW()
        WHERE id = $1::uuid AND tenant_id = $2 AND user_id = $3
      `, body.id, ctx.tenantId, ctx.userId);
    } else if (body.action === 'toggle-pin') {
      await prisma.$executeRawUnsafe(`
        UPDATE saved_searches SET is_pinned = NOT is_pinned, updated_at = NOW()
        WHERE id = $1::uuid AND tenant_id = $2 AND user_id = $3
      `, body.id, ctx.tenantId, ctx.userId);
    } else {
      await prisma.$executeRawUnsafe(`
        UPDATE saved_searches SET 
          name = COALESCE($4, name),
          query = COALESCE($5, query),
          filters = COALESCE($6::jsonb, filters),
          alert_enabled = COALESCE($7, alert_enabled),
          alert_frequency = COALESCE($8, alert_frequency),
          updated_at = NOW()
        WHERE id = $1::uuid AND tenant_id = $2 AND user_id = $3
      `, body.id, ctx.tenantId, ctx.userId, body.name, body.query, body.filters ? JSON.stringify(body.filters) : null, body.alertEnabled, body.alertFrequency);
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

    await prisma.$executeRawUnsafe(`
      DELETE FROM saved_searches WHERE id = $1::uuid AND tenant_id = $2 AND user_id = $3
    `, id, ctx.tenantId, ctx.userId);

    return createSuccessResponse(ctx, { deleted: true });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'An internal error occurred. Please try again.', 500);
  }
});
