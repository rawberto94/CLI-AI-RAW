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
 *
 * POST /api/v1/contracts — register a contract (reference mode).
 *
 * Scope: `contracts:write`. Used by upstream systems (DMS, ERP, custom
 * apps) that already store contract files elsewhere and want Contigo to
 * track metadata + obligations without holding the bytes.
 *
 * Body:
 *   {
 *     fileName: string,
 *     externalUrl: string,
 *     contractType?: string,
 *     contractTitle?: string,
 *     clientName?: string,
 *     supplierName?: string,
 *     externalId?: string,
 *     mimeType?: string,
 *   }
 *
 * Returns the created contract row (status = "UPLOADED",
 * storageProvider = "reference", externalUrl set). Never auto-processes.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateApiToken, requireScope } from '@/lib/api/v1/auth';
import {
  enforceApiV1RateLimit,
  withRateLimitHeaders,
} from '@/lib/api/v1/rate-limit';

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

  const { exceeded, result: rlResult } = await enforceApiV1RateLimit(auth);
  if (exceeded) return exceeded;

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

  return withRateLimitHeaders(
    NextResponse.json({
      data: page,
      nextCursor,
      hasMore,
    }),
    rlResult,
  );
}

interface CreateBody {
  fileName?: string;
  externalUrl?: string;
  contractType?: string;
  contractTitle?: string;
  clientName?: string;
  supplierName?: string;
  externalId?: string;
  mimeType?: string;
}

export async function POST(request: Request) {
  const authResult = await authenticateApiToken(request);
  if (!authResult.ok) return authResult.response;
  const { auth } = authResult;
  const scopeError = requireScope(auth, 'contracts:write');
  if (scopeError) return scopeError;

  const { exceeded, result: rlResult } = await enforceApiV1RateLimit(auth);
  if (exceeded) return exceeded;

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: 'Body must be valid JSON' }, { status: 400 });
  }

  const fileName = (body.fileName || '').trim();
  const externalUrl = (body.externalUrl || '').trim();
  if (!fileName) {
    return NextResponse.json({ error: 'fileName is required' }, { status: 400 });
  }
  if (!externalUrl) {
    return NextResponse.json(
      { error: 'externalUrl is required (Contigo only stores metadata in this mode)' },
      { status: 400 },
    );
  }
  try {
    // eslint-disable-next-line no-new
    new URL(externalUrl);
  } catch {
    return NextResponse.json({ error: 'externalUrl must be a valid URL' }, { status: 400 });
  }

  const contract = await prisma.contract.create({
    data: {
      tenantId: auth.tenantId,
      fileName,
      originalName: fileName,
      mimeType: body.mimeType || 'application/pdf',
      fileSize: BigInt(0),
      status: 'UPLOADED',
      storagePath: '',
      storageProvider: 'reference',
      contractType: body.contractType || 'UNKNOWN',
      contractTitle: body.contractTitle || fileName,
      clientName: body.clientName || undefined,
      supplierName: body.supplierName || undefined,
      externalId: body.externalId || undefined,
      externalUrl,
      importSource: 'api_v1',
      uploadedAt: new Date(),
      sourceMetadata: {
        mode: 'reference',
        createdVia: 'api_v1',
        apiTokenId: auth.tokenId,
      },
    },
    select: {
      id: true,
      fileName: true,
      contractType: true,
      contractTitle: true,
      status: true,
      clientName: true,
      supplierName: true,
      externalId: true,
      externalUrl: true,
      storageProvider: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // Webhook + durable event log (fire-and-forget).
  import('@/lib/webhook-triggers')
    .then(({ triggerContractCreated }) =>
      triggerContractCreated(auth.tenantId, contract.id, {
        fileName: contract.fileName,
        contractType: contract.contractType,
        clientName: contract.clientName ?? undefined,
        supplierName: contract.supplierName ?? undefined,
        importSource: 'api_v1',
        mode: 'reference',
      }),
    )
    .catch(() => {});
  import('@/lib/events/integration-events')
    .then(({ recordIntegrationEvent }) =>
      recordIntegrationEvent({
        tenantId: auth.tenantId,
        eventType: 'contract.created',
        resourceId: contract.id,
        payload: {
          contractId: contract.id,
          fileName: contract.fileName,
          contractType: contract.contractType,
          importSource: 'api_v1',
          mode: 'reference',
        },
      }),
    )
    .catch(() => {});

  return withRateLimitHeaders(
    NextResponse.json({ data: contract }, { status: 201 }),
    rlResult,
  );
}
