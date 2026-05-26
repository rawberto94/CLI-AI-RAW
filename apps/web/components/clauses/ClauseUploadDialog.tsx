'use client';

import { useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface ClauseImportRow {
  rowNumber: number;
  sourceSheet?: string;
  title: string;
  content: string;
  category: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  tags: string[];
  isStandard: boolean;
  isMandatory: boolean;
  isNegotiable: boolean;
  jurisdiction?: string;
  contractTypes: string[];
  alternativeText?: string;
  errors: string[];
  warnings: string[];
  duplicate?: boolean;
  duplicateReason?: string;
}

interface ClauseImportPreview {
  fileName: string;
  fileSize: number;
  totalRows: number;
  validRows: number;
  errorRows: number;
  duplicateRows: number;
  maxRows: number;
  rows: ClauseImportRow[];
}

interface ClauseImportSummary {
  totalRows: number;
  createdCount: number;
  skippedCount: number;
  failedCount: number;
  skipped: Array<{ rowNumber: number; title: string; reason: string }>;
  failed: Array<{ rowNumber: number; title: string; reason: string }>;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { message?: string; details?: string };
}

interface ClauseUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${Math.round((bytes / Math.pow(1024, index)) * 100) / 100} ${sizes[index]}`;
}

async function readApiData<T>(response: Response): Promise<T> {
  const payload = await response.json() as ApiResponse<T>;
  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(payload.error?.details || payload.error?.message || 'Request failed');
  }
  return payload.data;
}

function downloadTemplate(): void {
  const csv = [
    'title,content,category,riskLevel,tags,isStandard,isMandatory,isNegotiable,jurisdiction,contractTypes,alternativeText',
    'Standard Confidentiality,"Each party shall protect Confidential Information disclosed under this Agreement.",confidentiality,MEDIUM,"nda,confidentiality",true,true,true,GLOBAL,"MSA,NDA",',
    'Limitation of Liability,"Neither party shall be liable for indirect or consequential damages.",liability,HIGH,"liability,damages",true,false,true,US,"MSA,SOW",',
  ].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'clause-import-template.csv';
  link.click();
  URL.revokeObjectURL(url);
}

export function ClauseUploadDialog({ open, onOpenChange, onImportComplete }: ClauseUploadDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ClauseImportPreview | null>(null);
  const [summary, setSummary] = useState<ClauseImportSummary | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const importableRows = useMemo(
    () => preview?.rows.filter((row) => row.errors.length === 0 && !row.duplicate) ?? [],
    [preview],
  );

  const reset = () => {
    setFile(null);
    setPreview(null);
    setSummary(null);
    setIsPreviewing(false);
    setIsImporting(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) reset();
  };

  const handleFileSelect = (selectedFile?: File) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    setPreview(null);
    setSummary(null);
  };

  const previewFile = async () => {
    if (!file) {
      toast.error('Choose a clause file first');
      return;
    }

    setIsPreviewing(true);
    setSummary(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/clauses/upload/preview', {
        method: 'POST',
        body: formData,
      });
      const data = await readApiData<ClauseImportPreview>(response);
      setPreview(data);
      toast.success(`Previewed ${data.totalRows} clause rows`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to preview clause file');
    } finally {
      setIsPreviewing(false);
    }
  };

  const importRows = async () => {
    if (importableRows.length === 0) {
      toast.error('No valid rows to import');
      return;
    }

    setIsImporting(true);

    try {
      const response = await fetch('/api/clauses/upload/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: importableRows }),
      });
      const data = await readApiData<ClauseImportSummary>(response);
      setSummary(data);
      onImportComplete();
      toast.success(`Imported ${data.createdCount} clauses`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to import clauses');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Clauses</DialogTitle>
          <DialogDescription>
            Import structured clause libraries from CSV, Excel, or JSON. Review the parsed rows before saving them.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6">
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls,.json"
              className="hidden"
              onChange={(event) => handleFileSelect(event.target.files?.[0])}
            />
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="rounded-md bg-white p-2 text-violet-600 shadow-sm">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">
                    {file ? file.name : 'Choose a clause import file'}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Required columns: title, content, category. Optional: riskLevel, tags, jurisdiction, contractTypes.
                  </p>
                  {file && (
                    <p className="mt-1 text-xs text-slate-500">
                      {formatFileSize(file.size)}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={downloadTemplate}>
                  <Download className="mr-2 h-4 w-4" />
                  Template
                </Button>
                <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" />
                  Browse
                </Button>
                <Button type="button" onClick={previewFile} disabled={!file || isPreviewing}>
                  {isPreviewing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  Preview
                </Button>
              </div>
            </div>
          </div>

          {preview && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-md border p-3">
                  <p className="text-xs text-slate-500">Rows</p>
                  <p className="text-lg font-semibold">{preview.totalRows}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-slate-500">Ready</p>
                  <p className="text-lg font-semibold text-green-700">{importableRows.length}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-slate-500">Duplicates</p>
                  <p className="text-lg font-semibold text-amber-700">{preview.duplicateRows}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-slate-500">Errors</p>
                  <p className="text-lg font-semibold text-red-700">{preview.errorRows}</p>
                </div>
              </div>

              {preview.totalRows >= preview.maxRows && (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <AlertCircle className="mt-0.5 h-4 w-4" />
                  The preview is capped at {preview.maxRows} rows. Split larger files into smaller imports.
                </div>
              )}

              <div className="overflow-hidden rounded-lg border">
                <div className="max-h-80 overflow-auto">
                  <table className="w-full min-w-[820px] text-left text-sm">
                    <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Row</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Title</th>
                        <th className="px-3 py-2">Category</th>
                        <th className="px-3 py-2">Risk</th>
                        <th className="px-3 py-2">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {preview.rows.map((row) => {
                        const hasErrors = row.errors.length > 0;
                        const isDuplicate = Boolean(row.duplicate);
                        return (
                          <tr key={`${row.sourceSheet || 'sheet'}-${row.rowNumber}`} className="bg-white">
                            <td className="px-3 py-2 text-slate-500">{row.rowNumber}</td>
                            <td className="px-3 py-2">
                              <Badge
                                variant="outline"
                                className={cn(
                                  hasErrors && 'border-red-200 bg-red-50 text-red-700',
                                  isDuplicate && !hasErrors && 'border-amber-200 bg-amber-50 text-amber-700',
                                  !hasErrors && !isDuplicate && 'border-green-200 bg-green-50 text-green-700',
                                )}
                              >
                                {hasErrors ? 'Error' : isDuplicate ? 'Duplicate' : 'Ready'}
                              </Badge>
                            </td>
                            <td className="max-w-[260px] truncate px-3 py-2 font-medium text-slate-900">{row.title || 'Untitled row'}</td>
                            <td className="px-3 py-2 text-slate-600">{row.category || '-'}</td>
                            <td className="px-3 py-2 text-slate-600">{row.riskLevel}</td>
                            <td className="px-3 py-2 text-slate-600">
                              {[...row.errors, ...row.warnings].join('; ') || 'Ready to import'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {summary && (
            <div className="rounded-lg border bg-slate-50 p-4">
              <div className="flex items-center gap-2 font-medium text-slate-900">
                {summary.failedCount > 0 ? <AlertCircle className="h-4 w-4 text-amber-600" /> : <CheckCircle2 className="h-4 w-4 text-green-600" />}
                Import complete
              </div>
              <p className="mt-2 text-sm text-slate-600">
                {summary.createdCount} imported, {summary.skippedCount} skipped, {summary.failedCount} failed.
              </p>
              {(summary.skipped.length > 0 || summary.failed.length > 0) && (
                <div className="mt-3 space-y-1 text-xs text-slate-600">
                  {[...summary.skipped, ...summary.failed].slice(0, 6).map((issue) => (
                    <div key={`${issue.rowNumber}-${issue.title}`} className="flex items-start gap-2">
                      <XCircle className="mt-0.5 h-3.5 w-3.5 text-slate-400" />
                      <span>Row {issue.rowNumber}: {issue.title} - {issue.reason}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Close
          </Button>
          <Button onClick={importRows} disabled={!preview || importableRows.length === 0 || isImporting}>
            {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Import {importableRows.length || ''} Clauses
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}