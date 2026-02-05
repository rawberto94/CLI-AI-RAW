/**
 * Renewal History API
 * GET /api/contracts/renewal-history - Get renewal history for contracts
 * POST /api/contracts/renewal-history - Record a new renewal
 * 
 * Uses the RenewalHistory table for complete renewal lifecycle tracking
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Prisma as _Prisma } from '@prisma/client';
import { getServerTenantId } from '@/lib/tenant-server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = await getServerTenantId();
    
    const contractId = searchParams.get('contractId');
    const renewalType = searchParams.get('type');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');

    /**
     * Renewal terms JSON structure
     */
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

    // Query renewal history
    const renewals = await prisma.$queryRaw<Array<{
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
    }>>`
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
        ${contractId ? prisma.$queryRaw`AND contract_id = ${contractId}` : prisma.$queryRaw``}
        ${renewalType ? prisma.$queryRaw`AND renewal_type = ${renewalType}` : prisma.$queryRaw``}
      ORDER BY completed_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    // Get contract details
    const contractIds = [...new Set(renewals.map(r => r.contract_id))];
    type ContractInfo = {
      id: string;
      contractTitle: string | null;
      originalName: string | null;
      supplierName: string | null;
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
            },
          })) as ContractInfo[])
        : [];

    const contractMap = new Map<string, ContractInfo>(contracts.map(c => [c.id, c]));

    // Get summary stats
    const stats = await prisma.$queryRaw<Array<{
      total: bigint;
      standard: bigint;
      renegotiated: bigint;
      extended: bigint;
      auto_renewed: bigint;
      total_value_change: number;
      avg_negotiation_days: number;
      avg_value_change_percent: number;
    }>>`
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

    const defaultStats = {
      total: BigInt(0),
      standard: BigInt(0),
      renegotiated: BigInt(0),
      extended: BigInt(0),
      auto_renewed: BigInt(0),
      total_value_change: 0,
      avg_negotiation_days: 0,
      avg_value_change_percent: 0,
    };
    const s = stats[0] || defaultStats;

    // Transform response
    const data = renewals.map(renewal => {
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

    return NextResponse.json({
      success: true,
      data: {
        renewals: data,
        stats: {
          total: Number(s.total || 0),
          byType: {
            standard: Number(s.standard || 0),
            renegotiated: Number(s.renegotiated || 0),
            extended: Number(s.extended || 0),
            autoRenewed: Number(s.auto_renewed || 0),
          },
          totalValueChange: Number(s.total_value_change || 0),
          avgNegotiationDays: Math.round(Number(s.avg_negotiation_days || 0)),
          avgValueChangePercent: Number(s.avg_value_change_percent || 0).toFixed(1),
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
      { success: false, error: 'Failed to fetch renewal history', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = await getServerTenantId();
    const body = await request.json();
    const { contractId, renewalData } = body;
    const now = new Date();

    if (!contractId || !renewalData) {
      return NextResponse.json(
        { success: false, error: 'Contract ID and renewal data are required' },
        { status: 400 }
      );
    }

    // Get current contract data
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
      return NextResponse.json(
        { success: false, error: 'Contract not found' },
        { status: 404 }
      );
    }

    // Get previous renewal count
    const prevRenewals = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM renewal_history 
      WHERE contract_id = ${contractId} AND tenant_id = ${tenantId}
    `;
    const renewalNumber = Number(prevRenewals[0]?.count || 0) + 1;

    // Calculate value change
    const previousValue = contract.totalValue ? Number(contract.totalValue) : 0;
    const newValue = renewalData.newValue || previousValue;
    const valueChange = newValue - previousValue;
    const valueChangePercent = previousValue > 0 ? ((valueChange / previousValue) * 100) : 0;

    // Calculate term extension
    const previousEndDate = contract.endDate || contract.expirationDate;
    const newEndDate = renewalData.newEndDate ? new Date(renewalData.newEndDate) : null;
    const termExtension = previousEndDate && newEndDate 
      ? Math.ceil((newEndDate.getTime() - previousEndDate.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    const id = `renewal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Insert renewal history record
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
        ${renewalData.initiatedBy || null}, ${renewalData.initiatedAt ? new Date(renewalData.initiatedAt) : null},
        ${renewalData.completedBy || 'system'}, ${now},
        'COMPLETED', ${renewalData.notes || null}, ${now}
      )
    `;

    // Update contract with new dates if provided
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

    // Update expiration record
    await prisma.$executeRaw`
      UPDATE contract_expirations 
      SET renewal_status = 'COMPLETED', resolution = 'RENEWED', resolution_date = ${now},
          updated_at = ${now}
      WHERE contract_id = ${contractId} AND tenant_id = ${tenantId}
    `.catch((err) => console.error('[RenewalHistory] Expiration record update error:', err));

    return NextResponse.json({
      success: true,
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
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: 'Failed to record renewal', details: String(error) },
      { status: 500 }
    );
  }
}
