import { NextRequest } from 'next/server';

import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
} from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';

import type { ContractApiContext } from '@/lib/contracts/server/context';

type ExpirationSummaryRow = {
  total: bigint;
  expired: bigint;
  critical: bigint;
  high: bigint;
  medium: bigint;
  low: bigint;
  upcoming_renewals: bigint;
  value_at_risk: number | null;
};

export async function postContractExpirationSync(
  _request: NextRequest,
  context: ContractApiContext,
) {
  const startTime = Date.now();
  const tenantId = context.tenantId;

  if (!tenantId) {
    return createErrorResponse(context, 'VALIDATION_ERROR', 'Tenant ID is required', 400);
  }

  try {
    const contracts = await prisma.contract.findMany({
      where: {
        tenantId,
        isDeleted: false,
        OR: [{ expirationDate: { not: null } }, { endDate: { not: null } }],
      },
      select: {
        id: true,
        tenantId: true,
        contractTitle: true,
        supplierName: true,
        clientName: true,
        contractType: true,
        expirationDate: true,
        endDate: true,
        totalValue: true,
        uploadedBy: true,
      },
    });

    const now = new Date();
    const results = { synced: 0, expired: 0, errors: 0 };

    for (const contract of contracts) {
      try {
        const expirationDate = contract.expirationDate || contract.endDate;
        if (!expirationDate) {
          continue;
        }

        const daysUntilExpiry = Math.ceil(
          (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );
        const isExpired = daysUntilExpiry < 0;

        let expirationRisk: string;
        let impactScore: number;
        const riskFactors: string[] = [];

        if (isExpired) {
          expirationRisk = 'EXPIRED';
          impactScore = 100;
          riskFactors.push('Contract has expired');
        } else if (daysUntilExpiry <= 30) {
          expirationRisk = 'CRITICAL';
          impactScore = 90;
          riskFactors.push('Expires within 30 days');
        } else if (daysUntilExpiry <= 60) {
          expirationRisk = 'HIGH';
          impactScore = 70;
          riskFactors.push('Expires within 60 days');
        } else if (daysUntilExpiry <= 90) {
          expirationRisk = 'MEDIUM';
          impactScore = 50;
          riskFactors.push('Expires within 90 days');
        } else {
          expirationRisk = 'LOW';
          impactScore = 20;
        }

        const contractValue = contract.totalValue ? Number(contract.totalValue) : null;
        if (contractValue && contractValue > 100000) {
          impactScore = Math.min(100, impactScore + 20);
          riskFactors.push('High-value contract (>$100K)');
        }

        const renewalStatus = isExpired ? 'EXPIRED' : daysUntilExpiry <= 90 ? 'UPCOMING' : 'PENDING';
        const recommendedAction = isExpired
          ? 'REVIEW_EXPIRED'
          : daysUntilExpiry <= 30
            ? 'URGENT_RENEWAL'
            : daysUntilExpiry <= 60
              ? 'INITIATE_RENEWAL'
              : daysUntilExpiry <= 90
                ? 'PLAN_RENEWAL'
                : null;

        const noticePeriodDays = 30;
        const noticeDeadline = new Date(expirationDate);
        noticeDeadline.setDate(noticeDeadline.getDate() - noticePeriodDays);

        const valueAtRisk = isExpired || daysUntilExpiry <= 90 ? contractValue : null;
        const id = `exp_${contract.id}`;

        await prisma.$executeRaw`
          INSERT INTO contract_expirations (
            id, contract_id, tenant_id, expiration_date, days_until_expiry,
            is_expired, expired_at, expiration_risk, risk_factors, impact_score,
            contract_value, value_at_risk, renewal_status, recommended_action,
            owner_id, alerts_enabled, notice_period_days, notice_deadline,
            auto_renewal_enabled, contract_title, supplier_name,
            client_name, contract_type, created_at, updated_at
          ) VALUES (
            ${id}, ${contract.id}, ${contract.tenantId}, ${expirationDate}, ${daysUntilExpiry},
            ${isExpired}, ${isExpired ? now : null}, ${expirationRisk}, ${JSON.stringify(riskFactors)}::jsonb, ${impactScore},
            ${contractValue}, ${valueAtRisk}, ${renewalStatus}, ${recommendedAction},
            ${contract.uploadedBy || context.userId}, true, ${noticePeriodDays}, ${noticeDeadline},
            false, ${contract.contractTitle}, ${contract.supplierName},
            ${contract.clientName}, ${contract.contractType}, ${now}, ${now}
          )
          ON CONFLICT (contract_id) DO UPDATE SET
            expiration_date = EXCLUDED.expiration_date,
            days_until_expiry = EXCLUDED.days_until_expiry,
            is_expired = EXCLUDED.is_expired,
            expired_at = EXCLUDED.expired_at,
            expiration_risk = EXCLUDED.expiration_risk,
            risk_factors = EXCLUDED.risk_factors,
            impact_score = EXCLUDED.impact_score,
            contract_value = EXCLUDED.contract_value,
            value_at_risk = EXCLUDED.value_at_risk,
            renewal_status = EXCLUDED.renewal_status,
            recommended_action = EXCLUDED.recommended_action,
            contract_title = EXCLUDED.contract_title,
            supplier_name = EXCLUDED.supplier_name,
            client_name = EXCLUDED.client_name,
            contract_type = EXCLUDED.contract_type,
            updated_at = ${now}
        `;

        if (isExpired) {
          results.expired += 1;
        }
        results.synced += 1;
      } catch {
        results.errors += 1;
      }
    }

    return createSuccessResponse(context, {
      message: 'Expiration sync completed',
      totalContracts: contracts.length,
      ...results,
      duration: `${Date.now() - startTime}ms`,
    });
  } catch (error) {
    return handleApiError(context, error);
  }
}

export async function getContractExpirationSyncSummary(
  _request: NextRequest,
  context: ContractApiContext,
) {
  const tenantId = context.tenantId;
  if (!tenantId) {
    return createErrorResponse(context, 'VALIDATION_ERROR', 'Tenant ID is required', 400);
  }

  const stats = await prisma.$queryRaw<ExpirationSummaryRow[]>`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE is_expired = true) as expired,
      COUNT(*) FILTER (WHERE expiration_risk = 'CRITICAL') as critical,
      COUNT(*) FILTER (WHERE expiration_risk = 'HIGH') as high,
      COUNT(*) FILTER (WHERE expiration_risk = 'MEDIUM') as medium,
      COUNT(*) FILTER (WHERE expiration_risk = 'LOW') as low,
      COUNT(*) FILTER (WHERE renewal_status IN ('UPCOMING', 'INITIATED', 'IN_PROGRESS')) as upcoming_renewals,
      COALESCE(SUM(value_at_risk), 0) as value_at_risk
    FROM contract_expirations WHERE tenant_id = ${tenantId}
  `;

  const summary = stats[0] || {
    total: 0n,
    expired: 0n,
    critical: 0n,
    high: 0n,
    medium: 0n,
    low: 0n,
    upcoming_renewals: 0n,
    value_at_risk: 0,
  };

  return createSuccessResponse(context, {
    summary: {
      total: Number(summary.total),
      expired: Number(summary.expired),
      critical: Number(summary.critical),
      high: Number(summary.high),
      upcomingRenewals: Number(summary.upcoming_renewals),
      valueAtRisk: summary.value_at_risk || 0,
    },
    byRiskLevel: {
      EXPIRED: Number(summary.expired),
      CRITICAL: Number(summary.critical),
      HIGH: Number(summary.high),
      MEDIUM: Number(summary.medium),
      LOW: Number(summary.low),
    },
  });
}