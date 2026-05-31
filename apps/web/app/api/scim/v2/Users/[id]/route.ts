import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withScimHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { auditLog, AuditAction } from '@/lib/security/audit';

export const dynamic = 'force-dynamic';

const ScimUserUpdateSchema = z.object({
  userName: z.string().max(255).optional(),
  displayName: z.string().max(255).optional(),
  name: z.object({
    formatted: z.string().optional(),
    givenName: z.string().optional(),
    familyName: z.string().optional(),
  }).optional(),
  emails: z.array(z.object({
    value: z.string().email(),
    type: z.string().optional(),
    primary: z.boolean().optional(),
  })).optional(),
  active: z.boolean().optional(),
  externalId: z.string().optional(),
  schemas: z.array(z.string()).optional(),
});

function scimUserResponse(record: any) {
  return {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
    id: record.id,
    externalId: record.scim_id,
    userName: record.email,
    displayName: record.display_name,
    active: record.active,
    meta: { resourceType: 'User', created: record.created_at, lastModified: record.updated_at },
  };
}

// GET /api/scim/v2/Users/{id}
export const GET = withScimHandler(async (_request: NextRequest, ctx) => {
  const params = await (ctx as any).params as { id: string };
  const id = params?.id;
  if (!id) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'User ID is required', 400);
  }

  try {
    const { prisma } = await import('@/lib/prisma');
    const users = await prisma.$queryRaw`
      SELECT * FROM scim_sync_records
      WHERE tenant_id = ${ctx.tenantId} AND resource_type = 'User' AND id = ${id}
      LIMIT 1
    `;
    const user = (users as any[])[0];
    if (!user) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'User not found', 404);
    }
    return createSuccessResponse(ctx, scimUserResponse(user));
  } catch (error: unknown) {
    console.error('[SCIM] GET User error:', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'SCIM error. Please try again.', 500);
  }
});

// PUT /api/scim/v2/Users/{id}
export const PUT = withScimHandler(async (request: NextRequest, ctx) => {
  const params = await (ctx as any).params as { id: string };
  const id = params?.id;
  if (!id) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'User ID is required', 400);
  }

  try {
    const rawBody = await request.json();
    const parsed = ScimUserUpdateSchema.safeParse(rawBody);
    if (!parsed.success) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Invalid SCIM request body', 400);
    }
    const body = parsed.data;
    const { prisma } = await import('@/lib/prisma');

    const email = body.emails?.[0]?.value || body.userName;
    const displayName = body.displayName || body.name?.formatted || `${body.name?.givenName || ''} ${body.name?.familyName || ''}`.trim();

    const result = await prisma.$queryRaw`
      UPDATE scim_sync_records
      SET display_name = ${displayName}, email = ${email}, active = ${body.active ?? true},
          raw_attributes = ${JSON.stringify(body)}, last_synced_at = NOW(), updated_at = NOW()
      WHERE tenant_id = ${ctx.tenantId} AND resource_type = 'User' AND id = ${id}
      RETURNING *
    `;
    const updated = (result as any[])[0];
    if (!updated) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'User not found', 404);
    }

    // Also update the actual user record
    if (updated.internal_id) {
      await prisma.user.updateMany({
        where: { tenantId: ctx.tenantId, id: updated.internal_id },
        data: { firstName: displayName, status: body.active === false ? 'INACTIVE' : 'ACTIVE' },
      });
    }

    await auditLog({
      action: body.active === false ? AuditAction.USER_DEACTIVATED : AuditAction.USER_UPDATED,
      tenantId: ctx.tenantId,
      resourceType: 'user',
      resourceId: updated.internal_id,
      metadata: { scimId: id, email, source: 'scim', active: body.active },
      request,
    });

    return createSuccessResponse(ctx, scimUserResponse(updated));
  } catch (error: unknown) {
    console.error('[SCIM] PUT User error:', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'SCIM update error. Please try again.', 500);
  }
});

// PATCH /api/scim/v2/Users/{id}
export const PATCH = withScimHandler(async (request: NextRequest, ctx) => {
  const params = await (ctx as any).params as { id: string };
  const id = params?.id;
  if (!id) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'User ID is required', 400);
  }

  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');

    // Handle SCIM patch operations
    const operations = body.Operations || [];
    let active: boolean | undefined;
    let displayName: string | undefined;
    let email: string | undefined;

    for (const op of operations) {
      if (op.op === 'Replace' || op.op === 'replace') {
        if (op.path === 'active') active = op.value;
        if (op.path === 'displayName') displayName = op.value;
        if (op.path === 'emails') email = Array.isArray(op.value) ? op.value[0]?.value : op.value;
      }
    }

    const result = await prisma.$queryRaw`
      UPDATE scim_sync_records
      SET active = COALESCE(${active}, active),
          display_name = COALESCE(${displayName}, display_name),
          email = COALESCE(${email}, email),
          updated_at = NOW()
      WHERE tenant_id = ${ctx.tenantId} AND resource_type = 'User' AND id = ${id}
      RETURNING *
    `;
    const updated = (result as any[])[0];
    if (!updated) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'User not found', 404);
    }

    if (active !== undefined && updated.internal_id) {
      await prisma.user.updateMany({
        where: { tenantId: ctx.tenantId, id: updated.internal_id },
        data: { status: active === false ? 'INACTIVE' : 'ACTIVE' },
      });
    }

    await auditLog({
      action: active === false ? AuditAction.USER_DEACTIVATED : AuditAction.USER_UPDATED,
      tenantId: ctx.tenantId,
      resourceType: 'user',
      resourceId: updated.internal_id,
      metadata: { scimId: id, source: 'scim', active },
      request,
    });

    return createSuccessResponse(ctx, scimUserResponse(updated));
  } catch (error: unknown) {
    console.error('[SCIM] PATCH User error:', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'SCIM patch error. Please try again.', 500);
  }
});

// DELETE /api/scim/v2/Users/{id}
export const DELETE = withScimHandler(async (_request: NextRequest, ctx) => {
  const params = await (ctx as any).params as { id: string };
  const id = params?.id;
  if (!id) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'User ID is required', 400);
  }

  try {
    const { prisma } = await import('@/lib/prisma');

    const records = await prisma.$queryRaw<Array<{ internal_id: string }>>`
      SELECT internal_id FROM scim_sync_records
      WHERE tenant_id = ${ctx.tenantId} AND resource_type = 'User' AND id = ${id}
      LIMIT 1
    `;

    // Soft-delete: mark inactive instead of hard delete
    await prisma.$queryRaw`
      UPDATE scim_sync_records
      SET active = false, updated_at = NOW()
      WHERE tenant_id = ${ctx.tenantId} AND resource_type = 'User' AND id = ${id}
    `;

    if (records && records.length > 0 && records[0].internal_id) {
      await prisma.user.updateMany({
        where: { tenantId: ctx.tenantId, id: records[0].internal_id },
        data: { status: 'INACTIVE' },
      });

      await auditLog({
        action: AuditAction.USER_DEACTIVATED,
        tenantId: ctx.tenantId,
        resourceType: 'user',
        resourceId: records[0].internal_id,
        metadata: { scimId: id, source: 'scim' },
      });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error: unknown) {
    console.error('[SCIM] DELETE User error:', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'SCIM delete error. Please try again.', 500);
  }
});
