'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Archive, Trash2, FileX, Plus, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

export default function RecordsManager() {
  const [tab, setTab] = useState('overview');
  const [data, setData] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [showArchive, setShowArchive] = useState(false);
  const [archiveForm, setArchiveForm] = useState({ contractId: '', reason: '', archiveType: 'MANUAL' });

  const fetchData = useCallback(async () => {
    try {
      const type = tab === 'overview' ? 'overview' : tab === 'archived' ? 'archived' : 'deletion-certs';
      const res = await fetch(`/api/admin/records?type=${type}`);
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleArchive = async () => {
    if (!archiveForm.contractId) { toast.error('Contract ID required'); return; }
    try {
      const res = await fetch('/api/admin/records', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'archive', ...archiveForm }) });
      const json = await res.json();
      if (json.success) { toast.success('Contract archived'); setShowArchive(false); fetchData(); }
      else toast.error(json.error?.message || 'Failed');
    } catch { toast.error('Failed'); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="max-w-[1600px] mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><Archive className="h-8 w-8" /> Records Management</h1><p className="text-muted-foreground mt-1">Contract archival, retention, and defensible deletion</p></div>
        <Button onClick={() => setShowArchive(true)}><Archive className="h-4 w-4 mr-2" /> Archive Contract</Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => { setTab(v); setLoading(true); }}>
        <TabsList><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="archived">Archived</TabsTrigger><TabsTrigger value="certs">Deletion Certificates</TabsTrigger></TabsList>

        <TabsContent value="overview" className="mt-4">
          {data.metrics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="p-4"><div className="text-sm text-muted-foreground">Archived</div><p className="text-2xl font-bold">{data.metrics.archived_count}</p></Card>
              <Card className="p-4"><div className="text-sm text-muted-foreground">Pending Deletion</div><p className="text-2xl font-bold text-orange-500">{data.metrics.pending_deletion}</p></Card>
              <Card className="p-4"><div className="text-sm text-muted-foreground">Deleted</div><p className="text-2xl font-bold text-red-500">{data.metrics.deleted_count}</p></Card>
              <Card className="p-4"><div className="text-sm text-muted-foreground">Retention-Based</div><p className="text-2xl font-bold text-blue-500">{data.metrics.retention_based}</p></Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="archived" className="mt-4 space-y-3">
          {(data.archived || []).map((a: any) => (
            <Card key={a.id}><CardContent className="py-4 px-5 flex items-center justify-between">
              <div><h3 className="font-semibold">Contract: {a.contract_id}</h3><p className="text-sm text-muted-foreground">{a.reason || 'No reason'} • {a.archive_type}</p></div>
              <div className="text-right"><Badge variant="outline">{a.status}</Badge><p className="text-xs text-muted-foreground mt-1">{new Date(a.archived_at).toLocaleDateString()}</p></div>
            </CardContent></Card>
          ))}
          {(!data.archived || data.archived.length === 0) && <Card className="p-12 text-center text-muted-foreground">No archived contracts</Card>}
        </TabsContent>

        <TabsContent value="certs" className="mt-4 space-y-3">
          {(data.certificates || []).map((c: any) => (
            <Card key={c.id} className="border-red-200 dark:border-red-900"><CardContent className="py-4 px-5 flex items-center justify-between">
              <div className="flex items-center gap-2"><FileX className="h-5 w-5 text-red-500" /><div><h3 className="font-semibold">Certificate: {c.id.slice(0, 8)}</h3><p className="text-sm text-muted-foreground">{c.deletion_type} • {c.reason || 'No reason'}</p></div></div>
              <span className="text-sm text-muted-foreground">{new Date(c.deleted_at).toLocaleDateString()}</span>
            </CardContent></Card>
          ))}
          {(!data.certificates || data.certificates.length === 0) && <Card className="p-12 text-center text-muted-foreground">No deletion certificates</Card>}
        </TabsContent>
      </Tabs>

      <Dialog open={showArchive} onOpenChange={setShowArchive}>
        <DialogContent>
          <DialogHeader><DialogTitle>Archive Contract</DialogTitle><DialogDescription>Move a contract to the archive. Legal holds are enforced.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg flex items-start gap-2"><ShieldAlert className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" /><p className="text-sm">Contracts under legal hold cannot be archived or deleted.</p></div>
            <div><Label>Contract ID *</Label><Input value={archiveForm.contractId} onChange={(e) => setArchiveForm(p => ({ ...p, contractId: e.target.value }))} /></div>
            <div><Label>Reason</Label><Textarea value={archiveForm.reason} onChange={(e) => setArchiveForm(p => ({ ...p, reason: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowArchive(false)}>Cancel</Button><Button onClick={handleArchive}>Archive</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
