'use client';

import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Upload, Download, FileText, Database, CheckCircle2, XCircle, Clock,
  Play, Package, AlertTriangle, Loader2, Archive, ArrowLeftRight,
  FileSpreadsheet, FileArchive, BarChart3
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface BulkJob {
  id: string;
  type: 'export' | 'import' | 'status-change' | 'assign-workflow';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  totalItems: number;
  processedItems: number;
  failedItems: number;
  createdAt: string;
  result?: any;
}

export default function BulkOperationsCenter() {
  const [tab, setTab] = useState('export');
  const [contracts, setContracts] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [exportFormat, setExportFormat] = useState('csv');
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [statusChangeDialog, setStatusChangeDialog] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [processing, setProcessing] = useState(false);
  const [jobs, setJobs] = useState<BulkJob[]>([]);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // Fetch contracts
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/contracts?limit=100');
        const json = await res.json();
        if (json.success) setContracts(json.data.contracts || json.data || []);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, []);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === contracts.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(contracts.map(c => c.id)));
  };

  const handleBulkExport = async () => {
    if (selectedIds.size === 0) { toast.error('Select contracts first'); return; }
    setProcessing(true);
    try {
      const res = await fetch('/api/contracts/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: `export-${exportFormat}`,
          contractIds: Array.from(selectedIds),
        }),
      });
      const json = await res.json();
      if (json.success) {
        const job: BulkJob = {
          id: Date.now().toString(),
          type: 'export',
          status: 'completed',
          progress: 100,
          totalItems: selectedIds.size,
          processedItems: selectedIds.size,
          failedItems: 0,
          createdAt: new Date().toISOString(),
          result: json.data,
        };
        setJobs(prev => [job, ...prev]);
        toast.success(`Exported ${selectedIds.size} contracts as ${exportFormat.toUpperCase()}`);
        setExportDialogOpen(false);

        // If the response includes contract data, trigger download
        if (json.data?.contracts) {
          const exportData = exportFormat === 'json'
            ? JSON.stringify(json.data.contracts, null, 2)
            : [
                Object.keys(json.data.contracts[0] || {}).join(','),
                ...json.data.contracts.map((c: any) => Object.values(c).map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
              ].join('\n');

          const blob = new Blob([exportData], { type: exportFormat === 'json' ? 'application/json' : 'text/csv' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `contracts-export-${new Date().toISOString().split('T')[0]}.${exportFormat}`;
          a.click();
          URL.revokeObjectURL(url);
        }
      }
    } catch { toast.error('Export failed'); }
    finally { setProcessing(false); }
  };

  const handleBulkStatusChange = async () => {
    if (selectedIds.size === 0 || !newStatus) return;
    setProcessing(true);
    try {
      const res = await fetch('/api/contracts/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'update-status',
          contractIds: Array.from(selectedIds),
          data: { status: newStatus },
        }),
      });
      const json = await res.json();
      const job: BulkJob = {
        id: Date.now().toString(),
        type: 'status-change',
        status: json.success ? 'completed' : 'failed',
        progress: 100,
        totalItems: selectedIds.size,
        processedItems: selectedIds.size,
        failedItems: 0,
        createdAt: new Date().toISOString(),
      };
      setJobs(prev => [job, ...prev]);
      if (json.success) {
        toast.success(`Updated ${selectedIds.size} contracts to ${newStatus}`);
        setStatusChangeDialog(false);
      }
    } catch { toast.error('Status change failed'); }
    finally { setProcessing(false); }
  };

  const statusOptions = ['DRAFT', 'IN_REVIEW', 'PENDING_APPROVAL', 'ACTIVE', 'EXPIRED', 'TERMINATED', 'ARCHIVED'];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Package className="h-8 w-8" /> Bulk Operations
          </h1>
          <p className="text-muted-foreground mt-1">Export, import, and perform bulk actions on contracts</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="secondary">{selectedIds.size} selected</Badge>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => setExportDialogOpen(true)} disabled={selectedIds.size === 0}>
          <Download className="h-4 w-4 mr-2" /> Export Selected
        </Button>
        <Button variant="outline" onClick={() => setStatusChangeDialog(true)} disabled={selectedIds.size === 0}>
          <ArrowLeftRight className="h-4 w-4 mr-2" /> Change Status
        </Button>
        <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
          <Upload className="h-4 w-4 mr-2" /> Import Contracts
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="export">Select Contracts</TabsTrigger>
          <TabsTrigger value="history">Job History ({jobs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="export" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Contracts</CardTitle>
                <Button size="sm" variant="outline" onClick={toggleSelectAll}>
                  {selectedIds.size === contracts.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {contracts.map(c => (
                      <div
                        key={c.id}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                          selectedIds.has(c.id) ? 'bg-primary/5 border-primary/30' : 'hover:bg-muted/50'
                        )}
                        onClick={() => toggleSelect(c.id)}
                      >
                        <Checkbox checked={selectedIds.has(c.id)} />
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{c.contractTitle || c.fileName || 'Untitled'}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {c.supplierName && <span>{c.supplierName}</span>}
                            {c.status && <Badge variant="outline" className="text-[10px]">{c.status}</Badge>}
                            {c.contractType && <Badge variant="secondary" className="text-[10px]">{c.contractType}</Badge>}
                          </div>
                        </div>
                        {c.totalValue && (
                          <span className="text-sm font-medium shrink-0">
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: c.currency || 'USD', notation: 'compact' }).format(c.totalValue)}
                          </span>
                        )}
                      </div>
                    ))}
                    {contracts.length === 0 && (
                      <div className="py-12 text-center text-muted-foreground">
                        <Database className="h-12 w-12 mx-auto mb-3 opacity-30" />
                        <p>No contracts found</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Job History</CardTitle>
              <CardDescription>Track the status of bulk operations</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {jobs.map(job => (
                    <div key={job.id} className="p-4 rounded-lg border">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {job.type === 'export' && <Download className="h-5 w-5 text-blue-500" />}
                          {job.type === 'import' && <Upload className="h-5 w-5 text-green-500" />}
                          {job.type === 'status-change' && <ArrowLeftRight className="h-5 w-5 text-yellow-500" />}
                          <div>
                            <p className="font-medium capitalize">{job.type.replace('-', ' ')}</p>
                            <p className="text-xs text-muted-foreground">
                              {job.processedItems}/{job.totalItems} items · {new Date(job.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <Badge variant={job.status === 'completed' ? 'default' : job.status === 'failed' ? 'destructive' : 'secondary'}>
                          {job.status === 'completed' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                          {job.status === 'failed' && <XCircle className="h-3 w-3 mr-1" />}
                          {job.status === 'processing' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                          {job.status}
                        </Badge>
                      </div>
                      {job.status === 'processing' && (
                        <Progress value={job.progress} className="mt-3 h-2" />
                      )}
                    </div>
                  ))}
                  {jobs.length === 0 && (
                    <div className="py-12 text-center text-muted-foreground">
                      <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>No bulk operations have been run yet</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Export Dialog */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Contracts</DialogTitle>
            <DialogDescription>Export {selectedIds.size} selected contracts</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Export Format</Label>
              <div className="grid grid-cols-3 gap-3 mt-2">
                {[
                  { value: 'csv', icon: FileSpreadsheet, label: 'CSV' },
                  { value: 'json', icon: FileText, label: 'JSON' },
                  { value: 'pdf', icon: FileArchive, label: 'ZIP (PDFs)' },
                ].map(f => (
                  <button
                    key={f.value}
                    onClick={() => setExportFormat(f.value)}
                    className={cn(
                      'p-4 rounded-lg border-2 text-center transition-all',
                      exportFormat === f.value ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/30'
                    )}
                  >
                    <f.icon className="h-6 w-6 mx-auto mb-1" />
                    <span className="text-sm font-medium">{f.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkExport} disabled={processing}>
              {processing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Export
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Change Dialog */}
      <Dialog open={statusChangeDialog} onOpenChange={setStatusChangeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Status Change</DialogTitle>
            <DialogDescription>Change status for {selectedIds.size} selected contracts</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>New Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className="mt-2"><SelectValue placeholder="Select new status..." /></SelectTrigger>
                <SelectContent>
                  {statusOptions.map(s => (
                    <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="p-3 bg-yellow-50 border-yellow-200 border rounded-lg flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
              <p className="text-sm text-yellow-800">This will update {selectedIds.size} contracts. This action will be logged in the audit trail.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusChangeDialog(false)}>Cancel</Button>
            <Button onClick={handleBulkStatusChange} disabled={processing || !newStatus}>
              {processing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Contracts</DialogTitle>
            <DialogDescription>Upload a CSV or JSON file to import contracts</DialogDescription>
          </DialogHeader>
          <div className="border-2 border-dashed rounded-lg p-12 text-center">
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium">Drag &amp; drop your file here</p>
            <p className="text-xs text-muted-foreground mt-1">Supports CSV, JSON, and Excel (.xlsx)</p>
            <Button variant="outline" size="sm" className="mt-4">
              Browse Files
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            <p className="font-medium mb-1">Required columns:</p>
            <p>contractTitle, supplierName, status, effectiveDate, expirationDate</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
