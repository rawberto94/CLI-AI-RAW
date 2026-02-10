'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export default function ContractRequestForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', requestType: 'NEW_CONTRACT', urgency: 'MEDIUM',
    department: '', costCenter: '', estimatedValue: '', currency: 'USD',
    counterpartyName: '', counterpartyEmail: '', contractType: '',
    desiredStartDate: '', desiredEndDate: '', businessJustification: '',
  });

  const update = (field: string, value: string) => setForm((p) => ({ ...p, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, estimatedValue: form.estimatedValue ? parseFloat(form.estimatedValue) : undefined }),
      });
      const json = await res.json();
      if (json.success) { toast.success('Contract request submitted!'); router.push('/requests'); }
      else toast.error(json.error?.message || 'Failed to submit');
    } catch { toast.error('Network error'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <Button variant="ghost" className="mb-4" onClick={() => router.push('/requests')}><ArrowLeft className="h-4 w-4 mr-2" /> Back to Requests</Button>
      <Card>
        <CardHeader>
          <CardTitle>New Contract Request</CardTitle>
          <CardDescription>Submit a request for a new contract, renewal, or amendment</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2"><Label>Title *</Label><Input value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="e.g. New SaaS vendor agreement" /></div>
              <div className="md:col-span-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="Describe the contract need..." rows={3} /></div>
              <div><Label>Request Type</Label>
                <Select value={form.requestType} onValueChange={(v) => update('requestType', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NEW_CONTRACT">New Contract</SelectItem>
                    <SelectItem value="RENEWAL">Renewal</SelectItem>
                    <SelectItem value="AMENDMENT">Amendment</SelectItem>
                    <SelectItem value="ADDENDUM">Addendum</SelectItem>
                    <SelectItem value="TERMINATION">Termination</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Urgency</Label>
                <Select value={form.urgency} onValueChange={(v) => update('urgency', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="CRITICAL">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Department</Label><Input value={form.department} onChange={(e) => update('department', e.target.value)} placeholder="e.g. Engineering" /></div>
              <div><Label>Cost Center</Label><Input value={form.costCenter} onChange={(e) => update('costCenter', e.target.value)} placeholder="e.g. CC-1234" /></div>
              <div><Label>Estimated Value</Label><Input type="number" value={form.estimatedValue} onChange={(e) => update('estimatedValue', e.target.value)} placeholder="0.00" /></div>
              <div><Label>Currency</Label>
                <Select value={form.currency} onValueChange={(v) => update('currency', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="EUR">EUR</SelectItem><SelectItem value="GBP">GBP</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Counterparty Name</Label><Input value={form.counterpartyName} onChange={(e) => update('counterpartyName', e.target.value)} placeholder="Vendor/partner name" /></div>
              <div><Label>Counterparty Email</Label><Input type="email" value={form.counterpartyEmail} onChange={(e) => update('counterpartyEmail', e.target.value)} placeholder="contact@vendor.com" /></div>
              <div><Label>Contract Type</Label><Input value={form.contractType} onChange={(e) => update('contractType', e.target.value)} placeholder="e.g. MSA, SOW, NDA" /></div>
              <div><Label>Desired Start</Label><Input type="date" value={form.desiredStartDate} onChange={(e) => update('desiredStartDate', e.target.value)} /></div>
              <div><Label>Desired End</Label><Input type="date" value={form.desiredEndDate} onChange={(e) => update('desiredEndDate', e.target.value)} /></div>
              <div className="md:col-span-2"><Label>Business Justification</Label><Textarea value={form.businessJustification} onChange={(e) => update('businessJustification', e.target.value)} placeholder="Why is this contract needed?" rows={3} /></div>
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => router.push('/requests')}>Cancel</Button>
              <Button type="submit" disabled={submitting}><Send className="h-4 w-4 mr-2" />{submitting ? 'Submitting...' : 'Submit Request'}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
