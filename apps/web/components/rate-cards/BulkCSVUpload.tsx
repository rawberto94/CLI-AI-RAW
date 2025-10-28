'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  Upload, 
  Download, 
  FileSpreadsheet, 
  AlertCircle, 
  CheckCircle2,
  Loader2,
  X
} from 'lucide-react';
import { useToast } from '@/components/ui/toast-provider';

interface CSVUploadResult {
  success: boolean;
  summary: {
    total: number;
    valid: number;
    invalid: number;
    imported: number;
    errorCount: number;
    warningCount: number;
  };
  errors: Array<{
    row: number;
    data: any;
    errors: string[];
  }>;
  warnings: Array<{
    row: number;
    field: string;
    message: string;
  }>;
}

interface BulkCSVUploadProps {
  onSuccess?: () => void;
  tenantId?: string;
}

export function BulkCSVUpload({ onSuccess, tenantId = 'demo' }: BulkCSVUploadProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<CSVUploadResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { success, error, warning, info } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        error('Invalid File', 'Please select a CSV file');
        return;
      }
      setFile(selectedFile);
      setResult(null);
    }
  };

  const parseCSV = (text: string): any[] => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row: any = {};
      
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });

      data.push(row);
    }

    return data;
  };

  const handleValidate = async () => {
    if (!file) return;

    setValidating(true);
    try {
      const text = await file.text();
      const csvData = parseCSV(text);

      const response = await fetch('/api/rate-cards/import/csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          data: csvData,
          validateOnly: true,
        }),
      });

      const result: CSVUploadResult = await response.json();
      setResult(result);

      if (result.summary.invalid === 0) {
        success('Validation Passed', `All ${result.summary.valid} rows are valid and ready to import`);
      } else {
        warning('Validation Issues', `Found ${result.summary.invalid} invalid rows. Please review.`);
      }
    } catch (err) {
      error('Validation Error', 'Failed to validate CSV file');
    } finally {
      setValidating(false);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setLoading(true);
    try {
      const text = await file.text();
      const csvData = parseCSV(text);

      const response = await fetch('/api/rate-cards/import/csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          data: csvData,
          validateOnly: false,
        }),
      });

      const result: CSVUploadResult = await response.json();
      setResult(result);

      if (result.success) {
        success('Import Successful', `Successfully imported ${result.summary.imported} rate card entries`);
        onSuccess?.();
        // Reset after short delay
        setTimeout(() => {
          setOpen(false);
          setFile(null);
          setResult(null);
        }, 2000);
      } else {
        warning('Import Failed', `Import completed with errors. ${result.summary.imported} imported, ${result.summary.invalid} failed.`);
      }
    } catch (err) {
      error('Import Error', 'Failed to import CSV file');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch('/api/rate-cards/import/csv/template');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'rate-cards-template.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      error('Download Error', 'Failed to download template');
    }
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="mr-2 h-4 w-4" />
          Bulk CSV Upload
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk CSV Upload</DialogTitle>
          <DialogDescription>
            Import multiple rate card entries from a CSV file
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Download Template */}
          <Alert>
            <FileSpreadsheet className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>Need a template? Download our CSV template to get started.</span>
              <Button 
                variant="link" 
                size="sm" 
                onClick={handleDownloadTemplate}
                className="h-auto p-0"
              >
                <Download className="mr-2 h-3 w-3" />
                Download Template
              </Button>
            </AlertDescription>
          </Alert>

          {/* File Upload */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
              id="csv-upload"
            />
            {!file ? (
              <label htmlFor="csv-upload" className="cursor-pointer">
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-600">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-gray-500 mt-1">CSV files only</p>
              </label>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2">
                  <FileSpreadsheet className="h-8 w-8 text-green-600" />
                  <div className="text-left">
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-gray-500">
                      {(file.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleReset}
                    className="ml-4"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="flex gap-2 justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleValidate}
                    disabled={validating || loading}
                  >
                    {validating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Validate
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleImport}
                    disabled={loading || validating || (result && result.summary.invalid > 0)}
                  >
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Import
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Validation/Import Results */}
          {result && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-xs text-blue-600 font-medium">Total Rows</p>
                  <p className="text-2xl font-bold text-blue-900">{result.summary.total}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-xs text-green-600 font-medium">Valid</p>
                  <p className="text-2xl font-bold text-green-900">{result.summary.valid}</p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <p className="text-xs text-red-600 font-medium">Invalid</p>
                  <p className="text-2xl font-bold text-red-900">{result.summary.invalid}</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <p className="text-xs text-purple-600 font-medium">Imported</p>
                  <p className="text-2xl font-bold text-purple-900">{result.summary.imported}</p>
                </div>
              </div>

              {/* Progress */}
              {result.summary.total > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Success Rate</span>
                    <span className="font-medium">
                      {((result.summary.valid / result.summary.total) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <Progress 
                    value={(result.summary.valid / result.summary.total) * 100} 
                    className="h-2"
                  />
                </div>
              )}

              {/* Errors */}
              {result.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-medium mb-2">Errors Found ({result.errors.length}):</p>
                    <div className="max-h-40 overflow-y-auto space-y-2 text-sm">
                      {result.errors.slice(0, 5).map((error, idx) => (
                        <div key={idx} className="bg-red-50 p-2 rounded">
                          <p className="font-medium">Row {error.row}:</p>
                          <ul className="list-disc list-inside pl-2">
                            {error.errors.map((err, i) => (
                              <li key={i}>{err}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                      {result.errors.length > 5 && (
                        <p className="text-xs">...and {result.errors.length - 5} more errors</p>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Warnings */}
              {result.warnings.length > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-medium mb-2">Warnings ({result.warnings.length}):</p>
                    <div className="max-h-32 overflow-y-auto space-y-1 text-sm">
                      {result.warnings.slice(0, 3).map((warning, idx) => (
                        <div key={idx}>
                          Row {warning.row}: {warning.message}
                        </div>
                      ))}
                      {result.warnings.length > 3 && (
                        <p className="text-xs">...and {result.warnings.length - 3} more warnings</p>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Success Message */}
              {result.success && result.summary.imported > 0 && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    Successfully imported {result.summary.imported} rate card entries!
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
