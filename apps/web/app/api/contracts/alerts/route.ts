/**
 * Expiration Alerts API
 * GET /api/contracts/alerts - Get pending and sent expiration alerts
 * POST /api/contracts/alerts - Create, send, or acknowledge alerts
 * 
 * Uses the ExpirationAlert table for tracking alert history
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerTenantId } from '@/lib/tenant-server';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = await getServerTenantId();
    
    const status = searchParams.get('status'); // PENDING, SENT, ACKNOWLEDGED
    const alertType = searchParams.get('type'); // EXPIRATION_30_DAYS, etc.
    const severity = searchParams.get('severity'); // LOW, MEDIUM, HIGH, CRITICAL
    const contractId = searchParams.get('contractId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Validate input against allowed values to prevent SQL injection
    const validStatuses = ['PENDING', 'SENT', 'ACKNOWLEDGED'];
    const validSeverities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    const validAlertTypes = ['EXPIRATION_30_DAYS', 'EXPIRATION_60_DAYS', 'EXPIRATION_90_DAYS', 'RENEWAL_DUE', 'NOTICE_DEADLINE'];
    
    // Build safe parameterized query using Prisma.sql
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
      // Validate UUID format to prevent injection
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(contractId)) {
        conditions.push(Prisma.sql`contract_id = ${contractId}`);
      }
    }

    const whereClause = Prisma.join(conditions, ' AND ');

    /**
     * Alert recipient structure
     */
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

    // Query alerts with safe parameterized query
    const alerts = await prisma.$queryRaw<Array<{
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
    }>>`
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

    // Get summary stats
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
    const s = stats[0] || defaultStats;

    // Get contract details
    const contractIds = [...new Set(alerts.map(a => a.contract_id))];
    type ContractInfo = {
      id: string;
      contractTitle: string | null;
      originalName: string | null;
      supplierName: string | null;
      expirationDate: Date | null;
      endDate: Date | null;
    };

    const contracts: ContractInfo[] =
      contractIds.length > 0
        ? ((await prisma.contract.findMany({
            where: { id: { in: contractIds } },
            select: {
              id: true,
              contractTitle: true,
              originalName: true,
              supplierName: true,
              expirationDate: true,
              endDate: true,
            },
          })) as ContractInfo[])
        : [];

    const contractMap = new Map<string, ContractInfo>(contracts.map(c => [c.id, c]));

    // Transform response
    const data = alerts.map(alert => {
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

    return NextResponse.json({
      success: true,
      data: {
        alerts: data,
        stats: {
          total: Number(s.total || 0),
          byStatus: {
            pending: Number(s.pending || 0),
            sent: Number(s.sent || 0),
            acknowledged: Number(s.acknowledged || 0),
          },
          bySeverity: {
            critical: Number(s.critical || 0),
            high: Number(s.high || 0),
            medium: Number(s.medium || 0),
            low: Number(s.low || 0),
          },
          overdue: Number(s.overdue || 0),
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
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch alerts', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = await getServerTenantId();
    const body = await request.json();
    const { action, alertId, contractId, data } = body;
    const now = new Date();

    switch (action) {
      case 'create':
        // Create a new alert
        if (!contractId || !data?.alertType) {
          return NextResponse.json(
            { success: false, error: 'Contract ID and alert type are required' },
            { status: 400 }
          );
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

        return NextResponse.json({
          success: true,
          message: 'Alert created',
          data: { id, contractId, scheduledFor: scheduledFor.toISOString() },
        });

      case 'send':
        if (!alertId) {
          return NextResponse.json(
            { success: false, error: 'Alert ID is required' },
            { status: 400 }
          );
        }

        await prisma.$executeRaw`
          UPDATE expiration_alerts 
          SET status = 'SENT', sent_at = ${now}, sent_to = recipients, updated_at = ${now}
          WHERE id = ${alertId} AND tenant_id = ${tenantId}
        `;

        return NextResponse.json({
          success: true,
          message: 'Alert sent',
          data: { alertId, sentAt: now.toISOString() },
        });

      case 'acknowledge':
        if (!alertId) {
          return NextResponse.json(
            { success: false, error: 'Alert ID is required' },
            { status: 400 }
          );
        }

        await prisma.$executeRaw`
          UPDATE expiration_alerts 
          SET status = 'ACKNOWLEDGED', acknowledged_at = ${now}, 
              acknowledged_by = ${data?.userId || 'system'},
              acknowledged_action = ${data?.action || 'DISMISS'}, updated_at = ${now}
          WHERE id = ${alertId} AND tenant_id = ${tenantId}
        `;

        return NextResponse.json({
          success: true,
          message: 'Alert acknowledged',
          data: { alertId, acknowledgedAt: now.toISOString() },
        });

      case 'snooze':
        if (!alertId || !data?.snoozeUntil) {
          return NextResponse.json(
            { success: false, error: 'Alert ID and snooze date are required' },
            { status: 400 }
          );
        }

        const snoozeDate = new Date(data.snoozeUntil);

        await prisma.$executeRaw`
          UPDATE expiration_alerts 
          SET status = 'ACKNOWLEDGED', acknowledged_at = ${now},
              acknowledged_action = 'SNOOZE', snooze_until = ${snoozeDate}, updated_at = ${now}
          WHERE id = ${alertId} AND tenant_id = ${tenantId}
        `;

        return NextResponse.json({
          success: true,
          message: 'Alert snoozed',
          data: { alertId, snoozeUntil: snoozeDate.toISOString() },
        });

      case 'generate-pending':
        // Generate pending alerts for contracts expiring soon
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
        for (const exp of expirations) {
          // Check if alert already exists
          const existing = await prisma.$queryRaw<Array<{ id: string }>>`
            SELECT id FROM expiration_alerts 
            WHERE contract_id = ${exp.contract_id} 
              AND tenant_id = ${tenantId}
              AND days_before_expiry = ${exp.days_until_expiry}
              AND status = 'PENDING'
          `;

          if (existing.length === 0) {
            const alertType = exp.days_until_expiry <= 7 ? 'EXPIRATION_7_DAYS' :
                              exp.days_until_expiry <= 30 ? 'EXPIRATION_30_DAYS' :
                              exp.days_until_expiry <= 60 ? 'EXPIRATION_60_DAYS' : 'EXPIRATION_90_DAYS';
            
            const severity = exp.expiration_risk === 'CRITICAL' ? 'CRITICAL' :
                            exp.expiration_risk === 'HIGH' ? 'HIGH' :
                            exp.expiration_risk === 'MEDIUM' ? 'MEDIUM' : 'LOW';

            const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            await prisma.$executeRaw`
              INSERT INTO expiration_alerts (
                id, contract_id, tenant_id, alert_type, severity, title, message,
                recipients, status, scheduled_for, days_before_expiry, created_at, updated_at
              ) VALUES (
                ${alertId}, ${exp.contract_id}, ${tenantId}, ${alertType}, ${severity},
                ${`Contract "${exp.contract_title}" expires in ${exp.days_until_expiry} days`},
                ${`Action required: Contract is expiring on ${exp.expiration_date.toLocaleDateString()}`},
                '[]'::jsonb, 'PENDING', ${now}, ${exp.days_until_expiry}, ${now}, ${now}
              )
            `;
            created++;
          }
        }

        return NextResponse.json({
          success: true,
          message: `Generated ${created} new alerts`,
          data: { created, checked: expirations.length },
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: 'Failed to process action', details: String(error) },
      { status: 500 }
    );
  }
}
