import { Prisma } from '@prisma/client';
import { NextRequest } from 'next/server';

import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
} from '@/lib/api-middleware';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

import type { ContractApiContext } from '@/lib/contracts/server/context';

interface RenewalTerms {
  paymentTerms?: string;
  noticePeriod?: number;
  autoRenewal?: boolean;
  [key: string]: unknown;
}

interface KeyChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  description?: string;
}

type RenewalHistoryRow = {
  id: string;
  contract_id: string;
  renewal_number: number;
  renewal_type: string;
  previous_start_date: Date;
  previous_end_date: Date;
  previous_value: number;
  previous_terms: RenewalTerms;
  new_start_date: Date;
  new_end_date: Date;
  new_value: number;
  new_terms: RenewalTerms;
  value_change: number;
  value_change_percent: number;
  term_extension: number;
  negotiation_days: number;
  negotiation_rounds: number;
  key_changes: KeyChange[];
  initiated_by: string;
  initiated_at: Date;
  approved_by: string;
  approved_at: Date;
  completed_by: string;
  completed_at: Date;
  status: string;
  notes: string;
  created_at: Date;
};

type RenewalHistoryStatsRow = {
  total: bigint;
  standard: bigint;
  renegotiated: bigint;
  extended: bigint;
  auto_renewed: bigint;
  total_value_change: number;
  avg_negotiation_days: number;
  avg_value_change_percent: number;
};

type ContractInfo = {
  id: string;
  contractTitle: string | null;
  originalName: string | null;
  supplierName: string | null;
};

type RenewalCountRow = { count: bigint };

