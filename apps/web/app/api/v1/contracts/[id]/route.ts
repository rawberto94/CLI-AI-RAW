/**
 * GET /api/v1/contracts/:id — fetch a single contract.
 *
 * Scope: `contracts:read`. Returns 404 if not in the caller's tenant.
 * Optionally embeds artifacts when ?include=artifacts is passed.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateApiToken, requireScope } from '@/lib/api/v1/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const authResult = await authenticateApiToken(request);
  if (!authResult.ok) return authResult.response;
  const { auth } = authResult;
  const scopeError = requireScope(auth, 'contracts:read');
  if (scopeError) return scopeError;

  const url = new URL(request.url);
  const include = (url.searchParams.get('include') || '').split(',').map(s => s.trim());
  const includeArtifacts = include.includes('artifacts');
  const includeRawText = include.includes('rawText');

  const contract = await prisma.contract.findFirst({
    where: { id, tenantId: auth.tenantId },
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
      ...(includeRawText ? { rawText: true } : {}),
      ...(includeArtifacts
        ? {
            artifacts: {
              select: { id: true, type: true, content: true, createdAt: true },
            },
          }
        : {}),
    },
  });

  if (!contract) {
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
  }
  return NextResponse.json({ data: contract });
}
