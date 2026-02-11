'use client';

import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Eye, Copy, Plus, Minus, Equal, User, Clock, MapPin, Monitor, FileText, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface AuditDetailEntry {
  id: string;
  action: string;
  category: string;
  user_id: string;
  tenant_id: string;
  resource_type?: string;
  resource_id?: string;
  resource_name?: string;
  success: boolean;
  ip_address?: string;
  user_agent?: string;
  details?: Record<string, any>;
  before_data?: Record<string, any>;
  after_data?: Record<string, any>;
  error_message?: string;
  created_at: string;
  actor_name?: string;
  actor_email?: string;
}

interface DiffEntry {
  key: string;
  before: any;
  after: any;
  type: 'added' | 'removed' | 'changed' | 'unchanged';
}

function computeObjectDiff(before: Record<string, any> | null, after: Record<string, any> | null): DiffEntry[] {
  const b = before || {};
  const a = after || {};
  const allKeys = new Set([...Object.keys(b), ...Object.keys(a)]);
  const diffs: DiffEntry[] = [];

  for (const key of allKeys) {
    const inBefore = key in b;
    const inAfter = key in a;

    if (!inBefore && inAfter) {
      diffs.push({ key, before: undefined, after: a[key], type: 'added' });
    } else if (inBefore && !inAfter) {
      diffs.push({ key, before: b[key], after: undefined, type: 'removed' });
    } else if (JSON.stringify(b[key]) !== JSON.stringify(a[key])) {
      diffs.push({ key, before: b[key], after: a[key], type: 'changed' });
    } else {
      diffs.push({ key, before: b[key], after: a[key], type: 'unchanged' });
    }
  }

  // Sort: changed first, then added, removed, unchanged
  const order = { changed: 0, added: 1, removed: 2, unchanged: 3 };
  return diffs.sort((a, b) => order[a.type] - order[b.type]);
}

function formatValue(val: any): string {
  if (val === undefined || val === null) return '—';
  if (typeof val === 'object') return JSON.stringify(val, null, 2);
  return String(val);
}

