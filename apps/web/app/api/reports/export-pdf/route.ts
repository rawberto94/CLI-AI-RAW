'use server';

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

/**
 * POST /api/reports/export-pdf
 * Generate a downloadable PDF from report data
 * Uses html2pdf-style approach for client-side, or returns structured data
 */
export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const body = await request.json();
  const { reportData, filters, generatedAt } = body;

  if (!reportData) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Report data is required', 400);
  }

  // Format the report as HTML for PDF generation
  const html = generateReportHTML(reportData, filters, generatedAt, 'User');

  return createSuccessResponse(ctx, {
    html,
    filename: `ConTigo_AI_Report_${new Date().toISOString().split('T')[0]}.pdf`
  });
});

function generateReportHTML(
  report: {
    summary: {
      totalContracts: number;
      activeContracts: number;
      totalValue: number;
      averageValue: number;
      averageDurationMonths: number;
      shortestDurationMonths: number;
      longestDurationMonths: number;
    };
    contracts: Array<{
      id: string;
      title: string;
      supplierName: string;
      value: number;
      status: string;
      effectiveDate: string | null;
      expirationDate: string | null;
      durationMonths: number;
      category: string;
    }>;
    byCategory: Record<string, { count: number; value: number }>;
    byStatus: Record<string, number>;
    riskAnalysis: {
      expiringIn30Days: number;
      expiringIn90Days: number;
      autoRenewalCount: number;
      highValueAtRisk: number;
    };
    aiSummary?: string;
  },
  filters: {
    suppliers?: string[];
    categories?: string[];
    years?: string[];
    statuses?: string[];
  },
  generatedAt: string,
  userName: string
): string {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const filterSummary = [
    filters.suppliers?.length ? `Suppliers: ${filters.suppliers.join(', ')}` : null,
    filters.categories?.length ? `Categories: ${filters.categories.join(', ')}` : null,
    filters.years?.length ? `Years: ${filters.years.join(', ')}` : null,
    filters.statuses?.length ? `Statuses: ${filters.statuses.join(', ')}` : null,
  ].filter(Boolean).join(' | ') || 'All Contracts';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>ConTigo AI Report</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #1e293b;
      line-height: 1.6;
      padding: 40px;
      background: #fff;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 3px solid #8b5cf6;
    }
    
    .logo {
      font-size: 28px;
      font-weight: 700;
      color: #8b5cf6;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .logo-icon {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, #8b5cf6, #6366f1);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 20px;
    }
    
    .report-title {
      font-size: 24px;
      font-weight: 600;
      color: #1e293b;
      margin-top: 5px;
    }
    
    .meta {
      text-align: right;
      font-size: 12px;
      color: #64748b;
    }
    
    .filters-bar {
      background: #f1f5f9;
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 24px;
      font-size: 13px;
      color: #475569;
    }
    
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 30px;
    }
    
    .summary-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px;
      text-align: center;
    }
    
    .summary-card.blue { border-left: 4px solid #8b5cf6; }
    .summary-card.green { border-left: 4px solid #10b981; }
    .summary-card.purple { border-left: 4px solid #8b5cf6; }
    .summary-card.orange { border-left: 4px solid #f59e0b; }
    
    .summary-value {
      font-size: 28px;
      font-weight: 700;
      color: #1e293b;
    }
    
    .summary-label {
      font-size: 12px;
      color: #64748b;
      margin-top: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .section {
      margin-bottom: 30px;
    }
    
    .section-title {
      font-size: 16px;
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e2e8f0;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .ai-summary {
      background: linear-gradient(135deg, #eff6ff, #f5f3ff);
      border: 1px solid #c7d2fe;
      border-radius: 12px;
      padding: 20px;
      font-size: 14px;
      line-height: 1.7;
    }
    
    .risk-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
    }
    
    .risk-card {
      text-align: center;
      padding: 16px;
      border-radius: 8px;
    }
    
    .risk-card.red { background: #fef2f2; color: #dc2626; }
    .risk-card.orange { background: #fff7ed; color: #ea580c; }
    .risk-card.yellow { background: #fefce8; color: #ca8a04; }
    .risk-card.purple { background: #faf5ff; color: #9333ea; }
    
    .risk-value {
      font-size: 24px;
      font-weight: 700;
    }
    
    .risk-label {
      font-size: 11px;
      margin-top: 4px;
    }
    
    .category-list {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }
    
    .category-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: #f8fafc;
      border-radius: 8px;
      font-size: 13px;
    }
    
    .category-name {
      font-weight: 500;
    }
    
    .category-stats {
      color: #64748b;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    
    th {
      background: #f1f5f9;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      color: #475569;
      border-bottom: 2px solid #e2e8f0;
    }
    
    td {
      padding: 10px 12px;
      border-bottom: 1px solid #e2e8f0;
    }
    
    tr:hover { background: #f8fafc; }
    
    .status-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 12px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
    }
    
    .status-ACTIVE { background: #dcfce7; color: #16a34a; }
    .status-PENDING { background: #fef3c7; color: #d97706; }
    .status-EXPIRED { background: #fee2e2; color: #dc2626; }
    .status-DRAFT { background: #e0e7ff; color: #4f46e5; }
    .status-ARCHIVED { background: #f1f5f9; color: #64748b; }
    
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
      color: #94a3b8;
      text-align: center;
    }
    
    @media print {
      body { padding: 20px; }
      .page-break { page-break-before: always; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">
        <div class="logo-icon">C</div>
        ConTigo
      </div>
      <div class="report-title">AI Contract Analysis Report</div>
    </div>
    <div class="meta">
      <div>Generated: ${new Date(generatedAt).toLocaleString()}</div>
      <div>By: ${userName}</div>
    </div>
  </div>
  
  <div class="filters-bar">
    <strong>Filters Applied:</strong> ${filterSummary}
  </div>
  
  <div class="summary-grid">
    <div class="summary-card blue">
      <div class="summary-value">${report.summary.totalContracts}</div>
      <div class="summary-label">Total Contracts</div>
    </div>
    <div class="summary-card green">
      <div class="summary-value">${formatCurrency(report.summary.totalValue)}</div>
      <div class="summary-label">Total Value</div>
    </div>
    <div class="summary-card purple">
      <div class="summary-value">${report.summary.averageDurationMonths} mo</div>
      <div class="summary-label">Avg Duration</div>
    </div>
    <div class="summary-card orange">
      <div class="summary-value">${report.riskAnalysis.expiringIn90Days}</div>
      <div class="summary-label">Expiring in 90d</div>
    </div>
  </div>
  
  ${report.aiSummary ? `
  <div class="section">
    <div class="section-title">✨ AI Executive Summary</div>
    <div class="ai-summary">
      ${report.aiSummary.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br />')}
    </div>
  </div>
  ` : ''}
  
  <div class="section">
    <div class="section-title">⚠️ Risk Analysis</div>
    <div class="risk-grid">
      <div class="risk-card red">
        <div class="risk-value">${report.riskAnalysis.expiringIn30Days}</div>
        <div class="risk-label">Expiring in 30 days</div>
      </div>
      <div class="risk-card orange">
        <div class="risk-value">${report.riskAnalysis.expiringIn90Days}</div>
        <div class="risk-label">Expiring in 90 days</div>
      </div>
      <div class="risk-card yellow">
        <div class="risk-value">${report.riskAnalysis.autoRenewalCount}</div>
        <div class="risk-label">Auto-renewal</div>
      </div>
      <div class="risk-card purple">
        <div class="risk-value">${report.riskAnalysis.highValueAtRisk}</div>
        <div class="risk-label">High-value at risk</div>
      </div>
    </div>
  </div>
  
  <div class="section">
    <div class="section-title">📁 By Category</div>
    <div class="category-list">
      ${Object.entries(report.byCategory).map(([cat, data]) => `
        <div class="category-item">
          <span class="category-name">${cat}</span>
          <span class="category-stats">${data.count} contracts · ${formatCurrency(data.value)}</span>
        </div>
      `).join('')}
    </div>
  </div>
  
  <div class="page-break"></div>
  
  <div class="section">
    <div class="section-title">📋 Contract Details</div>
    <table>
      <thead>
        <tr>
          <th>Contract Title</th>
          <th>Supplier</th>
          <th>Value</th>
          <th>Duration</th>
          <th>Status</th>
          <th>Expiration</th>
        </tr>
      </thead>
      <tbody>
        ${report.contracts.slice(0, 50).map(contract => `
          <tr>
            <td><strong>${contract.title || 'Untitled'}</strong></td>
            <td>${contract.supplierName || 'N/A'}</td>
            <td>${formatCurrency(contract.value || 0)}</td>
            <td>${contract.durationMonths || 0} mo</td>
            <td><span class="status-badge status-${contract.status}">${contract.status}</span></td>
            <td>${formatDate(contract.expirationDate)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    ${report.contracts.length > 50 ? `<p style="margin-top: 12px; font-size: 12px; color: #64748b;">Showing 50 of ${report.contracts.length} contracts</p>` : ''}
  </div>
  
  <div class="footer">
    <p>Generated by ConTigo AI Contract Management Platform</p>
    <p>© ${new Date().getFullYear()} ConTigo. All rights reserved.</p>
  </div>
</body>
</html>
  `.trim();
}
