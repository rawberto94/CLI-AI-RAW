/**
 * Bulk Import Dialog
 * Import multiple rate cards from CSV/Excel with multi-currency support
 */

'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, Download, CheckCircle, XCircle, AlertCircle, FileSpreadsheet } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCurrencyConverter } from '@/lib/services/currency.service';

interface ImportResult {
  success: number;
  failed: number;
  errors: Array<{
    row: number;
    field: string;
    message: string;
  }>;
}

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: () => void;
}

export function BulkImportDialog({ open, onOpenChange, onImportComplete }: BulkImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const { convert } = useCurrencyConverter();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const extension = selectedFile.name.split('.').pop()?.toLowerCase();
      if (!['csv', 'xlsx', 'xls'].includes(extension || '')) {
        toast.error('Please select a CSV or Excel file');
        return;
      }
      setFile(selectedFile);
      setResult(null);
    }
  };

  const downloadTemplate = () => {
    const template = `Supplier Name,Role Name,Seniority,Daily Rate,Currency,Location,Skills,Start Date,End Date,Notes
Acme Consulting,Senior Developer,SENIOR,850,USD,US,"React,Node.js,AWS",2024-01-01,2024-12-31,
Tech Solutions Inc,Principal Architect,PRINCIPAL,1200,EUR,DE,"Python,Azure,Docker",2024-01-01,2024-12-31,
Global IT Partners,Mid-Level Developer,MID,600,GBP,GB,"JavaScript,Vue,PostgreSQL",2024-01-01,2024-12-31,`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rate_card_import_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Template downloaded');
  };

  const parseCSV = (text: string): any[] => {
    const lines = text.split('\n');
    const headers = lines[0].split(',').map((h) => h.trim());

    const records = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(',');
      const record: any = {};

      headers.forEach((header, index) => {
        record[header] = values[index]?.trim() || '';
      });

      records.push(record);
    }

    return records;
  };

  const validateRecord = (record: any, rowNumber: number): string[] => {
    const errors: string[] = [];

    if (!record['Supplier Name']) {
      errors.push(`Row ${rowNumber}: Supplier Name is required`);
    }

    if (!record['Role Name']) {
      errors.push(`Row ${rowNumber}: Role Name is required`);
    }

    if (!record['Seniority']) {
      errors.push(`Row ${rowNumber}: Seniority is required`);
    } else if (!['JUNIOR', 'MID', 'SENIOR', 'PRINCIPAL', 'LEAD'].includes(record['Seniority'])) {
      errors.push(`Row ${rowNumber}: Invalid seniority level`);
    }

    if (!record['Daily Rate']) {
      errors.push(`Row ${rowNumber}: Daily Rate is required`);
    } else if (isNaN(Number(record['Daily Rate']))) {
      errors.push(`Row ${rowNumber}: Daily Rate must be a number`);
    }

    if (!record['Currency']) {
      errors.push(`Row ${rowNumber}: Currency is required`);
    } else if (!['USD', 'EUR', 'GBP', 'CHF'].includes(record['Currency'])) {
      errors.push(`Row ${rowNumber}: Currency must be USD, EUR, GBP, or CHF`);
    }

    return errors;
  };

  const handleImport = async () => {
    if (!file) {
      toast.error('Please select a file');
      return;
    }

    setIsProcessing(true);
    setResult(null);

    try {
      const text = await file.text();
      const records = parseCSV(text);

      if (records.length === 0) {
        toast.error('No records found in file');
        setIsProcessing(false);
        return;
      }

      // Validate all records
      const allErrors: Array<{ row: number; field: string; message: string }> = [];
      records.forEach((record, index) => {
        const errors = validateRecord(record, index + 2); // +2 for header row and 1-based index
        errors.forEach((error) => {
          allErrors.push({
            row: index + 2,
            field: 'validation',
            message: error,
          });
        });
      });

      if (allErrors.length > 0) {
        setResult({
          success: 0,
          failed: records.length,
          errors: allErrors.slice(0, 10), // Show first 10 errors
        });
        setIsProcessing(false);
        return;
      }

      // Process records
      const processedRecords = await Promise.all(
        records.map(async (record) => {
          // Convert to USD for storage
          const dailyRate = Number(record['Daily Rate']);
          const currency = record['Currency'];
          
          let rateInUSD = dailyRate;
          if (currency !== 'USD') {
            try {
              const conversion = await convert(dailyRate, currency, 'USD');
              rateInUSD = conversion.convertedAmount;
            } catch (error) {
              console.error('Currency conversion failed:', error);
            }
          }

          return {
            supplierName: record['Supplier Name'],
            roleName: record['Role Name'],
            seniority: record['Seniority'],
            dailyRate: rateInUSD,
            originalRate: dailyRate,
            currency,
            location: record['Location'] || '',
            skills: record['Skills'] ? record['Skills'].split(';').map((s: string) => s.trim()) : [],
            startDate: record['Start Date'] || null,
            endDate: record['End Date'] || null,
            notes: record['Notes'] || '',
          };
        })
      );

      // Send to API
      const response = await fetch('/api/rate-cards/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: processedRecords }),
      });

      if (!response.ok) {
        throw new Error('Import failed');
      }

      const importResult = await response.json();

      setResult({
        success: importResult.success || processedRecords.length,
        failed: importResult.failed || 0,
        errors: importResult.errors || [],
      });

      if (importResult.success > 0) {
        toast.success(`Successfully imported ${importResult.success} rate cards`);
        onImportComplete?.();
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Failed to import rate cards');
      setResult({
        success: 0,
        failed: 1,
        errors: [{ row: 0, field: 'system', message: error instanceof Error ? error.message : 'Unknown error' }],
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Bulk Import Rate Cards
          </DialogTitle>
          <DialogDescription>
            Import multiple rate cards from CSV or Excel file with multi-currency support
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template Download */}
          <div className="border rounded-lg p-4 bg-blue-50">
            <div className="flex items-start gap-3">
              <FileSpreadsheet className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-blue-900">Download Template</h4>
                <p className="text-sm text-blue-700 mt-1">
                  Start with our template to ensure your data is formatted correctly
                </p>
                <Button variant="outline" size="sm" onClick={downloadTemplate} className="mt-2">
                  <Download className="h-4 w-4 mr-2" />
                  Download CSV Template
                </Button>
              </div>
            </div>
          </div>

          {/* File Upload */}
          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            {file ? (
              <div>
                <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-2" />
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {(file.size / 1024).toFixed(2)} KB
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFile(null)}
                  className="mt-4"
                >
                  Choose Different File
                </Button>
              </div>
            ) : (
              <div>
                <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                <p className="font-medium">Select a file to upload</p>
                <p className="text-sm text-muted-foreground mt-1">
                  CSV or Excel file (.csv, .xlsx, .xls)
                </p>
                <label htmlFor="file-upload" className="inline-block mt-4">
                  <Button variant="outline" size="sm" asChild>
                    <span>Choose File</span>
                  </Button>
                </label>
                <input
                  id="file-upload"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            )}
          </div>

          {/* Import Results */}
          {result && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="border rounded-lg p-3 bg-green-50">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="text-sm font-medium text-green-900">Successful</p>
                      <p className="text-2xl font-bold text-green-600">{result.success}</p>
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg p-3 bg-red-50">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-red-600" />
                    <div>
                      <p className="text-sm font-medium text-red-900">Failed</p>
                      <p className="text-2xl font-bold text-red-600">{result.failed}</p>
                    </div>
                  </div>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="border rounded-lg p-4 bg-amber-50">
                  <div className="flex items-start gap-2 mb-2">
                    <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                    <h4 className="font-medium text-amber-900">Errors</h4>
                  </div>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {result.errors.map((error, index) => (
                      <p key={index} className="text-sm text-amber-800">
                        • {error.message}
                      </p>
                    ))}
                    {result.failed > 10 && (
                      <p className="text-sm text-amber-700 italic mt-2">
                        ... and {result.failed - 10} more errors
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={!file || isProcessing}
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import Rate Cards
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
