/**
 * PDF Export Service
 * 
 * Generates PDF reports for:
 * - Contract analysis results
 * - Batch analysis summaries
 * - AI insights reports
 * 
 * Uses jsPDF for client-side PDF generation
 */

import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Extend jsPDF type for autotable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: {
      head?: string[][];
      body?: (string | number)[][];
      startY?: number;
      theme?: string;
      headStyles?: Record<string, unknown>;
      styles?: Record<string, unknown>;
      columnStyles?: Record<string, unknown>;
      margin?: { top?: number; right?: number; bottom?: number; left?: number };
      didParseCell?: (hookData: {
        column: { index: number };
        section: string;
        cell: { raw: unknown; styles: Record<string, unknown> };
      }) => void;
    }) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

// Types
export interface ContractAnalysisData {
  contractName: string;
  contractId: string;
  analysisDate: string;
  summary: string;
  keyTerms?: Array<{ term: string; value: string }>;
  risks?: Array<{ title: string; severity: string; description: string }>;
  obligations?: Array<{ party: string; obligation: string; dueDate?: string }>;
  recommendations?: string[];
  metadata?: {
    processingTime?: number;
    model?: string;
    tokensUsed?: number;
  };
}

export interface BatchAnalysisData {
  batchId: string;
  analysisDate: string;
  totalContracts: number;
  successful: number;
  failed: number;
  duration: number;
  contracts: Array<{
    name: string;
    status: 'success' | 'failed';
    summary?: string;
    riskCount?: number;
    error?: string;
  }>;
}

export interface AIInsightsData {
  reportDate: string;
  period: string;
  totalAnalyses: number;
  topRisks: Array<{ risk: string; count: number; severity: string }>;
  commonTerms: Array<{ term: string; frequency: number }>;
  recommendations: string[];
  trends: Array<{ metric: string; change: number; direction: 'up' | 'down' }>;
}

// Colors
const COLORS = {
  primary: [59, 130, 246] as [number, number, number],   // Blue
  secondary: [100, 116, 139] as [number, number, number], // Slate
  success: [16, 185, 129] as [number, number, number],   // Green
  warning: [245, 158, 11] as [number, number, number],   // Amber
  danger: [239, 68, 68] as [number, number, number],     // Red
  text: [30, 41, 59] as [number, number, number],        // Slate-800
  lightText: [100, 116, 139] as [number, number, number], // Slate-500
};

class PDFExportService {
  /**
   * Export single contract analysis to PDF
   */
  exportContractAnalysis(data: ContractAnalysisData): Blob {
    const doc = new jsPDF();
    let y = 20;

    // Header
    doc.setFillColor(...COLORS.primary);
    doc.rect(0, 0, 210, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Contract Analysis Report', 20, 22);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${data.analysisDate}`, 20, 30);

    y = 45;

    // Contract Info
    doc.setTextColor(...COLORS.text);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Contract Information', 20, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.lightText);
    doc.text(`Contract: ${data.contractName}`, 20, y);
    y += 5;
    doc.text(`ID: ${data.contractId}`, 20, y);
    y += 12;

    // Summary
    doc.setTextColor(...COLORS.text);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Executive Summary', 20, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const summaryLines = doc.splitTextToSize(data.summary, 170);
    doc.text(summaryLines, 20, y);
    y += summaryLines.length * 5 + 10;

    // Key Terms
    if (data.keyTerms && data.keyTerms.length > 0) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Key Terms', 20, y);
      y += 5;

      doc.autoTable({
        startY: y,
        head: [['Term', 'Value']],
        body: data.keyTerms.map(t => [t.term, t.value]),
        theme: 'striped',
        headStyles: { fillColor: COLORS.primary },
        styles: { fontSize: 9 },
        margin: { left: 20, right: 20 },
      });

      y = doc.lastAutoTable.finalY + 10;
    }

    // Risks
    if (data.risks && data.risks.length > 0) {
      if (y > 230) {
        doc.addPage();
        y = 20;
      }

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Risk Assessment', 20, y);
      y += 5;

      doc.autoTable({
        startY: y,
        head: [['Risk', 'Severity', 'Description']],
        body: data.risks.map(r => [
          r.title,
          r.severity.toUpperCase(),
          r.description,
        ]),
        theme: 'striped',
        headStyles: { fillColor: COLORS.danger },
        styles: { fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 40 },
          1: { cellWidth: 25 },
          2: { cellWidth: 'auto' },
        },
        margin: { left: 20, right: 20 },
      });

      y = doc.lastAutoTable.finalY + 10;
    }

