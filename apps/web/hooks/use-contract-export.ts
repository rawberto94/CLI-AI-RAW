/**
 * Contract Export Hook
 * 
 * Provides functionality to export contracts to various formats
 * including CSV, JSON, Excel, and PDF.
 */

import { useCallback, useState } from 'react';
import type { Contract } from './use-contract-analytics';

// ============================================================================
// Types
// ============================================================================

export type ExportFormat = 'csv' | 'json' | 'excel' | 'pdf';

export interface ExportColumn {
  key: string;
  header: string;
  format?: (value: any, contract: Contract) => string;
  width?: number;
}

export interface ExportOptions {
  format: ExportFormat;
  filename?: string;
  columns?: ExportColumn[];
  includeHeaders?: boolean;
  dateFormat?: string;
  currencyFormat?: string;
}

export interface ExportState {
  isExporting: boolean;
  progress: number;
  error: string | null;
}

export interface UseContractExportReturn {
  state: ExportState;
  exportContracts: (contracts: Contract[], options: ExportOptions) => Promise<void>;
  downloadFile: (content: string | Blob, filename: string, mimeType: string) => void;
  generateCSV: (contracts: Contract[], columns?: ExportColumn[]) => string;
  generateJSON: (contracts: Contract[], pretty?: boolean) => string;
}

// ============================================================================
// Default Columns
// ============================================================================

export const DEFAULT_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'id', header: 'ID' },
  { key: 'title', header: 'Title' },
  { key: 'status', header: 'Status' },
  { key: 'type', header: 'Type' },
  { key: 'vendor', header: 'Vendor' },
  { key: 'value', header: 'Value', format: (v) => v ? `$${v.toLocaleString()}` : '' },
  { key: 'startDate', header: 'Start Date', format: (v) => formatDate(v) },
  { key: 'endDate', header: 'End Date', format: (v) => formatDate(v) },
  { key: 'riskLevel', header: 'Risk Level' },
  { key: 'department', header: 'Department' },
  { key: 'tags', header: 'Tags', format: (v) => Array.isArray(v) ? v.join(', ') : '' },
  { key: 'hasAutoRenewal', header: 'Auto Renewal', format: (v) => v ? 'Yes' : 'No' },
  { key: 'createdAt', header: 'Created', format: (v) => formatDate(v) },
  { key: 'updatedAt', header: 'Updated', format: (v) => formatDate(v) },
];

// ============================================================================
// Utility Functions
// ============================================================================

