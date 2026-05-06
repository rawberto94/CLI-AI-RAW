/**
 * Export Manager Component
 * Configure and manage contract exports
 */

'use client';

import { memo, useState } from 'react';
import { 
  Download, 
  FileText, 
  FileSpreadsheet, 
  File,
  Loader2,
  CheckCircle2,
  Filter,
  Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DatePickerWithRange, DateRange } from '@/components/ui/date-range-picker';
import { toast } from 'sonner';
import { unwrapApiResponseData } from '@/lib/api-fetch';

interface ExportConfig {
  format: 'csv' | 'xlsx' | 'json' | 'pdf';
  includeFields: string[];
  filters: {
    status?: string[];
    dateRange?: DateRange;
    contractTypes?: string[];
  };
}

interface ExportManagerProps {
  contractIds?: string[];
  className?: string;
  onExportComplete?: (downloadUrl: string) => void;
}

const formatOptions = [
  { value: 'csv', label: 'CSV', icon: FileSpreadsheet, description: 'Comma-separated values for spreadsheets' },
  { value: 'xlsx', label: 'Excel', icon: FileSpreadsheet, description: 'Microsoft Excel format' },
  { value: 'json', label: 'JSON', icon: File, description: 'Structured data format for developers' },
  { value: 'pdf', label: 'PDF Report', icon: FileText, description: 'Formatted PDF report with summaries' },
];

const fieldOptions = [
  { value: 'name', label: 'Contract Name', group: 'basic' },
  { value: 'status', label: 'Status', group: 'basic' },
  { value: 'type', label: 'Contract Type', group: 'basic' },
  { value: 'supplier', label: 'Supplier', group: 'basic' },
  { value: 'value', label: 'Contract Value', group: 'financial' },
  { value: 'startDate', label: 'Start Date', group: 'dates' },
  { value: 'endDate', label: 'End Date', group: 'dates' },
  { value: 'createdAt', label: 'Created Date', group: 'dates' },
  { value: 'riskLevel', label: 'Risk Level', group: 'analysis' },
  { value: 'complianceStatus', label: 'Compliance Status', group: 'analysis' },
  { value: 'keyTerms', label: 'Key Terms', group: 'analysis' },
  { value: 'parties', label: 'Parties', group: 'details' },
  { value: 'summary', label: 'AI Summary', group: 'artifacts' },
  { value: 'artifacts', label: 'All Artifacts', group: 'artifacts' },
];

const statusOptions = [
  'completed', 'processing', 'pending', 'failed', 'archived'
];

const contractTypeOptions = [
  'MSA', 'NDA', 'SOW', 'Amendment', 'Renewal', 'Purchase Order', 'License', 'Other'
];

