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
import { ShieldAlert, Plus, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function VendorRiskDashboard() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [filterTier, setFilterTier] = useState('all');
  const [form, setForm] = useState({
    vendorName: '', financialRisk: 50, operationalRisk: 50, complianceRisk: 50, cyberRisk: 50, geopoliticalRisk: 50, notes: '',
  });

  const fetchProfiles = useCallback(async () => {
    try {
      const params = filterTier !== 'all' ? `?riskTier=${filterTier}` : '';
      const res = await fetch(`/api/vendor-risk${params}`);
      const json = await res.json();
      if (json.success) { setProfiles(json.data.profiles); setMetrics(json.data.metrics); }
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }, [filterTier]);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  const handleAdd = async () => {
    if (!form.vendorName) { toast.error('Vendor name is required'); return; }
    try {
      const res = await fetch('/api/vendor-risk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if ((await res.json()).success) { toast.success('Risk profile created'); setShowAdd(false); fetchProfiles(); }
    } catch { toast.error('Failed'); }
  };

  const tierColor = (tier: string) => tier === 'HIGH' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' : tier === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
  const scoreColor = (score: number) => score >= 70 ? 'text-red-500' : score >= 40 ? 'text-yellow-500' : 'text-green-500';

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><ShieldAlert className="h-8 w-8" /> Vendor Risk Management</h1><p className="text-muted-foreground mt-1">Third-party risk assessment and monitoring</p></div>
        <Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-2" /> New Assessment</Button>
      </div>

      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Total Vendors', value: metrics.total, icon: BarChart3, color: 'text-blue-600' },
            { label: 'High Risk', value: metrics.high_risk, icon: AlertTriangle, color: 'text-red-500' },
            { label: 'Medium Risk', value: metrics.medium_risk, icon: TrendingUp, color: 'text-yellow-500' },
            { label: 'Low Risk', value: metrics.low_risk, icon: CheckCircle2, color: 'text-green-500' },
            { label: 'Overdue Review', value: metrics.overdue, icon: TrendingDown, color: 'text-orange-500' },
          ].map((m) => (
            <Card key={m.label} className="p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><m.icon className={cn('h-4 w-4', m.color)} /> {m.label}</div>
              <p className={cn('text-2xl font-bold mt-1', m.color)}>{m.value}</p>
            </Card>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Select value={filterTier} onValueChange={(v) => { setFilterTier(v); setLoading(true); }}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filter by tier" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Tiers</SelectItem><SelectItem value="HIGH">High Risk</SelectItem><SelectItem value="MEDIUM">Medium Risk</SelectItem><SelectItem value="LOW">Low Risk</SelectItem></SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">Vendor</th><th className="text-center p-3 font-medium">Risk Tier</th>
              <th className="text-center p-3 font-medium">Score</th><th className="text-center p-3 font-medium">Financial</th>
              <th className="text-center p-3 font-medium">Operational</th><th className="text-center p-3 font-medium">Compliance</th>
              <th className="text-center p-3 font-medium">Cyber</th><th className="text-center p-3 font-medium">Next Review</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {profiles.map((p: any) => (
              <tr key={p.id} className="hover:bg-muted/30">
                <td className="p-3 font-medium">{p.vendor_name}</td>
                <td className="p-3 text-center"><Badge className={tierColor(p.risk_tier)}>{p.risk_tier}</Badge></td>
                <td className={cn('p-3 text-center font-bold', scoreColor(p.overall_score))}>{p.overall_score}</td>
                <td className={cn('p-3 text-center', scoreColor(p.financial_risk))}>{p.financial_risk}</td>
                <td className={cn('p-3 text-center', scoreColor(p.operational_risk))}>{p.operational_risk}</td>
                <td className={cn('p-3 text-center', scoreColor(p.compliance_risk))}>{p.compliance_risk}</td>
                <td className={cn('p-3 text-center', scoreColor(p.cyber_risk))}>{p.cyber_risk}</td>
                <td className="p-3 text-center text-sm text-muted-foreground">{p.next_assessment_due ? new Date(p.next_assessment_due).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
            {profiles.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No vendor risk profiles</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Vendor Risk Assessment</DialogTitle><DialogDescription>Score each risk dimension (0=Low, 100=High)</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label>Vendor Name *</Label><Input value={form.vendorName} onChange={(e) => setForm(p => ({ ...p, vendorName: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              {(['financialRisk', 'operationalRisk', 'complianceRisk', 'cyberRisk', 'geopoliticalRisk'] as const).map((field) => (
                <div key={field}><Label>{field.replace(/Risk/, ' Risk').replace(/([A-Z])/g, ' $1').trim()}</Label>
                  <Input type="number" min={0} max={100} value={form[field]} onChange={(e) => setForm(p => ({ ...p, [field]: parseInt(e.target.value) || 0 }))} /></div>
              ))}
            </div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button><Button onClick={handleAdd}>Create Assessment</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
