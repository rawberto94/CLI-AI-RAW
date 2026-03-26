import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { contractService } from 'data-orchestration/services'
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';
import { generateContractReportPDF } from '@/lib/reports/contract-report-pdf';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, HeadingLevel, BorderStyle, AlignmentType } from 'docx';

/**
 * Export data types
 */
interface ExportArtifact {
  id: string;
  type: string;
   
  data: any; // Json from Prisma can be any
  contractId: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ExportClause {
  id: string;
  content?: string; // Made optional - will use 'text' field from Prisma
  text?: string;
  type?: string | null;
  category?: string | null;
  contractId: string;
}

interface ContractExportData {
  id: string;
  contractTitle?: string | null;
  fileName: string | null;
  status: string;
  contractType?: string | null;
  clientName?: string | null;
  supplierName?: string | null;
   
  totalValue?: any; // Support both number and Prisma Decimal
  currency?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  expirationDate?: Date | null;
  uploadedAt: Date;
  jurisdiction?: string | null;
  category?: string | null;
  description?: string | null;
  artifacts?: ExportArtifact[];
  clauses?: ExportClause[];
  tenantId: string;
}

interface RiskItem {
  level?: string;
  severity?: string;
  description?: string;
  text?: string;
}

// Tenant isolation helper
function getTenantId(request: NextRequest): string | null {
  return request.headers.get('x-tenant-id');
}

function safeJsonParse(data: string | Record<string, any>): Record<string, any> {
  if (typeof data !== 'string') return data || {};
  try { return JSON.parse(data); } catch { return {}; }
}

// Simple XLSX generator (no external dependencies)
function generateXLSX(contract: ContractExportData): Buffer {
  // Create XML-based XLSX (Office Open XML format)
  const _escapeXml = (str: string) => 
    String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const rows = [
    ['Contract Export Report'],
    ['Generated:', new Date().toISOString()],
    [''],
    ['Basic Information'],
    ['Field', 'Value'],
    ['Contract ID', contract.id],
    ['Title', contract.contractTitle || 'N/A'],
    ['File Name', contract.fileName || 'N/A'],
    ['Status', contract.status],
    ['Contract Type', contract.contractType || 'N/A'],
    [''],
    ['Parties'],
    ['Client', contract.clientName || 'N/A'],
    ['Supplier', contract.supplierName || 'N/A'],
    [''],
    ['Financial'],
    ['Total Value', contract.totalValue ? `${contract.currency || 'USD'} ${Number(contract.totalValue).toLocaleString()}` : 'N/A'],
    ['Currency', contract.currency || 'N/A'],
    [''],
    ['Dates'],
    ['Start Date', contract.startDate ? new Date(contract.startDate).toLocaleDateString() : 'N/A'],
    ['End Date', contract.endDate ? new Date(contract.endDate).toLocaleDateString() : 'N/A'],
    ['Expiration', contract.expirationDate ? new Date(contract.expirationDate).toLocaleDateString() : 'N/A'],
    ['Uploaded At', new Date(contract.uploadedAt).toLocaleDateString()],
    [''],
    ['Other Details'],
    ['Jurisdiction', contract.jurisdiction || 'N/A'],
    ['Category', contract.category || 'N/A'],
    ['Description', contract.description || 'N/A'],
  ];

  // Add artifacts section
  if (contract.artifacts && contract.artifacts.length > 0) {
    rows.push(['']);
    rows.push(['Artifacts']);
    rows.push(['Type', 'Content Preview']);
    contract.artifacts.forEach((artifact: ExportArtifact) => {
      const preview = typeof artifact.data === 'string' 
        ? artifact.data.substring(0, 200) + (artifact.data.length > 200 ? '...' : '')
        : JSON.stringify(artifact.data).substring(0, 200);
      rows.push([artifact.type, preview]);
    });
  }

  // Generate CSV (Excel-compatible with UTF-8 BOM)
  const csvContent = rows.map(row => 
    row.map(cell => {
      const cellStr = String(cell || '');
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
        return `"${cellStr.replace(/"/g, '""')}"`;
      }
      return cellStr;
    }).join(',')
  ).join('\r\n');

  // Add UTF-8 BOM for Excel compatibility
  const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
  const content = Buffer.from(csvContent, 'utf-8');
  return Buffer.concat([bom, content]);
}

