import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

/**
 * Ecosystem API — Unified view across ERP integrations, Spend, and Contracts
 *
 * GET /api/ecosystem
 *   Returns aggregated data for the synergized dashboard:
 *   - ERP integration statuses + sync health
 *   - Spend metrics (PO, Invoice, matching)
 *   - Contract portfolio summary (value, status, categories)
 *   - Cross-system analytics (contract-to-spend variance, ERP sync coverage)
 *   - Forecasting summary
 */
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = ctx.tenantId;

  try {
    // ═══════════════════════════════════════════════════════════════════
    // PARALLEL: Fetch all data sources simultaneously
    // ═══════════════════════════════════════════════════════════════════

    const [
      integrations,
      contracts,
      spendMetricsRaw,
      workflowStats,
      recentSyncs,
      topSuppliers,
      categoryBreakdown,
      monthlySpendTrend,
    ] = await Promise.all([
      // 1. ERP / Integration statuses
      prisma.integration.findMany({
        where: { tenantId },
        include: {
          syncLogs: { orderBy: { startedAt: 'desc' }, take: 1 },
        },
        orderBy: { updatedAt: 'desc' },
      }),

      // 2. Contract portfolio
      prisma.contract.findMany({
        where: { tenantId },
        select: {
          id: true,
          status: true,
          totalValue: true,
          annualValue: true,
          spendType: true,
          contractType: true,
          supplierName: true,
          effectiveDate: true,
          expirationDate: true,
          categoryL1: true,
          categoryL2: true,
          paymentFrequency: true,
          currency: true,
        },
      }),

      // 3. Spend metrics from raw tables
      prisma.$queryRaw`
        SELECT
          (SELECT COUNT(*)::int FROM purchase_orders WHERE tenant_id = ${tenantId}) as total_pos,
          (SELECT COUNT(*)::int FROM invoices WHERE tenant_id = ${tenantId}) as total_invoices,
          (SELECT COUNT(*)::int FROM invoices WHERE tenant_id = ${tenantId} AND match_status = 'MATCHED') as matched_invoices,
          (SELECT COUNT(*)::int FROM invoices WHERE tenant_id = ${tenantId} AND match_status = 'DISCREPANCY') as discrepant_invoices,
          (SELECT COUNT(*)::int FROM invoices WHERE tenant_id = ${tenantId} AND match_status = 'UNMATCHED') as unmatched_invoices,
          (SELECT COUNT(*)::int FROM spend_exceptions WHERE tenant_id = ${tenantId} AND status = 'OPEN') as open_exceptions,
          (SELECT COALESCE(SUM(total_amount), 0)::decimal(15,2) FROM purchase_orders WHERE tenant_id = ${tenantId}) as total_po_value,
          (SELECT COALESCE(SUM(total_amount), 0)::decimal(15,2) FROM invoices WHERE tenant_id = ${tenantId}) as total_invoice_value,
          (SELECT COALESCE(SUM(total_amount), 0)::decimal(15,2) FROM purchase_orders WHERE tenant_id = ${tenantId} AND created_at > NOW() - INTERVAL '30 days') as po_value_30d,
          (SELECT COALESCE(SUM(total_amount), 0)::decimal(15,2) FROM invoices WHERE tenant_id = ${tenantId} AND created_at > NOW() - INTERVAL '30 days') as invoice_value_30d
      `.catch(() => [{}]),

      // 4. Workflow stats
      prisma.workflowExecution.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { _all: true },
      }),

      // 5. Recent sync activity
      prisma.syncLog.findMany({
        where: { integration: { tenantId } },
        include: { integration: { select: { name: true, provider: true, type: true } } },
        orderBy: { startedAt: 'desc' },
        take: 10,
      }),

      // 6. Top suppliers by contract value
      prisma.contract.groupBy({
        by: ['supplierName'],
        where: { tenantId, supplierName: { not: null } },
        _sum: { totalValue: true, annualValue: true },
        _count: { _all: true },
        orderBy: { _sum: { totalValue: 'desc' } },
        take: 10,
      }),

      // 7. Category breakdown
      prisma.contract.groupBy({
        by: ['categoryL1'],
        where: { tenantId, categoryL1: { not: null } },
        _sum: { totalValue: true },
        _count: { _all: true },
        orderBy: { _sum: { totalValue: 'desc' } },
        take: 10,
      }),

      // 8. Monthly spend trend (last 12 months)
      prisma.$queryRaw`
        SELECT
          TO_CHAR(created_at, 'YYYY-MM') as month,
          SUM(total_amount)::decimal(15,2) as po_spend
        FROM purchase_orders
        WHERE tenant_id = ${tenantId} AND created_at > NOW() - INTERVAL '12 months'
        GROUP BY TO_CHAR(created_at, 'YYYY-MM')
        ORDER BY month ASC
      `.catch(() => []),
    ]);

    // ═══════════════════════════════════════════════════════════════════
    // PROCESS: Derive analytics from raw data
    // ═══════════════════════════════════════════════════════════════════

    const spendMetrics = (spendMetricsRaw as Record<string, unknown>[])[0] || {};

    // Contract portfolio summary
    const portfolioValue = contracts.reduce((sum, c) => sum + Number(c.totalValue || 0), 0);
    const annualCommitment = contracts.reduce((sum, c) => sum + Number(c.annualValue || 0), 0);

    const statusCounts: Record<string, number> = {};
    const spendTypeCounts: Record<string, number> = {};
    const currencyCounts: Record<string, number> = {};
    let expiringIn30 = 0;
    let expiringIn90 = 0;
    const now = new Date();
    const d30 = new Date(now.getTime() + 30 * 86400000);
    const d90 = new Date(now.getTime() + 90 * 86400000);

    for (const c of contracts) {
      statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
      if (c.spendType) spendTypeCounts[c.spendType] = (spendTypeCounts[c.spendType] || 0) + 1;
      if (c.currency) currencyCounts[c.currency] = (currencyCounts[c.currency] || 0) + 1;
      if (c.expirationDate) {
        const exp = new Date(c.expirationDate);
        if (exp <= d30 && exp >= now) expiringIn30++;
        if (exp <= d90 && exp >= now) expiringIn90++;
      }
    }

    // ERP integration health
    const erpIntegrations = integrations.filter(i => i.type === 'ERP');
    const procurementIntegrations = integrations.filter(i => i.type === 'PROCUREMENT');
    const allConnected = integrations.filter(i => i.status === 'CONNECTED');

    const integrationHealth = {
      total: integrations.length,
      connected: allConnected.length,
      erroring: integrations.filter(i => (i.errors24h ?? 0) > 0).length,
      erp: erpIntegrations.map(i => ({
        id: i.id,
        name: i.name,
        provider: i.provider,
        status: i.status,
        lastSync: i.lastSyncAt,
        recordsProcessed: i.recordsProcessed,
        healthStatus: i.healthStatus,
        uptime: i.uptime,
        errors24h: i.errors24h,
      })),
      procurement: procurementIntegrations.map(i => ({
        id: i.id,
        name: i.name,
        provider: i.provider,
        status: i.status,
        lastSync: i.lastSyncAt,
        recordsProcessed: i.recordsProcessed,
      })),
      all: integrations.map(i => ({
        id: i.id,
        name: i.name,
        type: i.type,
        provider: i.provider,
        status: i.status,
        lastSync: i.lastSyncAt,
        latestSyncStatus: i.syncLogs[0]?.status,
      })),
    };

    // Cross-system analytics
    const totalPoValue = Number(spendMetrics.total_po_value || 0);
    const totalInvoiceValue = Number(spendMetrics.total_invoice_value || 0);
    const contractToSpendVariance = portfolioValue > 0
      ? ((totalPoValue - portfolioValue) / portfolioValue * 100)
      : 0;
    const invoiceMatchRate = Number(spendMetrics.total_invoices || 0) > 0
      ? (Number(spendMetrics.matched_invoices || 0) / Number(spendMetrics.total_invoices || 1) * 100)
      : 0;
    const erpSyncCoverage = contracts.length > 0
      ? (allConnected.length > 0 ? Math.min(100, (integrations.reduce((s, i) => s + (i.recordsProcessed || 0), 0) / contracts.length) * 100) : 0)
      : 0;

    // Workflow summary
    const workflowSummary: Record<string, number> = {};
    for (const ws of workflowStats) {
      workflowSummary[ws.status] = ws._count._all;
    }

    // ═══════════════════════════════════════════════════════════════════
    // RESPONSE: Unified ecosystem payload
    // ═══════════════════════════════════════════════════════════════════

    return createSuccessResponse(ctx, {
      // Portfolio KPIs
      portfolio: {
        totalContracts: contracts.length,
        portfolioValue,
        annualCommitment,
        byStatus: Object.entries(statusCounts).map(([status, count]) => ({ status, count })),
        bySpendType: Object.entries(spendTypeCounts).map(([type, count]) => ({ type, count })),
        byCurrency: Object.entries(currencyCounts).map(([currency, count]) => ({ currency, count })),
        expiringIn30,
        expiringIn90,
      },

      // Spend metrics
      spend: {
        totalPOs: Number(spendMetrics.total_pos || 0),
        totalInvoices: Number(spendMetrics.total_invoices || 0),
        matchedInvoices: Number(spendMetrics.matched_invoices || 0),
        discrepantInvoices: Number(spendMetrics.discrepant_invoices || 0),
        unmatchedInvoices: Number(spendMetrics.unmatched_invoices || 0),
        openExceptions: Number(spendMetrics.open_exceptions || 0),
        totalPoValue,
        totalInvoiceValue,
        poValue30d: Number(spendMetrics.po_value_30d || 0),
        invoiceValue30d: Number(spendMetrics.invoice_value_30d || 0),
        invoiceMatchRate: Math.round(invoiceMatchRate * 10) / 10,
      },

      // Integration health
      integrations: integrationHealth,

      // Cross-system analytics
      crossSystem: {
        contractToSpendVariance: Math.round(contractToSpendVariance * 10) / 10,
        erpSyncCoverage: Math.round(erpSyncCoverage * 10) / 10,
        invoiceMatchRate: Math.round(invoiceMatchRate * 10) / 10,
        dataCompleteness: Math.round(
          ((contracts.filter(c => c.totalValue).length / Math.max(contracts.length, 1)) * 40 +
            (contracts.filter(c => c.supplierName).length / Math.max(contracts.length, 1)) * 30 +
            (contracts.filter(c => c.categoryL1).length / Math.max(contracts.length, 1)) * 30)
          * 10
        ) / 10,
      },

      // Suppliers
      topSuppliers: topSuppliers.map(s => ({
        name: s.supplierName,
        totalValue: Number(s._sum.totalValue || 0),
        annualValue: Number(s._sum.annualValue || 0),
        contractCount: s._count._all,
      })),

      // Categories
      categories: categoryBreakdown.map(c => ({
        category: c.categoryL1,
        totalValue: Number(c._sum.totalValue || 0),
        contractCount: c._count._all,
      })),

      // Monthly trend
      monthlyTrend: (monthlySpendTrend as Array<{ month: string; po_spend: number }>).map(m => ({
        month: m.month,
        poSpend: Number(m.po_spend || 0),
      })),

      // Recent sync activity
      recentSyncs: recentSyncs.map(s => ({
        id: s.id,
        integrationName: s.integration?.name,
        provider: s.integration?.provider,
        type: s.integration?.type,
        status: s.status,
        recordsTotal: s.recordsTotal,
        recordsSuccess: s.recordsSuccess,
        recordsFailed: s.recordsFailed,
        startedAt: s.startedAt,
        completedAt: s.completedAt,
        duration: s.duration,
      })),

      // Workflow summary
      workflows: {
        pending: workflowSummary['PENDING'] || 0,
        inProgress: workflowSummary['IN_PROGRESS'] || 0,
        completed: workflowSummary['COMPLETED'] || 0,
        failed: workflowSummary['FAILED'] || 0,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `Ecosystem data fetch failed: ${message}`, 500);
  }
});
