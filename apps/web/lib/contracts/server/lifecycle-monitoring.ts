import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';

import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api-middleware';

import type { ContractApiContext } from '@/lib/contracts/server/context';

interface HealthFactor {
  name: string;
  score: number;
  weight: number;
  description?: string;
}

interface HealthAlert {
  id?: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  createdAt?: string;
}

interface AlertRecipient {
  email?: string;
  name?: string;
  userId?: string;
  notificationType?: string;
}

interface AlertMetadata {
  contractName?: string;
  expiryDate?: string;
  daysRemaining?: number;
  totalValue?: number;
  [key: string]: unknown;
}

interface TrendHistoryEntry {
  date: string;
  score: number;
}

interface ExpirationRecord {
  id: string;
  contract_id: string;
  contract_title: string;
  supplier_name: string;
  client_name: string;
  contract_type: string;
  expiration_date: Date;
  days_until_expiry: number;
  is_expired: boolean;
  expiration_risk: string;
  renewal_status: string;
  recommended_action: string;
  contract_value: number;
  annual_value: number;
  value_at_risk: number;
  owner_name: string;
  assigned_to: string;
  notice_deadline: Date;
  notice_given: boolean;
  auto_renewal_enabled: boolean;
  alerts_sent: number[];
  last_alert_sent: Date;
  updated_at: Date;
}

interface AlertRecord {
  id: string;
  contract_id: string;
  alert_type: string;
  severity: string;
  title: string;
  message: string;
  recipients: AlertRecipient[];
  sent_to: AlertRecipient[];
  status: string;
  sent_at: Date;
  delivered_at: Date;
  acknowledged_by: string;
  acknowledged_at: Date;
  acknowledged_action: string;
  snooze_until: Date;
  scheduled_for: Date;
  days_before_expiry: number;
  metadata: AlertMetadata;
  created_at: Date;
}

async function getPrismaClient() {
  const { prisma } = await import('@/lib/prisma');
  return prisma;
}

