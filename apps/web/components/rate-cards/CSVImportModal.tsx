'use client';

/**
 * CSV Import Modal
 * Upload, preview, and import rate cards from CSV
 */

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, Download, AlertCircle, CheckCircle, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface CSVImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CSVImportModal({ isOpen, onClose, onSuccess }: CSVImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setParseResult(null);
    }
  };

  const handleParse = async () => {
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/rate-cards/import/parse', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to parse CSV');
      }

      const result = await response.json();
      setParseResult(result);
      toast.success(`Parsed ${result.summary.totalRows} rows`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to parse CSV');
    } finally {
      setIsUploading(false);
    }
  };

  const handleImport = async () => {
    if (!parseResult) return;

    setIsImporting(true);
    try {
      const response = await fetch('/api/rate-cards/import/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': 'default-tenant',
          'x-user-id': 'current-user',
        },
        body: JSON.stringify({
          rows: parseResult.parseResult.rows.filter((r: any) => r.isValid),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to import');
      }

      const result = await response.json();
      toast.success(result.message);
      onSuccess?.();
      onClose();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to import');
    } finally {
      setIsImporting(false);
    }
  };

  const downloadTemplate = () => {
    window.open('/api/rate-cards/template', '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[1600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Rate Cards from CSV</DialogTitle>
        </DialogHeader>

        {!parseResult ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-violet-50 rounded-lg">
              <div>
                <p className="font-semibold">Need a template?</p>
                <p className="text-sm text-gray-600">Download our CSV template with examples</p>
              </div>
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="w-4 h-4 mr-2" />
                Download Template
              </Button>
            </div>

            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <input
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
                id="csv-upload"
              />
              <label htmlFor="csv-upload">
                <Button variant="outline" type="button">
                  Select CSV File
                </Button>
              </label>
              {file && (
                <p className="mt-2 text-sm text-gray-600">
                  Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
                </p>
              )}
            </div>

            {file && (
              <Button onClick={handleParse} disabled={isUploading} className="w-full">
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Parsing...
                  </>
                ) : (
                  'Parse and Validate'
                )}
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <div className="text-sm text-gray-600">Total Rows</div>
                <div className="text-2xl font-bold">{parseResult.summary.totalRows}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Valid</div>
                <div className="text-2xl font-bold text-green-600">
                  {parseResult.summary.validRows}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Invalid</div>
                <div className="text-2xl font-bold text-red-600">
                  {parseResult.summary.invalidRows}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Warnings</div>
                <div className="text-2xl font-bold text-yellow-600">
                  {parseResult.summary.warningRows}
                </div>
              </div>
            </div>

            {parseResult.importValidation.blockingErrors.length > 0 && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <span className="font-semibold text-red-900">Cannot Import</span>
                </div>
                <ul className="list-disc list-inside space-y-1">
                  {parseResult.importValidation.blockingErrors.map((error: string, idx: number) => (
                    <li key={idx} className="text-sm text-red-700">{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {parseResult.importValidation.warnings.length > 0 && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                  <span className="font-semibold text-yellow-900">Warnings</span>
                </div>
                <ul className="list-disc list-inside space-y-1">
                  {parseResult.importValidation.warnings.map((warning: string, idx: number) => (
                    <li key={idx} className="text-sm text-yellow-700">{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="px-2 py-2 text-left">Row</th>
                    <th className="px-2 py-2 text-left">Supplier</th>
                    <th className="px-2 py-2 text-left">Role</th>
                    <th className="px-2 py-2 text-left">Rate</th>
                    <th className="px-2 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {parseResult.parseResult.rows.map((row: any, idx: number) => (
                    <tr key={idx} className={row.isValid ? '' : 'bg-red-50'}>
                      <td className="px-2 py-2">{row.rowNumber}</td>
                      <td className="px-2 py-2">{row.data.supplierName}</td>
                      <td className="px-2 py-2">{row.data.roleStandardized || row.data.roleOriginal}</td>
                      <td className="px-2 py-2">{row.data.dailyRate} {row.data.currency}</td>
                      <td className="px-2 py-2">
                        {row.isValid ? (
                          <Badge className="bg-green-500">Valid</Badge>
                        ) : (
                          <Badge className="bg-red-500">
                            {row.errors.length} error(s)
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between pt-4 border-t">
              <Button variant="outline" onClick={() => setParseResult(null)}>
                Upload Different File
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={!parseResult.importValidation.canImport || isImporting}
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Import {parseResult.summary.validRows} Rate Cards
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
