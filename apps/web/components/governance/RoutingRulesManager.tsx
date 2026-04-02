'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Route, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/shared/EmptyState';

export default function RoutingRulesManager() {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', priority: 0, assignedUser: '', slaHours: '' });

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch('/api/routing-rules');
      const json = await res.json();
      if (json.success) setRules(json.data.rules);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const handleAdd = async () => {
    if (!form.name) { toast.error('Name is required'); return; }
    try {
      const res = await fetch('/api/routing-rules', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, slaHours: form.slaHours ? parseInt(form.slaHours) : null }),
      });
      if ((await res.json()).success) { toast.success('Rule created'); setShowAdd(false); setForm({ name: '', description: '', priority: 0, assignedUser: '', slaHours: '' }); fetchRules(); }
    } catch { toast.error('Failed to create rule'); }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/routing-rules?id=${id}`, { method: 'DELETE' });
      if ((await res.json()).success) { toast.success('Rule deleted'); fetchRules(); }
    } catch { toast.error('Failed to delete'); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="max-w-[1600px] mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><Route className="h-8 w-8" /> Routing Rules</h1><p className="text-muted-foreground mt-1">Auto-route contract requests to the right team</p></div>
        <Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-2" /> Add Rule</Button>
      </div>

      <div className="space-y-3">
        {rules.map((rule: any) => (
          <Card key={rule.id} className="hover:shadow-md transition-shadow">
            <CardContent className="py-4 px-5 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2"><h3 className="font-semibold">{rule.name}</h3><Badge variant="outline">Priority {rule.priority}</Badge></div>
                <p className="text-sm text-muted-foreground mt-1">{rule.description || 'No description'}</p>
                <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                  {rule.assigned_team && <span>Team: {rule.assigned_team}</span>}
                  {rule.assigned_user && <span>User: {rule.assigned_user}</span>}
                  {rule.sla_hours && <span>SLA: {rule.sla_hours}h</span>}
                  {rule.auto_approve && <Badge className="bg-blue-100 text-blue-800 text-[10px]">Auto-Approve</Badge>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={rule.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>{rule.is_active ? 'Active' : 'Inactive'}</Badge>
                <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleDelete(rule.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {rules.length === 0 && (
          <EmptyState
            variant="no-data"
            title="No routing rules"
            description="Create rules to automatically route contracts to the right teams."
            primaryAction={{
              label: 'Add Rule',
              onClick: () => setShowAdd(true),
              icon: Plus,
            }}
          />
        )}
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Routing Rule</DialogTitle><DialogDescription>Configure auto-routing for incoming requests</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label>Rule Name *</Label><Input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Priority</Label><Input type="number" value={form.priority} onChange={(e) => setForm(p => ({ ...p, priority: parseInt(e.target.value) || 0 }))} /></div>
              <div><Label>SLA (hours)</Label><Input type="number" value={form.slaHours} onChange={(e) => setForm(p => ({ ...p, slaHours: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button><Button onClick={handleAdd}>Create Rule</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
