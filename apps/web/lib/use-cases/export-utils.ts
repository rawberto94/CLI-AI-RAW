import type { RoleRate, Geography } from './enhanced-rate-benchmarking-data'
import { calculateConfidenceScore } from './data-quality'

/**
 * Export rate benchmarking data to CSV
 */
export function exportToCSV(
  roles: RoleRate[],
  geography: Geography,
  supplierName?: string
): string {
  const headers = [
    'Role',
    'Supplier',
    'Service Line',
    'Geography',
    'Seniority Level',
    'Your Rate ($/hr)',
    'ChainIQ Benchmark ($/hr)',
    'Industry Average ($/hr)',
    'P25 ($/hr)',
    'P75 ($/hr)',
    'P90 ($/hr)',
    'Variance ($)',
    'Variance (%)',
    'FTE Count',
    'Total Annual Cost ($)',
    'Location Premium (%)',
    'Skills Premium (%)',
    'Contract Date',
    'Last Updated',
    'Confidence (%)'
  ]
  
  const rows = roles.map(role => {
    const variance = role.hourlyRate - role.chainIQBenchmark
    const variancePercent = (variance / role.chainIQBenchmark) * 100
    const confidence = calculateConfidenceScore(role)
    
    return [
      role.role,
      role.supplierName,
      role.serviceLine,
      role.geography,
      role.level,
      role.hourlyRate.toFixed(2),
      role.chainIQBenchmark.toFixed(2),
      role.industryAverage.toFixed(2),
      role.chainIQPercentile.p25.toFixed(2),
      role.chainIQPercentile.p75.toFixed(2),
      role.chainIQPercentile.p90.toFixed(2),
      variance.toFixed(2),
      variancePercent.toFixed(2),
      role.fteCount || 1,
      role.totalAnnualCost.toFixed(2),
      role.locationPremium,
      role.skillsPremium,
      role.contractDate.toLocaleDateString(),
      role.lastUpdated.toLocaleDateString(),
      (confidence.overall * 100).toFixed(0)
    ]
  })
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n')
  
  return csvContent
}

/**
 * Download CSV file
 */
export function downloadCSV(content: string, filename: string = 'rate-benchmarking.csv'): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Export to Excel-compatible format (CSV with additional formatting hints)
 */
export function exportToExcel(
  roles: RoleRate[],
  geography: Geography,
  supplierName?: string
): string {
  // For now, use CSV format which Excel can open
  // In a real implementation, you'd use a library like xlsx or exceljs
  const csv = exportToCSV(roles, geography, supplierName)
  
  // Add Excel-specific metadata
  const metadata = [
    `ChainIQ Rate Benchmarking Report`,
    `Generated: ${new Date().toLocaleString()}`,
    `Geography: ${geography}`,
    supplierName ? `Supplier: ${supplierName}` : '',
    `Total Roles: ${roles.length}`,
    '',
    ''
  ].filter(Boolean).join('\n')
  
  return metadata + '\n' + csv
}

/**
 * Download Excel file
 */
export function downloadExcel(content: string, filename: string = 'rate-benchmarking.xlsx'): void {
  // For now, download as CSV which Excel can open
  // In production, use proper Excel format
  downloadCSV(content, filename.replace('.xlsx', '.csv'))
}

/**
 * Generate PDF report content (HTML that can be converted to PDF)
 */
