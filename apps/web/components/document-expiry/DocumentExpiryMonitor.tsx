'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileWarning, Plus, AlertTriangle, CheckCircle2, Clock, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function DocumentExpiryMonitor() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ vendorName: '', documentType: 'CERTIFICATE', documentName: '', expiryDate: '' });

  const fetchDocs = useCallback(async () => {
    try {
      const res = await fetch('/api/document-expiry');
      const json = await res.json();
      if (json.success) { setDocuments(json.data.documents); setMetrics(json.data.metrics); }
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const handleAdd = async () => {
    if (!form.vendorName || !form.documentName || !form.expiryDate) { toast.error('Vendor, document name and expiry date are required'); return; }
    try {
      const res = await fetch('/api/document-expiry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if ((await res.json()).success) { toast.success('Document tracked'); setShowAdd(false); fetchDocs(); }
    } catch { toast.error('Failed'); }
  };

  const statusConfig: Record<string, { icon: any; color: string; label: string }> = {
    EXPIRED: { icon: AlertTriangle, color: 'text-red-500', label: 'Expired' },
    EXPIRING_SOON: { icon: Clock, color: 'text-yellow-500', label: 'Expiring Soon' },
    ACTIVE: { icon: CheckCircle2, color: 'text-green-500', label: 'Valid' },
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="max-w-[1600px] mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><FileWarning className="h-8 w-8" /> Document Expiry Monitor</h1><p className="text-muted-foreground mt-1">Track vendor certificates, licenses, and document renewals</p></div>
        <Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-2" /> Track Document</Button>
      </div>

      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4"><div className="text-sm text-muted-foreground">Expired</div><p className="text-2xl font-bold text-red-500">{metrics.expired}</p></Card>
          <Card className="p-4"><div className="text-sm text-muted-foreground">Expiring (30d)</div><p className="text-2xl font-bold text-yellow-500">{metrics.expiring_30d}</p></Card>
          <Card className="p-4"><div className="text-sm text-muted-foreground">Expiring (90d)</div><p className="text-2xl font-bold text-orange-500">{metrics.expiring_90d}</p></Card>
          <Card className="p-4"><div className="text-sm text-muted-foreground">Valid</div><p className="text-2xl font-bold text-green-500">{metrics.valid}</p></Card>
        </div>
      )}

      <div className="space-y-3">
        {documents.map((doc: any) => {
          const status = statusConfig[doc.computed_status] || statusConfig.ACTIVE;
          const StatusIcon = status.icon;
          return (
            <Card key={doc.id} className={cn('hover:shadow-md transition-shadow', doc.computed_status === 'EXPIRED' && 'border-red-300 dark:border-red-800')}>
              <CardContent className="py-4 px-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <StatusIcon className={cn('h-5 w-5', status.color)} />
                  <div>
                    <h3 className="font-semibold">{doc.document_name}</h3>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>{doc.vendor_name}</span><Badge variant="outline">{doc.document_type}</Badge>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <Badge className={cn(doc.computed_status === 'EXPIRED' ? 'bg-red-100 text-red-800' : doc.computed_status === 'EXPIRING_SOON' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800')}>{status.label}</Badge>
                  <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1 justify-end"><Calendar className="h-3 w-3" />{new Date(doc.expiry_date).toLocaleDateString()}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {documents.length === 0 && <Card className="p-12 text-center text-muted-foreground">No documents tracked</Card>}
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Track Document Expiry</DialogTitle><DialogDescription>Add a certificate, license, or insurance document to monitor</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label>Vendor Name *</Label><Input value={form.vendorName} onChange={(e) => setForm(p => ({ ...p, vendorName: e.target.value }))} /></div>
            <div><Label>Document Name *</Label><Input value={form.documentName} onChange={(e) => setForm(p => ({ ...p, documentName: e.target.value }))} placeholder="e.g. SOC 2 Type II Report" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Type</Label><Select value={form.documentType} onValueChange={(v) => setForm(p => ({ ...p, documentType: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CERTIFICATE">Certificate</SelectItem><SelectItem value="LICENSE">License</SelectItem><SelectItem value="INSURANCE">Insurance</SelectItem><SelectItem value="COMPLIANCE_REPORT">Compliance Report</SelectItem><SelectItem value="OTHER">Other</SelectItem></SelectContent></Select></div>
              <div><Label>Expiry Date *</Label><Input type="date" value={form.expiryDate} onChange={(e) => setForm(p => ({ ...p, expiryDate: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button><Button onClick={handleAdd}>Track</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
