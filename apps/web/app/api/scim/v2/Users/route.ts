import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, getApiContext} from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

// SCIM 2.0 Users Endpoint
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const { prisma } = await import('@/lib/prisma');
    const users = await prisma.$queryRaw`SELECT * FROM scim_sync_records WHERE tenant_id = ${ctx.tenantId} AND resource_type = 'User' ORDER BY display_name`;

    // SCIM ListResponse format
    return createSuccessResponse(ctx, {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: (users as any[]).length,
      Resources: (users as any[]).map((u: any) => ({
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
        id: u.scim_id,
        externalId: u.internal_id,
        userName: u.email,
        displayName: u.display_name,
        active: u.active,
        meta: { resourceType: 'User', created: u.created_at, lastModified: u.updated_at },
      })),
    });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'SCIM error. Please try again.', 500);
  }
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');

    const email = body.emails?.[0]?.value || body.userName;
    const displayName = body.displayName || body.name?.formatted || `${body.name?.givenName || ''} ${body.name?.familyName || ''}`.trim();

    // Create or find user in system (upsert to prevent race conditions)
    const user = await prisma.user.upsert({
      where: { email },
      update: { firstName: displayName },
      create: {
        email,
        name: displayName,
        tenantId: ctx.tenantId,
        role: 'member',
        status: 'ACTIVE',
      } as any,
    });

    // Store SCIM mapping
    const result = await prisma.$queryRaw`INSERT INTO scim_sync_records (id, tenant_id, scim_id, resource_type, internal_id, display_name, email, active, sync_source, raw_attributes, last_synced_at)
       VALUES (gen_random_uuid()::text, ${ctx.tenantId}, ${body.externalId || body.id || user.id}, 'User', ${user.id}, ${displayName}, ${email}, ${body.active ?? true}, 'ENTRA_ID', ${JSON.stringify(body)}, NOW())
       ON CONFLICT (tenant_id, scim_id) DO UPDATE SET display_name = ${displayName}, email = ${email}, active = ${body.active ?? true}, raw_attributes = ${JSON.stringify(body)}, last_synced_at = NOW(), updated_at = NOW()
       RETURNING *`;

    const scimUser = (result as any[])[0];

    return createSuccessResponse(ctx, {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      id: scimUser.scim_id,
      externalId: scimUser.internal_id,
      userName: scimUser.email,
      displayName: scimUser.display_name,
      active: scimUser.active,
      meta: { resourceType: 'User', created: scimUser.created_at, lastModified: scimUser.updated_at },
    });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'SCIM create error. Please try again.', 500);
  }
});