export const ExportManager = memo(function ExportManager({
  contractIds,
  className,
  onExportComplete,
}: ExportManagerProps) {
  const [config, setConfig] = useState<ExportConfig>({
    format: 'csv',
    includeFields: ['name', 'status', 'type', 'supplier', 'value', 'startDate', 'endDate'],
    filters: {},
  });
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exportResult, setExportResult] = useState<{ url: string; count: number } | null>(null);

  const handleExport = async () => {
    setExporting(true);
    setProgress(0);
    setExportResult(null);

    try {
      // Simulate progress
      for (let i = 0; i <= 80; i += 10) {
        await new Promise(r => setTimeout(r, 200));
        setProgress(i);
      }

      const response = await fetch('/api/contracts/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...config,
          contractIds,
        }),
      });

      if (response.ok) {
        const data = unwrapApiResponseData<{ downloadUrl: string; count: number }>(await response.json());
        setExportResult({ url: data.downloadUrl, count: data.count });
        toast.success(`Export complete: ${data.count} contracts`);
        onExportComplete?.(data.downloadUrl);
      } else {
        toast.error('Export service unavailable');
      }

      setProgress(100);
    } catch (error) {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const toggleField = (field: string) => {
    setConfig(prev => ({
      ...prev,
      includeFields: prev.includeFields.includes(field)
        ? prev.includeFields.filter(f => f !== field)
        : [...prev.includeFields, field],
    }));
  };

  const selectAllFields = () => {
    setConfig(prev => ({
      ...prev,
      includeFields: fieldOptions.map(f => f.value),
    }));
  };

  const selectNoneFields = () => {
    setConfig(prev => ({
      ...prev,
      includeFields: [],
    }));
  };

  const groupedFields = fieldOptions.reduce((acc, field) => {
    const group = acc[field.group] || [];
    group.push(field);
    acc[field.group] = group;
    return acc;
  }, {} as Record<string, typeof fieldOptions>);

  const groupLabels: Record<string, string> = {
    basic: 'Basic Information',
    financial: 'Financial',
    dates: 'Dates',
    analysis: 'Analysis',
    details: 'Details',
    artifacts: 'AI Artifacts',
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5 text-green-600" />
          Export Contracts
        </CardTitle>
        <CardDescription>
          {contractIds 
            ? `Export ${contractIds.length} selected contracts` 
            : 'Export all contracts matching your filters'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Format Selection */}
        <div className="space-y-3">
          <Label className="text-base font-semibold">Export Format</Label>
          <div className="grid grid-cols-4 gap-3">
            {formatOptions.map(format => {
              const Icon = format.icon;
              return (
                <button
                  key={format.value}
                  onClick={() => setConfig(prev => ({ ...prev, format: format.value as ExportConfig['format'] }))}
                  className={cn(
                    'p-4 rounded-xl border-2 text-left transition-all',
                    config.format === format.value
                      ? 'border-violet-500 bg-violet-50'
                      : 'border-slate-200 hover:border-slate-300'
                  )}
                >
                  <Icon className={cn(
                    'h-6 w-6 mb-2',
                    config.format === format.value ? 'text-violet-600' : 'text-slate-400'
                  )} />
                  <p className="font-medium text-sm">{format.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{format.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Field Selection */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">Include Fields</Label>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={selectAllFields}>
                Select All
              </Button>
              <Button variant="ghost" size="sm" onClick={selectNoneFields}>
                Clear
              </Button>
            </div>
          </div>
          <div className="space-y-4 border rounded-lg p-4 max-h-64 overflow-y-auto">
            {Object.entries(groupedFields).map(([group, fields]) => (
              <div key={group}>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                  {groupLabels[group]}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {fields.map(field => (
                    <label
                      key={field.value}
                      className="flex items-center gap-2 p-2 rounded hover:bg-slate-50 cursor-pointer"
                    >
                      <Checkbox
                        checked={config.includeFields.includes(field.value)}
                        onCheckedChange={() => toggleField(field.value)}
                      />
                      <span className="text-sm">{field.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            {config.includeFields.length} of {fieldOptions.length} fields selected
          </p>
        </div>

        {/* Filters (only if no specific contracts selected) */}
        {!contractIds && (
          <div className="space-y-3">
            <Label className="text-base font-semibold flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filter Contracts
            </Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={config.filters.status?.[0] || 'all'}
                  onValueChange={(value) => setConfig(prev => ({
                    ...prev,
                    filters: { 
                      ...prev.filters, 
                      status: value === 'all' ? undefined : [value] 
                    },
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {statusOptions.map(status => (
                      <SelectItem key={status} value={status} className="capitalize">
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Contract Type</Label>
                <Select
                  value={config.filters.contractTypes?.[0] || 'all'}
                  onValueChange={(value) => setConfig(prev => ({
                    ...prev,
                    filters: { 
                      ...prev.filters, 
                      contractTypes: value === 'all' ? undefined : [value] 
                    },
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {contractTypeOptions.map(type => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* Export Progress/Result */}
        {(exporting || exportResult) && (
          <div className="p-4 rounded-lg bg-slate-50 border">
            {exporting ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
                  <span className="font-medium">Exporting contracts...</span>
                </div>
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-slate-500">{progress}% complete</p>
              </div>
            ) : exportResult ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium">Export Complete</p>
                    <p className="text-sm text-slate-500">
                      {exportResult.count} contracts exported as {config.format.toUpperCase()}
                    </p>
                  </div>
                </div>
                <Button onClick={() => window.open(exportResult.url, '_blank', 'noopener,noreferrer')} className="gap-2">
                  <Download className="h-4 w-4" />
                  Download
                </Button>
              </div>
            ) : null}
          </div>
        )}

        {/* Export Button */}
        <Button 
          onClick={handleExport} 
          disabled={exporting || config.includeFields.length === 0}
          className="w-full gap-2"
          size="lg"
        >
          {exporting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Export {contractIds ? `${contractIds.length} Contracts` : 'Contracts'}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
});
