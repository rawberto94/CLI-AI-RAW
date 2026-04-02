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
import { DollarSign, Plus, FileText, Receipt, AlertTriangle, CheckCircle2, XCircle, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function SpendManagementHub() {
  const [tab, setTab] = useState('overview');
  const [data, setData] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [showAddPO, setShowAddPO] = useState(false);
  const [showAddInvoice, setShowAddInvoice] = useState(false);
  const [poForm, setPoForm] = useState({ poNumber: '', vendorName: '', totalAmount: '', currency: 'USD' });
  const [invForm, setInvForm] = useState({ invoiceNumber: '', vendorName: '', totalAmount: '', poId: '' });

  const fetchData = useCallback(async () => {
    try {
      const type = tab === 'overview' ? 'overview' : tab === 'pos' ? 'purchase-orders' : tab === 'invoices' ? 'invoices' : 'exceptions';
      const res = await fetch(`/api/spend?type=${type}`);
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handlePO = async () => {
    if (!poForm.poNumber || !poForm.vendorName || !poForm.totalAmount) { toast.error('Fill required fields'); return; }
    try {
      const res = await fetch('/api/spend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'purchase-order', ...poForm, totalAmount: parseFloat(poForm.totalAmount) }) });
      if ((await res.json()).success) { toast.success('PO created'); setShowAddPO(false); fetchData(); }
    } catch { toast.error('Failed'); }
  };

  const handleInvoice = async () => {
    if (!invForm.invoiceNumber || !invForm.vendorName || !invForm.totalAmount) { toast.error('Fill required fields'); return; }
    try {
      const res = await fetch('/api/spend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'invoice', ...invForm, totalAmount: parseFloat(invForm.totalAmount) }) });
      if ((await res.json()).success) { toast.success('Invoice created'); setShowAddInvoice(false); fetchData(); }
    } catch { toast.error('Failed'); }
  };

  const handleMatch = async (invoiceId: string) => {
    try {
      const res = await fetch('/api/spend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'match', invoiceId }) });
      const json = await res.json();
      if (json.success) { toast.success(`Match result: ${json.data.matchStatus}`); fetchData(); }
    } catch { toast.error('Match failed'); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="max-w-[1600px] mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><DollarSign className="h-8 w-8" /> Spend Management</h1><p className="text-muted-foreground mt-1">Purchase orders, invoices, 3-way matching, and budget tracking</p></div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowAddPO(true)}><FileText className="h-4 w-4 mr-2" /> New PO</Button>
          <Button onClick={() => setShowAddInvoice(true)}><Receipt className="h-4 w-4 mr-2" /> New Invoice</Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => { setTab(v); setLoading(true); }}>
        <TabsList><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="pos">Purchase Orders</TabsTrigger><TabsTrigger value="invoices">Invoices</TabsTrigger><TabsTrigger value="exceptions">Exceptions</TabsTrigger></TabsList>

        <TabsContent value="overview" className="mt-4">
          {data.metrics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="p-4"><div className="text-sm text-muted-foreground flex items-center gap-1"><FileText className="h-4 w-4" /> Total POs</div><p className="text-2xl font-bold">{data.metrics.total_pos}</p><p className="text-sm text-muted-foreground">${Number(data.metrics.total_po_value).toLocaleString()}</p></Card>
              <Card className="p-4"><div className="text-sm text-muted-foreground flex items-center gap-1"><Receipt className="h-4 w-4" /> Total Invoices</div><p className="text-2xl font-bold">{data.metrics.total_invoices}</p><p className="text-sm text-muted-foreground">${Number(data.metrics.total_invoice_value).toLocaleString()}</p></Card>
              <Card className="p-4"><div className="text-sm text-muted-foreground flex items-center gap-1"><CheckCircle2 className="h-4 w-4 text-green-500" /> Matched</div><p className="text-2xl font-bold text-green-500">{data.metrics.matched}</p></Card>
              <Card className="p-4"><div className="text-sm text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-4 w-4 text-red-500" /> Discrepancies</div><p className="text-2xl font-bold text-red-500">{data.metrics.discrepant}</p></Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="pos" className="mt-4 space-y-3">
          {(data.purchaseOrders || []).map((po: any) => (
            <Card key={po.id}><CardContent className="py-4 px-5 flex items-center justify-between">
              <div><h3 className="font-semibold">{po.po_number}</h3><p className="text-sm text-muted-foreground">{po.vendor_name}</p></div>
              <div className="text-right"><p className="font-bold">${Number(po.total_amount).toLocaleString()}</p><Badge variant="outline">{po.status}</Badge></div>
            </CardContent></Card>
          ))}
          {(!data.purchaseOrders || data.purchaseOrders.length === 0) && <Card className="p-12 text-center text-muted-foreground">No purchase orders</Card>}
        </TabsContent>

        <TabsContent value="invoices" className="mt-4 space-y-3">
          {(data.invoices || []).map((inv: any) => (
            <Card key={inv.id}><CardContent className="py-4 px-5 flex items-center justify-between">
              <div><h3 className="font-semibold">{inv.invoice_number}</h3><p className="text-sm text-muted-foreground">{inv.vendor_name}</p></div>
              <div className="flex items-center gap-3">
                <div className="text-right"><p className="font-bold">${Number(inv.total_amount).toLocaleString()}</p>
                  <Badge className={inv.match_status === 'MATCHED' ? 'bg-green-100 text-green-800' : inv.match_status === 'DISCREPANCY' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}>{inv.match_status || 'UNMATCHED'}</Badge>
                </div>
                {(!inv.match_status || inv.match_status === 'UNMATCHED') && <Button size="sm" onClick={() => handleMatch(inv.id)}>Match</Button>}
              </div>
            </CardContent></Card>
          ))}
          {(!data.invoices || data.invoices.length === 0) && <Card className="p-12 text-center text-muted-foreground">No invoices</Card>}
        </TabsContent>

        <TabsContent value="exceptions" className="mt-4 space-y-3">
          {(data.exceptions || []).map((ex: any) => (
            <Card key={ex.id} className="border-orange-200"><CardContent className="py-4 px-5 flex items-center justify-between">
              <div><h3 className="font-semibold flex items-center gap-1"><AlertTriangle className="h-4 w-4 text-orange-500" /> {ex.exception_type}</h3><p className="text-sm text-muted-foreground">{ex.description}</p></div>
              <Badge className={ex.status === 'OPEN' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}>{ex.status}</Badge>
            </CardContent></Card>
          ))}
          {(!data.exceptions || data.exceptions.length === 0) && <Card className="p-12 text-center text-muted-foreground">No exceptions</Card>}
        </TabsContent>
      </Tabs>

      {/* PO Dialog */}
      <Dialog open={showAddPO} onOpenChange={setShowAddPO}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Purchase Order</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>PO Number *</Label><Input value={poForm.poNumber} onChange={(e) => setPoForm(p => ({ ...p, poNumber: e.target.value }))} /></div>
            <div><Label>Vendor *</Label><Input value={poForm.vendorName} onChange={(e) => setPoForm(p => ({ ...p, vendorName: e.target.value }))} /></div>
            <div><Label>Amount *</Label><Input type="number" value={poForm.totalAmount} onChange={(e) => setPoForm(p => ({ ...p, totalAmount: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowAddPO(false)}>Cancel</Button><Button onClick={handlePO}>Create PO</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Dialog */}
      <Dialog open={showAddInvoice} onOpenChange={setShowAddInvoice}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Invoice</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Invoice Number *</Label><Input value={invForm.invoiceNumber} onChange={(e) => setInvForm(p => ({ ...p, invoiceNumber: e.target.value }))} /></div>
            <div><Label>Vendor *</Label><Input value={invForm.vendorName} onChange={(e) => setInvForm(p => ({ ...p, vendorName: e.target.value }))} /></div>
            <div><Label>Amount *</Label><Input type="number" value={invForm.totalAmount} onChange={(e) => setInvForm(p => ({ ...p, totalAmount: e.target.value }))} /></div>
            <div><Label>PO ID (for matching)</Label><Input value={invForm.poId} onChange={(e) => setInvForm(p => ({ ...p, poId: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowAddInvoice(false)}>Cancel</Button><Button onClick={handleInvoice}>Create Invoice</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
