/**
 * DELETE /api/admin/api-tokens/:id — revoke a token (sets revokedAt).
 */

import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const tenantId = (session.user as { tenantId?: string }).tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant context' }, { status: 400 });
  }

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
