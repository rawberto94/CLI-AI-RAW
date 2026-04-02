'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Brain, FlaskConical, TrendingDown, Download, Settings, Plus, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function AiGovernanceDashboard() {
  const [tab, setTab] = useState('summary');
  const [data, setData] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [showAddDataset, setShowAddDataset] = useState(false);
  const [datasetForm, setDatasetForm] = useState({ name: '', description: '', datasetType: 'EXTRACTION' });

  const fetchData = useCallback(async () => {
    try {
      const type = tab === 'summary' ? 'summary' : tab === 'datasets' ? 'datasets' : tab === 'drift' ? 'drift' : tab === 'exports' ? 'exports' : 'policy';
      const res = await fetch(`/api/ai/governance?type=${type}`);
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleExport = async () => {
    try {
      const res = await fetch('/api/ai/governance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'export', fileFormat: 'JSONL' }) });
      const json = await res.json();
      if (json.success) toast.success(`Exported ${json.data.records?.length || 0} training records`);
    } catch { toast.error('Failed'); }
  };

  const handleAddDataset = async () => {
    if (!datasetForm.name) { toast.error('Name required'); return; }
    try {
      const res = await fetch('/api/ai/governance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'dataset', ...datasetForm }) });
      if ((await res.json()).success) { toast.success('Dataset created'); setShowAddDataset(false); fetchData(); }
    } catch { toast.error('Failed'); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="max-w-[1600px] mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><Brain className="h-8 w-8" /> AI Governance</h1><p className="text-muted-foreground mt-1">Evaluation harness, drift monitoring, training pipeline, and policies</p></div>
        <Button variant="outline" onClick={handleExport}><Download className="h-4 w-4 mr-2" /> Export Training Data</Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => { setTab(v); setLoading(true); }}>
        <TabsList><TabsTrigger value="summary">Summary</TabsTrigger><TabsTrigger value="datasets">Eval Datasets</TabsTrigger><TabsTrigger value="drift">Drift Monitor</TabsTrigger><TabsTrigger value="exports">Training Exports</TabsTrigger><TabsTrigger value="policy">AI Policy</TabsTrigger></TabsList>

        <TabsContent value="summary" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-2"><FlaskConical className="h-5 w-5 text-blue-500" /><span className="font-medium">Evaluation Datasets</span></div>
              <p className="text-2xl font-bold mt-2">{data.datasets?.count || 0}</p>
              {data.datasets?.avg_f1 && <p className="text-sm text-muted-foreground">Avg F1: {Number(data.datasets.avg_f1).toFixed(4)}</p>}
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2"><TrendingDown className="h-5 w-5 text-orange-500" /><span className="font-medium">Drift Alerts (7d)</span></div>
              <p className={cn('text-2xl font-bold mt-2', (data.recentDriftAlerts || 0) > 0 ? 'text-red-500' : 'text-green-500')}>{data.recentDriftAlerts || 0}</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2"><Download className="h-5 w-5 text-purple-500" /><span className="font-medium">Training Exports</span></div>
              <p className="text-2xl font-bold mt-2">{data.exports?.count || 0}</p>
              {data.exports?.last_export && <p className="text-sm text-muted-foreground">Last: {new Date(data.exports.last_export).toLocaleDateString()}</p>}
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="datasets" className="mt-4 space-y-4">
          <div className="flex justify-end"><Button onClick={() => setShowAddDataset(true)}><Plus className="h-4 w-4 mr-2" /> New Dataset</Button></div>
          {(data.datasets || []).map((ds: any) => (
            <Card key={ds.id}><CardContent className="py-4 px-5">
              <div className="flex items-center justify-between">
                <div><h3 className="font-semibold">{ds.name}</h3><p className="text-sm text-muted-foreground">{ds.description || ds.dataset_type} • {ds.total_items} items</p></div>
                <div className="text-right">{ds.f1_score && <p className="font-bold">F1: {Number(ds.f1_score).toFixed(4)}</p>}<Badge variant="outline">{ds.status}</Badge></div>
              </div>
            </CardContent></Card>
          ))}
        </TabsContent>

        <TabsContent value="drift" className="mt-4 space-y-4">
          {(data.driftMetrics || []).map((m: any) => (
            <Card key={m.id} className={m.drift_detected ? 'border-red-300 dark:border-red-800' : ''}><CardContent className="py-4 px-5 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2"><h3 className="font-semibold">{m.model_name} — {m.operation}</h3>{m.drift_detected && <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" /> Drift</Badge>}</div>
                <p className="text-sm text-muted-foreground">Score: {Number(m.score).toFixed(4)} {m.baseline_score && `(baseline: ${Number(m.baseline_score).toFixed(4)})`}</p>
              </div>
              <span className="text-sm text-muted-foreground">{new Date(m.measured_at).toLocaleDateString()}</span>
            </CardContent></Card>
          ))}
          {(!data.driftMetrics || data.driftMetrics.length === 0) && <Card className="p-12 text-center text-muted-foreground">No drift metrics recorded</Card>}
        </TabsContent>

        <TabsContent value="exports" className="mt-4 space-y-4">
          {(data.exports || []).length > 0 ? (Array.isArray(data.exports) ? data.exports : []).map((ex: any) => (
            <Card key={ex.id}><CardContent className="py-4 px-5"><h3 className="font-semibold">{ex.export_type} — {ex.total_records} records</h3><p className="text-sm text-muted-foreground">{ex.file_format} • {new Date(ex.created_at).toLocaleDateString()}</p></CardContent></Card>
          )) : <Card className="p-12 text-center text-muted-foreground">No training exports</Card>}
        </TabsContent>

        <TabsContent value="policy" className="mt-4">
          <Card className="p-6">{data.policy ? (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Tenant AI Policy</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div><span className="text-muted-foreground">Extraction</span><p className="font-medium">{data.policy.enable_extraction ? 'Enabled' : 'Disabled'}</p></div>
                <div><span className="text-muted-foreground">Generation</span><p className="font-medium">{data.policy.enable_generation ? 'Enabled' : 'Disabled'}</p></div>
                <div><span className="text-muted-foreground">Chat</span><p className="font-medium">{data.policy.enable_chat ? 'Enabled' : 'Disabled'}</p></div>
                <div><span className="text-muted-foreground">Confidence Threshold</span><p className="font-medium">{data.policy.confidence_threshold}</p></div>
                <div><span className="text-muted-foreground">PII Masking</span><p className="font-medium">{data.policy.pii_masking ? 'Yes' : 'No'}</p></div>
                <div><span className="text-muted-foreground">Human Review</span><p className="font-medium">{data.policy.require_human_review ? 'Required' : 'Optional'}</p></div>
              </div>
            </div>
          ) : <p className="text-center text-muted-foreground">No AI policy configured</p>}</Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showAddDataset} onOpenChange={setShowAddDataset}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Evaluation Dataset</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Name *</Label><Input value={datasetForm.name} onChange={(e) => setDatasetForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div><Label>Description</Label><Textarea value={datasetForm.description} onChange={(e) => setDatasetForm(p => ({ ...p, description: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowAddDataset(false)}>Cancel</Button><Button onClick={handleAddDataset}>Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
