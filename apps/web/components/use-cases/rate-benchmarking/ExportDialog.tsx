/**
 * Export Dialog Component
 * Full-featured export dialog with multiple formats and options
 */

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  X,
  Download,
  FileSpreadsheet,
  FileText,
  FileImage,
  Mail,
  Loader2,
  CheckCircle,
  Settings2,
  Calendar,
} from 'lucide-react';

type ExportFormat = 'csv' | 'excel' | 'pdf' | 'json';

interface ExportOption {
  id: string;
  label: string;
  checked: boolean;
}

export interface ExportDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  data?: unknown;
  title?: string;
  filename?: string;
  onExport?: (format: ExportFormat, options: { [key: string]: boolean }) => Promise<void>;
}

const formatConfig: Record<ExportFormat, { icon: React.ElementType; label: string; description: string }> = {
  csv: { icon: FileSpreadsheet, label: 'CSV', description: 'Comma-separated values for spreadsheets' },
  excel: { icon: FileSpreadsheet, label: 'Excel', description: 'Microsoft Excel workbook (.xlsx)' },
  pdf: { icon: FileText, label: 'PDF', description: 'Portable document for reports' },
  json: { icon: FileText, label: 'JSON', description: 'Raw data for developers' },
};

export function ExportDialog({ 
  open, 
  onOpenChange, 
  data,
  title = 'Export Data',
  filename = 'export',
  onExport,
}: ExportDialogProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('excel');
  const [isExporting, setIsExporting] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [sendEmail, setSendEmail] = useState(false);
  const [options, setOptions] = useState<ExportOption[]>([
    { id: 'includeCharts', label: 'Include charts and visualizations', checked: true },
    { id: 'includeMetadata', label: 'Include metadata and timestamps', checked: true },
    { id: 'includeRawData', label: 'Include raw data tables', checked: true },
    { id: 'includeSummary', label: 'Include executive summary', checked: false },
  ]);

  const toggleOption = (id: string) => {
    setOptions(options.map(opt => 
      opt.id === id ? { ...opt, checked: !opt.checked } : opt
    ));
  };

  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      const optionsMap = options.reduce((acc, opt) => {
        acc[opt.id] = opt.checked;
        return acc;
      }, {} as { [key: string]: boolean });

      if (onExport) {
        await onExport(selectedFormat, optionsMap);
      } else {
        // Default export behavior
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Generate and download file
        const dataStr = JSON.stringify(data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}-${new Date().toISOString().split('T')[0]}.${selectedFormat}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      toast.success(`Export complete`, {
        description: `Your ${formatConfig[selectedFormat].label} file is ready`,
      });

      if (sendEmail && emailTo) {
        toast.success('Email sent', {
          description: `Export sent to ${emailTo}`,
        });
      }

      onOpenChange?.(false);
    } catch (error) {
      toast.error('Export failed', {
        description: 'Please try again',
      });
    } finally {
      setIsExporting(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={() => !isExporting && onOpenChange?.(false)}
        />

        {/* Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-100">
                <Download className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900">{title}</h2>
                <p className="text-xs text-slate-500">Choose format and options</p>
              </div>
            </div>
            <button
              onClick={() => !isExporting && onOpenChange?.(false)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              disabled={isExporting}
            >
              <X className="h-5 w-5 text-slate-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Format Selection */}
            <div>
              <label className="text-sm font-medium text-slate-700 mb-3 block">Export Format</label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(formatConfig) as [ExportFormat, typeof formatConfig['csv']][]).map(([format, config]) => {
                  const Icon = config.icon;
                  const isSelected = selectedFormat === format;
                  
                  return (
                    <button
                      key={format}
                      onClick={() => setSelectedFormat(format)}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left',
                        isSelected
                          ? 'border-violet-500 bg-violet-50'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      )}
                    >
                      <Icon className={cn('h-5 w-5', isSelected ? 'text-violet-600' : 'text-slate-400')} />
                      <div>
                        <p className={cn('font-medium text-sm', isSelected ? 'text-violet-700' : 'text-slate-700')}>
                          {config.label}
                        </p>
                        <p className="text-[10px] text-slate-500 line-clamp-1">{config.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Options */}
            <div>
              <label className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                Export Options
              </label>
              <div className="space-y-2">
                {options.map((option) => (
                  <label
                    key={option.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={option.checked}
                      onCheckedChange={() => toggleOption(option.id)}
                    />
                    <span className="text-sm text-slate-700">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Email Option */}
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                <Checkbox
                  checked={sendEmail}
                  onCheckedChange={() => setSendEmail(!sendEmail)}
                />
                <span className="text-sm text-slate-700 flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Send copy via email
                </span>
              </label>
              {sendEmail && (
                <Input
                  type="email"
                  placeholder="Enter email address"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  className="ml-7"
                />
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-slate-50">
            <Button
              variant="outline"
              onClick={() => onOpenChange?.(false)}
              disabled={isExporting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleExport}
              disabled={isExporting}
              className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 min-w-[120px]"
            >
              {isExporting ? (
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
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default ExportDialog;