export async function getContractHealthScores(
  request: NextRequest,
  context: ContractApiContext,
) {
  const prisma = await getPrismaClient();
  const { searchParams } = new URL(request.url);
  const tenantId = context.tenantId;

  if (!tenantId) {
    return createErrorResponse(context, 'VALIDATION_ERROR', 'Tenant ID is required', 400);
  }

  const alertLevel = searchParams.get('alertLevel');
  const trendDirection = searchParams.get('trend');
  const minScore = searchParams.get('minScore');
  const maxScore = searchParams.get('maxScore');
  const contractId = searchParams.get('contractId');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  const healthScores = await prisma.$queryRaw<Array<{
    id: string;
    contract_id: string;
    overall_score: number;
    risk_score: number;
    compliance_score: number;
    financial_score: number;
    operational_score: number;
    renewal_readiness: number;
    document_quality: number;
    factors: HealthFactor[];
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    previous_score: number;
    score_change: number;
    trend_direction: string;
    trend_history: TrendHistoryEntry[];
    alert_level: string;
    active_alerts: HealthAlert[];
    alert_count: number;
    industry_average: number;
    percentile_rank: number;
    calculated_at: Date;
  }>>`
    SELECT 
      hs.id, hs.contract_id, hs.overall_score, hs.risk_score, hs.compliance_score,
      hs.financial_score, hs.operational_score, hs.renewal_readiness, hs.document_quality,
      hs.factors, hs.strengths, hs.weaknesses, hs.opportunities,
      hs.previous_score, hs.score_change, hs.trend_direction, hs.trend_history,
      hs.alert_level, hs.active_alerts, hs.alert_count,
      hs.industry_average, hs.percentile_rank, hs.calculated_at
    FROM contract_health_scores hs
    WHERE hs.tenant_id = ${tenantId}
      ${contractId ? Prisma.sql`AND hs.contract_id = ${contractId}` : Prisma.empty}
      ${alertLevel ? Prisma.sql`AND hs.alert_level = ${alertLevel}` : Prisma.empty}
      ${trendDirection ? Prisma.sql`AND hs.trend_direction = ${trendDirection}` : Prisma.empty}
      ${minScore ? Prisma.sql`AND hs.overall_score >= ${parseFloat(minScore)}` : Prisma.empty}
      ${maxScore ? Prisma.sql`AND hs.overall_score <= ${parseFloat(maxScore)}` : Prisma.empty}
    ORDER BY hs.overall_score ASC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const contractIds = healthScores.map((healthScore) => healthScore.contract_id);
  type ContractInfo = {
    id: string;
    contractTitle: string | null;
    originalName: string | null;
    fileName: string | null;
    supplierName: string | null;
    clientName: string | null;
    contractType: string | null;
    totalValue: Prisma.Decimal | number | null;
    expirationDate: Date | null;
    endDate: Date | null;
  };

  const contracts: ContractInfo[] = contractIds.length > 0
    ? (await prisma.contract.findMany({
        where: { id: { in: contractIds } },
        select: {
          id: true,
          contractTitle: true,
          originalName: true,
          fileName: true,
          supplierName: true,
          clientName: true,
          contractType: true,
          totalValue: true,
          expirationDate: true,
          endDate: true,
        },
      })) as ContractInfo[]
    : [];

  const contractMap = new Map<string, ContractInfo>(contracts.map((contract) => [contract.id, contract]));

  const stats = await prisma.$queryRaw<Array<{
    total: bigint;
    avg_score: number;
    avg_risk: number;
    avg_compliance: number;
    avg_financial: number;
    avg_renewal_readiness: number;
    critical_count: bigint;
    high_count: bigint;
    medium_count: bigint;
    low_count: bigint;
    healthy_count: bigint;
    improving: bigint;
    declining: bigint;
    stable: bigint;
  }>>`
    SELECT 
      COUNT(*) as total,
      AVG(overall_score) as avg_score,
      AVG(risk_score) as avg_risk,
      AVG(compliance_score) as avg_compliance,
      AVG(financial_score) as avg_financial,
      AVG(renewal_readiness) as avg_renewal_readiness,
      COUNT(*) FILTER (WHERE alert_level = 'critical') as critical_count,
      COUNT(*) FILTER (WHERE alert_level = 'high') as high_count,
      COUNT(*) FILTER (WHERE alert_level = 'medium') as medium_count,
      COUNT(*) FILTER (WHERE alert_level = 'low') as low_count,
      COUNT(*) FILTER (WHERE alert_level = 'none') as healthy_count,
      COUNT(*) FILTER (WHERE trend_direction = 'improving') as improving,
      COUNT(*) FILTER (WHERE trend_direction = 'declining') as declining,
      COUNT(*) FILTER (WHERE trend_direction = 'stable') as stable
    FROM contract_health_scores
    WHERE tenant_id = ${tenantId}
  `;

  const defaultStats = {
    total: BigInt(0),
    avg_score: 0,
    avg_risk: 0,
    avg_compliance: 0,
    avg_financial: 0,
    avg_renewal_readiness: 0,
    critical_count: BigInt(0),
    high_count: BigInt(0),
    medium_count: BigInt(0),
    low_count: BigInt(0),
    healthy_count: BigInt(0),
    improving: BigInt(0),
    declining: BigInt(0),
    stable: BigInt(0),
  };
  const summary = stats[0] || defaultStats;

  const data = healthScores.map((healthScore) => {
    const contract = contractMap.get(healthScore.contract_id);
    return {
      id: healthScore.id,
      contractId: healthScore.contract_id,
      contractName: contract?.contractTitle || contract?.originalName || contract?.fileName || 'Unknown',
      supplierName: contract?.supplierName,
      clientName: contract?.clientName,
      contractType: contract?.contractType,
      value: contract?.totalValue ? Number(contract.totalValue) : null,
      expirationDate: (contract?.expirationDate || contract?.endDate)?.toISOString(),
      scores: {
        overall: healthScore.overall_score,
        risk: healthScore.risk_score,
        compliance: healthScore.compliance_score,
        financial: healthScore.financial_score,
        operational: healthScore.operational_score,
        renewalReadiness: healthScore.renewal_readiness,
        documentQuality: healthScore.document_quality,
      },
      factors: healthScore.factors,
      strengths: healthScore.strengths,
      weaknesses: healthScore.weaknesses,
      opportunities: healthScore.opportunities,
      trend: {
        direction: healthScore.trend_direction,
        previousScore: healthScore.previous_score,
        change: healthScore.score_change,
        history: healthScore.trend_history,
      },
      alerts: {
        level: healthScore.alert_level,
        active: healthScore.active_alerts,
        count: healthScore.alert_count,
      },
      benchmarking: {
        industryAverage: healthScore.industry_average,
        percentileRank: healthScore.percentile_rank,
      },
      calculatedAt: healthScore.calculated_at?.toISOString(),
    };
  });

  return createSuccessResponse(context, {
    healthScores: data,
    stats: {
      total: Number(summary.total || 0),
      averages: {
        overall: Math.round(Number(summary.avg_score || 0)),
        risk: Math.round(Number(summary.avg_risk || 0)),
        compliance: Math.round(Number(summary.avg_compliance || 0)),
        financial: Math.round(Number(summary.avg_financial || 0)),
        renewalReadiness: Math.round(Number(summary.avg_renewal_readiness || 0)),
      },
      byAlertLevel: {
        critical: Number(summary.critical_count || 0),
        high: Number(summary.high_count || 0),
        medium: Number(summary.medium_count || 0),
        low: Number(summary.low_count || 0),
        healthy: Number(summary.healthy_count || 0),
      },
      byTrend: {
        improving: Number(summary.improving || 0),
        declining: Number(summary.declining || 0),
        stable: Number(summary.stable || 0),
      },
    },
    pagination: {
      limit,
      offset,
      hasMore: data.length === limit,
    },
  });
}

export async function postContractHealthScores(
  request: NextRequest,
  context: ContractApiContext,
) {
  const tenantId = context.tenantId;
  const userId = context.userId;

  if (!tenantId) {
    return createErrorResponse(context, 'VALIDATION_ERROR', 'Tenant ID is required', 400);
  }

  if (!userId) {
    return createErrorResponse(context, 'UNAUTHORIZED', 'Authentication required', 401);
  }

  const body = await request.json();
  const { action, contractIds } = body;

  if (action === 'recalculate') {
    const response = await fetch(`${request.nextUrl.origin}/api/contracts/sync-health-scores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': tenantId,
        'x-user-id': userId,
      },
      body: JSON.stringify({ tenantId, contractIds }),
    });

    const result = await response.json();
    return createSuccessResponse(context, result);
  }

  if (action === 'acknowledge-alert') {
    const { contractId, alertId } = body;
    if (!contractId) {
      return createErrorResponse(context, 'VALIDATION_ERROR', 'Contract ID is required', 400);
    }

    return createSuccessResponse(context, {
      message: 'Alert acknowledged',
      contractId,
      alertId,
    });
  }

  return createErrorResponse(context, 'BAD_REQUEST', 'Invalid action', 400);
}

