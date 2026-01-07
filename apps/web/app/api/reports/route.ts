/**
 * Unified AI Report API - Merges best features from 3 systems
 * - Portfolio analytics with AI insights
 * - Custom field selection and filtering
 * - Multi-format export (PDF, CSV, JSON)
 * - Deep contract analysis with benchmarking
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { reportGeneratorService } from '@/packages/data-orchestration/src/services/report-generator.service';
import { reportExportService } from '@/packages/data-orchestration/src/services/report-export.service';
import { analyticsService } from '@/packages/data-orchestration/src/services/analytics.service';

// Import deep analysis from ai-builder
import { prisma } from '@/lib/prisma';

// ============================================
// UNIFIED REPORT GENERATION
// ============================================

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('type') || 'executive';
    const format = searchParams.get('format') || 'json';
    const supplierName = searchParams.get('supplier');
    const deepAnalysis = searchParams.get('deep') === 'true';

    const tenantId = session.user.tenantId;

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
          return NextResponse.json({ error: 'Supplier name required for supplier reports' }, { status: 400 });
        }
        report = await reportGeneratorService.generateSupplierReport(tenantId, supplierName);
        break;

      default:
        return NextResponse.json({ error: 'Invalid report type' }, { status: 400 });
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
      return NextResponse.json(report);
    } else {
      return new NextResponse(exportedData, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }
  } catch (error) {
    console.error('[Report API] Error generating report:', error);
    return NextResponse.json(
      { error: 'Failed to generate report', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ============================================
// UNIFIED ANALYTICS & CUSTOM REPORTS
// ============================================

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    const body = await request.json();
    const { action, fields, filters, groupBy } = body;

    switch (action) {
      // Portfolio-level analytics (from new system)
      case 'portfolio_metrics':
        const metrics = await analyticsService.getPortfolioMetrics(tenantId);
        return NextResponse.json({ metrics });

      case 'spend_analysis':
        const spend = await analyticsService.getSpendAnalysis(tenantId);
        return NextResponse.json({ spend });

      case 'risk_analysis':
        const risks = await analyticsService.getRiskAnalysis(tenantId);
        return NextResponse.json({ risks });

      case 'savings_opportunities':
        const savings = await analyticsService.getSavingsOpportunities(tenantId);
        return NextResponse.json({ savings });

      case 'supplier_performance':
        const { supplierName } = body;
        if (!supplierName) {
          return NextResponse.json({ error: 'Supplier name required' }, { status: 400 });
        }
        const performance = await analyticsService.getSupplierPerformance(tenantId, supplierName);
        return NextResponse.json({ performance });

      case 'anomaly_detection':
        const anomalies = await analyticsService.detectAnomalies(tenantId);
        return NextResponse.json({ anomalies });

      // Custom field-based reports (from ReportBuilder)
      case 'custom_report':
        if (!fields || fields.length === 0) {
          return NextResponse.json({ error: 'Fields required for custom reports' }, { status: 400 });
        }
        const customData = await generateCustomReport(tenantId, fields, filters, groupBy);
        return NextResponse.json({ success: true, data: customData, rows: customData.length });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[Report API] Error processing request:', error);
    return NextResponse.json(
      { error: 'Failed to process request', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ============================================
// CUSTOM REPORT GENERATION
// Merges field selection from ReportBuilder with analytics service
// ============================================

async function generateCustomReport(
  tenantId: string,
  fields: string[],
  filters: Record<string, any> = {},
  groupBy?: string
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
