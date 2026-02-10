import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, getApiContext} from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

// SCIM 2.0 Users Endpoint
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const { prisma } = await import('@/lib/prisma');
    const users = await prisma.$queryRawUnsafe(
      `SELECT * FROM scim_sync_records WHERE tenant_id = $1 AND resource_type = 'User' ORDER BY display_name`, ctx.tenantId
    );

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
  } catch (error: any) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `SCIM error: ${error.message}`, 500);
  }
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');

    const email = body.emails?.[0]?.value || body.userName;
    const displayName = body.displayName || body.name?.formatted || `${body.name?.givenName || ''} ${body.name?.familyName || ''}`.trim();

    // Create or find user in system
    let user = await prisma.user.findFirst({ where: { email, tenantId: ctx.tenantId } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name: displayName,
          tenantId: ctx.tenantId,
          role: 'member',
          status: 'ACTIVE',
        },
      });
    }

    // Store SCIM mapping
    const result = await prisma.$queryRawUnsafe(
      `INSERT INTO scim_sync_records (id, tenant_id, scim_id, resource_type, internal_id, display_name, email, active, sync_source, raw_attributes, last_synced_at)
       VALUES (gen_random_uuid()::text, $1, $2, 'User', $3, $4, $5, $6, 'ENTRA_ID', $7, NOW())
       ON CONFLICT (tenant_id, scim_id) DO UPDATE SET display_name = $4, email = $5, active = $6, raw_attributes = $7, last_synced_at = NOW(), updated_at = NOW()
       RETURNING *`,
      ctx.tenantId, body.externalId || body.id || user.id, user.id,
      displayName, email, body.active ?? true,
      JSON.stringify(body)
    );

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
  } catch (error: any) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `SCIM create error: ${error.message}`, 500);
  }
});
