/**
 * DELETE /api/admin/api-tokens/:id — revoke a token (sets revokedAt).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminScope, isScopeError } from '@/lib/tenant-isolation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const scope = await requireAdminScope(request);
  if (isScopeError(scope)) {
    return scope;
  }
  const tenantId = scope.tenantId;

  const token = await prisma.apiToken.findFirst({
    where: { id, tenantId },
    select: { id: true, revokedAt: true },
  });
  if (!token) {
    return NextResponse.json({ error: 'Token not found' }, { status: 404 });
  }
  if (token.revokedAt) {
    return NextResponse.json({ data: { id, alreadyRevoked: true } });
  }
  await prisma.apiToken.update({
    where: { id },
    data: { revokedAt: new Date() },
  });
  return NextResponse.json({ data: { id, revoked: true } });
}
