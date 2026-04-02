'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ClipboardList, Plus, Filter, Clock, AlertTriangle, CheckCircle2, XCircle, BarChart3, ArrowRight, Users, FileX } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/shared/EmptyState';

interface ContractRequest {
  id: string;
  title: string;
  description: string | null;
  request_type: string;
  urgency: string;
  status: string;
  department: string | null;
  counterparty_name: string | null;
  estimated_value: number | null;
  assigned_to: string | null;
  sla_deadline: string | null;
  created_at: string;
  requester_id: string;
}

const statusColors: Record<string, string> = {
  SUBMITTED: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  IN_TRIAGE: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  APPROVED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  IN_PROGRESS: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  COMPLETED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  CANCELLED: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
};

const urgencyColors: Record<string, string> = {
  CRITICAL: 'bg-red-500 text-white',
  HIGH: 'bg-orange-500 text-white',
  MEDIUM: 'bg-yellow-500 text-black',
  LOW: 'bg-gray-400 text-white',
};

export default function ContractRequestsHub() {
  const [requests, setRequests] = useState<ContractRequest[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [triageDialog, setTriageDialog] = useState<{ open: boolean; request: ContractRequest | null }>({ open: false, request: null });
  const [triageNotes, setTriageNotes] = useState('');
  const [tab, setTab] = useState('triage');

  const fetchRequests = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.set('status', filterStatus);
      if (tab === 'my-requests') params.set('view', 'my-requests');
      const res = await fetch(`/api/requests?${params}`);
      const json = await res.json();
      if (json.success) {
        setRequests(json.data.requests);
        setMetrics(json.data.metrics);
      }
    } catch { toast.error('Failed to load requests'); }
    finally { setLoading(false); }
  }, [filterStatus, tab]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleTriage = async () => {
    if (!triageDialog.request) return;
    try {
      const res = await fetch('/api/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: triageDialog.request.id, action: 'triage', triageNotes }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Request triaged successfully');
        setTriageDialog({ open: false, request: null });
        setTriageNotes('');
        fetchRequests();
      }
    } catch { toast.error('Failed to triage request'); }
  };

  const handleAction = async (id: string, action: string, extra?: Record<string, any>) => {
    try {
      const res = await fetch('/api/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, ...extra }),
      });
      const json = await res.json();
      if (json.success) { toast.success(`Request ${action}d`); fetchRequests(); }
    } catch { toast.error(`Failed to ${action} request`); }
  };

  const isOverdue = (deadline: string | null) => deadline && new Date(deadline) < new Date();

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="max-w-[1600px] mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><ClipboardList className="h-8 w-8" /> Contract Requests</h1>
          <p className="text-muted-foreground mt-1">Intake, triage, and track contract requests</p>
        </div>
        <Button asChild><a href="/requests/new"><Plus className="h-4 w-4 mr-2" /> New Request</a></Button>
      </div>

      {/* Metrics */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { label: 'Total', value: metrics.total, icon: BarChart3, color: 'text-blue-600' },
            { label: 'Submitted', value: metrics.submitted, icon: ClipboardList, color: 'text-blue-500' },
            { label: 'In Triage', value: metrics.in_triage, icon: Filter, color: 'text-yellow-500' },
            { label: 'Approved', value: metrics.approved, icon: CheckCircle2, color: 'text-green-500' },
            { label: 'In Progress', value: metrics.in_progress, icon: ArrowRight, color: 'text-purple-500' },
            { label: 'SLA Breached', value: metrics.sla_breached, icon: AlertTriangle, color: 'text-red-500' },
            { label: 'Escalated', value: metrics.escalated, icon: Users, color: 'text-orange-500' },
          ].map((m) => (
            <Card key={m.label} className="p-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><m.icon className={cn('h-4 w-4', m.color)} />{m.label}</div>
              <p className={cn('text-2xl font-bold mt-1', m.color)}>{m.value}</p>
            </Card>
          ))}
        </div>
      )}

      <Tabs value={tab} onValueChange={(v) => { setTab(v); setLoading(true); }}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="triage">Triage Inbox</TabsTrigger>
            <TabsTrigger value="all">All Requests</TabsTrigger>
            <TabsTrigger value="my-requests">My Requests</TabsTrigger>
          </TabsList>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Filter status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="SUBMITTED">Submitted</SelectItem>
              <SelectItem value="IN_TRIAGE">In Triage</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <TabsContent value={tab} className="space-y-3 mt-4">
          {requests.length === 0 ? (
            <EmptyState
              variant="no-results"
              title="No requests found"
              description={filterStatus !== 'all' ? 'Try adjusting your filters to see more results.' : 'Create a new contract request to get started.'}
              primaryAction={{
                label: 'New Request',
                href: '/requests/new',
                icon: Plus,
              }}
            />
          ) : requests.map((req) => (
            <Card key={req.id} className={cn('hover:shadow-md transition-shadow', isOverdue(req.sla_deadline) && req.status !== 'COMPLETED' && req.status !== 'REJECTED' && 'border-red-300 dark:border-red-800')}>
              <CardContent className="py-4 px-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold truncate">{req.title}</h3>
                      <Badge className={cn('text-xs', statusColors[req.status])}>{req.status.replace(/_/g, ' ')}</Badge>
                      <Badge className={cn('text-xs', urgencyColors[req.urgency])}>{req.urgency}</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{req.request_type.replace(/_/g, ' ')}</span>
                      {req.counterparty_name && <span>• {req.counterparty_name}</span>}
                      {req.department && <span>• {req.department}</span>}
                      {req.estimated_value && <span>• ${Number(req.estimated_value).toLocaleString()}</span>}
                    </div>
                    {req.sla_deadline && (
                      <div className={cn('flex items-center gap-1 mt-1 text-xs', isOverdue(req.sla_deadline) && req.status !== 'COMPLETED' ? 'text-red-500' : 'text-muted-foreground')}>
                        <Clock className="h-3 w-3" /> SLA: {new Date(req.sla_deadline).toLocaleDateString()}
                        {isOverdue(req.sla_deadline) && req.status !== 'COMPLETED' && <Badge variant="destructive" className="text-[10px] ml-1">OVERDUE</Badge>}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {req.status === 'SUBMITTED' && (
                      <Button size="sm" variant="outline" onClick={() => { setTriageDialog({ open: true, request: req }); }}>Triage</Button>
                    )}
                    {req.status === 'IN_TRIAGE' && (
                      <>
                        <Button size="sm" variant="default" onClick={() => handleAction(req.id, 'approve')}>Approve</Button>
                        <Button size="sm" variant="destructive" onClick={() => handleAction(req.id, 'reject', { reason: 'Rejected by reviewer' })}>Reject</Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* Triage Dialog */}
      <Dialog open={triageDialog.open} onOpenChange={(o) => setTriageDialog({ open: o, request: triageDialog.request })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Triage Request</DialogTitle>
            <DialogDescription>Review and assign this contract request</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><p className="text-sm font-medium mb-1">Request</p><p className="text-sm text-muted-foreground">{triageDialog.request?.title}</p></div>
            <div><p className="text-sm font-medium mb-1">Triage Notes</p>
              <Textarea value={triageNotes} onChange={(e) => setTriageNotes(e.target.value)} placeholder="Add triage notes..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTriageDialog({ open: false, request: null })}>Cancel</Button>
            <Button onClick={handleTriage}>Assign & Triage</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
