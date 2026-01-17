"use client";

/**
 * useDownload Hook
 * 
 * Utilities for downloading files and exporting data.
 */

import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

// ============================================================================
// Types
// ============================================================================

export type FileFormat = "json" | "csv" | "txt" | "xml" | "html" | "pdf";

export interface DownloadOptions {
  filename?: string;
  format?: FileFormat;
  successMessage?: string;
  errorMessage?: string;
}

export interface UseDownloadReturn {
  downloading: boolean;
  download: (data: string | Blob, options?: DownloadOptions) => void;
  downloadJson: (data: unknown, filename?: string) => void;
  downloadCsv: (data: string, filename?: string) => void;
  downloadText: (data: string, filename?: string) => void;
  downloadBlob: (blob: Blob, filename: string) => void;
  downloadFromUrl: (url: string, filename?: string) => Promise<void>;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getMimeType(format: FileFormat): string {
  const mimeTypes: Record<FileFormat, string> = {
    json: "application/json",
    csv: "text/csv;charset=utf-8;",
    txt: "text/plain",
    xml: "application/xml",
    html: "text/html",
    pdf: "application/pdf",
  };
  return mimeTypes[format] || "application/octet-stream";
}

function generateFilename(format: FileFormat, prefix = "download"): string {
  const date = new Date().toISOString().split("T")[0];
  return `${prefix}-${date}.${format}`;
}

function triggerDownload(url: string, filename: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ============================================================================
// useDownload Hook
// ============================================================================

export function useDownload(): UseDownloadReturn {
  const [downloading, setDownloading] = useState(false);
  const { toast } = useToast();

  const download = useCallback((data: string | Blob, options: DownloadOptions = {}) => {
    const {
      filename,
      format = "txt",
      successMessage = "File downloaded successfully",
      errorMessage = "Failed to download file",
    } = options;

    try {
      setDownloading(true);

      const blob = data instanceof Blob 
        ? data 
        : new Blob([data], { type: getMimeType(format) });
      
      const url = URL.createObjectURL(blob);
      const finalFilename = filename || generateFilename(format);
      
      triggerDownload(url, finalFilename);

      toast({
        title: "Download Complete",
        description: successMessage,
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Download Failed",
        description: errorMessage,
      });
    } finally {
      setDownloading(false);
    }
  }, [toast]);

  const downloadJson = useCallback((data: unknown, filename?: string) => {
    const jsonString = JSON.stringify(data, null, 2);
    download(jsonString, {
      filename: filename || generateFilename("json", "export"),
      format: "json",
    });
  }, [download]);

  const downloadCsv = useCallback((data: string, filename?: string) => {
    download(data, {
      filename: filename || generateFilename("csv", "export"),
      format: "csv",
    });
  }, [download]);

  const downloadText = useCallback((data: string, filename?: string) => {
    download(data, {
      filename: filename || generateFilename("txt", "export"),
      format: "txt",
    });
  }, [download]);

  const downloadBlob = useCallback((blob: Blob, filename: string) => {
    try {
      setDownloading(true);
      const url = URL.createObjectURL(blob);
      triggerDownload(url, filename);
      
      toast({
        title: "Download Complete",
        description: "File downloaded successfully",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Download Failed",
        description: "Failed to download file",
      });
    } finally {
      setDownloading(false);
    }
  }, [toast]);

  const downloadFromUrl = useCallback(async (url: string, filename?: string) => {
    try {
      setDownloading(true);
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const blob = await response.blob();
      const finalFilename = filename || url.split("/").pop() || "download";
      
      const objectUrl = URL.createObjectURL(blob);
      triggerDownload(objectUrl, finalFilename);

      toast({
        title: "Download Complete",
        description: "File downloaded successfully",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Download Failed",
        description: "Failed to download file from URL",
      });
    } finally {
      setDownloading(false);
    }
  }, [toast]);

  return {
    downloading,
    download,
    downloadJson,
    downloadCsv,
    downloadText,
    downloadBlob,
    downloadFromUrl,
  };
}

// ============================================================================
// CSV Export Utilities
// ============================================================================

export interface CsvColumn<T> {
  key: keyof T | string;
  header: string;
  formatter?: (value: unknown, item: T) => string;
}

export interface ExportToCsvOptions<T> {
  columns: CsvColumn<T>[];
  filename?: string;
  delimiter?: string;
  includeHeaders?: boolean;
}

/**
 * Convert array of objects to CSV string
 */
export function objectsToCsv<T extends Record<string, unknown>>(
  data: T[],
  options: ExportToCsvOptions<T>
): string {
  const { columns, delimiter = ",", includeHeaders = true } = options;

  const escapeValue = (value: unknown): string => {
    const str = String(value ?? "");
    if (str.includes(delimiter) || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const getNestedValue = (obj: T, path: string): unknown => {
    return path.split(".").reduce((acc: unknown, key) => {
      if (acc && typeof acc === "object") {
        return (acc as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  };

  const rows: string[] = [];

  // Headers
  if (includeHeaders) {
    rows.push(columns.map((col) => escapeValue(col.header)).join(delimiter));
  }

  // Data rows
  for (const item of data) {
    const row = columns.map((col) => {
      const value = getNestedValue(item, col.key as string);
      const formatted = col.formatter ? col.formatter(value, item) : value;
      return escapeValue(formatted);
    });
    rows.push(row.join(delimiter));
  }

  return rows.join("\n");
}

/**
 * Hook for exporting data to CSV
 */
export function useExportCsv<T extends Record<string, unknown>>() {
  const { downloadCsv } = useDownload();
  const [exporting, setExporting] = useState(false);

  const exportToCsv = useCallback((
    data: T[],
    options: ExportToCsvOptions<T>
  ) => {
    setExporting(true);
    try {
      const csv = objectsToCsv(data, options);
      downloadCsv(csv, options.filename);
    } finally {
      setExporting(false);
    }
  }, [downloadCsv]);

  return { exportToCsv, exporting };
}

// ============================================================================
// JSON Export Utilities
// ============================================================================

export interface ExportToJsonOptions {
  filename?: string;
  prettyPrint?: boolean;
  filter?: (key: string, value: unknown) => unknown;
}

/**
 * Hook for exporting data to JSON
 */
export function useExportJson() {
  const { downloadJson } = useDownload();
  const [exporting, setExporting] = useState(false);

  const exportToJson = useCallback((
    data: unknown,
    options: ExportToJsonOptions = {}
  ) => {
    setExporting(true);
    try {
      downloadJson(data, options.filename);
    } finally {
      setExporting(false);
    }
  }, [downloadJson]);

  return { exportToJson, exporting };
}

// ============================================================================
// Print Utilities
// ============================================================================

export interface UsePrintOptions {
  title?: string;
  styles?: string;
}

export function usePrint(options: UsePrintOptions = {}) {
  const [printing, setPrinting] = useState(false);

  const print = useCallback((content: string | HTMLElement) => {
    setPrinting(true);
    
    try {
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        throw new Error("Could not open print window");
      }

      const htmlContent = typeof content === "string" 
        ? content 
        : content.outerHTML;

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${options.title || "Print"}</title>
            <style>
              body { font-family: system-ui, -apple-system, sans-serif; padding: 20px; }
              @media print {
                body { padding: 0; }
                .no-print { display: none !important; }
              }
              ${options.styles || ""}
            </style>
          </head>
          <body>
            ${htmlContent}
          </body>
        </html>
      `);
      
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    } catch {
      // Print error
    } finally {
      setPrinting(false);
    }
  }, [options.title, options.styles]);

  const printElement = useCallback((elementId: string) => {
    const element = document.getElementById(elementId);
    if (element) {
      print(element);
    }
  }, [print]);

  return { print, printElement, printing };
}