// DOCX generation using docx library
async function generateDOCX(contract: ContractExportData): Promise<Buffer> {
  const fmtDate = (d: Date | null | undefined) => d ? new Date(d).toLocaleDateString() : 'N/A';
  const fmtVal = (v: number | null | undefined, c?: string | null) =>
    v ? `${c || 'USD'} ${Number(v).toLocaleString()}` : 'N/A';

  const mkRow = (label: string, value: string) =>
    new TableRow({
      children: [
        new TableCell({
          width: { size: 3000, type: WidthType.DXA },
          children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 20 })] })],
        }),
        new TableCell({
          width: { size: 7000, type: WidthType.DXA },
          children: [new Paragraph({ children: [new TextRun({ text: value, size: 20 })] })],
        }),
      ],
    });

  const sections: Paragraph[] = [];
  const artifacts = contract.artifacts || [];
  for (const artifact of artifacts) {
    const data = typeof artifact.data === 'string' ? safeJsonParse(artifact.data) : (artifact.data || {});
    const preview = JSON.stringify(data, null, 2).slice(0, 500);
    sections.push(
      new Paragraph({ text: artifact.type.replace(/_/g, ' '), heading: HeadingLevel.HEADING_2, spacing: { before: 300 } }),
      new Paragraph({ children: [new TextRun({ text: preview, size: 18, font: 'Courier New' })] }),
    );
  }

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({
          text: contract.contractTitle || contract.fileName || 'Contract Report',
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({ text: `Generated: ${new Date().toLocaleDateString()}`, alignment: AlignmentType.CENTER, spacing: { after: 400 } }),
        new Paragraph({ text: 'Contract Details', heading: HeadingLevel.HEADING_1 }),
        new Table({
          rows: [
            mkRow('Title', contract.contractTitle || 'N/A'),
            mkRow('Status', contract.status),
            mkRow('Type', contract.contractType || 'N/A'),
            mkRow('Client', contract.clientName || 'N/A'),
            mkRow('Supplier', contract.supplierName || 'N/A'),
            mkRow('Total Value', fmtVal(contract.totalValue ? Number(contract.totalValue) : null, contract.currency)),
            mkRow('Start Date', fmtDate(contract.startDate)),
            mkRow('End Date', fmtDate(contract.endDate)),
            mkRow('Expiration', fmtDate(contract.expirationDate)),
            mkRow('Jurisdiction', contract.jurisdiction || 'N/A'),
            mkRow('Uploaded', fmtDate(contract.uploadedAt)),
          ],
          width: { size: 10000, type: WidthType.DXA },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1 },
            bottom: { style: BorderStyle.SINGLE, size: 1 },
            left: { style: BorderStyle.SINGLE, size: 1 },
            right: { style: BorderStyle.SINGLE, size: 1 },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
            insideVertical: { style: BorderStyle.SINGLE, size: 1 },
          },
        }),
        ...(contract.description ? [
          new Paragraph({ text: 'Description', heading: HeadingLevel.HEADING_1, spacing: { before: 400 } }),
          new Paragraph({ children: [new TextRun({ text: contract.description, size: 22 })] }),
        ] : []),
        ...(sections.length > 0 ? [
          new Paragraph({ text: 'Artifacts', heading: HeadingLevel.HEADING_1, spacing: { before: 400 } }),
          ...sections,
        ] : []),
      ],
    }],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