function formatDate(value: string | undefined): string {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return value;
  }
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((acc, part) => acc?.[part], obj);
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useContractExport(): UseContractExportReturn {
  const [state, setState] = useState<ExportState>({
    isExporting: false,
    progress: 0,
    error: null,
  });

  // Generate CSV content
  const generateCSV = useCallback((
    contracts: Contract[],
    columns: ExportColumn[] = DEFAULT_EXPORT_COLUMNS
  ): string => {
    const lines: string[] = [];

    // Header row
    const headers = columns.map((col) => escapeCSV(col.header));
    lines.push(headers.join(','));

    // Data rows
    contracts.forEach((contract) => {
      const row = columns.map((col) => {
        const value = getNestedValue(contract, col.key);
        const formatted = col.format ? col.format(value, contract) : String(value ?? '');
        return escapeCSV(formatted);
      });
      lines.push(row.join(','));
    });

    return lines.join('\n');
  }, []);

  // Generate JSON content
  const generateJSON = useCallback((
    contracts: Contract[],
    pretty: boolean = true
  ): string => {
    return pretty
      ? JSON.stringify(contracts, null, 2)
      : JSON.stringify(contracts);
  }, []);

  // Download file
  const downloadFile = useCallback((
    content: string | Blob,
    filename: string,
    mimeType: string
  ): void => {
    const blob = content instanceof Blob 
      ? content 
      : new Blob([content], { type: mimeType });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  // Generate Excel-compatible CSV (with BOM for UTF-8)
  const generateExcelCSV = useCallback((
    contracts: Contract[],
    columns: ExportColumn[] = DEFAULT_EXPORT_COLUMNS
  ): string => {
    // UTF-8 BOM for Excel
    const BOM = '\uFEFF';
    return BOM + generateCSV(contracts, columns);
  }, [generateCSV]);

  // Generate basic HTML report (for PDF via print)
  const generateHTMLReport = useCallback((
    contracts: Contract[],
    columns: ExportColumn[] = DEFAULT_EXPORT_COLUMNS
  ): string => {
    const rows = contracts.map((contract) => {
      const cells = columns.map((col) => {
        const value = getNestedValue(contract, col.key);
        const formatted = col.format ? col.format(value, contract) : String(value ?? '');
        return `<td style="padding: 8px; border: 1px solid #ddd;">${formatted}</td>`;
      }).join('');
      return `<tr>${cells}</tr>`;
    }).join('');

    const headerCells = columns.map((col) => 
      `<th style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5; font-weight: bold;">${col.header}</th>`
    ).join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Contracts Export</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #333; }
    table { border-collapse: collapse; width: 100%; margin-top: 20px; }
    th, td { text-align: left; }
    .summary { margin-bottom: 20px; color: #666; }
    @media print {
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <h1>Contracts Export</h1>
  <p class="summary">
    Exported on ${new Date().toLocaleDateString()} | Total: ${contracts.length} contracts
  </p>
  <table>
    <thead>
      <tr>${headerCells}</tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
  <script class="no-print">
    window.onload = function() { window.print(); }
  </script>
</body>
</html>
    `.trim();
  }, []);

  // Main export function
  const exportContracts = useCallback(async (
    contracts: Contract[],
    options: ExportOptions
  ): Promise<void> => {
    const { 
      format, 
      filename = `contracts-export-${Date.now()}`,
      columns = DEFAULT_EXPORT_COLUMNS,
    } = options;

    setState({ isExporting: true, progress: 0, error: null });

    try {
      setState((prev) => ({ ...prev, progress: 25 }));

      let content: string | Blob;
      let mimeType: string;
      let extension: string;

      switch (format) {
        case 'csv':
          content = generateCSV(contracts, columns);
          mimeType = 'text/csv;charset=utf-8';
          extension = 'csv';
          break;

        case 'json':
          content = generateJSON(contracts, true);
          mimeType = 'application/json';
          extension = 'json';
          break;

        case 'excel':
          content = generateExcelCSV(contracts, columns);
          mimeType = 'text/csv;charset=utf-8';
          extension = 'csv'; // Excel-compatible CSV
          break;

        case 'pdf':
          // Generate HTML and open in new window for printing
          const html = generateHTMLReport(contracts, columns);
          const printWindow = window.open('', '_blank');
          if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();
          }
          setState({ isExporting: false, progress: 100, error: null });
          return;

        default:
          throw new Error(`Unsupported export format: ${format}`);
      }

      setState((prev) => ({ ...prev, progress: 75 }));

      downloadFile(content, `${filename}.${extension}`, mimeType);

      setState({ isExporting: false, progress: 100, error: null });
    } catch (error) {
      setState({
        isExporting: false,
        progress: 0,
        error: error instanceof Error ? error.message : 'Export failed',
      });
    }
  }, [generateCSV, generateJSON, generateExcelCSV, generateHTMLReport, downloadFile]);

  return {
    state,
    exportContracts,
    downloadFile,
    generateCSV,
    generateJSON,
  };
}

// ============================================================================
// Export Presets
// ============================================================================

export const EXPORT_PRESETS = {
  basic: {
    columns: [
      { key: 'title', header: 'Title' },
      { key: 'status', header: 'Status' },
      { key: 'vendor', header: 'Vendor' },
      { key: 'value', header: 'Value', format: (v: number) => v ? `$${v.toLocaleString()}` : '' },
      { key: 'endDate', header: 'End Date', format: formatDate },
    ],
  },
  financial: {
    columns: [
      { key: 'title', header: 'Title' },
      { key: 'vendor', header: 'Vendor' },
      { key: 'value', header: 'Value', format: (v: number) => v ? `$${v.toLocaleString()}` : '' },
      { key: 'startDate', header: 'Start Date', format: formatDate },
      { key: 'endDate', header: 'End Date', format: formatDate },
      { key: 'department', header: 'Department' },
      { key: 'hasAutoRenewal', header: 'Auto Renewal', format: (v: boolean) => v ? 'Yes' : 'No' },
    ],
  },
  compliance: {
    columns: [
      { key: 'id', header: 'ID' },
      { key: 'title', header: 'Title' },
      { key: 'status', header: 'Status' },
      { key: 'type', header: 'Type' },
      { key: 'vendor', header: 'Vendor' },
      { key: 'riskLevel', header: 'Risk Level' },
      { key: 'endDate', header: 'End Date', format: formatDate },
      { key: 'tags', header: 'Tags', format: (v: string[]) => Array.isArray(v) ? v.join(', ') : '' },
      { key: 'createdAt', header: 'Created', format: formatDate },
    ],
  },
  full: {
    columns: DEFAULT_EXPORT_COLUMNS,
  },
};

export default useContractExport;
