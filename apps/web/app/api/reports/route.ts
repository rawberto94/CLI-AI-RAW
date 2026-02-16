/**
 * Unified AI Report API - Merges best features from 3 systems
 * - Portfolio analytics with AI insights
 * - Custom field selection and filtering
 * - Multi-format export (PDF, CSV, JSON)
 * - Deep contract analysis with benchmarking
 */

import { NextRequest, NextResponse } from 'next/server';
import { reportGeneratorService } from 'data-orchestration/services';
import { reportExportService } from 'data-orchestration/services';
import { analyticsService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, getApiContext} from '@/lib/api-middleware';

// Import deep analysis from ai-builder
import { prisma } from '@/lib/prisma';

// ============================================
// UNIFIED REPORT GENERATION
// ============================================

export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const { searchParams } = new URL(request.url);
  const reportType = searchParams.get('type') || 'executive';
  const format = searchParams.get('format') || 'json';
  const supplierName = searchParams.get('supplier');
  const _deepAnalysis = searchParams.get('deep') === 'true';

  const tenantId = ctx.tenantId;

  let report;

  // Generate report based on type (uses new analytics service)
  switch (reportType) {
    case 'executive':
      report = await reportGeneratorService.generateExecutiveReport(tenantId);
      break;

    case 'financial':
      report = await reportGeneratorService.generateFinancialReport(tenantId);
      break;

    case 'risk':
      report = await reportGeneratorService.generateRiskReport(tenantId);
      break;

    case 'compliance':
      report = await reportGeneratorService.generateComplianceReport(tenantId);
      break;

    case 'supplier':
      if (!supplierName) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'Supplier name required for supplier reports', 400);
      }
      report = await reportGeneratorService.generateSupplierReport(tenantId, supplierName);
      break;

    default:
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid report type', 400);
  }

  // Export in requested format
  let exportedData;
  let contentType;
  let filename;

  switch (format) {
    case 'pdf':
      exportedData = await reportExportService.exportToPDF(report);
      contentType = 'text/html';
      filename = `${report.type}-report-${Date.now()}.html`;
      break;

    case 'excel':
    case 'csv':
      exportedData = await reportExportService.exportToExcel(report);
      contentType = 'text/csv';
      filename = `${report.type}-report-${Date.now()}.csv`;
      break;

    case 'json':
    default:
      exportedData = await reportExportService.exportToJSON(report);
      contentType = 'application/json';
      filename = `${report.type}-report-${Date.now()}.json`;
      break;
  }

  // Return report
  if (format === 'json') {
    return createSuccessResponse(ctx, report);
  } else {
    return new NextResponse(exportedData, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  }
});

// ============================================
// UNIFIED ANALYTICS & CUSTOM REPORTS
// ============================================

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = ctx.tenantId;
  const body = await request.json();
  const { action, fields, filters, groupBy } = body;

  switch (action) {
    // Portfolio-level analytics (from new system)
    case 'portfolio_metrics': {
      const metrics = await analyticsService.getPortfolioMetrics(tenantId);
      return createSuccessResponse(ctx, { metrics });
    }

    case 'spend_analysis': {
      const spend = await analyticsService.getSpendAnalysis(tenantId);
      return createSuccessResponse(ctx, { spend });
    }

    case 'risk_analysis': {
      const risks = await analyticsService.getRiskAnalysis(tenantId);
      return createSuccessResponse(ctx, { risks });
    }

    case 'savings_opportunities': {
      const savings = await analyticsService.getSavingsOpportunities(tenantId);
      return createSuccessResponse(ctx, { savings });
    }

    case 'supplier_performance': {
      const { supplierName } = body;
      if (!supplierName) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'Supplier name required', 400);
      }
      const performance = await analyticsService.getSupplierPerformance(tenantId, supplierName);
      return createSuccessResponse(ctx, { performance });
    }

    case 'anomaly_detection': {
      const anomalies = await analyticsService.detectAnomalies(tenantId);
      return createSuccessResponse(ctx, { anomalies });
    }

    // Custom field-based reports (from ReportBuilder)
    case 'custom_report': {
      if (!fields || fields.length === 0) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'Fields required for custom reports', 400);
      }
      const customData = await generateCustomReport(tenantId, fields, filters, groupBy);
      return createSuccessResponse(ctx, { data: customData, rows: customData.length });
    }

    default:
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid action', 400);
  }
});

// ============================================
// CUSTOM REPORT GENERATION
// Merges field selection from ReportBuilder with analytics service
// ============================================

async function generateCustomReport(
  tenantId: string,
  fields: string[],
  filters: Record<string, any> = {},
  _groupBy?: string
): Promise<any[]> {
  // Build dynamic query based on selected fields
  const where: any = { tenantId };

  // Apply filters
  if (filters.suppliers && filters.suppliers.length > 0) {
    where.supplierName = { in: filters.suppliers };
  }
  if (filters.categories && filters.categories.length > 0) {
    where.categoryL1 = { in: filters.categories };
  }
  if (filters.statuses && filters.statuses.length > 0) {
    where.status = { in: filters.statuses };
  }

  // Fetch contracts
  const contracts = await prisma.contract.findMany({
    where,
    include: {
      artifacts: {
        where: { status: 'active' },
        select: { type: true, data: true },
      },
    },
  });

  // Transform to include requested fields only
  return contracts.map((contract) => {
    const row: any = {};

    fields.forEach((field) => {
      switch (field) {
        case 'contract_name':
          row.contractName = contract.contractTitle || contract.fileName;
          break;
        case 'supplier_name':
          row.supplierName = contract.supplierName;
          break;
        case 'contract_value':
          row.contractValue = Number(contract.totalValue || 0);
          break;
        case 'start_date':
          row.startDate = contract.effectiveDate;
          break;
        case 'end_date':
          row.endDate = contract.expirationDate;
          break;
        case 'status':
          row.status = contract.status;
          break;
        case 'days_to_renewal':
          if (contract.expirationDate) {
            row.daysToRenewal = Math.ceil(
              (new Date(contract.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            );
          }
          break;
        case 'category':
          row.category = contract.categoryL1;
          break;
        case 'auto_renewal':
          row.autoRenewal = contract.autoRenewalEnabled;
          break;
      }
    });

    return row;
  });
}
