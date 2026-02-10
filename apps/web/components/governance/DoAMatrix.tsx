'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Shield, Plus, DollarSign, Users, CheckCircle2, AlertTriangle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface DoAEntry {
  id: string; name: string; role: string; department: string | null;
  max_value: number | null; currency: string; requires_counter_sign: boolean;
  can_delegate: boolean; is_active: boolean; effective_from: string | null;
}

export default function DoAMatrix() {
  const [entries, setEntries] = useState<DoAEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', role: '', department: '', maxValue: '', currency: 'USD', requiresCounterSign: false, canDelegate: true });

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch('/api/governance/delegation');
      const json = await res.json();
      if (json.success) setEntries(json.data.entries);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const handleAdd = async () => {
    if (!form.name || !form.role) { toast.error('Name and role are required'); return; }
    try {
      const res = await fetch('/api/governance/delegation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, maxValue: form.maxValue ? parseFloat(form.maxValue) : null }),
      });
      if ((await res.json()).success) { toast.success('Entry added'); setShowAdd(false); setForm({ name: '', role: '', department: '', maxValue: '', currency: 'USD', requiresCounterSign: false, canDelegate: true }); fetchEntries(); }
    } catch { toast.error('Failed to add entry'); }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/governance/delegation?id=${id}`, { method: 'DELETE' });
      if ((await res.json()).success) { toast.success('Entry deleted'); fetchEntries(); }
    } catch { toast.error('Failed to delete'); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><Shield className="h-8 w-8" /> Delegation of Authority</h1>
          <p className="text-muted-foreground mt-1">Configure approval authority by role, department, and value</p>
        </div>
        <Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-2" /> Add Entry</Button>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">Name</th><th className="text-left p-3 font-medium">Role</th>
              <th className="text-left p-3 font-medium">Department</th><th className="text-right p-3 font-medium">Max Value</th>
              <th className="text-center p-3 font-medium">Counter-Sign</th><th className="text-center p-3 font-medium">Status</th>
              <th className="text-right p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {entries.map((e) => (
              <tr key={e.id} className="hover:bg-muted/30">
                <td className="p-3 font-medium">{e.name}</td>
                <td className="p-3"><Badge variant="outline">{e.role}</Badge></td>
                <td className="p-3 text-muted-foreground">{e.department || '—'}</td>
                <td className="p-3 text-right font-mono">{e.max_value ? `${e.currency} ${Number(e.max_value).toLocaleString()}` : 'Unlimited'}</td>
                <td className="p-3 text-center">{e.requires_counter_sign ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" /> : <span className="text-muted-foreground">—</span>}</td>
                <td className="p-3 text-center"><Badge className={e.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>{e.is_active ? 'Active' : 'Inactive'}</Badge></td>
                <td className="p-3 text-right"><Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(e.id)}><Trash2 className="h-4 w-4" /></Button></td>
              </tr>
            ))}
            {entries.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No delegation entries configured</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Delegation Entry</DialogTitle><DialogDescription>Define approval authority boundaries</DialogDescription></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} placeholder="VP Finance Approval" /></div>
            <div><Label>Role *</Label><Input value={form.role} onChange={(e) => setForm(p => ({ ...p, role: e.target.value }))} placeholder="e.g. VP, Director" /></div>
            <div><Label>Department</Label><Input value={form.department} onChange={(e) => setForm(p => ({ ...p, department: e.target.value }))} /></div>
            <div><Label>Max Value ({form.currency})</Label><Input type="number" value={form.maxValue} onChange={(e) => setForm(p => ({ ...p, maxValue: e.target.value }))} placeholder="Unlimited if empty" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button><Button onClick={handleAdd}>Add</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
