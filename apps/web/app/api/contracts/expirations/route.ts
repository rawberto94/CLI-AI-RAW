/**
 * Contract Expirations API
 * GET /api/contracts/expirations - Get contract expiration data from the dedicated table
 * POST /api/contracts/expirations - Update expiration records or trigger actions
 * 
 * Uses the ContractExpiration table for fast querying of expiration data
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerTenantId } from '@/lib/tenant-server';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

interface ExpirationFilters {
  risk?: string;
  status?: string;
  isExpired?: boolean;
  daysUntilExpiry?: number;
  ownerId?: string;
  assignedTo?: string;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = await getServerTenantId();
    
    // Parse filters
    const risk = searchParams.get('risk');
    const status = searchParams.get('status');
    const isExpired = searchParams.get('isExpired');
    const daysMax = searchParams.get('daysMax');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Validate input against allowed values to prevent SQL injection
    const validRisks = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    const validStatuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'EXPIRED', 'RENEWED'];

    // Build safe parameterized query using Prisma.sql
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
      const daysMaxInt = parseInt(daysMax);
      if (!isNaN(daysMaxInt) && daysMaxInt >= 0) {
        conditions.push(Prisma.sql`days_until_expiry <= ${daysMaxInt}`);
      }
    }

    const whereClause = Prisma.join(conditions, ' AND ');

    // Query expirations with safe parameterized query
    const expirations = await prisma.$queryRaw<Array<{
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
    }>>`
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

    // Get summary stats
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
    const s = stats[0] || defaultStats;

    // Transform to API response format
    const data = expirations.map(exp => ({
      id: exp.id,
      contractId: exp.contract_id,
      contractTitle: exp.contract_title,
      supplierName: exp.supplier_name,
      clientName: exp.client_name,
      contractType: exp.contract_type,
      expirationDate: exp.expiration_date?.toISOString(),
      daysUntilExpiry: exp.days_until_expiry,
      isExpired: exp.is_expired,
      risk: exp.expiration_risk,
      renewalStatus: exp.renewal_status,
      recommendedAction: exp.recommended_action,
      value: exp.contract_value ? Number(exp.contract_value) : null,
      annualValue: exp.annual_value ? Number(exp.annual_value) : null,
      valueAtRisk: exp.value_at_risk ? Number(exp.value_at_risk) : null,
      ownerName: exp.owner_name,
      assignedTo: exp.assigned_to,
      noticeDeadline: exp.notice_deadline?.toISOString(),
      noticeGiven: exp.notice_given,
      autoRenewal: exp.auto_renewal_enabled,
      alertsSent: exp.alerts_sent,
      lastAlertSent: exp.last_alert_sent?.toISOString(),
      updatedAt: exp.updated_at?.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: {
        expirations: data,
        stats: {
          total: Number(s.total || 0),
          expired: Number(s.expired || 0),
          byRisk: {
            critical: Number(s.critical || 0),
            high: Number(s.high || 0),
            medium: Number(s.medium || 0),
            low: Number(s.low || 0),
          },
          byStatus: {
            pending: Number(s.pending || 0),
            initiated: Number(s.initiated || 0),
            completed: Number(s.completed || 0),
          },
          totalValueAtRisk: Number(s.total_value_at_risk || 0),
          avgDaysToExpiry: Math.round(Number(s.avg_days_to_expiry || 0)),
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
      { success: false, error: 'Failed to fetch expirations', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = await getServerTenantId();
    const body = await request.json();
    const { action, contractId, data } = body;

    if (!contractId) {
      return NextResponse.json(
        { success: false, error: 'Contract ID is required' },
        { status: 400 }
      );
    }

    const now = new Date();

    switch (action) {
      case 'assign':
        await prisma.$executeRaw`
          UPDATE contract_expirations 
          SET assigned_to = ${data.assignedTo}, assigned_at = ${now}, updated_at = ${now}
          WHERE contract_id = ${contractId} AND tenant_id = ${tenantId}
        `;
        return NextResponse.json({
          success: true,
          message: 'Expiration assigned',
          data: { contractId, assignedTo: data.assignedTo, assignedAt: now.toISOString() },
        });

      case 'give-notice':
        await prisma.$executeRaw`
          UPDATE contract_expirations 
          SET notice_given = true, notice_given_at = ${now}, notice_given_by = ${data.userId || 'system'}, updated_at = ${now}
          WHERE contract_id = ${contractId} AND tenant_id = ${tenantId}
        `;
        return NextResponse.json({
          success: true,
          message: 'Notice recorded',
          data: { contractId, noticeGiven: true, noticeGivenAt: now.toISOString() },
        });

      case 'update-status':
        await prisma.$executeRaw`
          UPDATE contract_expirations 
          SET renewal_status = ${data.status}, updated_at = ${now}
          WHERE contract_id = ${contractId} AND tenant_id = ${tenantId}
        `;
        return NextResponse.json({
          success: true,
          message: 'Renewal status updated',
          data: { contractId, renewalStatus: data.status },
        });

      case 'resolve':
        await prisma.$executeRaw`
          UPDATE contract_expirations 
          SET resolution = ${data.resolution}, resolution_date = ${now}, resolution_by = ${data.userId || 'system'},
              resolution_notes = ${data.notes || null}, new_contract_id = ${data.newContractId || null}, updated_at = ${now}
          WHERE contract_id = ${contractId} AND tenant_id = ${tenantId}
        `;
        return NextResponse.json({
          success: true,
          message: 'Expiration resolved',
          data: { contractId, resolution: data.resolution, resolvedAt: now.toISOString() },
        });

      case 'toggle-alerts':
        await prisma.$executeRaw`
          UPDATE contract_expirations 
          SET alerts_enabled = NOT alerts_enabled, updated_at = ${now}
          WHERE contract_id = ${contractId} AND tenant_id = ${tenantId}
        `;
        return NextResponse.json({
          success: true,
          message: 'Alert preference toggled',
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
