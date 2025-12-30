/**
 * Report Export Service
 * Exports reports to PDF, Excel, and JSON formats
 */

import { ReportData, ChartData } from './analytics.service';

// ============================================
// REPORT EXPORT SERVICE
// ============================================

class ReportExportService {
  private static instance: ReportExportService;

  private constructor() {}

  public static getInstance(): ReportExportService {
    if (!ReportExportService.instance) {
      ReportExportService.instance = new ReportExportService();
    }
    return ReportExportService.instance;
  }

  // ============================================
  // PDF EXPORT
  // ============================================

  async exportToPDF(report: ReportData): Promise<string> {
    // Generate HTML for PDF conversion
    const html = this.generateReportHTML(report);

    // In a production environment, you would use a library like:
    // - puppeteer
    // - html-pdf
    // - pdfkit
    // For now, return the HTML that can be converted to PDF

    return html;
  }

  private generateReportHTML(report: ReportData): string {
    const { title, generatedAt, metrics, insights, recommendations, summary, charts } = report;

    let html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px;
      color: #1f2937;
      line-height: 1.6;
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
      border-bottom: 3px solid #3b82f6;
      padding-bottom: 20px;
    }
    .header h1 {
      color: #1e40af;
      margin: 0 0 10px 0;
      font-size: 32px;
    }
    .header .date {
      color: #6b7280;
      font-size: 14px;
    }
    .summary {
      background: #eff6ff;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
      border-left: 4px solid #3b82f6;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .metric-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      border-left: 4px solid #10b981;
    }
    .metric-card .label {
      font-size: 12px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .metric-card .value {
      font-size: 28px;
      font-weight: bold;
      color: #1f2937;
      margin-top: 5px;
    }
    .section {
      margin-bottom: 30px;
    }
    .section h2 {
      color: #1e40af;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    .insight-list, .recommendation-list {
      list-style: none;
      padding: 0;
    }
    .insight-list li, .recommendation-list li {
      padding: 12px;
      margin-bottom: 10px;
      background: #f9fafb;
      border-radius: 6px;
      border-left: 3px solid #3b82f6;
    }
    .chart-placeholder {
      background: #f3f4f6;
      padding: 40px;
      text-align: center;
      border-radius: 8px;
      margin-bottom: 20px;
      color: #6b7280;
    }
    .footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 2px solid #e5e7eb;
      text-align: center;
      color: #6b7280;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${title}</h1>
    <p class="date">Generated: ${generatedAt.toLocaleDateString()} ${generatedAt.toLocaleTimeString()}</p>
  </div>

  <div class="summary">
    <h3>Executive Summary</h3>
    <p>${summary}</p>
  </div>

  <div class="metrics-grid">
    <div class="metric-card">
      <div class="label">Total Contracts</div>
      <div class="value">${metrics.totalContracts}</div>
    </div>
    <div class="metric-card">
      <div class="label">Active Contracts</div>
      <div class="value">${metrics.activeContracts}</div>
    </div>
    <div class="metric-card">
      <div class="label">Total Value</div>
      <div class="value">$${(metrics.totalValue / 1000000).toFixed(1)}M</div>
    </div>
    <div class="metric-card">
      <div class="label">Compliance Score</div>
      <div class="value">${metrics.complianceScore}%</div>
    </div>
  </div>

  <div class="section">
    <h2>📊 Key Insights</h2>
    <ul class="insight-list">
      ${insights.map((insight) => `<li>${insight}</li>`).join('')}
    </ul>
  </div>

  <div class="section">
    <h2>🎯 Recommendations</h2>
    <ul class="recommendation-list">
      ${recommendations.map((rec) => `<li>${rec}</li>`).join('')}
    </ul>
  </div>

  <div class="section">
    <h2>📈 Visual Analytics</h2>
    ${charts.map((chart) => `<div class="chart-placeholder">[${chart.type.toUpperCase()} CHART: ${chart.title}]</div>`).join('')}
  </div>

  <div class="footer">
    <p>This report was generated automatically by the AI-Powered Contract Intelligence System</p>
    <p>Report ID: ${report.id} | Type: ${report.type}</p>
  </div>
</body>
</html>`;

    return html;
  }

  // ============================================
  // EXCEL EXPORT
  // ============================================

  async exportToExcel(report: ReportData): Promise<string> {
    // Generate CSV format (can be opened in Excel)
    const csv = this.generateReportCSV(report);
    return csv;
  }

  private generateReportCSV(report: ReportData): string {
    const { title, generatedAt, metrics, spend, risks } = report;

    let csv = `"${title}"\n`;
    csv += `"Generated","${generatedAt.toISOString()}"\n\n`;

    // Portfolio Metrics
    csv += `"Portfolio Metrics"\n`;
    csv += `"Metric","Value"\n`;
    csv += `"Total Contracts","${metrics.totalContracts}"\n`;
    csv += `"Active Contracts","${metrics.activeContracts}"\n`;
    csv += `"Total Value","${metrics.totalValue}"\n`;
    csv += `"Annual Value","${metrics.annualValue}"\n`;
    csv += `"Avg Contract Value","${metrics.avgContractValue}"\n`;
    csv += `"Avg Duration (days)","${metrics.avgDuration}"\n`;
    csv += `"Expiring in 30 Days","${metrics.expiringIn30Days}"\n`;
    csv += `"Expiring in 90 Days","${metrics.expiringIn90Days}"\n`;
    csv += `"High Risk Count","${metrics.highRiskCount}"\n`;
    csv += `"Auto Renewal Count","${metrics.autoRenewalCount}"\n`;
    csv += `"Supplier Count","${metrics.supplierCount}"\n`;
    csv += `"Category Count","${metrics.categoryCount}"\n`;
    csv += `"Compliance Score","${metrics.complianceScore}"\n\n`;

    // Spend by Supplier
    csv += `"Spend by Supplier"\n`;
    csv += `"Supplier","Value","Count","Percentage"\n`;
    spend.bySupplier.slice(0, 20).forEach((s) => {
      csv += `"${s.supplier}","${s.value}","${s.count}","${s.percentage.toFixed(2)}%"\n`;
    });
    csv += `\n`;

    // Spend by Category
    csv += `"Spend by Category"\n`;
    csv += `"Category","Value","Count","Percentage"\n`;
    spend.byCategory.slice(0, 20).forEach((c) => {
      csv += `"${c.category}","${c.value}","${c.count}","${c.percentage.toFixed(2)}%"\n`;
    });
    csv += `\n`;

    // Risk Analysis
    csv += `"Risk Analysis"\n`;
    csv += `"Metric","Value"\n`;
    csv += `"Overall Risk Score","${risks.overallRiskScore}"\n`;
    csv += `"Low Risk","${risks.riskDistribution.low}"\n`;
    csv += `"Medium Risk","${risks.riskDistribution.medium}"\n`;
    csv += `"High Risk","${risks.riskDistribution.high}"\n`;
    csv += `"Critical Risk","${risks.riskDistribution.critical}"\n`;
    csv += `"High Value at Risk","${risks.highValueAtRisk}"\n\n`;

    // Expiring Contracts
    if (risks.expiringContracts.length > 0) {
      csv += `"Expiring Contracts"\n`;
      csv += `"Contract","Supplier","Days Until Expiration","Value"\n`;
      risks.expiringContracts.forEach((c) => {
        csv += `"${c.title}","${c.supplier}","${c.daysUntil}","${c.value}"\n`;
      });
      csv += `\n`;
    }

    return csv;
  }

  // ============================================
  // JSON EXPORT
  // ============================================

  async exportToJSON(report: ReportData): Promise<string> {
    return JSON.stringify(report, null, 2);
  }

  // ============================================
  // CHART DATA EXPORT
  // ============================================

  exportChartData(chart: ChartData): any {
    return {
      type: chart.type,
      title: chart.title,
      data: chart.data,
      labels: chart.labels,
      datasets: chart.datasets,
      options: chart.options,
    };
  }

  // ============================================
  // BATCH EXPORT
  // ============================================

  async exportMultipleReports(reports: ReportData[], format: 'pdf' | 'excel' | 'json'): Promise<string[]> {
    const exports: string[] = [];

    for (const report of reports) {
      let exported: string;
      switch (format) {
        case 'pdf':
          exported = await this.exportToPDF(report);
          break;
        case 'excel':
          exported = await this.exportToExcel(report);
          break;
        case 'json':
          exported = await this.exportToJSON(report);
          break;
      }
      exports.push(exported);
    }

    return exports;
  }
}

export const reportExportService = ReportExportService.getInstance();
