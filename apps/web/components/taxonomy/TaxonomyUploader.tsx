'use client';

/**
 * Taxonomy Uploader Component
 * 
 * Allows users to upload custom taxonomies from CSV or JSON files,
 * or paste JSON directly. Used in settings/taxonomy management.
 */

import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  FileJson,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Download,
  Copy,
  X,
  HelpCircle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useCrossModuleInvalidation } from '@/hooks/use-queries';
import { notifyTaxonomyChange } from '@/lib/taxonomy-events';

// ============================================================================
// TYPES
// ============================================================================

interface ImportResult {
  success: boolean;
  categoriesCreated: number;
  categoriesUpdated: number;
  categoriesSkipped: number;
  errors: string[];
  warnings: string[];
}

interface TaxonomyUploaderProps {
  onSuccess?: (result: ImportResult) => void;
  onError?: (error: string) => void;
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function TaxonomyUploader({ onSuccess, onError, className }: TaxonomyUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showJsonInput, setShowJsonInput] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [clearExisting, setClearExisting] = useState(false);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  
  // Get cross-module invalidation for real-time updates
  const crossModule = useCrossModuleInvalidation();

  // File upload handler
  const handleFileUpload = useCallback(async (file: File) => {
    setIsUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('clearExisting', String(clearExisting));
      formData.append('updateExisting', String(updateExisting));

      const response = await fetch('/api/taxonomy/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setResult(data);
      
      if (data.success) {
        toast.success(`Imported ${data.categoriesCreated} categories`);
        // Invalidate taxonomy caches for real-time propagation
        crossModule.onTaxonomyChange();
        // Notify other tabs via BroadcastChannel
        notifyTaxonomyChange('taxonomy_imported', { count: data.categoriesCreated });
        onSuccess?.(data);
      } else {
        toast.warning(`Import completed with ${data.errors.length} errors`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      toast.error(message);
      onError?.(message);
    } finally {
      setIsUploading(false);
    }
  }, [clearExisting, updateExisting, onSuccess, onError, crossModule]);

  // JSON paste handler
  const handleJsonSubmit = useCallback(async () => {
    if (!jsonInput.trim()) {
      toast.error('Please paste JSON content');
      return;
    }

    setIsUploading(true);
    setResult(null);

    try {
      // Validate JSON
      let categories;
      try {
        categories = JSON.parse(jsonInput);
      } catch {
        throw new Error('Invalid JSON format');
      }

      const response = await fetch('/api/taxonomy/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categories,
          clearExisting,
          updateExisting,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Import failed');
      }

      setResult(data);
      
      if (data.success) {
        toast.success(`Imported ${data.categoriesCreated} categories`);
        setJsonInput('');
        setShowJsonInput(false);
        // Invalidate taxonomy caches for real-time propagation
        crossModule.onTaxonomyChange();
        // Notify other tabs via BroadcastChannel
        notifyTaxonomyChange('taxonomy_imported', { count: data.categoriesCreated });
        onSuccess?.(data);
      } else {
        toast.warning(`Import completed with ${data.errors.length} errors`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Import failed';
      toast.error(message);
      onError?.(message);
    } finally {
      setIsUploading(false);
    }
  }, [jsonInput, clearExisting, updateExisting, onSuccess, onError, crossModule]);

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

  // File input change handler
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

  // Download template
  const downloadTemplate = useCallback((format: 'csv' | 'json') => {
    let content: string;
    let filename: string;
    let mimeType: string;

    if (format === 'csv') {
      content = `name,description,parent,keywords,color,icon
IT & Technology,Technology contracts and services,,software;hardware;IT;tech,#3B82F6,laptop
Software & Licensing,Software licenses and subscriptions,IT & Technology,software;license;saas;subscription,#8B5CF6,code
Hardware & Equipment,Hardware purchases,IT & Technology,hardware;computer;server;equipment,#10B981,cpu
Cloud Services,Cloud infrastructure and platforms,IT & Technology,cloud;aws;azure;gcp;iaas,#06B6D4,cloud
Professional Services,Business and consulting services,,consulting;professional;advisory,#F59E0B,briefcase
Legal Services,Legal counsel and law firms,Professional Services,legal;attorney;law;counsel,#7C3AED,scale
Consulting,Management and strategy consulting,Professional Services,consulting;strategy;advisory,#3B82F6,users`;
      filename = 'taxonomy-template.csv';
      mimeType = 'text/csv';
    } else {
      content = JSON.stringify([
        {
          name: 'IT & Technology',
          description: 'Technology contracts and services',
          keywords: ['software', 'hardware', 'IT', 'tech'],
          color: '#3B82F6',
          icon: 'laptop',
          children: [
            {
              name: 'Software & Licensing',
              description: 'Software licenses and subscriptions',
              keywords: ['software', 'license', 'saas'],
            },
            {
              name: 'Hardware & Equipment',
              description: 'Hardware purchases',
              keywords: ['hardware', 'computer', 'server'],
            },
          ],
        },
        {
          name: 'Professional Services',
          description: 'Business and consulting services',
          keywords: ['consulting', 'professional', 'advisory'],
          color: '#F59E0B',
          icon: 'briefcase',
          children: [
            {
              name: 'Legal Services',
              description: 'Legal counsel and law firms',
              keywords: ['legal', 'attorney', 'law'],
            },
          ],
        },
      ], null, 2);
      filename = 'taxonomy-template.json';
      mimeType = 'application/json';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success(`Downloaded ${filename}`);
  }, []);

  // Copy example to clipboard
  const copyExample = useCallback(() => {
    const example = JSON.stringify([
      {
        name: 'Category Name',
        description: 'Category description',
        parent: 'Parent Category Name (optional)',
        keywords: ['keyword1', 'keyword2'],
        color: '#3B82F6',
        icon: 'folder',
      },
    ], null, 2);
    navigator.clipboard.writeText(example);
    toast.success('Copied example to clipboard');
  }, []);

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-blue-600" />
              Import Custom Taxonomy
            </CardTitle>
            <CardDescription className="mt-1.5">
              Upload your organization&apos;s category structure from CSV or JSON
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHelp(!showHelp)}
          >
            <HelpCircle className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Help Section */}
        <AnimatePresence>
          {showHelp && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 space-y-4">
                <h4 className="font-medium text-blue-900">Supported Formats</h4>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-blue-800">
                      <FileSpreadsheet className="h-4 w-4" />
                      CSV Format
                    </div>
                    <p className="text-xs text-blue-700">
                      Columns: name, description, parent, keywords (semicolon-separated), color, icon
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadTemplate('csv')}
                      className="text-xs"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Download CSV Template
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-blue-800">
                      <FileJson className="h-4 w-4" />
                      JSON Format
                    </div>
                    <p className="text-xs text-blue-700">
                      Flat array or hierarchical with &ldquo;children&rdquo; property
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadTemplate('json')}
                      className="text-xs"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Download JSON Template
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Options */}
        <div className="flex flex-wrap gap-6">
          <div className="flex items-center gap-3">
            <Switch
              id="updateExisting"
              checked={updateExisting}
              onCheckedChange={setUpdateExisting}
            />
            <Label htmlFor="updateExisting" className="text-sm cursor-pointer">
              Update existing categories
            </Label>
          </div>
          
          <div className="flex items-center gap-3">
            <Switch
              id="clearExisting"
              checked={clearExisting}
              onCheckedChange={setClearExisting}
            />
            <Label htmlFor="clearExisting" className="text-sm cursor-pointer text-amber-700">
              Clear all existing first
            </Label>
          </div>
        </div>

        {/* Upload Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
            isDragging 
              ? "border-blue-500 bg-blue-50" 
              : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50",
            isUploading && "pointer-events-none opacity-50"
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json"
            onChange={handleFileChange}
            className="hidden"
          />
          
          {isUploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
              <p className="text-sm text-slate-600">Importing categories...</p>
            </div>
          ) : (
            <>
              <div className="flex justify-center gap-4 mb-4">
                <div className="p-3 rounded-xl bg-blue-100">
                  <FileSpreadsheet className="h-6 w-6 text-blue-600" />
                </div>
                <div className="p-3 rounded-xl bg-purple-100">
                  <FileJson className="h-6 w-6 text-purple-600" />
                </div>
              </div>
              <p className="text-sm font-medium text-slate-700">
                Drag & drop your taxonomy file here
              </p>
              <p className="text-xs text-slate-500 mt-1">
                or click to browse • Supports .csv and .json
              </p>
            </>
          )}
        </div>

        {/* JSON Input Toggle */}
        <Collapsible open={showJsonInput} onOpenChange={setShowJsonInput}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between">
              <span className="flex items-center gap-2">
                <FileJson className="h-4 w-4" />
                Or paste JSON directly
              </span>
              {showJsonInput ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <Label>JSON Categories</Label>
              <Button variant="ghost" size="sm" onClick={copyExample}>
                <Copy className="h-3.5 w-3.5 mr-1" />
                Copy Example
              </Button>
            </div>
            
            <Textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder='[{"name": "Category Name", "description": "...", "children": [...]}]'
              className="font-mono text-xs min-h-[200px]"
            />
            
            <Button
              onClick={handleJsonSubmit}
              disabled={isUploading || !jsonInput.trim()}
              className="w-full"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import JSON
                </>
              )}
            </Button>
          </CollapsibleContent>
        </Collapsible>

