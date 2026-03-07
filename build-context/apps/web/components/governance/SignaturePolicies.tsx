'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PenTool, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/shared/EmptyState';

export default function SignaturePolicies() {
  const [policies, setPolicies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', signingOrder: 'SEQUENTIAL', provider: 'DOCUSIGN', requiresWetSignature: false, requiresNotarization: false });

  const fetchPolicies = useCallback(async () => {
    try {
      const res = await fetch('/api/governance/signature-policies');
      const json = await res.json();
      if (json.success) setPolicies(json.data.policies);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPolicies(); }, [fetchPolicies]);

  const handleAdd = async () => {
    if (!form.name) { toast.error('Name is required'); return; }
    try {
      const res = await fetch('/api/governance/signature-policies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if ((await res.json()).success) { toast.success('Policy created'); setShowAdd(false); fetchPolicies(); }
    } catch { toast.error('Failed to create'); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><PenTool className="h-8 w-8" /> Signature Policies</h1><p className="text-muted-foreground mt-1">Configure e-signature workflows and requirements</p></div>
        <Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-2" /> Add Policy</Button>
      </div>

      <div className="grid gap-4">
        {policies.map((p: any) => (
          <Card key={p.id}>
            <CardContent className="py-4 px-5 flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{p.name}</h3>
                <p className="text-sm text-muted-foreground">{p.description || 'No description'}</p>
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline">{p.signing_order}</Badge>
                  <Badge variant="outline">{p.provider}</Badge>
                  {p.requires_wet_signature && <Badge variant="secondary">Wet Signature</Badge>}
                  {p.requires_notarization && <Badge variant="secondary">Notarization</Badge>}
                </div>
              </div>
              <Badge className={p.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>{p.is_active ? 'Active' : 'Inactive'}</Badge>
            </CardContent>
          </Card>
        ))}
        {policies.length === 0 && (
          <EmptyState
            variant="no-data"
            title="No signature policies"
            description="Define signature policies to control how contracts are signed."
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
          <DialogHeader><DialogTitle>Add Signature Policy</DialogTitle><DialogDescription>Define signing requirements</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Signing Order</Label><Select value={form.signingOrder} onValueChange={(v) => setForm(p => ({ ...p, signingOrder: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SEQUENTIAL">Sequential</SelectItem><SelectItem value="PARALLEL">Parallel</SelectItem></SelectContent></Select></div>
              <div><Label>Provider</Label><Select value={form.provider} onValueChange={(v) => setForm(p => ({ ...p, provider: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="DOCUSIGN">DocuSign</SelectItem><SelectItem value="ADOBE_SIGN">Adobe Sign</SelectItem><SelectItem value="INTERNAL">Internal</SelectItem></SelectContent></Select></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button><Button onClick={handleAdd}>Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