// PDF generation using text-based format (HTML that can be printed as PDF)
function generatePDFContent(contract: ContractExportData): string {
  const formatDate = (date: Date | null | undefined) => date ? new Date(date).toLocaleDateString() : 'N/A';
  const formatValue = (val: number | null | undefined, currency?: string | null) => 
    val ? `${currency || 'USD'} ${Number(val).toLocaleString()}` : 'N/A';

  const artifacts = contract.artifacts || [];
  const summary = artifacts.find((a: ExportArtifact) => a.type === 'summary');
  const keyTerms = artifacts.find((a: ExportArtifact) => a.type === 'key_terms');
  const obligations = artifacts.find((a: ExportArtifact) => a.type === 'obligations');
  const risks = artifacts.find((a: ExportArtifact) => a.type === 'risks');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Contract Export - ${contract.contractTitle || contract.fileName}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
    h1 { color: #1a365d; border-bottom: 2px solid #3182ce; padding-bottom: 10px; }
    h2 { color: #2c5282; margin-top: 30px; }
    h3 { color: #4a5568; }
    .header { background: #f7fafc; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
    .section { margin-bottom: 25px; }
    .grid { display: grid; grid-template-columns: 200px 1fr; gap: 10px; }
    .label { font-weight: bold; color: #4a5568; }
    .value { color: #1a202c; }
    .status { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: bold; }
    .status-ACTIVE, .status-COMPLETED { background: #c6f6d5; color: #22543d; }
    .status-PENDING, .status-PROCESSING { background: #fefcbf; color: #744210; }
    .status-EXPIRED, .status-FAILED { background: #fed7d7; color: #742a2a; }
    .artifact { background: #f7fafc; padding: 15px; border-radius: 8px; margin: 10px 0; border-left: 4px solid #3182ce; }
    .artifact-title { font-weight: bold; color: #2c5282; margin-bottom: 10px; }
    .risk-high { color: #c53030; }
    .risk-medium { color: #dd6b20; }
    .risk-low { color: #38a169; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e2e8f0; }
    th { background: #edf2f7; font-weight: bold; }
    .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #718096; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>📄 ${contract.contractTitle || contract.fileName || 'Contract Document'}</h1>
    <p>Contract ID: ${contract.id}</p>
    <p>Generated: ${new Date().toLocaleString()}</p>
  </div>

  <div class="section">
    <h2>📋 Basic Information</h2>
    <div class="grid">
      <span class="label">Status:</span>
      <span class="value"><span class="status status-${contract.status}">${contract.status}</span></span>
      
      <span class="label">Contract Type:</span>
      <span class="value">${contract.contractType || 'N/A'}</span>
      
      <span class="label">File Name:</span>
      <span class="value">${contract.fileName || 'N/A'}</span>
      
      <span class="label">Category:</span>
      <span class="value">${contract.category || 'N/A'}</span>
    </div>
  </div>

  <div class="section">
    <h2>🏢 Parties</h2>
    <div class="grid">
      <span class="label">Client:</span>
      <span class="value">${contract.clientName || 'N/A'}</span>
      
      <span class="label">Supplier:</span>
      <span class="value">${contract.supplierName || 'N/A'}</span>
    </div>
  </div>

  <div class="section">
    <h2>💰 Financial Information</h2>
    <div class="grid">
      <span class="label">Total Value:</span>
      <span class="value">${formatValue(contract.totalValue, contract.currency)}</span>
      
      <span class="label">Currency:</span>
      <span class="value">${contract.currency || 'USD'}</span>
    </div>
  </div>

  <div class="section">
    <h2>📅 Key Dates</h2>
    <div class="grid">
      <span class="label">Start Date:</span>
      <span class="value">${formatDate(contract.startDate)}</span>
      
      <span class="label">End Date:</span>
      <span class="value">${formatDate(contract.endDate)}</span>
      
      <span class="label">Expiration Date:</span>
      <span class="value">${formatDate(contract.expirationDate)}</span>
      
      <span class="label">Uploaded:</span>
      <span class="value">${formatDate(contract.uploadedAt)}</span>
    </div>
  </div>

  ${contract.jurisdiction ? `
  <div class="section">
    <h2>⚖️ Jurisdiction</h2>
    <p>${contract.jurisdiction}</p>
  </div>
  ` : ''}

  ${contract.description ? `
  <div class="section">
    <h2>📝 Description</h2>
    <p>${contract.description}</p>
  </div>
  ` : ''}

  ${summary ? `
  <div class="section">
    <h2>📊 Summary</h2>
    <div class="artifact">
      <p>${typeof summary.data === 'string' ? summary.data : JSON.stringify(summary.data, null, 2)}</p>
    </div>
  </div>
  ` : ''}

  ${keyTerms ? `
  <div class="section">
    <h2>🔑 Key Terms</h2>
    <div class="artifact">
      ${formatArtifactData(keyTerms.data)}
    </div>
  </div>
  ` : ''}

  ${obligations ? `
  <div class="section">
    <h2>✅ Obligations</h2>
    <div class="artifact">
      ${formatArtifactData(obligations.data)}
    </div>
  </div>
  ` : ''}

  ${risks ? `
  <div class="section">
    <h2>⚠️ Risks</h2>
    <div class="artifact">
      ${formatRisks(risks.data)}
    </div>
  </div>
  ` : ''}

  <div class="footer">
    <p>This document was automatically generated by Contract Intelligence Platform.</p>
    <p>Document ID: ${contract.id} | Export Date: ${new Date().toISOString()}</p>
  </div>
</body>
</html>`;
}

function formatArtifactData(data: string | Record<string, unknown> | unknown[]): string {
  if (typeof data === 'string') return `<p>${data}</p>`;
  if (Array.isArray(data)) {
    return `<ul>${data.map(item => `<li>${typeof item === 'object' ? JSON.stringify(item) : item}</li>`).join('')}</ul>`;
  }
  if (typeof data === 'object' && data !== null) {
    return `<table>
      ${Object.entries(data).map(([key, value]) => 
        `<tr><td class="label">${key}</td><td>${typeof value === 'object' ? JSON.stringify(value) : value}</td></tr>`
      ).join('')}
    </table>`;
  }
  return String(data);
}

function formatRisks(data: string | RiskItem[] | Record<string, unknown> | unknown[]): string {
  if (Array.isArray(data)) {
    return `<ul>${data.map((risk: RiskItem | string) => {
      const level = typeof risk === 'object' ? (risk.level || risk.severity || 'medium') : 'medium';
      const text = typeof risk === 'object' ? (risk.description || risk.text || JSON.stringify(risk)) : risk;
      return `<li class="risk-${level.toLowerCase()}">${text}</li>`;
    }).join('')}</ul>`;
  }
  return formatArtifactData(data);
}

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const format = request.nextUrl.searchParams.get('format') || 'json'
    const includeArtifacts = request.nextUrl.searchParams.get('includeArtifacts') !== 'false'
    const tenantId = getTenantId(request);

    // Require tenant ID for security
    if (!tenantId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant ID is required', 400);
    }

    // Fetch contract with artifacts - scoped to tenant
    const contract = await prisma.contract.findFirst({
      where: { id: params.id, tenantId },
      include: {
        artifacts: includeArtifacts,
        clauses: true,
      }
    })

    if (!contract) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
    }

    switch (format) {
      case 'json':
        return new NextResponse(JSON.stringify(contract, null, 2), {
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="contract-${params.id}.json"`
          }
        })

      case 'pdf': {
        // Generate a real binary PDF report using jsPDF
        const pdfBytes = generateContractReportPDF({
          contract: {
            id: contract.id,
            contractTitle: contract.contractTitle,
            fileName: contract.fileName,
            status: contract.status,
            contractType: contract.contractType,
            clientName: contract.clientName,
            supplierName: contract.supplierName,
            description: contract.description,
            totalValue: contract.totalValue ? Number(contract.totalValue) : null,
            currency: contract.currency,
            startDate: contract.startDate,
            endDate: contract.endDate,
            effectiveDate: contract.effectiveDate,
            expirationDate: contract.expirationDate,
            uploadedAt: contract.uploadedAt,
            jurisdiction: contract.jurisdiction,
            signatureStatus: contract.signatureStatus,
            tenantId: contract.tenantId,
          },
          artifacts: (contract.artifacts || []).map((a: ExportArtifact) => ({
            type: a.type,
            data: typeof a.data === 'string' ? safeJsonParse(a.data) : (a.data as Record<string, any>) || {},
            confidence: null,
          })),
          tenantName: tenantId || undefined,
        });
        const safeName = (contract.contractTitle || contract.fileName || 'contract')
          .replace(/[^a-zA-Z0-9_-]/g, '_')
          .slice(0, 60);
        return new NextResponse(pdfBytes, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${safeName}-report.pdf"`,
          },
        });
      }

      case 'html': {
        // HTML preview (legacy format)
        const htmlContent = generatePDFContent(contract);
        return new NextResponse(htmlContent, {
          headers: {
            'Content-Type': 'text/html',
            'Content-Disposition': `attachment; filename="contract-${params.id}.html"`,
          },
        });
      }

      case 'docx':
      case 'word': {
        const docxBuffer = await generateDOCX(contract);
        const docxName = (contract.contractTitle || contract.fileName || 'contract')
          .replace(/[^a-zA-Z0-9_-]/g, '_')
          .slice(0, 60);
        return new NextResponse(new Uint8Array(docxBuffer), {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'Content-Disposition': `attachment; filename="${docxName}-report.docx"`,
          },
        });
      }

      case 'excel':
      case 'xlsx':
      case 'csv': {
        const xlsxBuffer = generateXLSX(contract);
        const isCsv = format === 'csv';
        return new NextResponse(new Uint8Array(xlsxBuffer), {
          headers: {
            'Content-Type': isCsv ? 'text/csv; charset=utf-8' : 'application/vnd.ms-excel',
            'Content-Disposition': `attachment; filename="contract-${params.id}.${isCsv ? 'csv' : 'xls'}"`,
          },
        });
      }

      default:
        return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid format. Supported formats: json, pdf, docx, html, excel, csv', 400);
    }
  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
}