        {/* Results */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={cn(
                "p-4 rounded-lg border",
                result.success 
                  ? "bg-emerald-50 border-emerald-200" 
                  : "bg-amber-50 border-amber-200"
              )}
            >
              <div className="flex items-start gap-3">
                {result.success ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
                )}
                
                <div className="flex-1 space-y-2">
                  <p className={cn(
                    "font-medium",
                    result.success ? "text-emerald-800" : "text-amber-800"
                  )}>
                    {result.success ? 'Import Successful' : 'Import Completed with Issues'}
                  </p>
                  
                  <div className="flex flex-wrap gap-2">
                    {result.categoriesCreated > 0 && (
                      <Badge className="bg-emerald-100 text-emerald-700">
                        {result.categoriesCreated} created
                      </Badge>
                    )}
                    {result.categoriesUpdated > 0 && (
                      <Badge className="bg-blue-100 text-blue-700">
                        {result.categoriesUpdated} updated
                      </Badge>
                    )}
                    {result.categoriesSkipped > 0 && (
                      <Badge className="bg-slate-100 text-slate-600">
                        {result.categoriesSkipped} skipped
                      </Badge>
                    )}
                  </div>
                  
                  {result.errors.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs font-medium text-red-700">Errors:</p>
                      {result.errors.slice(0, 5).map((error, i) => (
                        <p key={i} className="text-xs text-red-600">• {error}</p>
                      ))}
                      {result.errors.length > 5 && (
                        <p className="text-xs text-red-500">
                          ...and {result.errors.length - 5} more errors
                        </p>
                      )}
                    </div>
                  )}
                  
                  {result.warnings.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs font-medium text-amber-700">Warnings:</p>
                      {result.warnings.slice(0, 3).map((warning, i) => (
                        <p key={i} className="text-xs text-amber-600">• {warning}</p>
                      ))}
                      {result.warnings.length > 3 && (
                        <p className="text-xs text-amber-500">
                          ...and {result.warnings.length - 3} more warnings
                        </p>
                      )}
                    </div>
                  )}
                </div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setResult(null)}
                  className="shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

export default TaxonomyUploader;
