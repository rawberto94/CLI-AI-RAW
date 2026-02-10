'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { GripVertical, Plus, Lock, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function PreApprovalGates() {
  const [gates, setGates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', gateType: 'APPROVAL', gateOrder: 0, slaHours: '', appliesToValuesAbove: '' });

  const fetchGates = useCallback(async () => {
    try {
      const res = await fetch('/api/governance/pre-approval-gates');
      const json = await res.json();
      if (json.success) setGates(json.data.gates);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchGates(); }, [fetchGates]);

  const handleAdd = async () => {
    if (!form.name) { toast.error('Name is required'); return; }
    try {
      const res = await fetch('/api/governance/pre-approval-gates', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, slaHours: form.slaHours ? parseInt(form.slaHours) : null, appliesToValuesAbove: form.appliesToValuesAbove ? parseFloat(form.appliesToValuesAbove) : null }),
      });
      if ((await res.json()).success) { toast.success('Gate added'); setShowAdd(false); fetchGates(); }
    } catch { toast.error('Failed to add gate'); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><Lock className="h-8 w-8" /> Pre-Approval Gates</h1><p className="text-muted-foreground mt-1">Define mandatory checkpoints in the contract workflow</p></div>
        <Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-2" /> Add Gate</Button>
      </div>

      <div className="space-y-3">
        {gates.map((gate: any, idx: number) => (
          <Card key={gate.id} className="hover:shadow-md transition-shadow">
            <CardContent className="py-4 px-5 flex items-center gap-4">
              <div className="flex items-center gap-2 text-muted-foreground"><GripVertical className="h-5 w-5" /><span className="text-lg font-bold">{idx + 1}</span></div>
              <div className="flex-1">
                <div className="flex items-center gap-2"><h3 className="font-semibold">{gate.name}</h3><Badge variant="outline">{gate.gate_type}</Badge></div>
                <p className="text-sm text-muted-foreground mt-1">{gate.description || 'No description'}</p>
                <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                  {gate.sla_hours && <span>SLA: {gate.sla_hours}h</span>}
                  {gate.applies_to_values_above && <span>Min value: ${Number(gate.applies_to_values_above).toLocaleString()}</span>}
                  <span>Mode: {gate.approval_mode}</span>
                </div>
              </div>
              <Badge className={gate.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>{gate.is_active ? 'Active' : 'Inactive'}</Badge>
            </CardContent>
          </Card>
        ))}
        {gates.length === 0 && <Card className="p-12 text-center text-muted-foreground">No pre-approval gates configured</Card>}
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Pre-Approval Gate</DialogTitle><DialogDescription>Configure a new checkpoint in the approval workflow</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label>Gate Name *</Label><Input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Legal Review" /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Order</Label><Input type="number" value={form.gateOrder} onChange={(e) => setForm(p => ({ ...p, gateOrder: parseInt(e.target.value) || 0 }))} /></div>
              <div><Label>SLA (hours)</Label><Input type="number" value={form.slaHours} onChange={(e) => setForm(p => ({ ...p, slaHours: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button><Button onClick={handleAdd}>Add Gate</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
