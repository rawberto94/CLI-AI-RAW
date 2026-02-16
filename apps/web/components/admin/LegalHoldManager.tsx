'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Scale, Plus, ShieldOff, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/shared/EmptyState';

export default function LegalHoldManager() {
  const [holds, setHolds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [releaseId, setReleaseId] = useState<string | null>(null);
  const [releaseReason, setReleaseReason] = useState('');
  const [form, setForm] = useState({ name: '', description: '', matterId: '', holdType: 'LITIGATION', contractIds: '' });

  const fetchHolds = useCallback(async () => {
    try {
      const res = await fetch('/api/legal-holds');
      const json = await res.json();
      if (json.success) setHolds(json.data.holds);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchHolds(); }, [fetchHolds]);

  const handleAdd = async () => {
    if (!form.name) { toast.error('Name required'); return; }
    try {
      const ids = form.contractIds.split(',').map(s => s.trim()).filter(Boolean);
      const res = await fetch('/api/legal-holds', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, contractIds: ids }) });
      if ((await res.json()).success) { toast.success('Legal hold created'); setShowAdd(false); fetchHolds(); }
    } catch { toast.error('Failed'); }
  };

  const handleRelease = async () => {
    if (!releaseId) return;
    try {
      const res = await fetch('/api/legal-holds', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: releaseId, action: 'release', reason: releaseReason }) });
      if ((await res.json()).success) { toast.success('Hold released'); setReleaseId(null); fetchHolds(); }
    } catch { toast.error('Failed'); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><Scale className="h-8 w-8" /> Legal Holds</h1><p className="text-muted-foreground mt-1">Manage litigation and regulatory holds on contracts</p></div>
        <Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-2" /> Create Hold</Button>
      </div>

      <div className="space-y-3">
        {holds.map((h: any) => (
          <Card key={h.id} className={h.status === 'ACTIVE' ? 'border-yellow-300 dark:border-yellow-800' : ''}>
            <CardContent className="py-4 px-5 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2"><Shield className={`h-5 w-5 ${h.status === 'ACTIVE' ? 'text-yellow-500' : 'text-gray-400'}`} /><h3 className="font-semibold">{h.name}</h3><Badge className={h.status === 'ACTIVE' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}>{h.status}</Badge><Badge variant="outline">{h.hold_type}</Badge></div>
                <p className="text-sm text-muted-foreground mt-1">{h.description || 'No description'}</p>
                <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                  {h.matter_id && <span>Matter: {h.matter_id}</span>}
                  <span>Issued: {new Date(h.issued_at).toLocaleDateString()}</span>
                  {h.released_at && <span>Released: {new Date(h.released_at).toLocaleDateString()}</span>}
                </div>
              </div>
              {h.status === 'ACTIVE' && <Button size="sm" variant="outline" onClick={() => setReleaseId(h.id)}><ShieldOff className="h-4 w-4 mr-1" /> Release</Button>}
            </CardContent>
          </Card>
        ))}
        {holds.length === 0 && (
          <EmptyState
            variant="no-data"
            title="No legal holds"
            description="Create legal holds to preserve contracts for litigation or regulatory purposes."
            primaryAction={{
              label: 'Create Hold',
              onClick: () => setShowAdd(true),
              icon: Plus,
            }}
          />
        )}
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Legal Hold</DialogTitle><DialogDescription>Place a preservation hold on contracts</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label>Hold Name *</Label><Input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Matter ID</Label><Input value={form.matterId} onChange={(e) => setForm(p => ({ ...p, matterId: e.target.value }))} /></div>
              <div><Label>Hold Type</Label><Input value={form.holdType} onChange={(e) => setForm(p => ({ ...p, holdType: e.target.value }))} /></div>
            </div>
            <div><Label>Contract IDs (comma-separated)</Label><Input value={form.contractIds} onChange={(e) => setForm(p => ({ ...p, contractIds: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button><Button onClick={handleAdd}>Create Hold</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!releaseId} onOpenChange={() => setReleaseId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Release Legal Hold</DialogTitle><DialogDescription>Provide a reason for releasing the hold</DialogDescription></DialogHeader>
          <Textarea value={releaseReason} onChange={(e) => setReleaseReason(e.target.value)} placeholder="Reason for release..." />
          <DialogFooter><Button variant="outline" onClick={() => setReleaseId(null)}>Cancel</Button><Button onClick={handleRelease}>Release Hold</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