export async function getContractRenewalHistory(
  request: NextRequest,
  context: ContractApiContext,
) {
  const startTime = Date.now();
  const tenantId = context.tenantId;

  if (!tenantId) {
    return createErrorResponse(context, 'VALIDATION_ERROR', 'Tenant ID is required', 400);
  }

  try {
    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get('contractId');
    const renewalType = searchParams.get('type');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const contractFilter = contractId
      ? Prisma.sql`AND contract_id = ${contractId}`
      : Prisma.empty;
    const typeFilter = renewalType
      ? Prisma.sql`AND renewal_type = ${renewalType}`
      : Prisma.empty;

    const renewals = await prisma.$queryRaw<RenewalHistoryRow[]>`
      SELECT
        id, contract_id, renewal_number, renewal_type,
        previous_start_date, previous_end_date, previous_value, previous_terms,
        new_start_date, new_end_date, new_value, new_terms,
        value_change, value_change_percent, term_extension,
        negotiation_days, negotiation_rounds, key_changes,
        initiated_by, initiated_at, approved_by, approved_at,
        completed_by, completed_at, status, notes, created_at
      FROM renewal_history
      WHERE tenant_id = ${tenantId}
        ${contractFilter}
        ${typeFilter}
      ORDER BY completed_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const contractIds = [...new Set(renewals.map((renewal) => renewal.contract_id))];
    const contracts: ContractInfo[] =
      contractIds.length > 0
        ? ((await prisma.contract.findMany({
            where: {
              id: { in: contractIds },
              tenantId,
            },
            select: {
              id: true,
              contractTitle: true,
              originalName: true,
              supplierName: true,
            },
          })) as ContractInfo[])
        : [];

    const contractMap = new Map<string, ContractInfo>(contracts.map((contract) => [contract.id, contract]));

    const stats = await prisma.$queryRaw<RenewalHistoryStatsRow[]>`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE renewal_type = 'STANDARD') as standard,
        COUNT(*) FILTER (WHERE renewal_type = 'RENEGOTIATED') as renegotiated,
        COUNT(*) FILTER (WHERE renewal_type = 'EXTENDED') as extended,
        COUNT(*) FILTER (WHERE renewal_type = 'AUTO_RENEWED') as auto_renewed,
        COALESCE(SUM(value_change), 0) as total_value_change,
        COALESCE(AVG(negotiation_days), 0) as avg_negotiation_days,
        COALESCE(AVG(value_change_percent), 0) as avg_value_change_percent
      FROM renewal_history
      WHERE tenant_id = ${tenantId}
    `;

    const summary = stats[0] || {
      total: 0n,
      standard: 0n,
      renegotiated: 0n,
      extended: 0n,
      auto_renewed: 0n,
      total_value_change: 0,
      avg_negotiation_days: 0,
      avg_value_change_percent: 0,
    };

    const data = renewals.map((renewal) => {
      const contract = contractMap.get(renewal.contract_id);
      return {
        id: renewal.id,
        contractId: renewal.contract_id,
        contractName: contract?.contractTitle || contract?.originalName || 'Unknown',
        supplierName: contract?.supplierName,
        renewalNumber: renewal.renewal_number,
        renewalType: renewal.renewal_type,
        previousTerms: {
          startDate: renewal.previous_start_date?.toISOString(),
          endDate: renewal.previous_end_date?.toISOString(),
          value: renewal.previous_value ? Number(renewal.previous_value) : null,
          terms: renewal.previous_terms,
        },
        newTerms: {
          startDate: renewal.new_start_date?.toISOString(),
          endDate: renewal.new_end_date?.toISOString(),
          value: renewal.new_value ? Number(renewal.new_value) : null,
          terms: renewal.new_terms,
        },
        changes: {
          valueChange: renewal.value_change ? Number(renewal.value_change) : null,
          valueChangePercent: renewal.value_change_percent ? Number(renewal.value_change_percent) : null,
          termExtension: renewal.term_extension,
          keyChanges: renewal.key_changes,
        },
        negotiation: {
          days: renewal.negotiation_days,
          rounds: renewal.negotiation_rounds,
        },
        timeline: {
          initiatedBy: renewal.initiated_by,
          initiatedAt: renewal.initiated_at?.toISOString(),
          approvedBy: renewal.approved_by,
          approvedAt: renewal.approved_at?.toISOString(),
          completedBy: renewal.completed_by,
          completedAt: renewal.completed_at?.toISOString(),
        },
        status: renewal.status,
        notes: renewal.notes,
        createdAt: renewal.created_at?.toISOString(),
      };
    });

    return createSuccessResponse(context, {
      data: {
        renewals: data,
        stats: {
          total: Number(summary.total || 0),
          byType: {
            standard: Number(summary.standard || 0),
            renegotiated: Number(summary.renegotiated || 0),
            extended: Number(summary.extended || 0),
            autoRenewed: Number(summary.auto_renewed || 0),
          },
          totalValueChange: Number(summary.total_value_change || 0),
          avgNegotiationDays: Math.round(Number(summary.avg_negotiation_days || 0)),
          avgValueChangePercent: Number(summary.avg_value_change_percent || 0).toFixed(1),
        },
        pagination: {
          limit,
          offset,
          hasMore: data.length === limit,
        },
      },
      meta: {
        source: 'database',
        tenantId,
        timestamp: new Date().toISOString(),
        responseTime: `${Date.now() - startTime}ms`,
      },
    });
  } catch (error) {
    return handleApiError(context, error);
  }
}

export async function postContractRenewalHistory(
  request: NextRequest,
  context: ContractApiContext,
) {
  const tenantId = context.tenantId;
  const userId = context.userId;

  if (!tenantId) {
    return createErrorResponse(context, 'VALIDATION_ERROR', 'Tenant ID is required', 400);
  }

  const body = await request.json();
  const { contractId, renewalData } = body;
  const now = new Date();

  if (!contractId || !renewalData) {
    return createErrorResponse(context, 'VALIDATION_ERROR', 'Contract ID and renewal data are required', 400);
  }

  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId },
    select: {
      id: true,
      startDate: true,
      effectiveDate: true,
      endDate: true,
      expirationDate: true,
      totalValue: true,
    },
  });

  if (!contract) {
    return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
  }

  const previousRenewals = await prisma.$queryRaw<RenewalCountRow[]>`
    SELECT COUNT(*) as count FROM renewal_history
    WHERE contract_id = ${contractId} AND tenant_id = ${tenantId}
  `;
  const renewalNumber = Number(previousRenewals[0]?.count || 0) + 1;

  const previousValue = contract.totalValue ? Number(contract.totalValue) : 0;
  const newValue = renewalData.newValue || previousValue;
  const valueChange = newValue - previousValue;
  const valueChangePercent = previousValue > 0 ? ((valueChange / previousValue) * 100) : 0;

  const previousEndDate = contract.endDate || contract.expirationDate;
  const newEndDate = renewalData.newEndDate ? new Date(renewalData.newEndDate) : null;
  const termExtension = previousEndDate && newEndDate
    ? Math.ceil((newEndDate.getTime() - previousEndDate.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const id = `renewal_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

  await prisma.$executeRaw`
    INSERT INTO renewal_history (
      id, contract_id, tenant_id, renewal_number, renewal_type,
      previous_start_date, previous_end_date, previous_value,
      new_start_date, new_end_date, new_value,
      value_change, value_change_percent, term_extension,
      negotiation_days, negotiation_rounds, key_changes,
      initiated_by, initiated_at, completed_by, completed_at,
      status, notes, created_at
    ) VALUES (
      ${id}, ${contractId}, ${tenantId}, ${renewalNumber}, ${renewalData.renewalType || 'STANDARD'},
      ${contract.startDate || contract.effectiveDate}, ${previousEndDate}, ${previousValue},
      ${renewalData.newStartDate ? new Date(renewalData.newStartDate) : null},
      ${newEndDate}, ${newValue},
      ${valueChange}, ${valueChangePercent}, ${termExtension},
      ${renewalData.negotiationDays || null}, ${renewalData.negotiationRounds || null},
      ${JSON.stringify(renewalData.keyChanges || [])}::jsonb,
      ${renewalData.initiatedBy || userId}, ${renewalData.initiatedAt ? new Date(renewalData.initiatedAt) : now},
      ${renewalData.completedBy || userId}, ${now},
      'COMPLETED', ${renewalData.notes || null}, ${now}
    )
  `;

  if (renewalData.newStartDate || renewalData.newEndDate || renewalData.newValue) {
    await prisma.contract.update({
      where: { id: contractId },
      data: {
        ...(renewalData.newStartDate && {
          startDate: new Date(renewalData.newStartDate),
          effectiveDate: new Date(renewalData.newStartDate),
        }),
        ...(renewalData.newEndDate && {
          endDate: new Date(renewalData.newEndDate),
          expirationDate: new Date(renewalData.newEndDate),
        }),
        ...(renewalData.newValue && { totalValue: renewalData.newValue }),
        renewalStatus: 'COMPLETED',
        renewalCompletedAt: now,
        updatedAt: now,
      },
    });
  }

  await prisma.$executeRaw`
    UPDATE contract_expirations
    SET renewal_status = 'COMPLETED', resolution = 'RENEWED', resolution_date = ${now},
        updated_at = ${now}
    WHERE contract_id = ${contractId} AND tenant_id = ${tenantId}
  `.catch((error) => logger.error('[RenewalHistory] Expiration record update error:', error));

  return createSuccessResponse(context, {
    message: 'Renewal recorded successfully',
    data: {
      id,
      contractId,
      renewalNumber,
      renewalType: renewalData.renewalType || 'STANDARD',
      valueChange,
      valueChangePercent: valueChangePercent.toFixed(1),
      termExtension,
      completedAt: now.toISOString(),
    },
  });
}