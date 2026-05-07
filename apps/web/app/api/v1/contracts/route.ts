/**
 * GET /api/v1/contracts — list contracts in the authenticated tenant.
 *
 * Auth: `Authorization: Bearer ctg_*` (see lib/api/v1/auth.ts)
 * Scope required: `contracts:read`
 *
 * Query params:
 *   - limit (default 50, max 200)
 *   - cursor (id; pagination cursor, exclusive)
 *   - status (UPLOADED | PROCESSING | PROCESSED | FAILED | ...)
 *   - updatedSince (ISO 8601 timestamp; >= filter on updatedAt)
 *
 * Response:
 *   {
 *     data: Contract[],
 *     nextCursor: string | null,
 *     hasMore: boolean
 *   }
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateApiToken, requireScope } from '@/lib/api/v1/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

export async function GET(request: Request) {
  const authResult = await authenticateApiToken(request);
  if (!authResult.ok) return authResult.response;
  const { auth } = authResult;
  const scopeError = requireScope(auth, 'contracts:read');
  if (scopeError) return scopeError;

  const url = new URL(request.url);
  const limit = Math.min(
    parseInt(url.searchParams.get('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT,
    MAX_LIMIT,
  );
  const cursor = url.searchParams.get('cursor') || undefined;
  const status = url.searchParams.get('status') || undefined;
  const updatedSinceStr = url.searchParams.get('updatedSince') || undefined;
  const updatedSince = updatedSinceStr ? new Date(updatedSinceStr) : undefined;
  if (updatedSince && isNaN(updatedSince.getTime())) {
    return NextResponse.json(
      { error: 'updatedSince must be a valid ISO 8601 timestamp' },
      { status: 400 },
    );
  }

  const where: Record<string, unknown> = { tenantId: auth.tenantId };
  if (status) where.status = status;
  if (updatedSince) where.updatedAt = { gte: updatedSince };

  const rows = await prisma.contract.findMany({
    where,
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      title: true,
      fileName: true,
      contractType: true,
      status: true,
      clientName: true,
      supplierName: true,
      effectiveDate: true,
      expirationDate: true,
      totalValue: true,
      currency: true,
      signatureStatus: true,
      externalUrl: true,
      storageProvider: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;

  return NextResponse.json({
    data: page,
    nextCursor,
    hasMore,
  });
}