export async function getContractExpirations(
  request: NextRequest,
  context: ContractApiContext,
) {
  const prisma = await getPrismaClient();

  try {
    const { searchParams } = new URL(request.url);
    const tenantId = context.tenantId;

    if (!tenantId) {
      return createErrorResponse(context, 'VALIDATION_ERROR', 'Tenant ID is required', 400);
    }

    const risk = searchParams.get('risk');
    const status = searchParams.get('status');
    const isExpired = searchParams.get('isExpired');
    const daysMax = searchParams.get('daysMax');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const validRisks = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    const validStatuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'EXPIRED', 'RENEWED'];
    const conditions: Prisma.Sql[] = [Prisma.sql`tenant_id = ${tenantId}`];

    if (risk && validRisks.includes(risk)) {
      conditions.push(Prisma.sql`expiration_risk = ${risk}`);
    }
    if (status && validStatuses.includes(status)) {
      conditions.push(Prisma.sql`renewal_status = ${status}`);
    }
    if (isExpired === 'true') {
      conditions.push(Prisma.sql`is_expired = true`);
    } else if (isExpired === 'false') {
      conditions.push(Prisma.sql`is_expired = false`);
    }
    if (daysMax) {
      const daysMaxInt = parseInt(daysMax, 10);
      if (!Number.isNaN(daysMaxInt) && daysMaxInt >= 0) {
        conditions.push(Prisma.sql`days_until_expiry <= ${daysMaxInt}`);
      }
    }

    const whereClause = Prisma.join(conditions, ' AND ');
    const expirations = await prisma.$queryRaw<ExpirationRecord[]>`
      SELECT 
        id, contract_id, contract_title, supplier_name, client_name, contract_type,
        expiration_date, days_until_expiry, is_expired, expiration_risk, renewal_status,
        recommended_action, contract_value, annual_value, value_at_risk,
        owner_name, assigned_to, notice_deadline, notice_given, auto_renewal_enabled,
        alerts_sent, last_alert_sent, updated_at
      FROM contract_expirations
      WHERE ${whereClause}
      ORDER BY 
        CASE WHEN is_expired THEN 0 ELSE 1 END,
        days_until_expiry ASC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const stats = await prisma.$queryRaw<Array<{
      total: bigint;
      expired: bigint;
      critical: bigint;
      high: bigint;
      medium: bigint;
      low: bigint;
      pending: bigint;
      initiated: bigint;
      completed: bigint;
      total_value_at_risk: number;
      avg_days_to_expiry: number;
    }>>`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_expired = true) as expired,
        COUNT(*) FILTER (WHERE expiration_risk = 'CRITICAL') as critical,
        COUNT(*) FILTER (WHERE expiration_risk = 'HIGH') as high,
        COUNT(*) FILTER (WHERE expiration_risk = 'MEDIUM') as medium,
        COUNT(*) FILTER (WHERE expiration_risk = 'LOW') as low,
        COUNT(*) FILTER (WHERE renewal_status = 'PENDING') as pending,
        COUNT(*) FILTER (WHERE renewal_status = 'INITIATED') as initiated,
        COUNT(*) FILTER (WHERE renewal_status = 'COMPLETED') as completed,
        COALESCE(SUM(value_at_risk), 0) as total_value_at_risk,
        COALESCE(AVG(days_until_expiry) FILTER (WHERE days_until_expiry > 0), 0) as avg_days_to_expiry
      FROM contract_expirations
      WHERE tenant_id = ${tenantId}
    `;

    const defaultStats = {
      total: BigInt(0),
      expired: BigInt(0),
      critical: BigInt(0),
      high: BigInt(0),
      medium: BigInt(0),
      low: BigInt(0),
      pending: BigInt(0),
      initiated: BigInt(0),
      completed: BigInt(0),
      total_value_at_risk: 0,
      avg_days_to_expiry: 0,
    };
    const summary = stats[0] || defaultStats;

    const data = expirations.map((expiration) => ({
      id: expiration.id,
      contractId: expiration.contract_id,
      contractTitle: expiration.contract_title,
      supplierName: expiration.supplier_name,
      clientName: expiration.client_name,
      contractType: expiration.contract_type,
      expirationDate: expiration.expiration_date?.toISOString(),
      daysUntilExpiry: expiration.days_until_expiry,
      isExpired: expiration.is_expired,
      risk: expiration.expiration_risk,
      renewalStatus: expiration.renewal_status,
      recommendedAction: expiration.recommended_action,
      value: expiration.contract_value ? Number(expiration.contract_value) : null,
      annualValue: expiration.annual_value ? Number(expiration.annual_value) : null,
      valueAtRisk: expiration.value_at_risk ? Number(expiration.value_at_risk) : null,
      ownerName: expiration.owner_name,
      assignedTo: expiration.assigned_to,
      noticeDeadline: expiration.notice_deadline?.toISOString(),
      noticeGiven: expiration.notice_given,
      autoRenewal: expiration.auto_renewal_enabled,
      alertsSent: expiration.alerts_sent,
      lastAlertSent: expiration.last_alert_sent?.toISOString(),
      updatedAt: expiration.updated_at?.toISOString(),
    }));

    return createSuccessResponse(
      context,
      {
        expirations: data,
        stats: {
          total: Number(summary.total || 0),
          expired: Number(summary.expired || 0),
          byRisk: {
            critical: Number(summary.critical || 0),
            high: Number(summary.high || 0),
            medium: Number(summary.medium || 0),
            low: Number(summary.low || 0),
          },
          byStatus: {
            pending: Number(summary.pending || 0),
            initiated: Number(summary.initiated || 0),
            completed: Number(summary.completed || 0),
          },
          totalValueAtRisk: Number(summary.total_value_at_risk || 0),
          avgDaysToExpiry: Math.round(Number(summary.avg_days_to_expiry || 0)),
        },
        pagination: {
          limit,
          offset,
          hasMore: data.length === limit,
        },
      },
      { dataSource: 'database' },
    );
  } catch (error: unknown) {
    return createErrorResponse(context, 'INTERNAL_ERROR', 'Failed to fetch expirations', 500, {
      details: String(error),
    });
  }
}

export async function postContractExpirations(
  request: NextRequest,
  context: ContractApiContext,
) {
  const prisma = await getPrismaClient();
  const tenantId = context.tenantId;
  const userId = context.userId;

  if (!tenantId) {
    return createErrorResponse(context, 'VALIDATION_ERROR', 'Tenant ID is required', 400);
  }

  if (!userId) {
    return createErrorResponse(context, 'UNAUTHORIZED', 'Authentication required', 401);
  }

  const body = await request.json();
  const { action, contractId, data } = body;

  if (!contractId) {
    return createErrorResponse(context, 'VALIDATION_ERROR', 'Contract ID is required', 400);
  }

  const now = new Date();

  switch (action) {
    case 'assign':
      await prisma.$executeRaw`
        UPDATE contract_expirations 
        SET assigned_to = ${data.assignedTo}, assigned_at = ${now}, updated_at = ${now}
        WHERE contract_id = ${contractId} AND tenant_id = ${tenantId}
      `;
      return createSuccessResponse(context, {
        message: 'Expiration assigned',
        contractId,
        assignedTo: data.assignedTo,
        assignedAt: now.toISOString(),
      });

    case 'give-notice':
      await prisma.$executeRaw`
        UPDATE contract_expirations 
        SET notice_given = true, notice_given_at = ${now}, notice_given_by = ${userId}, updated_at = ${now}
        WHERE contract_id = ${contractId} AND tenant_id = ${tenantId}
      `;
      return createSuccessResponse(context, {
        message: 'Notice recorded',
        contractId,
        noticeGiven: true,
        noticeGivenAt: now.toISOString(),
      });

    case 'update-status':
      await prisma.$executeRaw`
        UPDATE contract_expirations 
        SET renewal_status = ${data.status}, updated_at = ${now}
        WHERE contract_id = ${contractId} AND tenant_id = ${tenantId}
      `;
      return createSuccessResponse(context, {
        message: 'Renewal status updated',
        contractId,
        renewalStatus: data.status,
      });

    case 'resolve':
      await prisma.$executeRaw`
        UPDATE contract_expirations 
        SET resolution = ${data.resolution}, resolution_date = ${now}, resolution_by = ${userId},
            resolution_notes = ${data.notes || null}, new_contract_id = ${data.newContractId || null}, updated_at = ${now}
        WHERE contract_id = ${contractId} AND tenant_id = ${tenantId}
      `;
      return createSuccessResponse(context, {
        message: 'Expiration resolved',
        contractId,
        resolution: data.resolution,
        resolvedAt: now.toISOString(),
      });

    case 'toggle-alerts':
      await prisma.$executeRaw`
        UPDATE contract_expirations 
        SET alerts_enabled = NOT alerts_enabled, updated_at = ${now}
        WHERE contract_id = ${contractId} AND tenant_id = ${tenantId}
      `;
      return createSuccessResponse(context, {
        message: 'Alert preference toggled',
      });

    default:
      return createErrorResponse(context, 'VALIDATION_ERROR', 'Invalid action', 400);
  }
}

export async function getContractAlerts(
  request: NextRequest,
  context: ContractApiContext,
) {
  const prisma = await getPrismaClient();

  try {
    const { searchParams } = new URL(request.url);
    const tenantId = context.tenantId;

    if (!tenantId) {
      return createErrorResponse(context, 'VALIDATION_ERROR', 'Tenant ID is required', 400);
    }

    const status = searchParams.get('status');
    const alertType = searchParams.get('type');
    const severity = searchParams.get('severity');
    const contractId = searchParams.get('contractId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const validStatuses = ['PENDING', 'SENT', 'ACKNOWLEDGED'];
    const validSeverities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    const validAlertTypes = [
      'EXPIRATION_7_DAYS',
      'EXPIRATION_30_DAYS',
      'EXPIRATION_60_DAYS',
      'EXPIRATION_90_DAYS',
      'RENEWAL_DUE',
      'NOTICE_DEADLINE',
    ];
    const conditions: Prisma.Sql[] = [Prisma.sql`tenant_id = ${tenantId}`];

    if (status && validStatuses.includes(status)) {
      conditions.push(Prisma.sql`status = ${status}`);
    }
    if (alertType && validAlertTypes.includes(alertType)) {
      conditions.push(Prisma.sql`alert_type = ${alertType}`);
    }
    if (severity && validSeverities.includes(severity)) {
      conditions.push(Prisma.sql`severity = ${severity}`);
    }
    if (contractId) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(contractId)) {
        conditions.push(Prisma.sql`contract_id = ${contractId}`);
      }
    }

    const whereClause = Prisma.join(conditions, ' AND ');
    const alerts = await prisma.$queryRaw<AlertRecord[]>`
      SELECT 
        id, contract_id, alert_type, severity, title, message,
        recipients, sent_to, status, sent_at, delivered_at,
        acknowledged_by, acknowledged_at, acknowledged_action, snooze_until,
        scheduled_for, days_before_expiry, metadata, created_at
      FROM expiration_alerts
      WHERE ${whereClause}
      ORDER BY 
        CASE WHEN status = 'PENDING' THEN 0 ELSE 1 END,
        scheduled_for ASC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const stats = await prisma.$queryRaw<Array<{
      total: bigint;
      pending: bigint;
      sent: bigint;
      acknowledged: bigint;
      critical: bigint;
      high: bigint;
      medium: bigint;
      low: bigint;
      overdue: bigint;
    }>>`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'PENDING') as pending,
        COUNT(*) FILTER (WHERE status = 'SENT') as sent,
        COUNT(*) FILTER (WHERE status = 'ACKNOWLEDGED') as acknowledged,
        COUNT(*) FILTER (WHERE severity = 'CRITICAL') as critical,
        COUNT(*) FILTER (WHERE severity = 'HIGH') as high,
        COUNT(*) FILTER (WHERE severity = 'MEDIUM') as medium,
        COUNT(*) FILTER (WHERE severity = 'LOW') as low,
        COUNT(*) FILTER (WHERE status = 'PENDING' AND scheduled_for < NOW()) as overdue
      FROM expiration_alerts
      WHERE tenant_id = ${tenantId}
    `;

    const defaultStats = {
      total: BigInt(0),
      pending: BigInt(0),
      sent: BigInt(0),
      acknowledged: BigInt(0),
      critical: BigInt(0),
      high: BigInt(0),
      medium: BigInt(0),
      low: BigInt(0),
      overdue: BigInt(0),
    };
    const summary = stats[0] || defaultStats;

    type ContractInfo = {
      id: string;
      contractTitle: string | null;
      originalName: string | null;
      supplierName: string | null;
      expirationDate: Date | null;
      endDate: Date | null;
    };

    const contractIds = [...new Set(alerts.map((alert) => alert.contract_id))];
    const contracts: ContractInfo[] = contractIds.length > 0
      ? (await prisma.contract.findMany({
          where: { id: { in: contractIds } },
          select: {
            id: true,
            contractTitle: true,
            originalName: true,
            supplierName: true,
            expirationDate: true,
            endDate: true,
          },
        })) as ContractInfo[]
      : [];

    const contractMap = new Map<string, ContractInfo>(contracts.map((contract) => [contract.id, contract]));
    const data = alerts.map((alert) => {
      const contract = contractMap.get(alert.contract_id);

      return {
        id: alert.id,
        contractId: alert.contract_id,
        contractName: contract?.contractTitle || contract?.originalName || 'Unknown',
        supplierName: contract?.supplierName,
        expirationDate: (contract?.expirationDate || contract?.endDate)?.toISOString(),
        alertType: alert.alert_type,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        status: alert.status,
        scheduledFor: alert.scheduled_for?.toISOString(),
        daysBeforeExpiry: alert.days_before_expiry,
        sentAt: alert.sent_at?.toISOString(),
        deliveredAt: alert.delivered_at?.toISOString(),
        acknowledgedBy: alert.acknowledged_by,
        acknowledgedAt: alert.acknowledged_at?.toISOString(),
        acknowledgedAction: alert.acknowledged_action,
        snoozeUntil: alert.snooze_until?.toISOString(),
        recipients: alert.recipients,
        sentTo: alert.sent_to,
        createdAt: alert.created_at?.toISOString(),
      };
    });

    return createSuccessResponse(context, {
      alerts: data,
      stats: {
        total: Number(summary.total || 0),
        byStatus: {
          pending: Number(summary.pending || 0),
          sent: Number(summary.sent || 0),
          acknowledged: Number(summary.acknowledged || 0),
        },
        bySeverity: {
          critical: Number(summary.critical || 0),
          high: Number(summary.high || 0),
          medium: Number(summary.medium || 0),
          low: Number(summary.low || 0),
        },
        overdue: Number(summary.overdue || 0),
      },
      pagination: {
        limit,
        offset,
        hasMore: data.length === limit,
      },
    });
  } catch (error: unknown) {
    return handleApiError(context, error);
  }
}

