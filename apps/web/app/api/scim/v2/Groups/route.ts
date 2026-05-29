import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withScimHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { auditLog, AuditAction } from '@/lib/security/audit';

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

function scimGroupResponse(record: any, members?: Array<{ value: string; display?: string }>) {
  return {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
    id: record.id,
    externalId: record.scim_id,
    displayName: record.display_name,
    members: members ?? [],
    meta: { resourceType: 'Group', created: record.created_at, lastModified: record.updated_at },
  };
}

// GET /api/scim/v2/Groups
export const GET = withScimHandler(async (_request: NextRequest, ctx) => {
  try {
    const { prisma } = await import('@/lib/prisma');
    const groups = await prisma.$queryRaw`
      SELECT * FROM scim_sync_records
      WHERE tenant_id = ${ctx.tenantId} AND resource_type = 'Group'
      ORDER BY display_name
    `;

    // Resolve members for each group
    const groupIds = (groups as any[]).map((g: any) => g.internal_id).filter(Boolean);
    const membersByGroup = new Map<string, Array<{ value: string; display?: string }>>();
    if (groupIds.length > 0) {
      const groupMembers = await prisma.userGroupMember.findMany({
        where: { groupId: { in: groupIds } },
        include: { user: { select: { firstName: true, lastName: true } } },
      });
      for (const gm of groupMembers) {
        if (!membersByGroup.has(gm.groupId)) membersByGroup.set(gm.groupId, []);
        const display = [gm.user?.firstName, gm.user?.lastName].filter(Boolean).join(' ') || undefined;
        membersByGroup.get(gm.groupId)!.push({ value: gm.userId, display });
      }
    }

    return createSuccessResponse(ctx, {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: (groups as any[]).length,
      Resources: (groups as any[]).map((g: any) => scimGroupResponse(g, membersByGroup.get(g.internal_id))),
    });
  } catch {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'SCIM error. Please try again.', 500);
  }
});

// POST /api/scim/v2/Groups
export const POST = withScimHandler(async (request: NextRequest, ctx) => {
  try {
    const rawBody = await request.json();
    const parsed = ScimGroupCreateSchema.safeParse(rawBody);
    if (!parsed.success) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Invalid SCIM request body', 400);
    }
    const body = parsed.data;
    const { prisma } = await import('@/lib/prisma');

    const scimId = body.externalId || crypto.randomUUID();

    // Upsert SCIM mapping record
    const result = await prisma.$queryRaw`
      INSERT INTO scim_sync_records (id, tenant_id, scim_id, resource_type, internal_id, display_name, active, sync_source, raw_attributes, last_synced_at)
      VALUES (gen_random_uuid()::text, ${ctx.tenantId}, ${scimId}, 'Group', gen_random_uuid()::text, ${body.displayName}, true, 'ENTRA_ID', ${JSON.stringify(body)}, NOW())
      ON CONFLICT (tenant_id, scim_id) DO UPDATE SET display_name = ${body.displayName}, raw_attributes = ${JSON.stringify(body)}, last_synced_at = NOW(), updated_at = NOW()
      RETURNING *
    `;
    const groupRecord = (result as any[])[0];

    // Upsert corresponding UserGroup
    const userGroup = await prisma.userGroup.upsert({
      where: {
        tenantId_name: {
          tenantId: ctx.tenantId,
          name: body.displayName,
        },
      },
      update: {
        description: `SCIM group synced from ${groupRecord.sync_source || 'IdP'}`,
        isSystem: true,
      },
      create: {
        tenantId: ctx.tenantId,
        name: body.displayName,
        description: `SCIM group synced from ${groupRecord.sync_source || 'IdP'}`,
        isSystem: true,
        color: '#8B5CF6',
      },
    });

    // Update scim_sync_records internal_id to point to the actual UserGroup
    await prisma.$queryRaw`
      UPDATE scim_sync_records
      SET internal_id = ${userGroup.id}
      WHERE tenant_id = ${ctx.tenantId} AND resource_type = 'Group' AND scim_id = ${scimId}
    `;

    // Resolve members if provided
    if (body.members && body.members.length > 0) {
      const memberScimIds = body.members.map(m => m.value);
      const memberRecords = await prisma.$queryRaw<Array<{ scim_id: string; internal_id: string }>>`
        SELECT scim_id, internal_id FROM scim_sync_records
        WHERE tenant_id = ${ctx.tenantId} AND resource_type = 'User' AND scim_id = ANY(${memberScimIds})
      `;
      const memberMap = new Map(memberRecords.map(r => [r.scim_id, r.internal_id]));

      const existingMembers = await prisma.userGroupMember.findMany({
        where: { groupId: userGroup.id },
        select: { userId: true },
      });
      const existingUserIds = new Set(existingMembers.map(m => m.userId));

      for (const member of body.members) {
        const userId = memberMap.get(member.value);
        if (userId && !existingUserIds.has(userId)) {
          await prisma.userGroupMember.create({
            data: {
              groupId: userGroup.id,
              userId,
              role: 'member',
            },
          }).catch(() => {
            // Ignore duplicate member errors
          });
        }
      }
    }

    await auditLog({
      action: AuditAction.GROUP_CREATED,
      tenantId: ctx.tenantId,
      resourceType: 'group',
      resourceId: userGroup.id,
      metadata: { scimId, displayName: body.displayName, source: 'scim', members: body.members?.length ?? 0 },
      request,
    });

    return createSuccessResponse(ctx, scimGroupResponse(groupRecord));
  } catch {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'SCIM create error. Please try again.', 500);
  }
});
