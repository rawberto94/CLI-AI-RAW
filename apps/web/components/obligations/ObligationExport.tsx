'use client';

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Download,
  FileSpreadsheet,
  FileJson,
  FileText,
  Loader2,
  Columns,
  Settings2,
} from 'lucide-react';

interface ExportOptions {
  format: 'csv' | 'json' | 'xlsx';
  includeFields: string[];
  filters: {
    status?: string;
    priority?: string;
    type?: string;
    dateFrom?: string;
    dateTo?: string;
  };
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  includeCompleted: boolean;
  groupBy?: string;
}

interface ObligationExportProps {
  filters?: Record<string, string>;
  selectedIds?: string[];
  totalCount?: number;
  compact?: boolean;
}

const availableFields = [
  { id: 'title', label: 'Title', default: true },
  { id: 'description', label: 'Description', default: true },
  { id: 'status', label: 'Status', default: true },
  { id: 'priority', label: 'Priority', default: true },
  { id: 'type', label: 'Type', default: true },
  { id: 'owner', label: 'Owner', default: true },
  { id: 'dueDate', label: 'Due Date', default: true },
  { id: 'contractTitle', label: 'Contract', default: true },
  { id: 'contractId', label: 'Contract ID', default: false },
  { id: 'clauseReference', label: 'Clause Reference', default: false },
  { id: 'sourceExcerpt', label: 'Source Excerpt', default: false },
  { id: 'riskScore', label: 'Risk Score', default: false },
  { id: 'financialImpact', label: 'Financial Impact', default: false },
  { id: 'completedAt', label: 'Completed Date', default: true },
  { id: 'completedBy', label: 'Completed By', default: false },
  { id: 'assignedTo', label: 'Assigned To', default: true },
  { id: 'tags', label: 'Tags', default: false },
  { id: 'createdAt', label: 'Created Date', default: false },
  { id: 'updatedAt', label: 'Last Updated', default: false },
];

const defaultExportOptions: ExportOptions = {
  format: 'csv',
  includeFields: availableFields.filter((f) => f.default).map((f) => f.id),
  filters: {},
  sortBy: 'dueDate',
  sortOrder: 'asc',
  includeCompleted: true,
};

