/**
 * Contracts Collection API
 * GET  /api/contracts - List contracts with filtering, sorting, and pagination
 * POST /api/contracts - Create a contract from the manual wizard (no file upload)
 *
 * MULTI-TENANT: Uses authenticated tenant context for proper tenant isolation
 */

import { ContractStatus } from '@prisma/client';
import { NextRequest } from 'next/server';
import { z } from 'zod';

import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  withContractApiHandler,
} from '@/lib/api-middleware';
import { getContractsCollection } from '@/lib/contracts/server/collection';
import { normalizeTagArray } from '@/lib/contracts/server/tag-registry';
import { prisma } from '@/lib/prisma';
import { resolvePersistCurrency } from '@/lib/fx';
import { auditLog, AuditAction } from '@/lib/security/audit';

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;
export const GET = withContractApiHandler(async (request: NextRequest, ctx) => {
  return getContractsCollection(request, ctx);
});

const manualPartySchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  email: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
});

const createManualContractSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  type: z.string().optional(),
  description: z.string().nullable().optional(),
  status: z.string().optional(),
  parties: z.array(manualPartySchema).optional(),
  effectiveDate: z.string().nullable().optional(),
  expirationDate: z.string().nullable().optional(),
  autoRenew: z.boolean().optional(),
  renewalNoticeDays: z.number().nullable().optional(),
  totalValue: z.number().nullable().optional(),
  currency: z.string().optional(),
  paymentTerms: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  priority: z.string().optional(),
  confidential: z.boolean().optional(),
  internalNotes: z.string().nullable().optional(),
});

function parseOptionalDate(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function resolveManualStatus(status: string | undefined): ContractStatus {
  if (status && (Object.values(ContractStatus) as string[]).includes(status)) {
    return status as ContractStatus;
  }
  return ContractStatus.DRAFT;
}

/** POST /api/contracts — create a manual (no-file) contract, including tags. */
export const POST = withContractApiHandler(async (request: NextRequest, ctx) => {
  try {
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid JSON body', 400);
    }

    const parsed = createManualContractSchema.safeParse(rawBody);
    if (!parsed.success) {
      return createErrorResponse(
        ctx,
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message || 'Invalid contract payload',
        400,
      );
    }

    const data = parsed.data;
    const tags = normalizeTagArray(data.tags ?? []);
    const parties = data.parties ?? [];
    const client = parties.find((party) => party.role.toLowerCase() === 'client');
    const supplier = parties.find((party) => {
      const role = party.role.toLowerCase();
      return role === 'vendor' || role === 'supplier';
    });
    const fallbackParty = parties[0];
    const clientName = client?.name || (fallbackParty && !supplier ? fallbackParty.name : undefined);
    const supplierName = supplier?.name;
    const status = resolveManualStatus(data.status);
    const title = data.title.trim();
    const fileName = `${title.replace(/[/\\]/g, '-').slice(0, 180) || 'manual-contract'}.txt`;

    const created = await prisma.$transaction(async (tx) => {
      const contract = await tx.contract.create({
        data: {
          tenantId: ctx.tenantId,
          fileName,
          originalName: title,
          mimeType: 'text/plain',
          fileSize: BigInt(0),
          status,
          uploadedBy: ctx.userId,
          importSource: 'API',
          contractTitle: title,
          contractType: data.type || null,
          description: data.description || null,
          clientName: clientName || null,
          supplierName: supplierName || null,
          effectiveDate: parseOptionalDate(data.effectiveDate) ?? null,
          expirationDate: parseOptionalDate(data.expirationDate) ?? null,
          autoRenewalEnabled: data.autoRenew ?? false,
          noticePeriodDays: data.renewalNoticeDays ?? null,
          totalValue: data.totalValue ?? null,
          currency: resolvePersistCurrency(data.currency),
          paymentTerms: data.paymentTerms || null,
          tags,
          aiMetadata: {
            tags,
            external_parties: parties.map((party) => ({
              legalName: party.name,
              role: party.role,
              contactEmail: party.email || undefined,
              company: party.company || undefined,
            })),
          },
          metadata: {
            source: 'manual-wizard',
            priority: data.priority || null,
            confidential: data.confidential ?? false,
            internalNotes: data.internalNotes || null,
            parties,
          },
        } as any,
      });

      await tx.contractMetadata.create({
        data: {
          contractId: contract.id,
          tenantId: ctx.tenantId,
          tags,
          customFields: {},
          systemFields: { source: 'manual-wizard' },
          updatedBy: ctx.userId,
        },
      });

      return contract;
    });

    try {
      await auditLog({
        action: AuditAction.CONTRACT_CREATED,
        resourceType: 'contract',
        resourceId: created.id,
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        metadata: { source: 'manual-wizard', tags },
      });
    } catch {
      // Best-effort audit; creating the contract already succeeded.
    }

    return createSuccessResponse(
      ctx,
      {
        id: created.id,
        title: created.contractTitle,
        status: created.status,
        tags,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(ctx, error);
  }
});
