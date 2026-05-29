'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  Upload,
  FileSpreadsheet,
  FileText,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Download,
  RefreshCw,
  ChevronRight,
  Database,
  Map,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const REQUIRED_COLUMNS = ['contractTitle', 'effectiveDate', 'expirationDate'];
const OPTIONAL_COLUMNS = ['supplierName', 'clientName', 'contractType', 'totalValue', 'currency', 'paymentTerms', 'paymentFrequency', 'description', 'jurisdiction'];

const COLUMN_LABELS: Record<string, string> = {
  contractTitle: 'Contract Title',
  supplierName: 'Supplier / Vendor',
  clientName: 'Client / Customer',
  contractType: 'Contract Type',
  effectiveDate: 'Effective Date',
  expirationDate: 'Expiration Date',
  totalValue: 'Total Value',
  currency: 'Currency',
  paymentTerms: 'Payment Terms',
  paymentFrequency: 'Payment Frequency',
  description: 'Description',
  jurisdiction: 'Jurisdiction',
};

export default function ContractMigrationPage() {
  const [step, setStep] = useState<'upload' | 'mapping' | 'review' | 'complete'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[]>([]);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(async (selectedFile: File) => {
    if (!selectedFile.name.match(/\.(csv|xlsx|xls)$/i)) {
      toast.error('Please upload a CSV or Excel file');
      return;
    }
    setFile(selectedFile);
    setLoading(true);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await fetch('/api/contracts/migrate', { method: 'POST', body: formData });
      const json = await res.json();
      if (json.success) {
        if (json.data.stage === 'mapping') {
          setParsedHeaders(json.data.headers);
          setMapping(
            Object.fromEntries(
              Object.entries(json.data.mapping as Record<string, string | undefined>)
                .filter(([, v]) => v !== undefined)
            ) as Record<string, string>
          );
          setStep('mapping');
        } else {
          setResult(json.data);
          setStep('complete');
        }
      } else {
        toast.error(json.error || 'Failed to parse file');
      }
    } catch {
      toast.error('Upload failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFile(droppedFile);
  }, [handleFile]);

  const handleImport = useCallback(async () => {
    if (!file) return;
    setLoading(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('mapping', JSON.stringify(mapping));

    try {
      const res = await fetch('/api/contracts/migrate', { method: 'POST', body: formData });
      const json = await res.json();
      if (json.success) {
        setResult(json.data);
        setStep('complete');
        toast.success(`Imported ${json.data.imported} contracts`);
      } else {
        toast.error(json.error || 'Import failed');
      }
    } catch {
      toast.error('Import request failed');
    } finally {
      setLoading(false);
    }
  }, [file, mapping]);

  const downloadTemplate = () => {
    const headers = [
      'Contract Title', 'Supplier', 'Client', 'Contract Type',
      'Effective Date', 'Expiration Date', 'Total Value', 'Currency',
      'Payment Terms', 'Payment Frequency', 'Description', 'Jurisdiction',
    ];
    const csv = headers.join(',') + '\n' +
      'Sample Supply Agreement,Acme Corp,Stadler Rail,Supply Agreement,01.01.2024,31.12.2026,250000,CHF,Net 30,MONTHLY,Annual widget supply,Switzerland\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contract-migration-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const mappedCount = REQUIRED_COLUMNS.filter(f => mapping[f]).length;
  const mappingProgress = (mappedCount / REQUIRED_COLUMNS.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/30 to-purple-50/20">
      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Contract Migration</h1>
          <p className="text-slate-500 mt-2">
            Bulk import your existing contract portfolio from CSV or Excel.
          </p>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2 mb-8">
          {[
            { id: 'upload', label: 'Upload', icon: Upload },
            { id: 'mapping', label: 'Map Columns', icon: Map },
            { id: 'review', label: 'Review', icon: ShieldCheck },
            { id: 'complete', label: 'Complete', icon: CheckCircle2 },
          ].map((s, i) => {
            const Icon = s.icon;
            const isActive = step === s.id;
            const isPast = ['upload', 'mapping', 'review', 'complete'].indexOf(step) > i;
            return (
              <React.Fragment key={s.id}>
                {i > 0 && <ChevronRight className="h-4 w-4 text-slate-300" />}
                <div className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium',
                  isActive ? 'bg-violet-100 text-violet-700' :
                  isPast ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'
                )}>
                  <Icon className="h-3.5 w-3.5" />
                  {s.label}
                </div>
              </React.Fragment>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          {step === 'upload' && (
            <motion.div key="upload" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <Card>
                <CardContent className="p-8">
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    className={cn(
                      'border-2 border-dashed rounded-2xl p-12 text-center transition-colors',
                      dragOver ? 'border-violet-400 bg-violet-50' : 'border-slate-300 bg-slate-50/50'
                    )}
                  >
                    <div className="w-16 h-16 rounded-2xl bg-violet-100 flex items-center justify-center mx-auto mb-4">
                      <Upload className="h-8 w-8 text-violet-600" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Drop your file here</h3>
                    <p className="text-sm text-slate-500 mb-4">CSV or Excel up to 1000 rows</p>
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                      className="hidden"
                      id="migration-file"
                    />
                    <label htmlFor="migration-file">
                      <Button variant="outline" className="cursor-pointer" asChild>
                        <span>Select File</span>
                      </Button>
                    </label>
                  </div>

                  <div className="mt-6 flex items-center justify-center gap-4">
                    <Button variant="ghost" size="sm" onClick={downloadTemplate}>
                      <Download className="h-4 w-4 mr-2" />
                      Download Template
                    </Button>
                  </div>

                  <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-slate-50 border">
                      <Database className="h-5 w-5 text-violet-600 mb-2" />
                      <p className="text-sm font-medium">Bulk Import</p>
                      <p className="text-xs text-slate-500 mt-1">Up to 1,000 contracts in a single upload</p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 border">
                      <Map className="h-5 w-5 text-violet-600 mb-2" />
                      <p className="text-sm font-medium">Smart Mapping</p>
                      <p className="text-xs text-slate-500 mt-1">Auto-detects columns from any header format</p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 border">
                      <ShieldCheck className="h-5 w-5 text-violet-600 mb-2" />
                      <p className="text-sm font-medium">Validation</p>
                      <p className="text-xs text-slate-500 mt-1">Date, value, and required field checks</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {step === 'mapping' && (
            <motion.div key="mapping" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Map className="h-5 w-5 text-violet-600" />
                    Map Columns
                  </CardTitle>
                  <CardDescription>
                    Match your spreadsheet columns to contract fields. Required fields must be mapped.
                  </CardDescription>
                  <Progress value={mappingProgress} className="mt-2" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-slate-700">Required Fields</p>
                    {REQUIRED_COLUMNS.map(field => (
                      <div key={field} className="flex items-center gap-3">
                        <label className="w-40 text-sm text-slate-600">{COLUMN_LABELS[field]}</label>
                        <select
                          value={mapping[field] || ''}
                          onChange={(e) => setMapping(prev => ({ ...prev, [field]: e.target.value }))}
                          className="flex-1 h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
                        >
                          <option value="">-- Select column --</option>
                          {parsedHeaders.map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                        {mapping[field] ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3 pt-4 border-t">
                    <p className="text-sm font-medium text-slate-700">Optional Fields</p>
                    {OPTIONAL_COLUMNS.map(field => (
                      <div key={field} className="flex items-center gap-3">
                        <label className="w-40 text-sm text-slate-500">{COLUMN_LABELS[field]}</label>
                        <select
                          value={mapping[field] || ''}
                          onChange={(e) => setMapping(prev => ({ ...prev, [field]: e.target.value }))}
                          className="flex-1 h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
                        >
                          <option value="">-- Select column --</option>
                          {parsedHeaders.map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                        {mapping[field] && <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4">
                    <Button variant="outline" onClick={() => setStep('upload')}>
                      Back
                    </Button>
                    <Button
                      onClick={handleImport}
                      disabled={mappedCount < REQUIRED_COLUMNS.length || loading}
                    >
                      {loading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <ArrowRight className="h-4 w-4 mr-2" />}
                      Import Contracts
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {step === 'complete' && result && (
            <motion.div key="complete" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    Migration Complete
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-center">
                      <p className="text-3xl font-bold text-green-700">{result.imported}</p>
                      <p className="text-sm text-green-600 mt-1">Imported</p>
                    </div>
                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-center">
                      <p className="text-3xl font-bold text-amber-700">{result.skipped}</p>
                      <p className="text-sm text-amber-600 mt-1">Skipped</p>
                    </div>
                    <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-center">
                      <p className="text-3xl font-bold text-red-700">{result.errors}</p>
                      <p className="text-sm text-red-600 mt-1">Errors</p>
                    </div>
                  </div>

                  {result.validationErrors?.length > 0 && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                      <p className="text-sm font-medium text-red-700 mb-2 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Validation Issues
                      </p>
                      <ul className="text-xs text-red-600 space-y-1 max-h-40 overflow-auto">
                        {result.validationErrors.map((err: string, i: number) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {result.importedContracts?.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-slate-700 mb-2">Imported Contracts</p>
                      <div className="max-h-60 overflow-auto rounded-xl border divide-y">
                        {result.importedContracts.map((c: any) => (
                          <Link
                            key={c.id}
                            href={`/contracts/${c.id}`}
                            className="flex items-center gap-3 p-3 hover:bg-slate-50 text-sm"
                          >
                            <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                            <span className="flex-1 truncate">{c.title}</span>
                            <ArrowRight className="h-3 w-3 text-slate-400" />
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-3">
                    <Button variant="outline" onClick={() => {
                      setStep('upload');
                      setFile(null);
                      setResult(null);
                      setMapping({});
                    }}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Import Another File
                    </Button>
                    <Link href="/contracts">
                      <Button>View Contracts</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
