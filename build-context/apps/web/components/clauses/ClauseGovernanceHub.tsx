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
import { BookOpen, Plus, CheckCircle2, XCircle, Clock, History } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function ClauseGovernanceHub() {
  const [tab, setTab] = useState('pending');
  const [approvals, setApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewDialog, setReviewDialog] = useState<{ open: boolean; id: string | null; action: string }>({ open: false, id: null, action: '' });
  const [reviewNotes, setReviewNotes] = useState('');

  const fetchApprovals = useCallback(async () => {
    try {
      const status = tab === 'pending' ? 'PENDING' : tab === 'approved' ? 'APPROVED' : tab === 'rejected' ? 'REJECTED' : '';
      const params = status ? `?status=${status}` : '';
      const res = await fetch(`/api/clauses/governance${params}`);
      const json = await res.json();
      if (json.success) setApprovals(json.data.approvals);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { fetchApprovals(); }, [fetchApprovals]);

  const handleReview = async () => {
    if (!reviewDialog.id) return;
    try {
      const res = await fetch('/api/clauses/governance', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: reviewDialog.id, action: reviewDialog.action, notes: reviewNotes }) });
      if ((await res.json()).success) { toast.success(`Clause ${reviewDialog.action}d`); setReviewDialog({ open: false, id: null, action: '' }); setReviewNotes(''); fetchApprovals(); }
    } catch { toast.error('Failed'); }
  };

  const statusIcons: Record<string, { icon: any; color: string }> = {
    PENDING: { icon: Clock, color: 'text-yellow-500' },
    APPROVED: { icon: CheckCircle2, color: 'text-green-500' },
    REJECTED: { icon: XCircle, color: 'text-red-500' },
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><BookOpen className="h-8 w-8" /> Clause Governance</h1><p className="text-muted-foreground mt-1">Review and approve clause changes</p></div>
      </div>

      <Tabs value={tab} onValueChange={(v) => { setTab(v); setLoading(true); }}>
        <TabsList>
          <TabsTrigger value="pending">Pending Review</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4 space-y-3">
          {approvals.map((a: any) => {
            const si = statusIcons[a.status] || statusIcons.PENDING;
            const StatusIcon = si.icon;
            return (
              <Card key={a.id} className="hover:shadow-md transition-shadow">
                <CardContent className="py-4 px-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <StatusIcon className={cn('h-5 w-5', si.color)} />
                    <div>
                      <h3 className="font-semibold">{a.clause_title || `Clause ${a.clause_id?.slice(0, 8)}`}</h3>
                      <div className="flex gap-2 mt-1 text-sm text-muted-foreground">
                        {a.clause_category && <Badge variant="outline">{a.clause_category}</Badge>}
                        {a.clause_risk && <Badge variant="outline">{a.clause_risk}</Badge>}
                        <span>v{a.version}</span>
                        <span>Submitted: {new Date(a.submitted_at).toLocaleDateString()}</span>
                      </div>
                      {a.changes_summary && <p className="text-sm text-muted-foreground mt-1">{a.changes_summary}</p>}
                    </div>
                  </div>
                  {a.status === 'PENDING' && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => setReviewDialog({ open: true, id: a.id, action: 'approve' })}>Approve</Button>
                      <Button size="sm" variant="destructive" onClick={() => setReviewDialog({ open: true, id: a.id, action: 'reject' })}>Reject</Button>
                    </div>
                  )}
                  {a.status !== 'PENDING' && a.review_notes && (
                    <p className="text-sm text-muted-foreground max-w-xs truncate">{a.review_notes}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {approvals.length === 0 && <Card className="p-12 text-center text-muted-foreground">No clause approvals in this category</Card>}
        </TabsContent>
      </Tabs>

      <Dialog open={reviewDialog.open} onOpenChange={(o) => setReviewDialog(p => ({ ...p, open: o }))}>
        <DialogContent>
          <DialogHeader><DialogTitle>{reviewDialog.action === 'approve' ? 'Approve Clause' : 'Reject Clause'}</DialogTitle><DialogDescription>Add review notes for this decision</DialogDescription></DialogHeader>
          <Textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder="Review notes..." />
          <DialogFooter><Button variant="outline" onClick={() => setReviewDialog({ open: false, id: null, action: '' })}>Cancel</Button><Button variant={reviewDialog.action === 'approve' ? 'default' : 'destructive'} onClick={handleReview}>{reviewDialog.action === 'approve' ? 'Approve' : 'Reject'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
