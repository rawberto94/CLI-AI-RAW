/**
 * POST /api/admin/api-tokens — issue a new API token (session-auth).
 * GET  /api/admin/api-tokens — list non-revoked tokens for the tenant.
 *
 * The raw token is returned ONLY in the POST response. Subsequent reads
 * expose only id/name/prefix/scopes/lastUsedAt/createdAt/expiresAt.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { generateApiToken, hashApiToken } from '@/lib/api/v1/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_SCOPES = new Set([
  '*',
  'contracts:read',
  'contracts:write',
  'obligations:read',
  'events:read',
  'webhooks:read',
  'webhooks:write',
]);

export async function GET() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const tenantId = (session.user as { tenantId?: string }).tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant context' }, { status: 400 });
  }

  const tokens = await prisma.apiToken.findMany({
    where: { tenantId, revokedAt: null },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      prefix: true,
      scopes: true,
      lastUsedAt: true,
      requestCount: true,
      expiresAt: true,
      createdAt: true,
      createdBy: true,
    },
  });

  // Augment with last-24h request counts from the hourly bucket table.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const buckets = await prisma.apiTokenUsageBucket.groupBy({
    by: ['tokenId'],
    where: {
      tenantId,
      hourBucket: { gte: since },
      tokenId: { in: tokens.map(t => t.id) },
    },
    _sum: { count: true },
  });
  const last24hByToken = new Map(
    buckets.map(b => [b.tokenId, b._sum.count ?? 0]),
  );
  const data = tokens.map(t => ({
    ...t,
    requestsLast24h: last24hByToken.get(t.id) ?? 0,
  }));
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const tenantId = (session.user as { tenantId?: string }).tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant context' }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    scopes?: string[];
    expiresAt?: string;
  };
  const name = (body.name || '').trim();
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  const scopesArr = Array.isArray(body.scopes) && body.scopes.length > 0
    ? body.scopes
    : ['contracts:read'];
  for (const s of scopesArr) {
    if (!VALID_SCOPES.has(s)) {
      return NextResponse.json({ error: `Invalid scope: ${s}` }, { status: 400 });
    }
  }
  let expiresAt: Date | null = null;
  if (body.expiresAt) {
    const d = new Date(body.expiresAt);
    if (isNaN(d.getTime())) {
      return NextResponse.json({ error: 'Invalid expiresAt' }, { status: 400 });
    }
    expiresAt = d;
  }

  const { raw, prefix } = generateApiToken();
  const tokenHash = await hashApiToken(raw);

  const token = await prisma.apiToken.create({
    data: {
      tenantId,
      name,
      prefix,
      tokenHash,
      scopes: scopesArr.join(','),
      createdBy: session.user.id,
      expiresAt,
    },
    select: {
      id: true,
      name: true,
      prefix: true,
      scopes: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json(
    {
      data: { ...token, token: raw },
      warning: 'This is the only time the token will be shown. Store it securely.',
    },
    { status: 201 },
  );
}
