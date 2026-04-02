'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ShieldCheck, Plus, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/shared/EmptyState';

export default function DlpPoliciesManager() {
  const [policies, setPolicies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', policyType: 'DOWNLOAD_RESTRICTION' });

  const fetchPolicies = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/dlp-policies');
      const json = await res.json();
      if (json.success) setPolicies(json.data.policies);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPolicies(); }, [fetchPolicies]);

  const handleAdd = async () => {
    if (!form.name) { toast.error('Name required'); return; }
    try {
      const res = await fetch('/api/admin/dlp-policies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if ((await res.json()).success) { toast.success('Policy created'); setShowAdd(false); fetchPolicies(); }
    } catch { toast.error('Failed'); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="max-w-[1600px] mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><ShieldCheck className="h-8 w-8" /> DLP Policies</h1><p className="text-muted-foreground mt-1">Data Loss Prevention controls</p></div>
        <Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-2" /> Add Policy</Button>
      </div>

      <div className="space-y-3">
        {policies.map((p: any) => (
          <Card key={p.id}><CardContent className="py-4 px-5 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2"><h3 className="font-semibold">{p.name}</h3><Badge variant="outline">{p.policy_type}</Badge></div>
              <p className="text-sm text-muted-foreground mt-1">{p.description || 'No description'}</p>
            </div>
            <Badge className={p.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>{p.is_active ? 'Active' : 'Inactive'}</Badge>
          </CardContent></Card>
        ))}
        {policies.length === 0 && (
          <EmptyState
            variant="no-data"
            title="No DLP policies"
            description="Create data loss prevention policies to protect sensitive information."
            primaryAction={{
              label: 'Add Policy',
              onClick: () => setShowAdd(true),
              icon: Plus,
            }}
          />
        )}
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add DLP Policy</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Policy Name *</Label><Input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} /></div>
            <div><Label>Policy Type</Label><Input value={form.policyType} onChange={(e) => setForm(p => ({ ...p, policyType: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button><Button onClick={handleAdd}>Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
