import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withScimHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { auditLog, AuditAction } from '@/lib/security/audit';

export const dynamic = 'force-dynamic';

const ScimGroupUpdateSchema = z.object({
  displayName: z.string().max(255).optional(),
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

async function getGroupMembers(prisma: any, groupId: string): Promise<Array<{ value: string; display?: string }>> {
  const members = await prisma.userGroupMember.findMany({
    where: { groupId },
    include: { user: { select: { firstName: true, lastName: true } } },
  });
  return members.map((m: any) => ({
    value: m.userId,
    display: [m.user?.firstName, m.user?.lastName].filter(Boolean).join(' ') || undefined,
  }));
}

async function syncGroupMembers(
  prisma: any,
  tenantId: string,
  userGroupId: string,
  members: Array<{ value: string; display?: string }>
) {
  if (!members) return;

  // Resolve SCIM user IDs to internal user IDs
  const memberScimIds = members.map(m => m.value);
  const memberRecords = await prisma.$queryRaw<Array<{ scim_id: string; internal_id: string }>>`
    SELECT scim_id, internal_id FROM scim_sync_records
    WHERE tenant_id = ${tenantId} AND resource_type = 'User' AND scim_id = ANY(${memberScimIds})
  `;
  const memberMap = new Map(memberRecords.map(r => [r.scim_id, r.internal_id]));

  // Remove existing members not in the new list
  const newUserIds = new Set(memberMap.values());
  await prisma.userGroupMember.deleteMany({
    where: { groupId: userGroupId, userId: { notIn: Array.from(newUserIds) } },
  });

  // Add new members
  const existing = await prisma.userGroupMember.findMany({
    where: { groupId: userGroupId },
    select: { userId: true },
  });
  const existingUserIds = new Set(existing.map((m: any) => m.userId));

  for (const member of members) {
    const userId = memberMap.get(member.value);
    if (userId && !existingUserIds.has(userId)) {
      await prisma.userGroupMember.create({
        data: { groupId: userGroupId, userId, role: 'member' },
      }).catch(() => {
        // Ignore duplicates
      });
    }
  }
}

// GET /api/scim/v2/Groups/{id}
export const GET = withScimHandler(async (_request: NextRequest, ctx) => {
  const params = await (ctx as any).params as { id: string };
  const id = params?.id;
  if (!id) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Group ID is required', 400);
  }

  try {
    const { prisma } = await import('@/lib/prisma');
    const groups = await prisma.$queryRaw`
      SELECT * FROM scim_sync_records
      WHERE tenant_id = ${ctx.tenantId} AND resource_type = 'Group' AND id = ${id}
      LIMIT 1
    `;
    const group = (groups as any[])[0];
    if (!group) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Group not found', 404);
    }

    const members = await getGroupMembers(prisma, group.internal_id);
    return createSuccessResponse(ctx, scimGroupResponse(group, members));
  } catch {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'SCIM error. Please try again.', 500);
  }
});

// PUT /api/scim/v2/Groups/{id}
export const PUT = withScimHandler(async (request: NextRequest, ctx) => {
  const params = await (ctx as any).params as { id: string };
  const id = params?.id;
  if (!id) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Group ID is required', 400);
  }

  try {
    const rawBody = await request.json();
    const parsed = ScimGroupUpdateSchema.safeParse(rawBody);
    if (!parsed.success) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Invalid SCIM request body', 400);
    }
    const body = parsed.data;
    const { prisma } = await import('@/lib/prisma');

    const result = await prisma.$queryRaw`
      UPDATE scim_sync_records
      SET display_name = ${body.displayName},
          raw_attributes = ${JSON.stringify(body)},
          last_synced_at = NOW(),
          updated_at = NOW()
      WHERE tenant_id = ${ctx.tenantId} AND resource_type = 'Group' AND id = ${id}
      RETURNING *
    `;
    const updated = (result as any[])[0];
    if (!updated) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Group not found', 404);
    }

    // Update corresponding UserGroup
    if (updated.internal_id && body.displayName) {
      await prisma.userGroup.updateMany({
        where: { id: updated.internal_id, tenantId: ctx.tenantId },
        data: { name: body.displayName },
      });
    }

    if (updated.internal_id && body.members) {
      await syncGroupMembers(prisma, ctx.tenantId, updated.internal_id, body.members);
    }

    const members = await getGroupMembers(prisma, updated.internal_id);

    await auditLog({
      action: AuditAction.GROUP_UPDATED,
      tenantId: ctx.tenantId,
      resourceType: 'group',
      resourceId: updated.internal_id,
      metadata: { scimId: id, displayName: body.displayName, source: 'scim' },
      request,
    });

    return createSuccessResponse(ctx, scimGroupResponse(updated, members));
  } catch {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'SCIM update error. Please try again.', 500);
  }
});

