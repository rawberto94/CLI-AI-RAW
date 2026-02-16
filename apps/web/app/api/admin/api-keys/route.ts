import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, getApiContext} from '@/lib/api-middleware';
import { createHash, randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';

// API Key Management
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const { prisma } = await import('@/lib/prisma');
    const keys = await prisma.$queryRawUnsafe(
      `SELECT id, name, key_prefix, scopes, is_active, last_used_at, usage_count, expires_at, created_at
       FROM api_keys WHERE tenant_id = $1 ORDER BY created_at DESC`, ctx.tenantId
    );
    return createSuccessResponse(ctx, { apiKeys: keys });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to fetch API keys. Please try again.', 500);
  }
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');

    const rawKey = `ctg_${randomBytes(32).toString('hex')}`;
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.substring(0, 12);
    const expiresAt = body.expiresInDays ? new Date(Date.now() + body.expiresInDays * 86400000) : null;

    await prisma.$queryRawUnsafe(
      `INSERT INTO api_keys (id, tenant_id, user_id, name, key_hash, key_prefix, scopes, rate_limit, expires_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8)`,
      ctx.tenantId, ctx.userId, body.name, keyHash, keyPrefix,
      JSON.stringify(body.scopes || ['read']), body.rateLimit || 1000, expiresAt
    );

    return createSuccessResponse(ctx, {
      apiKey: { key: rawKey, keyPrefix, name: body.name, scopes: body.scopes || ['read'], expiresAt },
      warning: 'Store this key securely. It will not be shown again.',
    });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to create API key. Please try again.', 500);
  }
});

export const DELETE = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return createErrorResponse(ctx, 'BAD_REQUEST', 'Key ID is required', 400);
    const { prisma } = await import('@/lib/prisma');
    await prisma.$queryRawUnsafe(
      `UPDATE api_keys SET is_active = false, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`, id, ctx.tenantId
    );
    return createSuccessResponse(ctx, { revoked: true });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to revoke API key. Please try again.', 500);
  }
});
