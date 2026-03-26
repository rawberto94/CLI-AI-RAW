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
import { FileEdit, Plus, ArrowRight, CheckCircle2, Clock, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  IN_REVIEW: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  EXECUTED: 'bg-blue-100 text-blue-800',
};

export default function AmendmentWorkflow() {
  const [amendments, setAmendments] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ originalContractId: '', title: '', description: '', amendmentType: 'MODIFICATION', financialImpact: '', effectiveDate: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [changingId, setChangingId] = useState<string | null>(null);

  const fetchAmendments = useCallback(async () => {
    try {
      const res = await fetch('/api/amendments');
      const json = await res.json();
      if (json.success) { setAmendments(json.data.amendments); setMetrics(json.data.metrics); }
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAmendments(); }, [fetchAmendments]);

  const handleAdd = async () => {
    if (!form.originalContractId || !form.title) { toast.error('Contract ID and title required'); return; }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/amendments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, financialImpact: form.financialImpact ? parseFloat(form.financialImpact) : null }) });
      if ((await res.json()).success) { toast.success('Amendment created'); setShowAdd(false); fetchAmendments(); }
    } catch { toast.error('Failed'); }
    finally { setIsSubmitting(false); }
  };

  const handleStatusChange = async (id: string, status: string) => {
    setChangingId(id);
    try {
      const res = await fetch('/api/amendments', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
      if ((await res.json()).success) { toast.success(`Amendment ${status.toLowerCase()}`); fetchAmendments(); }
    } catch { toast.error('Failed'); }
    finally { setChangingId(null); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><FileEdit className="h-8 w-8" /> Amendments</h1><p className="text-muted-foreground mt-1">Track and manage contract amendments through their lifecycle</p></div>
        <Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-2" /> New Amendment</Button>
      </div>

      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Total', value: metrics.total, color: 'text-blue-600' },
            { label: 'Draft', value: metrics.draft, color: 'text-gray-500' },
            { label: 'In Review', value: metrics.in_review, color: 'text-yellow-500' },
            { label: 'Approved', value: metrics.approved, color: 'text-green-500' },
            { label: 'Executed', value: metrics.executed, color: 'text-blue-500' },
          ].map((m) => (
            <Card key={m.label} className="p-4"><div className="text-sm text-muted-foreground">{m.label}</div><p className={cn('text-2xl font-bold', m.color)}>{m.value}</p></Card>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {amendments.map((a: any) => (
          <Card key={a.id} className="hover:shadow-md transition-shadow">
            <CardContent className="py-4 px-5 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2"><h3 className="font-semibold">Amendment #{a.amendment_number}: {a.title}</h3><Badge className={statusColors[a.status]}>{a.status}</Badge><Badge variant="outline">{a.amendment_type}</Badge></div>
                <p className="text-sm text-muted-foreground mt-1">{a.description || 'No description'}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  {a.financial_impact && <span>Impact: ${Number(a.financial_impact).toLocaleString()}</span>}
                  {a.effective_date && <span>Effective: {new Date(a.effective_date).toLocaleDateString()}</span>}
                  <span>Created: {new Date(a.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex gap-2">
                {a.status === 'DRAFT' && <Button size="sm" disabled={changingId === a.id} onClick={() => handleStatusChange(a.id, 'IN_REVIEW')}>Submit for Review</Button>}
                {a.status === 'IN_REVIEW' && <>
                  <Button size="sm" disabled={changingId === a.id} onClick={() => handleStatusChange(a.id, 'APPROVED')}>Approve</Button>
                  <Button size="sm" variant="destructive" disabled={changingId === a.id} onClick={() => handleStatusChange(a.id, 'REJECTED')}>Reject</Button>
                </>}
                {a.status === 'APPROVED' && <Button size="sm" disabled={changingId === a.id} onClick={() => handleStatusChange(a.id, 'EXECUTED')}>Execute</Button>}
              </div>
            </CardContent>
          </Card>
        ))}
        {amendments.length === 0 && <Card className="p-12 text-center text-muted-foreground">No amendments</Card>}
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Amendment</DialogTitle><DialogDescription>Create an amendment for an existing contract</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label>Contract ID *</Label><Input value={form.originalContractId} onChange={(e) => setForm(p => ({ ...p, originalContractId: e.target.value }))} /></div>
            <div><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))} /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Type</Label><Select value={form.amendmentType} onValueChange={(v) => setForm(p => ({ ...p, amendmentType: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="MODIFICATION">Modification</SelectItem><SelectItem value="EXTENSION">Extension</SelectItem><SelectItem value="PRICE_CHANGE">Price Change</SelectItem><SelectItem value="SCOPE_CHANGE">Scope Change</SelectItem></SelectContent></Select></div>
              <div><Label>Financial Impact</Label><Input type="number" value={form.financialImpact} onChange={(e) => setForm(p => ({ ...p, financialImpact: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button><Button disabled={isSubmitting} onClick={handleAdd}>{isSubmitting ? 'Creating…' : 'Create'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
