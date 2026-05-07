/**
 * API token authentication for outbound `/api/v1/*` REST surface.
 *
 * Token format: `ctg_<32 url-safe base64 chars>`. The first 12 chars
 * (`ctg_<8>`) are stored plaintext as `prefix` so users can identify
 * a token in the UI; the full string is bcrypted into `tokenHash`.
 *
 * Lookup is by `prefix` (indexed) → bcrypt compare against `tokenHash`.
 * On success, returns `{ tenantId, tokenId, scopes }` and bumps
 * `lastUsedAt` (fire-and-forget, no await).
 */

import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';

export interface ApiTokenAuth {
  tenantId: string;
  tokenId: string;
  scopes: Set<string>;
}

const PREFIX_LEN = 12; // "ctg_" + 8 chars

export function generateApiToken(): { raw: string; prefix: string } {
  // 24 random bytes → 32 url-safe base64 chars
  const body = randomBytes(24)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  const raw = `ctg_${body}`;
  return { raw, prefix: raw.slice(0, PREFIX_LEN) };
}

export async function hashApiToken(raw: string): Promise<string> {
  return bcrypt.hash(raw, 10);
}

export async function authenticateApiToken(
  request: Request,
): Promise<{ ok: true; auth: ApiTokenAuth } | { ok: false; response: NextResponse }> {
  const header = request.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(\S+)$/i);
  if (!match) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Missing Authorization: Bearer <token>' },
        { status: 401 },
      ),
    };
  }
  const raw = match[1];
  if (!raw.startsWith('ctg_') || raw.length < PREFIX_LEN + 8) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Invalid token format' }, { status: 401 }),
    };
  }
  const prefix = raw.slice(0, PREFIX_LEN);

  const candidates = await prisma.apiToken.findMany({
    where: { prefix, revokedAt: null },
    select: { id: true, tenantId: true, tokenHash: true, scopes: true, expiresAt: true },
  });

  for (const c of candidates) {
    if (c.expiresAt && c.expiresAt < new Date()) continue;
    // bcrypt compare is constant-time within each call
    const ok = await bcrypt.compare(raw, c.tokenHash);
    if (!ok) continue;

    // Fire-and-forget usage tracking: bump lastUsedAt + requestCount and
    // upsert the per-token hourly bucket. Failures are silently swallowed
    // so an outage in usage tracking never breaks API auth.
    const now = new Date();
    const hourBucket = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        now.getUTCHours(),
        0,
        0,
        0,
      ),
    );
    prisma.apiToken
      .update({
        where: { id: c.id },
        data: { lastUsedAt: now, requestCount: { increment: 1 } },
      })
      .catch(() => {});
    prisma.apiTokenUsageBucket
      .upsert({
        where: { tokenId_hourBucket: { tokenId: c.id, hourBucket } },
        create: {
          tokenId: c.id,
          tenantId: c.tenantId,
          hourBucket,
          count: 1,
        },
        update: { count: { increment: 1 } },
      })
      .catch(() => {});

    return {
      ok: true,
      auth: {
        tenantId: c.tenantId,
        tokenId: c.id,
        scopes: new Set(c.scopes.split(',').map(s => s.trim()).filter(Boolean)),
      },
    };
  }

  return {
    ok: false,
    response: NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 }),
  };
}

export function requireScope(auth: ApiTokenAuth, scope: string): NextResponse | null {
  if (auth.scopes.has('*') || auth.scopes.has(scope)) return null;
  return NextResponse.json(
    { error: `Token is missing required scope: ${scope}` },
    { status: 403 },
  );
}
