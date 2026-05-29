import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

const ScimGroupCreateSchema = z.object({
  displayName: z.string().max(255),
  externalId: z.string().optional(),
  members: z.array(z.object({
    value: z.string(),
    display: z.string().optional(),
  })).optional(),
  schemas: z.array(z.string()).optional(),
});

function scimGroupResponse(record: any) {
  return {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
    id: record.scim_id,
    externalId: record.internal_id,
    displayName: record.display_name,
    meta: { resourceType: 'Group', created: record.created_at, lastModified: record.updated_at },
  };
}

// GET /api/scim/v2/Groups
export const GET = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  try {
    const { prisma } = await import('@/lib/prisma');
    const groups = await prisma.$queryRaw`
      SELECT * FROM scim_sync_records
      WHERE tenant_id = ${ctx.tenantId} AND resource_type = 'Group'
      ORDER BY display_name
    `;

    return createSuccessResponse(ctx, {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: (groups as any[]).length,
      Resources: (groups as any[]).map((g: any) => scimGroupResponse(g)),
    });
  } catch {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'SCIM error. Please try again.', 500);
  }
});

// POST /api/scim/v2/Groups
export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const rawBody = await request.json();
    const parsed = ScimGroupCreateSchema.safeParse(rawBody);
    if (!parsed.success) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Invalid SCIM request body', 400);
    }
    const body = parsed.data;
    const { prisma } = await import('@/lib/prisma');

    const result = await prisma.$queryRaw`
      INSERT INTO scim_sync_records (id, tenant_id, scim_id, resource_type, internal_id, display_name, active, sync_source, raw_attributes, last_synced_at)
      VALUES (gen_random_uuid()::text, ${ctx.tenantId}, ${body.externalId || crypto.randomUUID()}, 'Group', gen_random_uuid()::text, ${body.displayName}, true, 'ENTRA_ID', ${JSON.stringify(body)}, NOW())
      ON CONFLICT (tenant_id, scim_id) DO UPDATE SET display_name = ${body.displayName}, raw_attributes = ${JSON.stringify(body)}, last_synced_at = NOW(), updated_at = NOW()
      RETURNING *
    `;
    const group = (result as any[])[0];

    return createSuccessResponse(ctx, scimGroupResponse(group));
  } catch {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'SCIM create error. Please try again.', 500);
  }
});
