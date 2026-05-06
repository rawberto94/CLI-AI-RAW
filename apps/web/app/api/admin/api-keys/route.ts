import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, getApiContext} from '@/lib/api-middleware';
import { createHash, randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';

// API Key Management
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const normalizedRole = ctx.userRole?.toLowerCase();
  if (normalizedRole !== 'admin' && normalizedRole !== 'owner') {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Admin access required', 403);
  }

  try {
    const { prisma } = await import('@/lib/prisma');
    const keys = await prisma.$queryRaw`SELECT id, name, key_prefix, scopes, is_active, last_used_at, usage_count, expires_at, created_at
       FROM api_keys WHERE tenant_id = ${ctx.tenantId} ORDER BY created_at DESC`;
    return createSuccessResponse(ctx, { apiKeys: keys, storageAvailable: true });
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('relation "api_keys" does not exist')) {
      return createSuccessResponse(ctx, {
        apiKeys: [],
        storageAvailable: false,
        warning: 'API key storage is not initialized in this environment.',
      });
    }
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to fetch API keys. Please try again.', 500);
  }
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const normalizedRole = ctx.userRole?.toLowerCase();
  if (normalizedRole !== 'admin' && normalizedRole !== 'owner') {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Admin access required', 403);
  }

  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');

    const rawKey = `ctg_${randomBytes(32).toString('hex')}`;
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.substring(0, 12);
    const expiresAt = body.expiresInDays ? new Date(Date.now() + body.expiresInDays * 86400000) : null;

    await prisma.$queryRaw`INSERT INTO api_keys (id, tenant_id, user_id, name, key_hash, key_prefix, scopes, rate_limit, expires_at)
       VALUES (gen_random_uuid()::text, ${ctx.tenantId}, ${ctx.userId}, ${body.name}, ${keyHash}, ${keyPrefix}, ${JSON.stringify(body.scopes || ['read'])}, ${body.rateLimit || 1000}, ${expiresAt})`;

    return createSuccessResponse(ctx, {
      apiKey: { key: rawKey, keyPrefix, name: body.name, scopes: body.scopes || ['read'], expiresAt },
      warning: 'Store this key securely. It will not be shown again.',
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('relation "api_keys" does not exist')) {
      return createErrorResponse(ctx, 'SERVICE_UNAVAILABLE', 'API key storage is not initialized in this environment.', 503);
    }
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to create API key. Please try again.', 500);
  }
});

export const DELETE = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return createErrorResponse(ctx, 'BAD_REQUEST', 'Key ID is required', 400);
    const { prisma } = await import('@/lib/prisma');
    // IDOR hardening: any tenant member could previously revoke ANY api_key
    // row as long as tenant_id matched — including keys owned by other users
    // (and their automation). Restrict revocation to the key's owner, with
    // an admin/owner override for legitimate tenant cleanup.
    const normalizedRole = ctx.userRole?.toLowerCase();
    const isAdmin = normalizedRole === 'admin' || normalizedRole === 'owner';
    const result: Array<{ id: string }> = isAdmin
      ? await prisma.$queryRaw`UPDATE api_keys SET is_active = false, updated_at = NOW()
           WHERE id = ${id} AND tenant_id = ${ctx.tenantId} RETURNING id`
      : await prisma.$queryRaw`UPDATE api_keys SET is_active = false, updated_at = NOW()
           WHERE id = ${id} AND tenant_id = ${ctx.tenantId} AND user_id = ${ctx.userId} RETURNING id`;
    if (!result || result.length === 0) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'API key not found or not owned by you', 404);
    }
    return createSuccessResponse(ctx, { revoked: true });
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('relation "api_keys" does not exist')) {
      return createErrorResponse(ctx, 'SERVICE_UNAVAILABLE', 'API key storage is not initialized in this environment.', 503);
    }
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to revoke API key. Please try again.', 500);
  }
});

export const PATCH = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { id, isActive } = body as { id?: string; isActive?: boolean };

    if (!id || typeof isActive !== 'boolean') {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Key ID and isActive are required', 400);
    }

    const { prisma } = await import('@/lib/prisma');
    const normalizedRole = ctx.userRole?.toLowerCase();
    const isAdmin = normalizedRole === 'admin' || normalizedRole === 'owner';
    const result: Array<{ id: string }> = isAdmin
      ? await prisma.$queryRaw`UPDATE api_keys SET is_active = ${isActive}, updated_at = NOW()
           WHERE id = ${id} AND tenant_id = ${ctx.tenantId} RETURNING id`
      : await prisma.$queryRaw`UPDATE api_keys SET is_active = ${isActive}, updated_at = NOW()
           WHERE id = ${id} AND tenant_id = ${ctx.tenantId} AND user_id = ${ctx.userId} RETURNING id`;

    if (!result || result.length === 0) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'API key not found or not owned by you', 404);
    }

    return createSuccessResponse(ctx, { updated: true, isActive });
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('relation "api_keys" does not exist')) {
      return createErrorResponse(ctx, 'SERVICE_UNAVAILABLE', 'API key storage is not initialized in this environment.', 503);
    }
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to update API key. Please try again.', 500);
  }
});