export function generatePDFContent(
  roles: RoleRate[],
  geography: Geography,
  supplierName?: string
): string {
  const totalCurrentCost = roles.reduce((sum, r) => sum + r.totalAnnualCost, 0)
  const totalChainIQCost = roles.reduce((sum, r) => sum + (r.chainIQBenchmark * (r.fteCount || 1) * 2080), 0)
  const totalSavings = totalCurrentCost - totalChainIQCost
  const savingsPercent = (totalSavings / totalCurrentCost) * 100
  
  const aboveMarket = roles.filter(r => r.hourlyRate > r.chainIQBenchmark).length
  const atMarket = roles.filter(r => Math.abs(r.hourlyRate - r.chainIQBenchmark) <= r.chainIQBenchmark * 0.05).length
  const belowMarket = roles.filter(r => r.hourlyRate < r.chainIQBenchmark * 0.95).length
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>ChainIQ Rate Benchmarking Report</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 40px;
      color: #333;
    }
    h1 {
      color: #2563eb;
      border-bottom: 3px solid #2563eb;
      padding-bottom: 10px;
    }
    h2 {
      color: #4b5563;
      margin-top: 30px;
    }
    .summary {
      background: #f3f4f6;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .metric {
      display: inline-block;
      margin: 10px 20px 10px 0;
    }
    .metric-label {
      font-size: 12px;
      color: #6b7280;
      text-transform: uppercase;
    }
    .metric-value {
      font-size: 24px;
      font-weight: bold;
      color: #1f2937;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th {
      background: #2563eb;
      color: white;
      padding: 12px;
      text-align: left;
      font-weight: 600;
    }
    td {
      padding: 10px 12px;
      border-bottom: 1px solid #e5e7eb;
    }
    tr:nth-child(even) {
      background: #f9fafb;
    }
    .above-market {
      color: #dc2626;
      font-weight: 600;
    }
    .at-market {
      color: #059669;
      font-weight: 600;
    }
    .below-market {
      color: #2563eb;
      font-weight: 600;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <h1>ChainIQ Rate Benchmarking Report</h1>
  
  <div class="summary">
    <div class="metric">
      <div class="metric-label">Report Date</div>
      <div class="metric-value">${new Date().toLocaleDateString()}</div>
    </div>
    <div class="metric">
      <div class="metric-label">Geography</div>
      <div class="metric-value">${geography}</div>
    </div>
    ${supplierName ? `
    <div class="metric">
      <div class="metric-label">Supplier</div>
      <div class="metric-value">${supplierName}</div>
    </div>
    ` : ''}
    <div class="metric">
      <div class="metric-label">Roles Analyzed</div>
      <div class="metric-value">${roles.length}</div>
    </div>
  </div>
  
  <h2>Executive Summary</h2>
  <div class="summary">
    <div class="metric">
      <div class="metric-label">Current Annual Cost</div>
      <div class="metric-value">$${(totalCurrentCost / 1000).toFixed(0)}K</div>
    </div>
    <div class="metric">
      <div class="metric-label">ChainIQ Benchmark Cost</div>
      <div class="metric-value">$${(totalChainIQCost / 1000).toFixed(0)}K</div>
    </div>
    <div class="metric">
      <div class="metric-label">Potential Savings</div>
      <div class="metric-value" style="color: #059669;">$${(totalSavings / 1000).toFixed(0)}K</div>
    </div>
    <div class="metric">
      <div class="metric-label">Savings Percentage</div>
      <div class="metric-value" style="color: #059669;">${savingsPercent.toFixed(1)}%</div>
    </div>
  </div>
  
  <h2>Rate Distribution</h2>
  <div class="summary">
    <div class="metric">
      <div class="metric-label">Above Market</div>
      <div class="metric-value above-market">${aboveMarket}</div>
    </div>
    <div class="metric">
      <div class="metric-label">At Market</div>
      <div class="metric-value at-market">${atMarket}</div>
    </div>
    <div class="metric">
      <div class="metric-label">Below Market</div>
      <div class="metric-value below-market">${belowMarket}</div>
    </div>
  </div>
  
  <h2>Detailed Rate Analysis</h2>
  <table>
    <thead>
      <tr>
        <th>Role</th>
        <th>Your Rate</th>
        <th>ChainIQ Benchmark</th>
        <th>Variance</th>
        <th>Annual Savings</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${roles.map(role => {
        const variance = role.hourlyRate - role.chainIQBenchmark
        const variancePercent = (variance / role.chainIQBenchmark) * 100
        const annualSavings = variance * (role.fteCount || 1) * 2080
        const status = variance > role.chainIQBenchmark * 0.05 ? 'above-market' : 
                      variance < -role.chainIQBenchmark * 0.05 ? 'below-market' : 'at-market'
        
        return `
      <tr>
        <td>${role.role}</td>
        <td>$${role.hourlyRate}/hr</td>
        <td>$${role.chainIQBenchmark}/hr</td>
        <td class="${status}">${variance > 0 ? '+' : ''}$${variance.toFixed(0)}/hr (${variancePercent.toFixed(1)}%)</td>
        <td class="${status}">${annualSavings > 0 ? '+' : ''}$${(annualSavings / 1000).toFixed(0)}K</td>
        <td class="${status}">${status.replace('-', ' ').toUpperCase()}</td>
      </tr>
        `
      }).join('')}
    </tbody>
  </table>
  
  <div class="footer">
    <p><strong>ChainIQ Rate Benchmarking</strong></p>
    <p>This report is based on ChainIQ's proprietary benchmark data derived from 500+ anonymized contracts.</p>
    <p>All rates are normalized for geography, seniority, and service line to ensure accurate comparisons.</p>
    <p>Generated: ${new Date().toLocaleString()}</p>
  </div>
</body>
</html>
  `
}

/**
 * Download PDF (opens print dialog with formatted content)
 */
export function downloadPDF(content: string, filename: string = 'rate-benchmarking-report.pdf'): void {
  // Open a new window with the HTML content
  const printWindow = window.open('', '_blank')
  if (printWindow) {
    printWindow.document.write(content)
    printWindow.document.close()
    
    // Trigger print dialog after content loads
    printWindow.onload = () => {
      printWindow.print()
    }
  }
}

/**
 * Export summary data for quick sharing
 */
export function exportSummary(
  roles: RoleRate[],
  geography: Geography,
  supplierName?: string
): string {
  const totalCurrentCost = roles.reduce((sum, r) => sum + r.totalAnnualCost, 0)
  const totalChainIQCost = roles.reduce((sum, r) => sum + (r.chainIQBenchmark * (r.fteCount || 1) * 2080), 0)
  const totalSavings = totalCurrentCost - totalChainIQCost
  const savingsPercent = (totalSavings / totalCurrentCost) * 100
  
  return `
ChainIQ Rate Benchmarking Summary
Generated: ${new Date().toLocaleString()}
${supplierName ? `Supplier: ${supplierName}` : ''}
Geography: ${geography}

EXECUTIVE SUMMARY
-----------------
Roles Analyzed: ${roles.length}
Current Annual Cost: $${(totalCurrentCost / 1000).toFixed(0)}K
ChainIQ Benchmark Cost: $${(totalChainIQCost / 1000).toFixed(0)}K
Potential Savings: $${(totalSavings / 1000).toFixed(0)}K (${savingsPercent.toFixed(1)}%)

TOP SAVINGS OPPORTUNITIES
-------------------------
${roles
  .map(r => ({
    role: r.role,
    savings: (r.hourlyRate - r.chainIQBenchmark) * (r.fteCount || 1) * 2080
  }))
  .sort((a, b) => b.savings - a.savings)
  .slice(0, 5)
  .map((r, i) => `${i + 1}. ${r.role}: $${(r.savings / 1000).toFixed(0)}K`)
  .join('\n')}

---
Powered by ChainIQ Rate Benchmarking
  `.trim()
}
