import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { NegotiationAssistantService } from 'data-orchestration/services';

const negotiationService = new NegotiationAssistantService(prisma);

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const rateCardId = params.id;

    // Generate comprehensive negotiation brief
    const brief = await negotiationService.generateNegotiationBrief(rateCardId);

    // Generate HTML content for PDF
    const htmlContent = generateNegotiationBriefHTML(brief);

    // For now, return HTML that can be printed to PDF by the browser
    // In production, you might want to use a library like puppeteer or pdfkit
    return new NextResponse(htmlContent, {
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `inline; filename="negotiation-brief-${rateCardId}.html"`,
      },
    });
  } catch (error: any) {
    console.error('Error exporting negotiation brief:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to export negotiation brief',
      },
      { status: 500 }
    );
  }
}

function generateNegotiationBriefHTML(brief: any): string {
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Negotiation Brief - ${brief.currentSituation.supplierName}</title>
  <style>
    @media print {
      @page {
        margin: 1in;
        size: letter;
      }
      body {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
      .page-break {
        page-break-before: always;
      }
      .no-print {
        display: none;
      }
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 8.5in;
      margin: 0 auto;
      padding: 20px;
      background: white;
    }

    .header {
      border-bottom: 3px solid #2563eb;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }

    h1 {
      color: #1e40af;
      margin: 0 0 10px 0;
      font-size: 28px;
    }

    .subtitle {
      color: #64748b;
      font-size: 14px;
      margin: 5px 0;
    }

    h2 {
      color: #1e40af;
      font-size: 20px;
      margin-top: 30px;
      margin-bottom: 15px;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 8px;
    }

    h3 {
      color: #334155;
      font-size: 16px;
      margin-top: 20px;
      margin-bottom: 10px;
    }

    .info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
      margin: 20px 0;
    }

    .info-item {
      padding: 12px;
      background: #f8fafc;
      border-left: 3px solid #2563eb;
    }

    .info-label {
      font-size: 12px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }

    .info-value {
      font-size: 16px;
      font-weight: 600;
      color: #1e293b;
    }

    .highlight-box {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }

    .target-rate {
      background: white;
      border: 2px solid #e2e8f0;
      border-radius: 8px;
      padding: 15px;
      margin: 15px 0;
    }

    .target-rate.recommended {
      border-color: #2563eb;
      background: #eff6ff;
    }

    .target-rate-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }

    .target-rate-title {
      font-weight: 600;
      font-size: 16px;
    }

    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
    }

    .badge-primary {
      background: #2563eb;
      color: white;
    }

    .badge-success {
      background: #16a34a;
      color: white;
    }

    .badge-warning {
      background: #ea580c;
      color: white;
    }

    .badge-secondary {
      background: #64748b;
      color: white;
    }

    .rate-amount {
      font-size: 32px;
      font-weight: 700;
      color: #2563eb;
      margin: 10px 0;
    }

    .savings-text {
      color: #16a34a;
      font-size: 14px;
    }

    .talking-point {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 15px;
      margin: 15px 0;
    }

    .talking-point-header {
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 10px;
    }

    .talking-point-section {
      margin: 8px 0;
      font-size: 14px;
    }

    .talking-point-label {
      font-weight: 600;
      color: #64748b;
      font-size: 12px;
      text-transform: uppercase;
    }

    .alternative-supplier {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 15px;
      margin: 15px 0;
    }

    .alternative-header {
      display: flex;
      justify-content: space-between;
      align-items: start;
      margin-bottom: 15px;
    }

    .alternative-name {
      font-weight: 600;
      font-size: 18px;
      color: #1e293b;
    }

    .alternative-rate {
      font-size: 24px;
      font-weight: 700;
      color: #16a34a;
    }

    .pros-cons {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
      margin-top: 15px;
    }

    .pros-cons h4 {
      font-size: 14px;
      margin-bottom: 8px;
    }

    .pros-cons ul {
      margin: 0;
      padding-left: 20px;
      font-size: 14px;
    }

    .leverage-point {
      background: #f0fdf4;
      border-left: 4px solid #16a34a;
      padding: 12px;
      margin: 10px 0;
      font-size: 14px;
    }

    .risk-item {
      background: #fef2f2;
      border-left: 4px solid #dc2626;
      padding: 12px;
      margin: 10px 0;
    }

    .risk-header {
      font-weight: 600;
      color: #991b1b;
      margin-bottom: 8px;
    }

    .risk-mitigation {
      font-size: 14px;
      color: #64748b;
      margin-top: 8px;
    }

    .strategy-box {
      background: #fefce8;
      border: 2px solid #fde047;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
      font-size: 15px;
      line-height: 1.8;
    }

    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #e2e8f0;
      text-align: center;
      color: #64748b;
      font-size: 12px;
    }

    .print-button {
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 24px;
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .print-button:hover {
      background: #1d4ed8;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }

    th, td {
      padding: 10px;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
    }

    th {
      background: #f8fafc;
      font-weight: 600;
      color: #475569;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <button class="print-button no-print" onclick="window.print()">Print / Save as PDF</button>

  <div class="header">
    <h1>Negotiation Brief</h1>
    <div class="subtitle">Prepared: ${currentDate}</div>
    <div class="subtitle">Supplier: ${brief.currentSituation.supplierName}</div>
  </div>

  <!-- Current Situation -->
  <h2>Current Situation</h2>
  <div class="info-grid">
    <div class="info-item">
      <div class="info-label">Supplier</div>
      <div class="info-value">${brief.currentSituation.supplierName}</div>
    </div>
    <div class="info-item">
      <div class="info-label">Current Rate</div>
      <div class="info-value">$${brief.currentSituation.currentRate.toLocaleString()}/day</div>
    </div>
    <div class="info-item">
      <div class="info-label">Role</div>
      <div class="info-value">${brief.currentSituation.roleStandardized} (${brief.currentSituation.seniority})</div>
    </div>
    <div class="info-item">
      <div class="info-label">Location</div>
      <div class="info-value">${brief.currentSituation.country}</div>
    </div>
    ${
      brief.currentSituation.volumeCommitted
        ? `
    <div class="info-item">
      <div class="info-label">Volume Committed</div>
      <div class="info-value">${brief.currentSituation.volumeCommitted} days/year</div>
    </div>
    `
        : ''
    }
    ${
      brief.currentSituation.contractExpiry
        ? `
    <div class="info-item">
      <div class="info-label">Contract Expiry</div>
      <div class="info-value">${new Date(brief.currentSituation.contractExpiry).toLocaleDateString()}</div>
    </div>
    `
        : ''
    }
  </div>

  <!-- Market Position -->
  <h2>Market Position</h2>
  <div class="highlight-box">
    <h3>${brief.marketPosition.position}</h3>
    <p><strong>Percentile Rank:</strong> ${brief.marketPosition.percentileRank}th percentile</p>
    <p><strong>Cohort Size:</strong> ${brief.marketPosition.cohortSize} comparable rates</p>
    
    <table>
      <tr>
        <th>25th Percentile</th>
        <th>Median</th>
        <th>75th Percentile</th>
      </tr>
      <tr>
        <td>$${brief.marketPosition.marketP25.toLocaleString()}</td>
        <td>$${brief.marketPosition.marketMedian.toLocaleString()}</td>
        <td>$${brief.marketPosition.marketP75.toLocaleString()}</td>
      </tr>
    </table>
  </div>

  <!-- Target Rates -->
  <div class="page-break"></div>
  <h2>Recommended Target Rates</h2>
  
  <div class="target-rate">
    <div class="target-rate-header">
      <span class="target-rate-title">Aggressive Target</span>
      <span class="badge badge-warning">Stretch Goal</span>
    </div>
    <div class="rate-amount">$${brief.targetRates.aggressive.toLocaleString()}/day</div>
    <div class="savings-text">
      Savings: $${(brief.currentSituation.currentRate - brief.targetRates.aggressive).toLocaleString()}/day
      (${(((brief.currentSituation.currentRate - brief.targetRates.aggressive) / brief.currentSituation.currentRate) * 100).toFixed(1)}%)
    </div>
  </div>

  <div class="target-rate recommended">
    <div class="target-rate-header">
      <span class="target-rate-title">Realistic Target</span>
      <span class="badge badge-primary">Recommended</span>
    </div>
    <div class="rate-amount">$${brief.targetRates.realistic.toLocaleString()}/day</div>
    <div class="savings-text">
      Savings: $${(brief.currentSituation.currentRate - brief.targetRates.realistic).toLocaleString()}/day
      (${(((brief.currentSituation.currentRate - brief.targetRates.realistic) / brief.currentSituation.currentRate) * 100).toFixed(1)}%)
    </div>
  </div>

  <div class="target-rate">
    <div class="target-rate-header">
      <span class="target-rate-title">Fallback Target</span>
      <span class="badge badge-secondary">Minimum</span>
    </div>
    <div class="rate-amount">$${brief.targetRates.fallback.toLocaleString()}/day</div>
    <div class="savings-text">
      Savings: $${(brief.currentSituation.currentRate - brief.targetRates.fallback).toLocaleString()}/day
      (${(((brief.currentSituation.currentRate - brief.targetRates.fallback) / brief.currentSituation.currentRate) * 100).toFixed(1)}%)
    </div>
  </div>

  <div class="highlight-box">
    <h3>Justification</h3>
    <p>${brief.targetRates.justification}</p>
  </div>

  <!-- Leverage Points -->
  <h2>Leverage Points</h2>
  ${brief.leverage
    .map(
      (point: any) => `
    <div class="leverage-point">
      <strong>${point.point}</strong>
      <div style="margin-top: 5px; font-size: 12px; color: #64748b;">
        Category: ${point.category} | Strength: ${point.strength}
      </div>
    </div>
  `
    )
    .join('')}

  <!-- Talking Points -->
  <div class="page-break"></div>
  <h2>Negotiation Talking Points</h2>
  ${brief.talkingPoints
    .sort((a: any, b: any) => a.priority - b.priority)
    .map(
      (point: any) => `
    <div class="talking-point">
      <div class="talking-point-header">
        ${point.point}
        <span class="badge badge-secondary">Priority ${point.priority}</span>
      </div>
      <div class="talking-point-section">
        <div class="talking-point-label">Supporting Data:</div>
        <div>${point.supportingData}</div>
      </div>
      <div class="talking-point-section">
        <div class="talking-point-label">Impact:</div>
        <div style="color: #16a34a;">${point.impact}</div>
      </div>
    </div>
  `
    )
    .join('')}

  <!-- Alternative Suppliers -->
  ${
    brief.alternatives.length > 0
      ? `
  <div class="page-break"></div>
  <h2>Alternative Suppliers</h2>
  ${brief.alternatives
    .map(
      (alt: any) => `
    <div class="alternative-supplier">
      <div class="alternative-header">
        <div>
          <div class="alternative-name">${alt.supplierName}</div>
          <div style="color: #64748b; font-size: 14px;">${alt.country}</div>
        </div>
        <div style="text-align: right;">
          <div class="alternative-rate">$${alt.dailyRate.toLocaleString()}/day</div>
          <div class="badge badge-success">Save ${alt.savingsPercent.toFixed(1)}%</div>
        </div>
      </div>
      <div class="pros-cons">
        <div>
          <h4 style="color: #16a34a;">Pros</h4>
          <ul>
            ${alt.pros.map((pro: string) => `<li>${pro}</li>`).join('')}
          </ul>
        </div>
        <div>
          <h4 style="color: #ea580c;">Cons</h4>
          <ul>
            ${alt.cons.map((con: string) => `<li>${con}</li>`).join('')}
          </ul>
        </div>
      </div>
      <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e2e8f0; font-size: 14px; color: #64748b;">
        Potential annual savings: $${(alt.savingsAmount * (brief.currentSituation.volumeCommitted || 200)).toLocaleString()}
      </div>
    </div>
  `
    )
    .join('')}
  `
      : ''
  }

  <!-- Recommended Strategy -->
  <div class="page-break"></div>
  <h2>Recommended Negotiation Strategy</h2>
  <div class="strategy-box">
    ${brief.recommendedStrategy}
  </div>

  <!-- Risk Assessment -->
  <h2>Risk Assessment</h2>
  ${brief.risks
    .map(
      (risk: any) => `
    <div class="risk-item">
      <div class="risk-header">
        ${risk.risk}
        <span class="badge badge-${risk.severity === 'high' ? 'warning' : risk.severity === 'medium' ? 'secondary' : 'success'}">
          ${risk.severity} severity
        </span>
      </div>
      <div class="risk-mitigation">
        <strong>Mitigation:</strong> ${risk.mitigation}
      </div>
    </div>
  `
    )
    .join('')}

  <div class="footer">
    <p>This negotiation brief was generated by the Rate Card Benchmarking Module</p>
    <p>Confidential - For Internal Use Only</p>
  </div>
</body>
</html>
  `.trim();
}
