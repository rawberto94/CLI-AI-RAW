/**
 * Contract Report PDF Generator
 *
 * Generates a comprehensive multi-page PDF report from contract data + all artifacts.
 * Uses jsPDF with autoTable for professional table rendering.
 *
 * Sections: Cover, Executive Summary, Parties & Contacts, Financial,
 *           Risk Assessment, Compliance, Key Clauses, Obligations,
 *           Renewal & Termination, Timeline, Negotiation Points, Amendments
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Helper: call autoTable as a standalone function (works in Node/server context)
function addAutoTable(doc: jsPDF, options: AutoTableOptions): void {
  autoTable(doc as Parameters<typeof autoTable>[0], options as Parameters<typeof autoTable>[1]);
}

// Get finalY after last autoTable call
function getLastTableY(doc: jsPDF): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (doc as any).lastAutoTable?.finalY ?? doc.internal.pageSize.getHeight() - 40;
}

// =============================================================================
// TYPES
// =============================================================================

interface AutoTableOptions {
  head?: string[][];
  body?: (string | number)[][];
  startY?: number;
  theme?: string;
  headStyles?: Record<string, unknown>;
  bodyStyles?: Record<string, unknown>;
  alternateRowStyles?: Record<string, unknown>;
  styles?: Record<string, unknown>;
  columnStyles?: Record<string, unknown>;
  margin?: { top?: number; right?: number; bottom?: number; left?: number };
  tableWidth?: number | 'auto' | 'wrap';
  didParseCell?: (hookData: {
    column: { index: number };
    section: string;
    cell: { raw: unknown; styles: Record<string, unknown> };
  }) => void;
}

export interface ContractReportData {
  contract: {
    id: string;
    contractTitle?: string | null;
    fileName?: string | null;
    status: string;
    contractType?: string | null;
    clientName?: string | null;
    supplierName?: string | null;
    description?: string | null;
    totalValue?: number | bigint | null;
    currency?: string | null;
    startDate?: Date | string | null;
    endDate?: Date | string | null;
    effectiveDate?: Date | string | null;
    expirationDate?: Date | string | null;
    uploadedAt?: Date | string;
    jurisdiction?: string | null;
    signatureStatus?: string | null;
    tenantId: string;
  };
  artifacts: Array<{
    type: string;
    data: Record<string, any>;
    confidence?: number | null;
  }>;
  tenantName?: string;
}

// =============================================================================
// COLORS & CONSTANTS
// =============================================================================

const C = {
  primary:    [37, 99, 235]   as const, // blue-600
  primaryDk:  [29, 78, 216]   as const, // blue-700
  dark:       [15, 23, 42]    as const, // slate-900
  text:       [30, 41, 59]    as const, // slate-800
  muted:      [100, 116, 139] as const, // slate-500
  light:      [148, 163, 184] as const, // slate-400
  bg:         [248, 250, 252] as const, // slate-50
  bgAlt:      [241, 245, 249] as const, // slate-100
  white:      [255, 255, 255] as const,
  green:      [22, 163, 74]   as const, // green-600
  amber:      [217, 119, 6]   as const, // amber-600
  red:        [220, 38, 38]   as const, // red-600
  border:     [226, 232, 240] as const, // slate-200
};

const MARGIN = 20;
const PAGE_WIDTH = 210; // A4 mm
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

// =============================================================================
// MAIN EXPORT
// =============================================================================

export function generateContractReportPDF(input: ContractReportData): Uint8Array {
  const { contract, artifacts, tenantName } = input;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageHeight = doc.internal.pageSize.getHeight();

  // Helper: get artifact data by type
  const getArtifact = (type: string) => artifacts.find(a => a.type === type)?.data;

  // ─── COVER PAGE ──────────────────────────────────────────────────────────
  renderCoverPage(doc, contract, tenantName);

  // ─── CONTENT PAGES ───────────────────────────────────────────────────────
  doc.addPage();
  let y = MARGIN;

  // Table of Contents
  y = renderTableOfContents(doc, y, artifacts);

  // Executive Summary
  const execSummary = getArtifact('EXECUTIVE_SUMMARY');
  const overview = getArtifact('OVERVIEW');
  doc.addPage();
  y = MARGIN;
  y = renderExecutiveSummary(doc, y, contract, overview, execSummary);

  // Parties & Contacts
  const parties = getArtifact('PARTIES');
  const contacts = getArtifact('CONTACTS');
  if (parties || contacts || contract.clientName || contract.supplierName) {
    y = checkPage(doc, y, 60);
    y = renderPartiesAndContacts(doc, y, contract, parties, contacts);
  }

  // Financial
  const financial = getArtifact('FINANCIAL');
  if (financial || contract.totalValue) {
    y = checkPage(doc, y, 60);
    y = renderFinancialSection(doc, y, contract, financial);
  }

  // Risk Assessment
  const risk = getArtifact('RISK');
  if (risk) {
    y = checkPage(doc, y, 60);
    y = renderRiskSection(doc, y, risk);
  }

  // Compliance
  const compliance = getArtifact('COMPLIANCE');
  if (compliance) {
    y = checkPage(doc, y, 60);
    y = renderComplianceSection(doc, y, compliance);
  }

  // Key Clauses
  const clauses = getArtifact('CLAUSES');
  if (clauses) {
    y = checkPage(doc, y, 60);
    y = renderClausesSection(doc, y, clauses);
  }

  // Obligations
  const obligations = getArtifact('OBLIGATIONS');
  if (obligations) {
    y = checkPage(doc, y, 60);
    y = renderObligationsSection(doc, y, obligations);
  }

  // Renewal & Termination
  const renewal = getArtifact('RENEWAL');
  if (renewal) {
    y = checkPage(doc, y, 60);
    y = renderRenewalSection(doc, y, renewal);
  }

  // Timeline & Deliverables
  const timeline = getArtifact('TIMELINE');
  const deliverables = getArtifact('DELIVERABLES');
  if (timeline || deliverables) {
    y = checkPage(doc, y, 60);
    y = renderTimelineSection(doc, y, timeline, deliverables);
  }

  // Negotiation Points
  const negotiation = getArtifact('NEGOTIATION_POINTS');
  if (negotiation) {
    y = checkPage(doc, y, 60);
    y = renderNegotiationSection(doc, y, negotiation);
  }

  // Amendments
  const amendments = getArtifact('AMENDMENTS');
  if (amendments) {
    y = checkPage(doc, y, 60);
    y = renderAmendmentsSection(doc, y, amendments);
  }

  // ─── PAGE NUMBERS (footer on every page except cover) ────────────────────
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 2; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...C.light);
    doc.text(
      `${contract.contractTitle || contract.fileName || 'Contract Report'}  •  Page ${i - 1} of ${totalPages - 1}`,
      PAGE_WIDTH / 2, pageHeight - 8, { align: 'center' },
    );
    // Thin line above footer
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, pageHeight - 14, PAGE_WIDTH - MARGIN, pageHeight - 14);
  }

  return doc.output('arraybuffer') as unknown as Uint8Array;
}

// =============================================================================
// HELPERS
// =============================================================================

function checkPage(doc: jsPDF, y: number, needed: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed > pageHeight - 20) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function fmtMoney(val: number | bigint | null | undefined, currency?: string | null): string {
  if (val == null) return '—';
  const num = typeof val === 'bigint' ? Number(val) : val;
  return `${currency || 'USD'} ${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function severityColor(severity: string): readonly [number, number, number] {
  const s = (severity || '').toLowerCase();
  if (s === 'high' || s === 'critical') return C.red;
  if (s === 'medium' || s === 'moderate') return C.amber;
  return C.green;
}

function truncate(text: string, max: number): string {
  if (!text) return '';
  return text.length > max ? text.slice(0, max - 3) + '...' : text;
}

// Safely extract a value from artifact data (handles {value: x} shape)
function val(data: Record<string, any>, key: string): any {
  const v = data[key];
  if (v && typeof v === 'object' && 'value' in v) return v.value;
  return v;
}

// =============================================================================
// SECTION HEADING
// =============================================================================

function sectionHeading(doc: jsPDF, y: number, title: string, icon?: string): number {
  y = checkPage(doc, y, 30);
  doc.setFillColor(...C.primary);
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 10, 1.5, 1.5, 'F');
  doc.setTextColor(...C.white);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`${icon ? icon + '  ' : ''}${title}`, MARGIN + 5, y + 7);
  return y + 16;
}

function subHeading(doc: jsPDF, y: number, title: string): number {
  y = checkPage(doc, y, 15);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.text);
  doc.text(title, MARGIN, y);
  doc.setDrawColor(...C.primary);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y + 2, MARGIN + doc.getTextWidth(title), y + 2);
  return y + 8;
}

function bodyText(doc: jsPDF, y: number, text: string): number {
  y = checkPage(doc, y, 10);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...C.text);
  const lines = doc.splitTextToSize(String(text || ''), CONTENT_WIDTH);
  doc.text(lines, MARGIN, y);
  return y + lines.length * 4.5 + 3;
}

function kvRow(doc: jsPDF, y: number, key: string, value: any, width = 45): number {
  if (value == null || value === '' || value === '—') return y;
  y = checkPage(doc, y, 8);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.muted);
  doc.text(`${key}:`, MARGIN, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...C.text);
  const valStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
  const lines = doc.splitTextToSize(valStr, CONTENT_WIDTH - width);
  doc.text(lines, MARGIN + width, y);
  return y + Math.max(lines.length * 4.5, 5) + 1;
}

// =============================================================================
// COVER PAGE
// =============================================================================

function renderCoverPage(
  doc: jsPDF,
  contract: ContractReportData['contract'],
  tenantName?: string,
) {
  const pageHeight = doc.internal.pageSize.getHeight();

  // Full-page background gradient effect
  doc.setFillColor(...C.dark);
  doc.rect(0, 0, PAGE_WIDTH, pageHeight, 'F');

  // Accent bar
  doc.setFillColor(...C.primary);
  doc.rect(0, 0, PAGE_WIDTH, 6, 'F');

  // Title area
  doc.setTextColor(...C.white);
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  const title = contract.contractTitle || contract.fileName || 'Contract Report';
  const titleLines = doc.splitTextToSize(title, CONTENT_WIDTH);
  doc.text(titleLines, MARGIN, 80);

  let ty = 80 + titleLines.length * 14 + 10;

  // Subtitle line
  doc.setDrawColor(...C.primary);
  doc.setLineWidth(1);
  doc.line(MARGIN, ty, MARGIN + 50, ty);
  ty += 12;

  // Contract type badge
  if (contract.contractType) {
    doc.setFillColor(...C.primary);
    const badgeText = contract.contractType.toUpperCase();
    const badgeWidth = doc.getTextWidth(badgeText) * 0.75 + 12;
    doc.roundedRect(MARGIN, ty - 5, badgeWidth, 9, 2, 2, 'F');
    doc.setTextColor(...C.white);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(badgeText, MARGIN + 6, ty + 1.5);
    ty += 16;
  }

  // Key metadata
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 190, 210);

  const metaItems = [
    contract.clientName && contract.supplierName
      ? `${contract.clientName}  /  ${contract.supplierName}`
      : contract.clientName || contract.supplierName || null,
    contract.totalValue
      ? `Value: ${fmtMoney(contract.totalValue, contract.currency)}`
      : null,
    contract.startDate || contract.endDate
      ? `Period: ${fmtDate(contract.startDate)} — ${fmtDate(contract.endDate)}`
      : null,
    contract.status
      ? `Status: ${contract.status.charAt(0).toUpperCase() + contract.status.slice(1)}`
      : null,
  ].filter(Boolean);

  for (const item of metaItems) {
    doc.text(item!, MARGIN, ty);
    ty += 7;
  }

  // Footer on cover
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('Contract Intelligence Report', MARGIN, pageHeight - 30);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })}`, MARGIN, pageHeight - 24);
  if (tenantName) {
    doc.text(`Organization: ${tenantName}`, MARGIN, pageHeight - 18);
  }

  // ConTigo branding
  doc.setTextColor(...C.primary);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('ConTigo', PAGE_WIDTH - MARGIN, pageHeight - 24, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Contract Intelligence Platform', PAGE_WIDTH - MARGIN, pageHeight - 18, { align: 'right' });
}

// =============================================================================
// TABLE OF CONTENTS
// =============================================================================

function renderTableOfContents(doc: jsPDF, y: number, artifacts: ContractReportData['artifacts']): number {
  y = sectionHeading(doc, y, 'Table of Contents');

  const sections = [
    { name: 'Executive Summary', always: true },
    { name: 'Parties & Contacts', type: ['PARTIES', 'CONTACTS'] },
    { name: 'Financial Overview', type: ['FINANCIAL'] },
    { name: 'Risk Assessment', type: ['RISK'] },
    { name: 'Compliance', type: ['COMPLIANCE'] },
    { name: 'Key Clauses', type: ['CLAUSES'] },
    { name: 'Obligations', type: ['OBLIGATIONS'] },
    { name: 'Renewal & Termination', type: ['RENEWAL'] },
    { name: 'Timeline & Deliverables', type: ['TIMELINE', 'DELIVERABLES'] },
    { name: 'Negotiation Points', type: ['NEGOTIATION_POINTS'] },
    { name: 'Amendments', type: ['AMENDMENTS'] },
  ];

  let idx = 1;
  for (const section of sections) {
    const hasData = section.always || section.type?.some(t => artifacts.some(a => a.type === t));
    if (!hasData) continue;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.text);
    doc.text(`${idx}.  ${section.name}`, MARGIN + 5, y);

    // Dotted leader
    const nameWidth = doc.getTextWidth(`${idx}.  ${section.name}`);
    doc.setTextColor(...C.light);
    doc.setFontSize(8);
    const dots = '.'.repeat(80);
    const dotsWidth = CONTENT_WIDTH - nameWidth - 10;
    if (dotsWidth > 0) {
      doc.text(dots, MARGIN + 5 + nameWidth + 3, y, { maxWidth: dotsWidth });
    }

    y += 7;
    idx++;
  }

  return y + 5;
}

// =============================================================================
// EXECUTIVE SUMMARY
// =============================================================================

function renderExecutiveSummary(
  doc: jsPDF, y: number,
  contract: ContractReportData['contract'],
  overview: Record<string, any> | undefined,
  execSummary: Record<string, any> | undefined,
): number {
  y = sectionHeading(doc, y, 'Executive Summary');

  // Quick stats bar
  doc.setFillColor(...C.bg);
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 18, 2, 2, 'F');

  const stats = [
    { label: 'Type', value: contract.contractType || '—' },
    { label: 'Value', value: contract.totalValue ? fmtMoney(contract.totalValue, contract.currency) : '—' },
    { label: 'Status', value: contract.status },
    { label: 'Signature', value: contract.signatureStatus || '—' },
  ];

  const cellWidth = CONTENT_WIDTH / stats.length;
  for (let i = 0; i < stats.length; i++) {
    const x = MARGIN + i * cellWidth;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.muted);
    doc.text(stats[i].label.toUpperCase(), x + 5, y + 6);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.text);
    doc.text(truncate(String(stats[i].value), 20), x + 5, y + 13);
  }
  y += 24;

  // Summary text
  const summaryText = execSummary?.summary || execSummary?.executiveSummary
    || val(overview || {}, 'executiveSummary') || val(overview || {}, 'summary')
    || contract.description;
  if (summaryText) {
    y = bodyText(doc, y, summaryText);
  }

  // Key dates table
  y = subHeading(doc, y + 2, 'Key Dates');
  addAutoTable(doc, {
    startY: y,
    head: [['Date', 'Value']],
    body: [
      ['Start Date', fmtDate(contract.startDate)],
      ['End Date', fmtDate(contract.endDate)],
      ['Effective Date', fmtDate(contract.effectiveDate)],
      ['Expiration Date', fmtDate(contract.expirationDate)],
    ].filter(r => r[1] !== '—'),
    theme: 'striped',
    headStyles: { fillColor: C.primary as unknown as number[], textColor: [255, 255, 255], fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: C.text as unknown as number[] },
    alternateRowStyles: { fillColor: C.bg as unknown as number[] },
    margin: { left: MARGIN, right: MARGIN },
    tableWidth: CONTENT_WIDTH,
  });
  y = getLastTableY(doc) + 8;

  return y;
}

// =============================================================================
// PARTIES & CONTACTS
// =============================================================================

function renderPartiesAndContacts(
  doc: jsPDF, y: number,
  contract: ContractReportData['contract'],
  parties: Record<string, any> | undefined,
  contacts: Record<string, any> | undefined,
): number {
  y = sectionHeading(doc, y, 'Parties & Contacts');

  // Parties
  const partyList = parties?.parties || parties?.identifiedParties || [];
  if (partyList.length > 0) {
    addAutoTable(doc, {
      startY: y,
      head: [['Party Name', 'Role', 'Type']],
      body: partyList.map((p: any) => [
        p.name || p.legalName || '—',
        p.role || '—',
        p.type || p.entityType || '—',
      ]),
      theme: 'striped',
      headStyles: { fillColor: C.primary as unknown as number[], textColor: [255, 255, 255], fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: C.text as unknown as number[] },
      alternateRowStyles: { fillColor: C.bg as unknown as number[] },
      margin: { left: MARGIN, right: MARGIN },
    });
    y = getLastTableY(doc) + 6;
  } else {
    y = kvRow(doc, y, 'Client', contract.clientName || '—');
    y = kvRow(doc, y, 'Supplier', contract.supplierName || '—');
    y += 4;
  }

  // Key contacts
  const contactList = contacts?.primaryContacts || contacts?.keyPersonnel || [];
  if (contactList.length > 0) {
    y = subHeading(doc, y, 'Key Contacts');
    addAutoTable(doc, {
      startY: y,
      head: [['Name', 'Role', 'Party', 'Email']],
      body: contactList.slice(0, 15).map((c: any) => [
        c.name || '—',
        c.role || c.title || '—',
        c.party || '—',
        c.email || '—',
      ]),
      theme: 'striped',
      headStyles: { fillColor: C.primaryDk as unknown as number[], textColor: [255, 255, 255], fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: C.text as unknown as number[] },
      alternateRowStyles: { fillColor: C.bg as unknown as number[] },
      margin: { left: MARGIN, right: MARGIN },
    });
    y = getLastTableY(doc) + 8;
  }

  return y;
}

// =============================================================================
// FINANCIAL
// =============================================================================

function renderFinancialSection(
  doc: jsPDF, y: number,
  contract: ContractReportData['contract'],
  financial: Record<string, any> | undefined,
): number {
  y = sectionHeading(doc, y, 'Financial Overview');

  const data = financial || {};
  y = kvRow(doc, y, 'Total Value', fmtMoney(
    data.totalValue ?? contract.totalValue,
    data.currency ?? contract.currency,
  ));
  y = kvRow(doc, y, 'Currency', data.currency || contract.currency);

  // Payment terms
  if (data.paymentTerms) {
    y += 2;
    y = subHeading(doc, y, 'Payment Terms');
    if (typeof data.paymentTerms === 'string') {
      y = bodyText(doc, y, data.paymentTerms);
    } else if (Array.isArray(data.paymentTerms)) {
      for (const term of data.paymentTerms) {
        y = bodyText(doc, y, typeof term === 'string' ? term : term.description || JSON.stringify(term));
      }
    } else {
      y = kvRow(doc, y, 'Net Days', data.paymentTerms.netDays);
      y = kvRow(doc, y, 'Method', data.paymentTerms.paymentMethod);
      y = kvRow(doc, y, 'Schedule', data.paymentTerms.invoicingSchedule);
    }
  }

  // Rate cards
  const rates = data.rateCards || data.rates || [];
  if (rates.length > 0) {
    y = checkPage(doc, y, 30);
    y = subHeading(doc, y, 'Rate Cards');
    addAutoTable(doc, {
      startY: y,
      head: [['Role / Item', 'Rate', 'Currency', 'Unit']],
      body: rates.slice(0, 20).map((r: any) => [
        r.role || r.title || r.item || '—',
        typeof r.rate === 'number' ? r.rate.toLocaleString() : String(r.rate || '—'),
        r.currency || data.currency || contract.currency || 'USD',
        r.unit || r.period || '—',
      ]),
      theme: 'striped',
      headStyles: { fillColor: C.primary as unknown as number[], textColor: [255, 255, 255], fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: C.text as unknown as number[] },
      alternateRowStyles: { fillColor: C.bg as unknown as number[] },
      margin: { left: MARGIN, right: MARGIN },
    });
    y = getLastTableY(doc) + 8;
  }

  // Fees
  const fees = data.fees || [];
  if (fees.length > 0) {
    y = checkPage(doc, y, 30);
    y = subHeading(doc, y, 'Fees & Charges');
    addAutoTable(doc, {
      startY: y,
      head: [['Fee', 'Amount', 'Frequency']],
      body: fees.map((f: any) => [
        f.name || f.description || '—',
        typeof f.amount === 'number' ? fmtMoney(f.amount, data.currency) : String(f.amount || '—'),
        f.frequency || 'One-time',
      ]),
      theme: 'striped',
      headStyles: { fillColor: C.primary as unknown as number[], textColor: [255, 255, 255], fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: C.text as unknown as number[] },
      alternateRowStyles: { fillColor: C.bg as unknown as number[] },
      margin: { left: MARGIN, right: MARGIN },
    });
    y = getLastTableY(doc) + 8;
  }

  return y;
}

// =============================================================================
// RISK ASSESSMENT
// =============================================================================

function renderRiskSection(doc: jsPDF, y: number, risk: Record<string, any>): number {
  y = sectionHeading(doc, y, 'Risk Assessment');

  // Overall score
  const score = risk.overallRiskScore?.value ?? risk.riskScore ?? risk.overallRisk;
  if (score != null) {
    const scoreNum = Number(score);
    const category = risk.overallRiskScore?.category || risk.riskLevel
      || (scoreNum >= 7 ? 'High' : scoreNum >= 4 ? 'Medium' : 'Low');
    const color = severityColor(category);

    doc.setFillColor(...C.bg);
    doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 14, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setTextColor(...C.muted);
    doc.text('OVERALL RISK', MARGIN + 5, y + 5);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...color);
    doc.text(`${scoreNum}/10 — ${category}`, MARGIN + 5, y + 12);
    doc.setFont('helvetica', 'normal');
    y += 20;
  }

  // Individual risks
  const risks = risk.risks || risk.items || [];
  if (risks.length > 0) {
    addAutoTable(doc, {
      startY: y,
      head: [['Risk', 'Severity', 'Category', 'Mitigation']],
      body: risks.slice(0, 25).map((r: any) => [
        r.title || r.name || 'Risk',
        (r.severity || r.level || '—').toUpperCase(),
        r.category || '—',
        truncate(r.mitigation || r.recommendation || '—', 60),
      ]),
      theme: 'striped',
      headStyles: { fillColor: C.red as unknown as number[], textColor: [255, 255, 255], fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: C.text as unknown as number[] },
      alternateRowStyles: { fillColor: [254, 242, 242] },
      margin: { left: MARGIN, right: MARGIN },
      didParseCell: (hookData) => {
        if (hookData.section === 'body' && hookData.column.index === 1) {
          const sev = String(hookData.cell.raw).toLowerCase();
          if (sev === 'high' || sev === 'critical') hookData.cell.styles.textColor = C.red as unknown as number[];
          else if (sev === 'medium') hookData.cell.styles.textColor = C.amber as unknown as number[];
          else hookData.cell.styles.textColor = C.green as unknown as number[];
        }
      },
    });
    y = getLastTableY(doc) + 8;
  }

  return y;
}

// =============================================================================
// COMPLIANCE
// =============================================================================

function renderComplianceSection(doc: jsPDF, y: number, compliance: Record<string, any>): number {
  y = sectionHeading(doc, y, 'Compliance');

  const score = compliance.overallScore ?? compliance.complianceScore;
  if (score != null) {
    doc.setFillColor(...C.bg);
    doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 14, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setTextColor(...C.muted);
    doc.text('COMPLIANCE SCORE', MARGIN + 5, y + 5);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    const scoreColor = Number(score) >= 80 ? C.green : Number(score) >= 50 ? C.amber : C.red;
    doc.setTextColor(...scoreColor);
    doc.text(`${score}%`, MARGIN + 5, y + 12);
    doc.setFont('helvetica', 'normal');
    y += 20;
  }

  // Frameworks
  const frameworks = compliance.frameworks || [];
  if (frameworks.length > 0) {
    y = subHeading(doc, y, 'Regulatory Frameworks');
    addAutoTable(doc, {
      startY: y,
      head: [['Framework', 'Status']],
      body: frameworks.map((fw: any) => [
        fw.name || '—',
        fw.compliant ? 'Compliant' : 'Non-compliant',
      ]),
      theme: 'striped',
      headStyles: { fillColor: C.primary as unknown as number[], textColor: [255, 255, 255], fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: C.text as unknown as number[] },
      alternateRowStyles: { fillColor: C.bg as unknown as number[] },
      margin: { left: MARGIN, right: MARGIN },
      didParseCell: (hookData) => {
        if (hookData.section === 'body' && hookData.column.index === 1) {
          const val = String(hookData.cell.raw).toLowerCase();
          hookData.cell.styles.textColor = val.includes('non') ? C.red as unknown as number[] : C.green as unknown as number[];
        }
      },
    });
    y = getLastTableY(doc) + 6;
  }

  // Gaps
  const gaps = compliance.gaps || [];
  if (gaps.length > 0) {
    y = subHeading(doc, y, 'Compliance Gaps');
    for (const gap of gaps.slice(0, 10)) {
      const text = typeof gap === 'string' ? gap : gap.description || JSON.stringify(gap);
      y = bodyText(doc, y, `•  ${text}`);
    }
  }

  return y + 4;
}

// =============================================================================
// KEY CLAUSES
// =============================================================================

function renderClausesSection(doc: jsPDF, y: number, clauseData: Record<string, any>): number {
  y = sectionHeading(doc, y, 'Key Clauses');

  const clauses = clauseData.clauses || clauseData.items || [];
  if (clauses.length === 0) {
    y = bodyText(doc, y, 'No clauses extracted.');
    return y;
  }

  addAutoTable(doc, {
    startY: y,
    head: [['Clause', 'Category', 'Summary']],
    body: clauses.slice(0, 30).map((c: any) => [
      c.title || c.name || 'Clause',
      c.category || c.type || '—',
      truncate(c.text || c.summary || c.excerpt || c.fullText || '—', 80),
    ]),
    theme: 'striped',
    headStyles: { fillColor: C.primary as unknown as number[], textColor: [255, 255, 255], fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: C.text as unknown as number[] },
    alternateRowStyles: { fillColor: C.bg as unknown as number[] },
    margin: { left: MARGIN, right: MARGIN },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { cellWidth: 30 },
      2: { cellWidth: 'auto' },
    },
  });
  return getLastTableY(doc) + 8;
}

// =============================================================================
// OBLIGATIONS
// =============================================================================

function renderObligationsSection(doc: jsPDF, y: number, data: Record<string, any>): number {
  y = sectionHeading(doc, y, 'Obligations');

  // Categorized obligations
  const categories = [
    { title: 'Buyer Obligations', items: data.buyerObligations },
    { title: 'Seller Obligations', items: data.sellerObligations },
    { title: 'Mutual Obligations', items: data.mutualObligations },
  ];

  for (const cat of categories) {
    if (cat.items?.length) {
      y = subHeading(doc, y, cat.title);
      for (const ob of cat.items.slice(0, 15)) {
        y = checkPage(doc, y, 12);
        y = bodyText(doc, y, `•  ${ob.description || ob.text || ob.obligation || ''}`);
        if (ob.deadline || ob.dueDate) {
          y = kvRow(doc, y, '   Deadline', fmtDate(ob.deadline || ob.dueDate), 30);
        }
      }
      y += 3;
    }
  }

  // Generic obligations list
  const obligations = data.obligations || data.items || [];
  if (obligations.length > 0 && !data.buyerObligations?.length) {
    addAutoTable(doc, {
      startY: y,
      head: [['Obligation', 'Party', 'Type', 'Due Date']],
      body: obligations.slice(0, 20).map((o: any) => [
        truncate(o.title || o.description || '—', 50),
        o.party || '—',
        o.type || '—',
        fmtDate(o.dueDate),
      ]),
      theme: 'striped',
      headStyles: { fillColor: C.primary as unknown as number[], textColor: [255, 255, 255], fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: C.text as unknown as number[] },
      alternateRowStyles: { fillColor: C.bg as unknown as number[] },
      margin: { left: MARGIN, right: MARGIN },
    });
    y = getLastTableY(doc) + 8;
  }

  return y;
}

// =============================================================================
// RENEWAL & TERMINATION
// =============================================================================

function renderRenewalSection(doc: jsPDF, y: number, data: Record<string, any>): number {
  y = sectionHeading(doc, y, 'Renewal & Termination');

  y = kvRow(doc, y, 'Auto-Renewal', data.autoRenewal === true ? 'Yes' : data.autoRenewal === false ? 'No' : '—');

  if (data.renewalTerms) {
    y = kvRow(doc, y, 'Renewal Period', data.renewalTerms.renewalPeriod);
    y = kvRow(doc, y, 'Notice Period', data.renewalTerms.noticePeriodDays
      ? `${data.renewalTerms.noticePeriodDays} days` : null);
    y = kvRow(doc, y, 'Opt-Out Deadline', fmtDate(data.renewalTerms.optOutDeadline));
  }

  if (data.terminationNotice) {
    y += 2;
    y = subHeading(doc, y, 'Termination Notice');
    y = kvRow(doc, y, 'Required Days', data.terminationNotice.requiredDays);
    y = kvRow(doc, y, 'Format', data.terminationNotice.format);
  }

  // Price escalation
  const escalation = data.priceEscalation || [];
  if (escalation.length > 0) {
    y = subHeading(doc, y + 2, 'Price Escalation');
    for (const e of escalation) {
      y = bodyText(doc, y, `•  ${e.type || 'Escalation'}: ${e.percentage ? e.percentage + '%' : ''} ${e.cap ? '(cap: ' + e.cap + ')' : ''}`);
    }
  }

  // Alerts
  const alerts = data.renewalAlerts || data.optOutDeadlines || [];
  if (alerts.length > 0) {
    y = subHeading(doc, y + 2, 'Upcoming Deadlines');
    addAutoTable(doc, {
      startY: y,
      head: [['Alert', 'Date', 'Priority']],
      body: alerts.slice(0, 10).map((a: any) => [
        a.message || a.description || '—',
        fmtDate(a.dueDate || a.date),
        (a.type || 'info').toUpperCase(),
      ]),
      theme: 'striped',
      headStyles: { fillColor: C.amber as unknown as number[], textColor: [255, 255, 255], fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: C.text as unknown as number[] },
      alternateRowStyles: { fillColor: [254, 252, 232] },
      margin: { left: MARGIN, right: MARGIN },
    });
    y = getLastTableY(doc) + 8;
  }

  return y;
}

// =============================================================================
// TIMELINE & DELIVERABLES
// =============================================================================

function renderTimelineSection(
  doc: jsPDF, y: number,
  timeline: Record<string, any> | undefined,
  deliverables: Record<string, any> | undefined,
): number {
  y = sectionHeading(doc, y, 'Timeline & Deliverables');

  // Timeline events
  const events = timeline?.events || timeline?.milestones || timeline?.keyDates || [];
  if (events.length > 0) {
    addAutoTable(doc, {
      startY: y,
      head: [['Date', 'Event', 'Status']],
      body: events.slice(0, 20).map((e: any) => [
        fmtDate(e.date || e.dueDate),
        e.title || e.name || e.description || '—',
        e.status || '—',
      ]),
      theme: 'striped',
      headStyles: { fillColor: C.primary as unknown as number[], textColor: [255, 255, 255], fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: C.text as unknown as number[] },
      alternateRowStyles: { fillColor: C.bg as unknown as number[] },
      margin: { left: MARGIN, right: MARGIN },
    });
    y = getLastTableY(doc) + 6;
  }

  // Deliverables
  const deliverableList = deliverables?.deliverables || deliverables?.items || [];
  if (deliverableList.length > 0) {
    y = subHeading(doc, y, 'Deliverables');
    addAutoTable(doc, {
      startY: y,
      head: [['Deliverable', 'Party', 'Due Date', 'Status']],
      body: deliverableList.slice(0, 20).map((d: any) => [
        d.title || d.name || d.description || '—',
        d.party || d.responsibleParty || '—',
        fmtDate(d.dueDate || d.deadline),
        d.status || '—',
      ]),
      theme: 'striped',
      headStyles: { fillColor: C.primary as unknown as number[], textColor: [255, 255, 255], fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: C.text as unknown as number[] },
      alternateRowStyles: { fillColor: C.bg as unknown as number[] },
      margin: { left: MARGIN, right: MARGIN },
    });
    y = getLastTableY(doc) + 8;
  }

  return y;
}

// =============================================================================
// NEGOTIATION POINTS
// =============================================================================

function renderNegotiationSection(doc: jsPDF, y: number, data: Record<string, any>): number {
  y = sectionHeading(doc, y, 'Negotiation Points');

  // Overall leverage
  if (data.overallLeverage) {
    const leverageColor = data.overallLeverage === 'strong' ? C.green
      : data.overallLeverage === 'weak' ? C.red : C.amber;
    y = kvRow(doc, y, 'Overall Leverage', data.overallLeverage.toUpperCase());
    y += 2;
  }

  // Leverage points
  const leverage = data.leveragePoints || [];
  if (leverage.length > 0) {
    y = subHeading(doc, y, 'Leverage Points');
    addAutoTable(doc, {
      startY: y,
      head: [['Point', 'Strength', 'Suggested Action']],
      body: leverage.slice(0, 15).map((l: any) => [
        l.title || l.description || '—',
        (l.strength || '—').toUpperCase(),
        truncate(l.suggestedAction || '—', 50),
      ]),
      theme: 'striped',
      headStyles: { fillColor: C.green as unknown as number[], textColor: [255, 255, 255], fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: C.text as unknown as number[] },
      alternateRowStyles: { fillColor: [240, 253, 244] },
      margin: { left: MARGIN, right: MARGIN },
    });
    y = getLastTableY(doc) + 6;
  }

  // Weak clauses
  const weakClauses = data.weakClauses || [];
  if (weakClauses.length > 0) {
    y = checkPage(doc, y, 30);
    y = subHeading(doc, y, 'Weak Clauses');
    addAutoTable(doc, {
      startY: y,
      head: [['Clause', 'Issue', 'Impact', 'Suggested Revision']],
      body: weakClauses.slice(0, 15).map((w: any) => [
        w.clauseReference || w.clause || '—',
        truncate(w.issue || '—', 40),
        (w.impact || '—').toUpperCase(),
        truncate(w.suggestedRevision || '—', 40),
      ]),
      theme: 'striped',
      headStyles: { fillColor: C.amber as unknown as number[], textColor: [255, 255, 255], fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: C.text as unknown as number[] },
      alternateRowStyles: { fillColor: [254, 252, 232] },
      margin: { left: MARGIN, right: MARGIN },
    });
    y = getLastTableY(doc) + 8;
  }

  return y;
}

// =============================================================================
// AMENDMENTS
// =============================================================================

function renderAmendmentsSection(doc: jsPDF, y: number, data: Record<string, any>): number {
  y = sectionHeading(doc, y, 'Amendments');

  const amendments = data.amendments || data.items || [];
  if (amendments.length === 0) {
    y = bodyText(doc, y, 'No amendments recorded.');
    return y;
  }

  for (const amend of amendments.slice(0, 10)) {
    y = checkPage(doc, y, 25);
    y = subHeading(doc, y, `Amendment ${amend.amendmentNumber || ''}: ${amend.title || 'Untitled'}`);
    y = kvRow(doc, y, 'Effective Date', fmtDate(amend.effectiveDate));
    if (amend.description) {
      y = bodyText(doc, y, amend.description);
    }
    if (amend.changedClauses?.length) {
      addAutoTable(doc, {
        startY: y,
        head: [['Clause', 'Change Type', 'New Text']],
        body: amend.changedClauses.slice(0, 10).map((cc: any) => [
          cc.clauseId || '—',
          cc.changeType || '—',
          truncate(cc.newText || '—', 60),
        ]),
        theme: 'striped',
        headStyles: { fillColor: C.primaryDk as unknown as number[], textColor: [255, 255, 255], fontSize: 8 },
        bodyStyles: { fontSize: 8, textColor: C.text as unknown as number[] },
        alternateRowStyles: { fillColor: C.bg as unknown as number[] },
        margin: { left: MARGIN, right: MARGIN },
      });
      y = getLastTableY(doc) + 6;
    }
    y += 4;
  }

  return y;
}