// PATCH /api/scim/v2/Groups/{id}
export const PATCH = withScimHandler(async (request: NextRequest, ctx) => {
  const params = await (ctx as any).params as { id: string };
  const id = params?.id;
  if (!id) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Group ID is required', 400);
  }

  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');

    const operations = body.Operations || [];
    let displayName: string | undefined;
    let members: Array<{ value: string; display?: string }> | undefined;

    for (const op of operations) {
      if (op.op === 'Replace' || op.op === 'replace') {
        if (op.path === 'displayName') displayName = op.value;
        if (op.path === 'members') members = op.value;
      }
    }

    const result = await prisma.$queryRaw`
      UPDATE scim_sync_records
      SET display_name = COALESCE(${displayName}, display_name),
          updated_at = NOW()
      WHERE tenant_id = ${ctx.tenantId} AND resource_type = 'Group' AND id = ${id}
      RETURNING *
    `;
    const updated = (result as any[])[0];
    if (!updated) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Group not found', 404);
    }

    if (updated.internal_id && displayName) {
      await prisma.userGroup.updateMany({
        where: { id: updated.internal_id, tenantId: ctx.tenantId },
        data: { name: displayName },
      });
    }

    if (updated.internal_id && members) {
      await syncGroupMembers(prisma, ctx.tenantId, updated.internal_id, members);
    }

    const currentMembers = await getGroupMembers(prisma, updated.internal_id);

    await auditLog({
      action: AuditAction.GROUP_UPDATED,
      tenantId: ctx.tenantId,
      resourceType: 'group',
      resourceId: updated.internal_id,
      metadata: { scimId: id, source: 'scim' },
      request,
    });

    return createSuccessResponse(ctx, scimGroupResponse(updated, currentMembers));
  } catch {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'SCIM patch error. Please try again.', 500);
  }
});

// DELETE /api/scim/v2/Groups/{id}
export const DELETE = withScimHandler(async (_request: NextRequest, ctx) => {
  const params = await (ctx as any).params as { id: string };
  const id = params?.id;
  if (!id) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Group ID is required', 400);
  }

  try {
    const { prisma } = await import('@/lib/prisma');

    const records = await prisma.$queryRaw<Array<{ internal_id: string }>>`
      SELECT internal_id FROM scim_sync_records
      WHERE tenant_id = ${ctx.tenantId} AND resource_type = 'Group' AND id = ${id}
      LIMIT 1
    `;

    await prisma.$queryRaw`
      DELETE FROM scim_sync_records
      WHERE tenant_id = ${ctx.tenantId} AND resource_type = 'Group' AND id = ${id}
    `;

    if (records && records.length > 0 && records[0].internal_id) {
      await prisma.userGroupMember.deleteMany({
        where: { groupId: records[0].internal_id },
      });
      await prisma.userGroup.deleteMany({
        where: { id: records[0].internal_id, tenantId: ctx.tenantId },
      });

      await auditLog({
        action: AuditAction.GROUP_DELETED,
        tenantId: ctx.tenantId,
        resourceType: 'group',
        resourceId: records[0].internal_id,
        metadata: { scimId: id, source: 'scim' },
      });
    }

    return new NextResponse(null, { status: 204 });
  } catch {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'SCIM delete error. Please try again.', 500);
  }
});
