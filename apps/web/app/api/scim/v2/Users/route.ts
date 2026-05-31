import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { withScimHandler, createSuccessResponse, createErrorResponse, getApiContext} from '@/lib/api-middleware';
import { auditLog, AuditAction } from '@/lib/security/audit';

const ScimUserCreateSchema = z.object({
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
  groups: z.array(z.object({
    value: z.string(),
    display: z.string().optional(),
  })).optional(),
  active: z.boolean().optional().default(true),
  externalId: z.string().optional(),
  id: z.string().optional(),
  schemas: z.array(z.string()).optional(),
});

export const dynamic = 'force-dynamic';

function resolveRole(
  defaultRole: string,
  groupMapping: Array<{ ssoGroup: string; appRole: string }>,
  scimGroups?: Array<{ value: string; display?: string }>
): string {
  if (!scimGroups || scimGroups.length === 0) return defaultRole;
  for (const g of scimGroups) {
    const mapping = groupMapping.find(m => m.ssoGroup === g.value || m.ssoGroup === g.display);
    if (mapping) return mapping.appRole;
  }
  return defaultRole;
}

// SCIM 2.0 Users Endpoint
export const GET = withScimHandler(async (request: NextRequest, ctx) => {
  try {
    const { prisma } = await import('@/lib/prisma');
    const users = await prisma.$queryRaw`SELECT * FROM scim_sync_records WHERE tenant_id = ${ctx.tenantId} AND resource_type = 'User' ORDER BY display_name`;

    // SCIM ListResponse format
    return createSuccessResponse(ctx, {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: (users as any[]).length,
      Resources: (users as any[]).map((u: any) => ({
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
        id: u.id,
        externalId: u.scim_id,
        userName: u.email,
        displayName: u.display_name,
        active: u.active,
        meta: { resourceType: 'User', created: u.created_at, lastModified: u.updated_at },
      })),
    });
  } catch (error: unknown) {
    console.error('[SCIM] GET Users error:', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'SCIM error. Please try again.', 500);
  }
});

export const POST = withScimHandler(async (request: NextRequest, ctx) => {
  try {
    const rawBody = await request.json();
    const parsed = ScimUserCreateSchema.safeParse(rawBody);
    if (!parsed.success) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Invalid SCIM request body', 400);
    }
    const body = parsed.data;
    const { prisma } = await import('@/lib/prisma');

    const email = body.emails?.[0]?.value || body.userName;
    if (!email) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Email or userName is required', 400);
    }
    const displayName = body.displayName || body.name?.formatted || `${body.name?.givenName || ''} ${body.name?.familyName || ''}`.trim();

    // Resolve role from SSO provider configuration
    const tenantConfig = await prisma.tenantConfig.findUnique({
      where: { tenantId: ctx.tenantId },
      select: { securitySettings: true },
    });
    const ssoProviders = ((tenantConfig?.securitySettings as any)?.ssoProviders || []) as Array<{
      status?: string;
      enabled?: boolean;
      defaultRole?: string;
      groupMapping?: Array<{ ssoGroup: string; appRole: string }>;
    }>;
    const activeProvider = ssoProviders.find(p => p.enabled || p.status === 'active');
    const defaultRole = activeProvider?.defaultRole || 'member';
    const groupMapping = activeProvider?.groupMapping || [];
    const role = resolveRole(defaultRole, groupMapping, body.groups);

    const isActive = body.active ?? true;

    // Create or find user in system (upsert to prevent race conditions)
    const user = await prisma.user.upsert({
      where: { email },
      update: { firstName: displayName, role, status: isActive ? 'ACTIVE' : 'INACTIVE' },
      create: {
        email,
        firstName: displayName,
        tenantId: ctx.tenantId,
        role,
        status: isActive ? 'ACTIVE' : 'INACTIVE',
      },
    });

    // Store SCIM mapping
    const result = await prisma.$queryRaw`INSERT INTO scim_sync_records (id, tenant_id, scim_id, resource_type, internal_id, display_name, email, active, sync_source, raw_attributes, last_synced_at)
       VALUES (gen_random_uuid()::text, ${ctx.tenantId}, ${body.externalId || body.id || user.id}, 'User', ${user.id}, ${displayName}, ${email}, ${isActive}, 'ENTRA_ID', ${JSON.stringify(body)}, NOW())
       ON CONFLICT (tenant_id, scim_id) DO UPDATE SET display_name = ${displayName}, email = ${email}, active = ${isActive}, raw_attributes = ${JSON.stringify(body)}, last_synced_at = NOW(), updated_at = NOW()
       RETURNING *`;

    const scimUser = (result as any[])[0];

    await auditLog({
      action: isActive ? AuditAction.USER_CREATED : AuditAction.USER_DEACTIVATED,
      tenantId: ctx.tenantId,
      resourceType: 'user',
      resourceId: user.id,
      metadata: { scimId: scimUser.scim_id, email, role, source: 'scim', active: isActive },
      request,
    });

    return createSuccessResponse(ctx, {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      id: scimUser.id,
      externalId: scimUser.scim_id,
      userName: scimUser.email,
      displayName: scimUser.display_name,
      active: scimUser.active,
      meta: { resourceType: 'User', created: scimUser.created_at, lastModified: scimUser.updated_at },
    });
  } catch (error: unknown) {
    console.error('[SCIM] POST User error:', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'SCIM create error. Please try again.', 500);
  }
});