export async function postContractAlerts(
  request: NextRequest,
  context: ContractApiContext,
) {
  const prisma = await getPrismaClient();
  const tenantId = context.tenantId;
  const userId = context.userId;

  if (!tenantId) {
    return createErrorResponse(context, 'VALIDATION_ERROR', 'Tenant ID is required', 400);
  }

  if (!userId) {
    return createErrorResponse(context, 'UNAUTHORIZED', 'Authentication required', 401);
  }

  const body = await request.json();
  const { action, alertId, contractId, data } = body;
  const now = new Date();

  switch (action) {
    case 'create': {
      if (!contractId || !data?.alertType) {
        return createErrorResponse(context, 'VALIDATION_ERROR', 'Contract ID and alert type are required', 400);
      }

      const contract = await prisma.contract.findFirst({
        where: { id: contractId, tenantId },
        select: { id: true },
      });

      if (!contract) {
        return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
      }

      const id = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const scheduledFor = data.scheduledFor ? new Date(data.scheduledFor) : now;

      await prisma.$executeRaw`
        INSERT INTO expiration_alerts (
          id, contract_id, tenant_id, alert_type, severity, title, message,
          recipients, status, scheduled_for, days_before_expiry, created_at, updated_at
        ) VALUES (
          ${id}, ${contractId}, ${tenantId}, ${data.alertType}, ${data.severity || 'MEDIUM'},
          ${data.title || 'Contract Expiration Alert'}, ${data.message || 'Contract is expiring soon'},
          ${JSON.stringify(data.recipients || [])}::jsonb, 'PENDING', ${scheduledFor},
          ${data.daysBeforeExpiry || 30}, ${now}, ${now}
        )
      `;

      return createSuccessResponse(context, {
        id,
        contractId,
        scheduledFor: scheduledFor.toISOString(),
        message: 'Alert created',
      });
    }

    case 'send': {
      if (!alertId) {
        return createErrorResponse(context, 'VALIDATION_ERROR', 'Alert ID is required', 400);
      }

      await prisma.$executeRaw`
        UPDATE expiration_alerts 
        SET status = 'SENT', sent_at = ${now}, sent_to = recipients, updated_at = ${now}
        WHERE id = ${alertId} AND tenant_id = ${tenantId}
      `;

      return createSuccessResponse(context, {
        alertId,
        sentAt: now.toISOString(),
        message: 'Alert sent',
      });
    }

    case 'acknowledge': {
      if (!alertId) {
        return createErrorResponse(context, 'VALIDATION_ERROR', 'Alert ID is required', 400);
      }

      await prisma.$executeRaw`
        UPDATE expiration_alerts 
        SET status = 'ACKNOWLEDGED', acknowledged_at = ${now}, 
            acknowledged_by = ${userId},
            acknowledged_action = ${data?.action || 'DISMISS'}, updated_at = ${now}
        WHERE id = ${alertId} AND tenant_id = ${tenantId}
      `;

      return createSuccessResponse(context, {
        alertId,
        acknowledgedAt: now.toISOString(),
        message: 'Alert acknowledged',
      });
    }

    case 'snooze': {
      if (!alertId || !data?.snoozeUntil) {
        return createErrorResponse(context, 'VALIDATION_ERROR', 'Alert ID and snooze date are required', 400);
      }

      const snoozeDate = new Date(data.snoozeUntil);

      await prisma.$executeRaw`
        UPDATE expiration_alerts 
        SET status = 'ACKNOWLEDGED', acknowledged_at = ${now},
            acknowledged_action = 'SNOOZE', snooze_until = ${snoozeDate}, updated_at = ${now}
        WHERE id = ${alertId} AND tenant_id = ${tenantId}
      `;

      return createSuccessResponse(context, {
        alertId,
        snoozeUntil: snoozeDate.toISOString(),
        message: 'Alert snoozed',
      });
    }

    case 'generate-pending': {
      const expirations = await prisma.$queryRaw<Array<{
        contract_id: string;
        contract_title: string;
        expiration_date: Date;
        days_until_expiry: number;
        expiration_risk: string;
      }>>`
        SELECT contract_id, contract_title, expiration_date, days_until_expiry, expiration_risk
        FROM contract_expirations
        WHERE tenant_id = ${tenantId}
          AND is_expired = false
          AND days_until_expiry BETWEEN 0 AND 90
          AND alerts_enabled = true
      `;

      let created = 0;
      for (const expiration of expirations) {
        const existing = await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM expiration_alerts 
          WHERE contract_id = ${expiration.contract_id} 
            AND tenant_id = ${tenantId}
            AND days_before_expiry = ${expiration.days_until_expiry}
            AND status = 'PENDING'
        `;

        if (existing.length === 0) {
          const generatedAlertType = expiration.days_until_expiry <= 7
            ? 'EXPIRATION_7_DAYS'
            : expiration.days_until_expiry <= 30
              ? 'EXPIRATION_30_DAYS'
              : expiration.days_until_expiry <= 60
                ? 'EXPIRATION_60_DAYS'
                : 'EXPIRATION_90_DAYS';

          const generatedSeverity = expiration.expiration_risk === 'CRITICAL'
            ? 'CRITICAL'
            : expiration.expiration_risk === 'HIGH'
              ? 'HIGH'
              : expiration.expiration_risk === 'MEDIUM'
                ? 'MEDIUM'
                : 'LOW';

          const generatedAlertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

          await prisma.$executeRaw`
            INSERT INTO expiration_alerts (
              id, contract_id, tenant_id, alert_type, severity, title, message,
              recipients, status, scheduled_for, days_before_expiry, created_at, updated_at
            ) VALUES (
              ${generatedAlertId}, ${expiration.contract_id}, ${tenantId}, ${generatedAlertType}, ${generatedSeverity},
              ${`Contract "${expiration.contract_title}" expires in ${expiration.days_until_expiry} days`},
              ${`Action required: Contract is expiring on ${expiration.expiration_date.toLocaleDateString()}`},
              '[]'::jsonb, 'PENDING', ${now}, ${expiration.days_until_expiry}, ${now}, ${now}
            )
          `;
          created += 1;
        }
      }

      return createSuccessResponse(context, {
        created,
        checked: expirations.length,
        message: `Generated ${created} new alerts`,
      });
    }

    default:
      return createErrorResponse(context, 'VALIDATION_ERROR', 'Invalid action', 400);
  }
}

export async function postContractHealthScoreSync(
  request: NextRequest,
  context: ContractApiContext,
) {
  const prisma = await getPrismaClient();

  try {
    const startTime = Date.now();
    const tenantId = context.tenantId;
    const body = await request.json().catch(() => ({}));
    const requestedContractIds = Array.isArray(body?.contractIds)
      ? [...new Set(body.contractIds.filter((contractId): contractId is string => typeof contractId === 'string' && contractId.length > 0))]
      : undefined;

    if (!tenantId) {
      return createErrorResponse(context, 'VALIDATION_ERROR', 'Tenant ID is required', 400);
    }

    const contracts = await prisma.contract.findMany({
      where: {
        tenantId,
        isDeleted: false,
        status: { notIn: ['PROCESSING', 'FAILED', 'DELETED'] },
        ...(requestedContractIds && requestedContractIds.length > 0
          ? {
              id: {
                in: requestedContractIds,
              },
            }
          : {}),
      },
      select: {
        id: true,
        tenantId: true,
        contractTitle: true,
        status: true,
        totalValue: true,
        expirationDate: true,
        endDate: true,
        artifacts: { select: { type: true, data: true } },
        contractMetadata: { select: { riskScore: true, complianceStatus: true, dataQualityScore: true } },
      },
    });

    const now = new Date();
    const results = { synced: 0, errors: 0 };

    for (const contract of contracts) {
      try {
        const artifacts = contract.artifacts || [];
        const metadata = contract.contractMetadata;

        const scores = {
          risk: 70,
          compliance: 70,
          financial: 70,
          operational: 70,
          renewalReadiness: 50,
          documentQuality: 50,
        };
        const factors: Array<{ name: string; score: number; weight: number }> = [];
        const strengths: string[] = [];
        const weaknesses: string[] = [];
        const opportunities: string[] = [];

        const riskArtifact = artifacts.find((artifact) => artifact.type === 'RISK');
        if (riskArtifact) {
          const riskData = riskArtifact.data as any;
          const overallRisk = riskData?.overallRiskLevel || 'MEDIUM';
          scores.risk = overallRisk === 'LOW' ? 85 : overallRisk === 'HIGH' ? 40 : 65;
          if (overallRisk === 'LOW') {
            strengths.push('Low overall risk profile');
          } else if (overallRisk === 'HIGH') {
            weaknesses.push('High risk factors identified');
          }
          factors.push({ name: 'Risk Analysis', score: scores.risk, weight: 0.25 });
        }

        const complianceArtifact = artifacts.find((artifact) => artifact.type === 'COMPLIANCE');
        if (complianceArtifact) {
          const complianceData = complianceArtifact.data as any;
          scores.compliance = complianceData?.complianceScore || 70;
          if (scores.compliance >= 80) {
            strengths.push('Strong compliance posture');
          } else if (scores.compliance < 60) {
            weaknesses.push('Compliance gaps detected');
            opportunities.push('Review compliance issues');
          }
          factors.push({ name: 'Compliance Analysis', score: scores.compliance, weight: 0.20 });
        } else if (metadata?.complianceStatus) {
          scores.compliance = metadata.complianceStatus === 'compliant'
            ? 90
            : metadata.complianceStatus === 'non-compliant'
              ? 30
              : 60;
          factors.push({ name: 'Compliance Status', score: scores.compliance, weight: 0.20 });
        }

        const artifactCount = artifacts.length;
        const hasOverview = artifacts.some((artifact) => artifact.type === 'OVERVIEW');
        scores.documentQuality = Math.min(100, 20 + artifactCount * 15 + (hasOverview ? 20 : 0));
        if (hasOverview) {
          strengths.push('Complete contract analysis available');
        }
        factors.push({ name: 'Document Completeness', score: scores.documentQuality, weight: 0.10 });

        const expirationDate = contract.expirationDate || contract.endDate;
        if (expirationDate) {
          const daysUntilExpiry = Math.ceil((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (daysUntilExpiry < 0) {
            scores.renewalReadiness = 0;
            weaknesses.push('Contract has expired');
          } else if (daysUntilExpiry <= 30) {
            scores.renewalReadiness = 30;
            weaknesses.push('Urgent: expires within 30 days');
          } else if (daysUntilExpiry <= 60) {
            scores.renewalReadiness = 50;
            opportunities.push('Begin renewal process soon');
          } else if (daysUntilExpiry <= 90) {
            scores.renewalReadiness = 70;
            opportunities.push('Plan for upcoming renewal');
          } else {
            scores.renewalReadiness = 90;
            strengths.push('Adequate time for renewal planning');
          }
          factors.push({ name: 'Renewal Timeline', score: scores.renewalReadiness, weight: 0.10 });
        }

        const overallScore = Math.round(
          scores.risk * 0.25
            + scores.compliance * 0.20
            + scores.financial * 0.20
            + scores.operational * 0.15
            + scores.renewalReadiness * 0.10
            + scores.documentQuality * 0.10,
        );

        const alertLevel = overallScore < 40
          ? 'critical'
          : overallScore < 55
            ? 'high'
            : overallScore < 70
              ? 'medium'
              : overallScore < 85
                ? 'low'
                : 'none';
        const activeAlerts: Array<{ type: string; message: string; severity: string }> = [];
        if (scores.risk < 50) {
          activeAlerts.push({ type: 'RISK', message: 'High risk detected', severity: 'high' });
        }
        if (scores.compliance < 60) {
          activeAlerts.push({ type: 'COMPLIANCE', message: 'Compliance issues', severity: 'medium' });
        }
        if (scores.renewalReadiness < 50) {
          activeAlerts.push({ type: 'RENEWAL', message: 'Renewal attention needed', severity: 'medium' });
        }

        const id = `hs_${contract.id}`;
        await prisma.$executeRaw`
          INSERT INTO contract_health_scores (
            id, contract_id, tenant_id, overall_score, risk_score, compliance_score,
            financial_score, operational_score, renewal_readiness, document_quality,
            factors, strengths, weaknesses, opportunities, score_change, trend_direction,
            trend_history, alert_level, active_alerts, alert_count, calculated_at, created_at, updated_at
          ) VALUES (
            ${id}, ${contract.id}, ${contract.tenantId}, ${overallScore}, ${scores.risk}, ${scores.compliance},
            ${scores.financial}, ${scores.operational}, ${scores.renewalReadiness}, ${scores.documentQuality},
            ${JSON.stringify(factors)}::jsonb, ${JSON.stringify(strengths)}::jsonb, 
            ${JSON.stringify(weaknesses)}::jsonb, ${JSON.stringify(opportunities)}::jsonb,
            0, 'stable', '[]'::jsonb, ${alertLevel}, ${JSON.stringify(activeAlerts)}::jsonb, 
            ${activeAlerts.length}, ${now}, ${now}, ${now}
          )
          ON CONFLICT (contract_id) DO UPDATE SET
            overall_score = EXCLUDED.overall_score,
            risk_score = EXCLUDED.risk_score,
            compliance_score = EXCLUDED.compliance_score,
            financial_score = EXCLUDED.financial_score,
            operational_score = EXCLUDED.operational_score,
            renewal_readiness = EXCLUDED.renewal_readiness,
            document_quality = EXCLUDED.document_quality,
            factors = EXCLUDED.factors,
            strengths = EXCLUDED.strengths,
            weaknesses = EXCLUDED.weaknesses,
            opportunities = EXCLUDED.opportunities,
            previous_score = contract_health_scores.overall_score,
            score_change = EXCLUDED.overall_score - contract_health_scores.overall_score,
            trend_direction = CASE 
              WHEN EXCLUDED.overall_score - contract_health_scores.overall_score > 5 THEN 'improving'
              WHEN EXCLUDED.overall_score - contract_health_scores.overall_score < -5 THEN 'declining'
              ELSE 'stable' END,
            alert_level = EXCLUDED.alert_level,
            active_alerts = EXCLUDED.active_alerts,
            alert_count = EXCLUDED.alert_count,
            calculated_at = ${now},
            updated_at = ${now}
        `;

        results.synced += 1;
      } catch {
        results.errors += 1;
      }
    }

    return createSuccessResponse(context, {
      message: 'Health score sync completed',
      totalContracts: contracts.length,
      ...results,
      duration: `${Date.now() - startTime}ms`,
    });
  } catch (error: unknown) {
    return handleApiError(context, error);
  }
}

export async function getContractHealthScoreSyncSummary(
  _request: NextRequest,
  context: ContractApiContext,
) {
  const prisma = await getPrismaClient();
  const tenantId = context.tenantId;

  if (!tenantId) {
    return createErrorResponse(context, 'VALIDATION_ERROR', 'Tenant ID is required', 400);
  }

  const stats = await prisma.$queryRaw<Array<{
    total: bigint;
    avg_overall: number;
    avg_risk: number;
    avg_compliance: number;
    critical_count: bigint;
    high_count: bigint;
    medium_count: bigint;
    healthy_count: bigint;
  }>>`
    SELECT 
      COUNT(*) as total,
      AVG(overall_score) as avg_overall,
      AVG(risk_score) as avg_risk,
      AVG(compliance_score) as avg_compliance,
      COUNT(*) FILTER (WHERE alert_level = 'critical') as critical_count,
      COUNT(*) FILTER (WHERE alert_level = 'high') as high_count,
      COUNT(*) FILTER (WHERE alert_level = 'medium') as medium_count,
      COUNT(*) FILTER (WHERE alert_level IN ('low', 'none')) as healthy_count
    FROM contract_health_scores WHERE tenant_id = ${tenantId}
  `;

  const summary = stats[0] || {
    total: 0n,
    avg_overall: 0,
    avg_risk: 0,
    avg_compliance: 0,
    critical_count: 0n,
    high_count: 0n,
    medium_count: 0n,
    healthy_count: 0n,
  };

  return createSuccessResponse(context, {
    summary: {
      total: Number(summary.total),
      averageScore: Math.round(summary.avg_overall || 0),
      averageRiskScore: Math.round(summary.avg_risk || 0),
      averageComplianceScore: Math.round(summary.avg_compliance || 0),
    },
    byAlertLevel: {
      critical: Number(summary.critical_count),
      high: Number(summary.high_count),
      medium: Number(summary.medium_count),
      healthy: Number(summary.healthy_count),
    },
  });
}

export async function postContractTrackingSync(
  request: NextRequest,
  context: ContractApiContext,
) {
  const startTime = Date.now();

  try {
    const tenantId = context.tenantId;
    const userId = context.userId;

    if (!tenantId) {
      return createErrorResponse(context, 'VALIDATION_ERROR', 'Tenant ID is required', 400);
    }

    if (!userId) {
      return createErrorResponse(context, 'UNAUTHORIZED', 'Authentication required', 401);
    }

    const baseUrl = request.nextUrl.origin;
    const authHeaders = {
      'Content-Type': 'application/json',
      'x-tenant-id': tenantId,
      'x-user-id': userId,
    };

    const results = {
      expirations: { success: false, data: null as any, error: null as string | null },
      healthScores: { success: false, data: null as any, error: null as string | null },
      alerts: { success: false, data: null as any, error: null as string | null },
    };

    try {
      const expirationsResponse = await fetch(`${baseUrl}/api/contracts/sync-expirations`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ tenantId }),
      });
      const expirationsResult = await expirationsResponse.json();
      results.expirations = {
        success: expirationsResult.success,
        data: expirationsResult.data,
        error: expirationsResult.error?.message || null,
      };
    } catch (error) {
      results.expirations.error = String(error);
    }

    try {
      const healthScoresResponse = await fetch(`${baseUrl}/api/contracts/sync-health-scores`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ tenantId }),
      });
      const healthScoresResult = await healthScoresResponse.json();
      results.healthScores = {
        success: healthScoresResult.success,
        data: healthScoresResult.data,
        error: healthScoresResult.error?.message || null,
      };
    } catch (error) {
      results.healthScores.error = String(error);
    }

    try {
      const alertsResponse = await fetch(`${baseUrl}/api/contracts/alerts`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ tenantId, action: 'generate-pending' }),
      });
      const alertsResult = await alertsResponse.json();
      results.alerts = {
        success: alertsResult.success,
        data: alertsResult.data,
        error: alertsResult.error || null,
      };
    } catch (error) {
      results.alerts.error = String(error);
    }

    const allSuccess = results.expirations.success
      && results.healthScores.success
      && results.alerts.success;

    return createSuccessResponse(context, {
      allSuccess,
      message: allSuccess
        ? 'All contract data synced successfully'
        : 'Some sync operations failed',
      expirations: results.expirations,
      healthScores: results.healthScores,
      alerts: results.alerts,
      summary: {
        contractsWithExpirations: results.expirations.data?.synced || 0,
        contractsWithHealthScores: results.healthScores.data?.synced || 0,
        alertsGenerated: results.alerts.data?.created || 0,
      },
      tenantId,
      duration: `${Date.now() - startTime}ms`,
    });
  } catch {
    return createErrorResponse(context, 'INTERNAL_ERROR', 'Failed to sync contract data', 500);
  }
}

export async function getContractTrackingSyncDescription(
  context: ContractApiContext,
) {
  return createSuccessResponse(context, {
    endpoints: {
      expirations: '/api/contracts/sync-expirations',
      healthScores: '/api/contracts/sync-health-scores',
      alerts: '/api/contracts/alerts (action: generate-pending)',
      fullSync: '/api/contracts/sync (POST)',
    },
    description: 'POST to /api/contracts/sync to trigger a full sync of all tracking data',
  });
}