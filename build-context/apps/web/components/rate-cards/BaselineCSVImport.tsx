'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, Download, AlertCircle, CheckCircle, FileText } from 'lucide-react';

interface ImportResult {
  imported: number;
  updated: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
  baselineIds: string[];
}

export function BaselineCSVImport() {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState({
    updateExisting: true,
    autoApprove: false,
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        setError('Please select a CSV file');
        return;
      }
      setFile(selectedFile);
      setError(null);
      setResult(null);
    }
  };

  const downloadTemplate = () => {
    const template = [
      'baselineName,baselineType,role,seniority,country,region,categoryL1,categoryL2,dailyRateUSD,currency,minimumRate,maximumRate,tolerancePercentage,source,sourceDetails,effectiveDate,expiryDate,notes',
      'Q1 2025 Software Engineer Target,TARGET_RATE,Software Engineer,SENIOR,United States,North America,IT Services,Software Development,800,USD,700,900,5,MARKET_RESEARCH,Industry Survey 2025,2025-01-01,,Target rate for senior software engineers',
      'Market Benchmark - Project Manager,MARKET_BENCHMARK,Project Manager,MID,United Kingdom,Europe,Professional Services,Project Management,650,USD,,,10,INDUSTRY_REPORT,PMI Report 2025,2025-01-01,2025-12-31,',
    ].join('\n');

    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'baseline-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseCSV = (text: string): any[] => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('CSV file must contain headers and at least one data row');
    }

    const headerLine = lines[0];
    if (!headerLine) throw new Error('No header line found');
    const headers = headerLine.split(',').map(h => h.trim());
    const baselines = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const values = line.split(',').map(v => v.trim());
      const baseline: any = {};

      headers.forEach((header, index) => {
        const value = values[index];
        if (value) {
          // Convert numeric fields
          if (['dailyRateUSD', 'minimumRate', 'maximumRate', 'tolerancePercentage'].includes(header)) {
            baseline[header] = parseFloat(value);
          } 
          // Convert date fields
          else if (['effectiveDate', 'expiryDate'].includes(header)) {
            baseline[header] = new Date(value);
          }
          // String fields
          else {
            baseline[header] = value;
          }
        }
      });

      baselines.push(baseline);
    }

    return baselines;
  };

  const handleImport = async () => {
    if (!file) {
      setError('Please select a file');
      return;
    }

    try {
      setImporting(true);
      setError(null);
      setResult(null);

      const text = await file.text();
      const baselines = parseCSV(text);

      const response = await fetch('/api/rate-cards/baselines/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baselines, options }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Import failed');
      }

      const importResult = await response.json();
      setResult(importResult);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to import baselines');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">Bulk Import Baselines</h2>
        <p className="text-gray-600 mb-6">
          Import multiple baseline rates from a CSV file. Download the template to see the required format.
        </p>

        {/* Template Download */}
        <div className="bg-violet-50 border border-violet-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-violet-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-violet-900 mb-1">CSV Template</h3>
              <p className="text-sm text-violet-700 mb-3">
                Download the template file to see the required format and example data.
              </p>
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </Button>
            </div>
          </div>
        </div>

        {/* Import Options */}
        <div className="space-y-4 mb-6">
          <h3 className="font-semibold">Import Options</h3>
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={options.updateExisting}
                onChange={(e) => setOptions({ ...options, updateExisting: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">Update existing baselines with same name</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={options.autoApprove}
                onChange={(e) => setOptions({ ...options, autoApprove: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">Auto-approve imported baselines</span>
            </label>
          </div>
        </div>

        {/* File Upload */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center mb-6">
          <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
            id="csv-upload"
          />
          <label htmlFor="csv-upload" className="cursor-pointer">
            <span className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
              Select CSV File
            </span>
          </label>
          {file && (
            <p className="mt-3 text-sm text-gray-600">
              Selected: <span className="font-medium">{file.name}</span>
            </p>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Import Button */}
        <Button
          onClick={handleImport}
          disabled={!file || importing}
          className="w-full"
        >
          {importing ? 'Importing...' : 'Import Baselines'}
        </Button>
      </div>

      {/* Results */}
      {result && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="h-6 w-6 text-green-500" />
            <h3 className="text-lg font-semibold">Import Complete</h3>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-600 mb-1">Imported</p>
              <p className="text-3xl font-bold text-green-700">{result.imported}</p>
            </div>
            <div className="bg-violet-50 border border-violet-200 rounded-lg p-4">
              <p className="text-sm text-violet-600 mb-1">Updated</p>
              <p className="text-3xl font-bold text-violet-700">{result.updated}</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-600 mb-1">Failed</p>
              <p className="text-3xl font-bold text-red-700">{result.failed}</p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div>
              <h4 className="font-semibold mb-3">Errors</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {result.errors.map((err, idx) => (
                  <div key={idx} className="bg-red-50 border border-red-200 rounded p-3">
                    <p className="text-sm">
                      <span className="font-medium">Row {err.row}:</span> {err.error}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.baselineIds.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-gray-600">
                Successfully imported {result.baselineIds.length} baseline(s).
                {!options.autoApprove && ' They are pending approval.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