    // Obligations
    if (data.obligations && data.obligations.length > 0) {
      if (y > 230) {
        doc.addPage();
        y = 20;
      }

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Key Obligations', 20, y);
      y += 5;

      doc.autoTable({
        startY: y,
        head: [['Party', 'Obligation', 'Due Date']],
        body: data.obligations.map(o => [
          o.party,
          o.obligation,
          o.dueDate || 'N/A',
        ]),
        theme: 'striped',
        headStyles: { fillColor: COLORS.warning },
        styles: { fontSize: 9 },
        margin: { left: 20, right: 20 },
      });

      y = doc.lastAutoTable.finalY + 10;
    }

    // Recommendations
    if (data.recommendations && data.recommendations.length > 0) {
      if (y > 230) {
        doc.addPage();
        y = 20;
      }

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Recommendations', 20, y);
      y += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      data.recommendations.forEach((rec, i) => {
        const lines = doc.splitTextToSize(`${i + 1}. ${rec}`, 170);
        doc.text(lines, 20, y);
        y += lines.length * 5 + 3;
      });
    }

    // Footer with metadata
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.lightText);
      doc.text(
        `Page ${i} of ${pageCount} | AI Analysis powered by Contigo`,
        105,
        287,
        { align: 'center' }
      );
      if (data.metadata) {
        doc.text(
          `Model: ${data.metadata.model || 'GPT-4o'} | Tokens: ${data.metadata.tokensUsed || 'N/A'}`,
          105,
          292,
          { align: 'center' }
        );
      }
    }

    return doc.output('blob');
  }

  /**
   * Export batch analysis results to PDF
   */
  exportBatchAnalysis(data: BatchAnalysisData): Blob {
    const doc = new jsPDF();
    let y = 20;

    // Header
    doc.setFillColor(...COLORS.primary);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Batch Analysis Report', 20, 22);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Batch ID: ${data.batchId}`, 20, 30);
    doc.text(`Generated: ${data.analysisDate}`, 20, 36);

    y = 50;

    // Summary Stats
    doc.setTextColor(...COLORS.text);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Summary', 20, y);
    y += 10;

    // Stats boxes
    const stats = [
      { label: 'Total Contracts', value: data.totalContracts.toString(), color: COLORS.primary },
      { label: 'Successful', value: data.successful.toString(), color: COLORS.success },
      { label: 'Failed', value: data.failed.toString(), color: COLORS.danger },
      { label: 'Duration', value: `${(data.duration / 1000).toFixed(1)}s`, color: COLORS.secondary },
    ];

    let x = 20;
    stats.forEach(stat => {
      doc.setFillColor(...stat.color);
      doc.roundedRect(x, y, 40, 25, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(stat.value, x + 20, y + 12, { align: 'center' });
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(stat.label, x + 20, y + 20, { align: 'center' });
      x += 45;
    });

    y += 35;

    // Success Rate
    const successRate = Math.round((data.successful / data.totalContracts) * 100);
    doc.setTextColor(...COLORS.text);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Success Rate: ${successRate}%`, 20, y);
    y += 8;

    // Progress bar
    doc.setFillColor(226, 232, 240); // Gray background
    doc.roundedRect(20, y, 170, 8, 2, 2, 'F');
    doc.setFillColor(...COLORS.success);
    doc.roundedRect(20, y, (170 * successRate) / 100, 8, 2, 2, 'F');
    y += 18;

    // Contract Results Table
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Contract Results', 20, y);
    y += 5;

    doc.autoTable({
      startY: y,
      head: [['Contract', 'Status', 'Summary / Error']],
      body: data.contracts.map(c => [
        c.name,
        c.status.toUpperCase(),
        c.status === 'success' ? (c.summary?.substring(0, 80) + '...') || 'Analyzed' : c.error || 'Failed',
      ]),
      theme: 'striped',
      headStyles: { fillColor: COLORS.primary },
      styles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 20 },
        2: { cellWidth: 'auto' },
      },
      margin: { left: 20, right: 20 },
      didParseCell: (hookData) => {
        if (hookData.column.index === 1 && hookData.section === 'body') {
          const value = hookData.cell.raw as string;
          if (value === 'SUCCESS') {
            hookData.cell.styles.textColor = COLORS.success;
          } else {
            hookData.cell.styles.textColor = COLORS.danger;
          }
        }
      },
    });

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.lightText);
      doc.text(
        `Page ${i} of ${pageCount} | Batch Analysis Report | Contigo`,
        105,
        287,
        { align: 'center' }
      );
    }

    return doc.output('blob');
  }

  /**
   * Export AI insights report to PDF
   */
  exportAIInsights(data: AIInsightsData): Blob {
    const doc = new jsPDF();
    let y = 20;

    // Header
    doc.setFillColor(...COLORS.primary);
    doc.rect(0, 0, 210, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('AI Insights Report', 20, 22);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Period: ${data.period} | Generated: ${data.reportDate}`, 20, 30);

    y = 45;

    // Overview
    doc.setTextColor(...COLORS.text);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Overview', 20, y);
    y += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Analyses Performed: ${data.totalAnalyses}`, 20, y);
    y += 15;

    // Trends
    if (data.trends && data.trends.length > 0) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Key Trends', 20, y);
      y += 8;

      data.trends.forEach(trend => {
        const arrow = trend.direction === 'up' ? '↑' : '↓';
        const color = trend.direction === 'up' ? COLORS.success : COLORS.danger;
        doc.setTextColor(...color);
        doc.setFontSize(10);
        doc.text(`${arrow} ${trend.metric}: ${trend.change > 0 ? '+' : ''}${trend.change}%`, 25, y);
        y += 6;
      });
      y += 5;
    }

    // Top Risks
    if (data.topRisks && data.topRisks.length > 0) {
      doc.setTextColor(...COLORS.text);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Most Common Risks', 20, y);
      y += 5;

      doc.autoTable({
        startY: y,
        head: [['Risk', 'Occurrences', 'Severity']],
        body: data.topRisks.map(r => [r.risk, r.count.toString(), r.severity]),
        theme: 'striped',
        headStyles: { fillColor: COLORS.danger },
        styles: { fontSize: 9 },
        margin: { left: 20, right: 20 },
      });

      y = doc.lastAutoTable.finalY + 10;
    }

    // Common Terms
    if (data.commonTerms && data.commonTerms.length > 0) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Frequently Identified Terms', 20, y);
      y += 5;

      doc.autoTable({
        startY: y,
        head: [['Term', 'Frequency']],
        body: data.commonTerms.map(t => [t.term, t.frequency.toString()]),
        theme: 'striped',
        headStyles: { fillColor: COLORS.secondary },
        styles: { fontSize: 9 },
        margin: { left: 20, right: 20 },
      });

      y = doc.lastAutoTable.finalY + 10;
    }

    // Recommendations
    if (data.recommendations && data.recommendations.length > 0) {
      if (y > 220) {
        doc.addPage();
        y = 20;
      }

      doc.setTextColor(...COLORS.text);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('AI Recommendations', 20, y);
      y += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      data.recommendations.forEach((rec, i) => {
        const lines = doc.splitTextToSize(`${i + 1}. ${rec}`, 170);
        doc.text(lines, 20, y);
        y += lines.length * 5 + 4;
      });
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.lightText);
      doc.text(
        `Page ${i} of ${pageCount} | AI Insights Report | Contigo`,
        105,
        287,
        { align: 'center' }
      );
    }

    return doc.output('blob');
  }

  /**
   * Download PDF blob as file
   */
  downloadPDF(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export const pdfExportService = new PDFExportService();