interface AuditDetailModalProps {
  entryId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AuditDetailModal({ entryId, open, onOpenChange }: AuditDetailModalProps) {
  const [entry, setEntry] = useState<AuditDetailEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('overview');

  const fetchDetail = useCallback(async () => {
    if (!entryId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/audit-logs?detailId=${entryId}`);
      const json = await res.json();
      if (json.success) setEntry(json.data.entry);
    } catch { toast.error('Failed to load audit detail'); }
    finally { setLoading(false); }
  }, [entryId]);

  // Fetch on open
  if (open && entryId && !entry && !loading) {
    fetchDetail();
  }

  const handleOpenChange = (o: boolean) => {
    if (!o) { setEntry(null); setTab('overview'); }
    onOpenChange(o);
  };

  const diffs = entry?.before_data || entry?.after_data
    ? computeObjectDiff(entry?.before_data || null, entry?.after_data || null)
    : [];

  const hasDiff = diffs.some(d => d.type !== 'unchanged');

  const copyJSON = () => {
    navigator.clipboard.writeText(JSON.stringify(entry, null, 2));
    toast.success('Copied to clipboard');
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" /> Audit Log Detail
          </DialogTitle>
          <DialogDescription>
            {entry ? `${entry.action} — ${format(new Date(entry.created_at), 'PPpp')}` : 'Loading...'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : entry ? (
          <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col overflow-hidden">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              {hasDiff && <TabsTrigger value="diff">Changes ({diffs.filter(d => d.type !== 'unchanged').length})</TabsTrigger>}
              <TabsTrigger value="raw">Raw JSON</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="flex-1 overflow-auto mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <span className="text-xs text-muted-foreground">Action</span>
                    <p className="font-medium">{entry.action}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Category</span>
                    <p><Badge variant="outline">{entry.category}</Badge></p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Status</span>
                    <p><Badge variant={entry.success ? 'default' : 'destructive'}>{entry.success ? 'Success' : 'Failed'}</Badge></p>
                  </div>
                  {entry.error_message && (
                    <div>
                      <span className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Error</span>
                      <p className="text-red-600 text-sm">{entry.error_message}</p>
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  <div>
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" /> Actor</span>
                    <p className="font-medium">{entry.actor_name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">{entry.actor_email}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Timestamp</span>
                    <p className="text-sm">{format(new Date(entry.created_at), 'PPpp')}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> IP Address</span>
                    <p className="text-sm font-mono">{entry.ip_address || '—'}</p>
                  </div>
                  {entry.resource_type && (
                    <div>
                      <span className="text-xs text-muted-foreground flex items-center gap-1"><FileText className="h-3 w-3" /> Resource</span>
                      <p className="text-sm">{entry.resource_type}: {entry.resource_name || entry.resource_id || '—'}</p>
                    </div>
                  )}
                </div>
              </div>
              {Object.keys(entry.details || {}).length > 0 && (
                <>
                  <Separator className="my-4" />
                  <div>
                    <span className="text-xs text-muted-foreground mb-2 block">Additional Details</span>
                    <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">{JSON.stringify(entry.details, null, 2)}</pre>
                  </div>
                </>
              )}
            </TabsContent>

            {hasDiff && (
              <TabsContent value="diff" className="flex-1 overflow-hidden mt-4">
                <ScrollArea className="h-[50vh]">
                  <div className="space-y-1">
                    {diffs.filter(d => d.type !== 'unchanged').map((d) => (
                      <div key={d.key} className={cn(
                        'p-3 rounded-lg border text-sm',
                        d.type === 'added' && 'bg-green-50 border-green-200',
                        d.type === 'removed' && 'bg-red-50 border-red-200',
                        d.type === 'changed' && 'bg-yellow-50 border-yellow-200',
                      )}>
                        <div className="flex items-center gap-2 mb-1">
                          {d.type === 'added' && <Plus className="h-3 w-3 text-green-600" />}
                          {d.type === 'removed' && <Minus className="h-3 w-3 text-red-600" />}
                          {d.type === 'changed' && <Equal className="h-3 w-3 text-yellow-600" />}
                          <span className="font-mono font-medium">{d.key}</span>
                          <Badge variant="outline" className="text-[10px]">{d.type}</Badge>
                        </div>
                        {d.type === 'changed' && (
                          <div className="grid grid-cols-2 gap-4 mt-2">
                            <div className="bg-red-100 p-2 rounded">
                              <span className="text-[10px] text-red-600 block mb-1">Before</span>
                              <pre className="text-xs whitespace-pre-wrap break-all">{formatValue(d.before)}</pre>
                            </div>
                            <div className="bg-green-100 p-2 rounded">
                              <span className="text-[10px] text-green-600 block mb-1">After</span>
                              <pre className="text-xs whitespace-pre-wrap break-all">{formatValue(d.after)}</pre>
                            </div>
                          </div>
                        )}
                        {d.type === 'added' && (
                          <pre className="text-xs mt-1 whitespace-pre-wrap break-all text-green-700">{formatValue(d.after)}</pre>
                        )}
                        {d.type === 'removed' && (
                          <pre className="text-xs mt-1 whitespace-pre-wrap break-all text-red-700">{formatValue(d.before)}</pre>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            )}

            <TabsContent value="raw" className="flex-1 overflow-hidden mt-4">
              <div className="flex justify-end mb-2">
                <Button size="sm" variant="outline" onClick={copyJSON}>
                  <Copy className="h-3 w-3 mr-2" /> Copy JSON
                </Button>
              </div>
              <ScrollArea className="h-[50vh]">
                <pre className="text-xs bg-muted p-4 rounded overflow-x-auto">
                  {JSON.stringify(entry, null, 2)}
                </pre>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="py-12 text-center text-muted-foreground">No entry found</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
