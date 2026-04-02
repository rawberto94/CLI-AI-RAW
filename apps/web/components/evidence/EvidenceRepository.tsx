'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileCheck, Plus, CheckCircle2, XCircle, Clock, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function EvidenceRepository() {
  const [evidence, setEvidence] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ obligationId: '', contractId: '', title: '', description: '', evidenceType: 'DOCUMENT' });

  const fetchEvidence = useCallback(async () => {
    try {
      const res = await fetch('/api/evidence');
      const json = await res.json();
      if (json.success) { setEvidence(json.data.evidence); setMetrics(json.data.metrics); }
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchEvidence(); }, [fetchEvidence]);

  const handleAdd = async () => {
    if (!form.title || !form.contractId) { toast.error('Title and contract ID required'); return; }
    try {
      const res = await fetch('/api/evidence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if ((await res.json()).success) { toast.success('Evidence submitted'); setShowAdd(false); fetchEvidence(); }
    } catch { toast.error('Failed'); }
  };

  const handleReview = async (id: string, action: 'verify' | 'reject', notes?: string) => {
    try {
      const res = await fetch('/api/evidence', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action, notes }) });
      if ((await res.json()).success) { toast.success(`Evidence ${action}d`); fetchEvidence(); }
    } catch { toast.error('Failed'); }
  };

  const statusConfig: Record<string, { icon: any; color: string }> = {
    PENDING_REVIEW: { icon: Clock, color: 'bg-yellow-100 text-yellow-800' },
    VERIFIED: { icon: CheckCircle2, color: 'bg-green-100 text-green-800' },
    REJECTED: { icon: XCircle, color: 'bg-red-100 text-red-800' },
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="max-w-[1600px] mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><FileCheck className="h-8 w-8" /> Evidence Repository</h1><p className="text-muted-foreground mt-1">Manage compliance evidence linked to contract obligations</p></div>
        <Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-2" /> Submit Evidence</Button>
      </div>

      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4"><div className="text-sm text-muted-foreground">Total</div><p className="text-2xl font-bold">{metrics.total}</p></Card>
          <Card className="p-4"><div className="text-sm text-muted-foreground">Verified</div><p className="text-2xl font-bold text-green-500">{metrics.verified}</p></Card>
          <Card className="p-4"><div className="text-sm text-muted-foreground">Pending</div><p className="text-2xl font-bold text-yellow-500">{metrics.pending}</p></Card>
          <Card className="p-4"><div className="text-sm text-muted-foreground">Rejected</div><p className="text-2xl font-bold text-red-500">{metrics.rejected}</p></Card>
        </div>
      )}

      <div className="space-y-3">
        {evidence.map((e: any) => {
          const sc = statusConfig[e.status] || statusConfig.PENDING_REVIEW;
          return (
            <Card key={e.id} className="hover:shadow-md transition-shadow">
              <CardContent className="py-4 px-5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2"><h3 className="font-semibold">{e.title}</h3><Badge className={sc.color}>{e.status.replace(/_/g, ' ')}</Badge><Badge variant="outline">{e.evidence_type}</Badge></div>
                  <p className="text-sm text-muted-foreground mt-1">{e.description || 'No description'}</p>
                  <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                    {e.file_name && <span>{e.file_name}</span>}
                    <span>Uploaded: {new Date(e.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                {e.status === 'PENDING_REVIEW' && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleReview(e.id, 'verify')}>Verify</Button>
                    <Button size="sm" variant="destructive" onClick={() => handleReview(e.id, 'reject')}>Reject</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {evidence.length === 0 && <Card className="p-12 text-center text-muted-foreground">No evidence items</Card>}
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Submit Evidence</DialogTitle><DialogDescription>Upload compliance evidence for an obligation</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))} /></div>
            <div><Label>Contract ID *</Label><Input value={form.contractId} onChange={(e) => setForm(p => ({ ...p, contractId: e.target.value }))} /></div>
            <div><Label>Obligation ID</Label><Input value={form.obligationId} onChange={(e) => setForm(p => ({ ...p, obligationId: e.target.value }))} /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} /></div>
            <div><Label>Type</Label><Select value={form.evidenceType} onValueChange={(v) => setForm(p => ({ ...p, evidenceType: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="DOCUMENT">Document</SelectItem><SelectItem value="SCREENSHOT">Screenshot</SelectItem><SelectItem value="AUDIT_LOG">Audit Log</SelectItem><SelectItem value="REPORT">Report</SelectItem></SelectContent></Select></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button><Button onClick={handleAdd}>Submit</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