export function ObligationExport({
  filters = {},
  selectedIds = [],
  totalCount = 0,
  compact = false,
}: ObligationExportProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [options, setOptions] = useState<ExportOptions>(defaultExportOptions);
  const [exporting, setExporting] = useState(false);

  const handleFieldToggle = (fieldId: string) => {
    setOptions((prev) => ({
      ...prev,
      includeFields: prev.includeFields.includes(fieldId)
        ? prev.includeFields.filter((f) => f !== fieldId)
        : [...prev.includeFields, fieldId],
    }));
  };

  const selectAllFields = () => {
    setOptions((prev) => ({
      ...prev,
      includeFields: availableFields.map((f) => f.id),
    }));
  };

  const selectDefaultFields = () => {
    setOptions((prev) => ({
      ...prev,
      includeFields: availableFields.filter((f) => f.default).map((f) => f.id),
    }));
  };

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      params.set('format', options.format);
      params.set('fields', options.includeFields.join(','));
      params.set('sortBy', options.sortBy);
      params.set('sortOrder', options.sortOrder);
      
      if (!options.includeCompleted) {
        params.set('excludeCompleted', 'true');
      }

      // Apply current filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all') {
          params.set(key, value);
        }
      });

      // If specific IDs are selected, include them
      if (selectedIds.length > 0) {
        params.set('ids', selectedIds.join(','));
      }

      const response = await fetch(`/api/obligations/v2/export?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Get filename from Content-Disposition header if available
      const disposition = response.headers.get('Content-Disposition');
      let filename = `obligations-export.${options.format}`;
      if (disposition) {
        const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast.success('Export completed successfully');
      setShowDialog(false);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export obligations');
    } finally {
      setExporting(false);
    }
  }, [options, filters, selectedIds]);

  const formatIcons = {
    csv: <FileSpreadsheet className="h-5 w-5" />,
    json: <FileJson className="h-5 w-5" />,
    xlsx: <FileSpreadsheet className="h-5 w-5" />,
  };

  // Compact button only
  if (compact) {
    return (
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <ExportDialogContent
            options={options}
            setOptions={setOptions}
            onFieldToggle={handleFieldToggle}
            onSelectAll={selectAllFields}
            onSelectDefault={selectDefaultFields}
            onExport={handleExport}
            onCancel={() => setShowDialog(false)}
            exporting={exporting}
            selectedCount={selectedIds.length}
            totalCount={totalCount}
          />
        </DialogContent>
      </Dialog>
    );
  }

  // Full card view
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5 text-purple-600" />
          Export Obligations
        </CardTitle>
        <CardDescription>
          Download your obligations data in various formats
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Format Selection */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Export Format
          </Label>
          <RadioGroup
            value={options.format}
            onValueChange={(v) => setOptions((prev) => ({ ...prev, format: v as 'csv' | 'json' | 'xlsx' }))}
            className="grid grid-cols-3 gap-4"
          >
            <div>
              <RadioGroupItem value="csv" id="csv" className="peer sr-only" />
              <Label
                htmlFor="csv"
                className="flex flex-col items-center justify-center p-4 border-2 rounded-lg cursor-pointer hover:bg-slate-50 peer-data-[state=checked]:border-purple-600 peer-data-[state=checked]:bg-purple-50"
              >
                <FileSpreadsheet className="h-8 w-8 text-green-600 mb-2" />
                <span className="font-medium">CSV</span>
                <span className="text-xs text-slate-500">Spreadsheet format</span>
              </Label>
            </div>
            <div>
              <RadioGroupItem value="json" id="json" className="peer sr-only" />
              <Label
                htmlFor="json"
                className="flex flex-col items-center justify-center p-4 border-2 rounded-lg cursor-pointer hover:bg-slate-50 peer-data-[state=checked]:border-purple-600 peer-data-[state=checked]:bg-purple-50"
              >
                <FileJson className="h-8 w-8 text-blue-600 mb-2" />
                <span className="font-medium">JSON</span>
                <span className="text-xs text-slate-500">Data format</span>
              </Label>
            </div>
            <div>
              <RadioGroupItem value="xlsx" id="xlsx" className="peer sr-only" disabled />
              <Label
                htmlFor="xlsx"
                className="flex flex-col items-center justify-center p-4 border-2 rounded-lg cursor-not-allowed opacity-50"
              >
                <FileSpreadsheet className="h-8 w-8 text-purple-600 mb-2" />
                <span className="font-medium">Excel</span>
                <span className="text-xs text-slate-500">Coming soon</span>
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Field Selection */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Columns className="h-4 w-4" />
              Include Fields
            </Label>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={selectAllFields}>
                All
              </Button>
              <Button variant="ghost" size="sm" onClick={selectDefaultFields}>
                Default
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-4 border rounded-lg bg-slate-50">
            {availableFields.map((field) => (
              <div key={field.id} className="flex items-center space-x-2">
                <Checkbox
                  id={field.id}
                  checked={options.includeFields.includes(field.id)}
                  onCheckedChange={() => handleFieldToggle(field.id)}
                />
                <Label htmlFor={field.id} className="text-sm cursor-pointer">
                  {field.label}
                </Label>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            {options.includeFields.length} of {availableFields.length} fields selected
          </p>
        </div>

        {/* Options */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              Sort By
            </Label>
            <Select
              value={options.sortBy}
              onValueChange={(v) => setOptions((prev) => ({ ...prev, sortBy: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dueDate">Due Date</SelectItem>
                <SelectItem value="priority">Priority</SelectItem>
                <SelectItem value="status">Status</SelectItem>
                <SelectItem value="title">Title</SelectItem>
                <SelectItem value="createdAt">Created Date</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Sort Order</Label>
            <Select
              value={options.sortOrder}
              onValueChange={(v) => setOptions((prev) => ({ ...prev, sortOrder: v as 'asc' | 'desc' }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">Ascending</SelectItem>
                <SelectItem value="desc">Descending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center space-x-2 p-3 border rounded-lg">
          <Checkbox
            id="includeCompleted"
            checked={options.includeCompleted}
            onCheckedChange={(v) => setOptions((prev) => ({ ...prev, includeCompleted: !!v }))}
          />
          <Label htmlFor="includeCompleted" className="cursor-pointer">
            Include completed obligations
          </Label>
        </div>

        {/* Export Button */}
        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-slate-500">
            {selectedIds.length > 0 ? (
              <Badge variant="secondary">{selectedIds.length} selected</Badge>
            ) : (
              <span>Export all {totalCount} obligations</span>
            )}
          </div>
          <Button
            onClick={handleExport}
            disabled={exporting || options.includeFields.length === 0}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            {exporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                {formatIcons[options.format]}
                <span className="ml-2">Export as {options.format.toUpperCase()}</span>
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Dialog content extracted for reuse
function ExportDialogContent({
  options,
  setOptions,
  onFieldToggle,
  onSelectAll,
  onSelectDefault,
  onExport,
  onCancel,
  exporting,
  selectedCount,
  totalCount,
}: {
  options: ExportOptions;
  setOptions: React.Dispatch<React.SetStateAction<ExportOptions>>;
  onFieldToggle: (fieldId: string) => void;
  onSelectAll: () => void;
  onSelectDefault: () => void;
  onExport: () => void;
  onCancel: () => void;
  exporting: boolean;
  selectedCount: number;
  totalCount: number;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Download className="h-5 w-5 text-purple-600" />
          Export Obligations
        </DialogTitle>
        <DialogDescription>
          {selectedCount > 0
            ? `Export ${selectedCount} selected obligation(s)`
            : `Export all ${totalCount} obligations`}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-6 py-4">
        {/* Format */}
        <div className="space-y-3">
          <Label>Format</Label>
          <RadioGroup
            value={options.format}
            onValueChange={(v) => setOptions((prev) => ({ ...prev, format: v as 'csv' | 'json' | 'xlsx' }))}
            className="grid grid-cols-3 gap-3"
          >
            <div>
              <RadioGroupItem value="csv" id="dialog-csv" className="peer sr-only" />
              <Label
                htmlFor="dialog-csv"
                className="flex items-center justify-center p-3 border-2 rounded-lg cursor-pointer hover:bg-slate-50 peer-data-[state=checked]:border-purple-600 peer-data-[state=checked]:bg-purple-50"
              >
                <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" />
                CSV
              </Label>
            </div>
            <div>
              <RadioGroupItem value="json" id="dialog-json" className="peer sr-only" />
              <Label
                htmlFor="dialog-json"
                className="flex items-center justify-center p-3 border-2 rounded-lg cursor-pointer hover:bg-slate-50 peer-data-[state=checked]:border-purple-600 peer-data-[state=checked]:bg-purple-50"
              >
                <FileJson className="h-4 w-4 mr-2 text-blue-600" />
                JSON
              </Label>
            </div>
            <div>
              <RadioGroupItem value="xlsx" id="dialog-xlsx" className="peer sr-only" disabled />
              <Label
                htmlFor="dialog-xlsx"
                className="flex items-center justify-center p-3 border-2 rounded-lg cursor-not-allowed opacity-50"
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Excel (Soon)
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Fields */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Fields to Include</Label>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onSelectAll}>
                All
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onSelectDefault}>
                Default
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 p-3 border rounded-lg bg-slate-50 max-h-48 overflow-y-auto">
            {availableFields.map((field) => (
              <div key={field.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`dialog-${field.id}`}
                  checked={options.includeFields.includes(field.id)}
                  onCheckedChange={() => onFieldToggle(field.id)}
                />
                <Label htmlFor={`dialog-${field.id}`} className="text-xs cursor-pointer">
                  {field.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Options */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="dialog-includeCompleted"
            checked={options.includeCompleted}
            onCheckedChange={(v) => setOptions((prev) => ({ ...prev, includeCompleted: !!v }))}
          />
          <Label htmlFor="dialog-includeCompleted" className="text-sm cursor-pointer">
            Include completed obligations
          </Label>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          onClick={onExport}
          disabled={exporting || options.includeFields.length === 0}
          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
        >
          {exporting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Export
            </>
          )}
        </Button>
      </DialogFooter>
    </>
  );
}

export default ObligationExport;
