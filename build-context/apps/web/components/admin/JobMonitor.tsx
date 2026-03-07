'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Cog, RefreshCw, Trash2, Activity, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface QueueInfo {
  name: string; waiting: number; active: number; completed: number; failed: number; delayed: number; status: string;
}

export default function JobMonitor() {
  const [queues, setQueues] = useState<QueueInfo[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/job-monitor');
      const json = await res.json();
      if (json.success) { setQueues(json.data.queues); setSummary(json.data.summary); }
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { const interval = setInterval(fetchData, 15000); return () => clearInterval(interval); }, [fetchData]);

  const handleCleanFailed = async (queueName: string) => {
    try {
      const res = await fetch('/api/admin/job-monitor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'clean-failed', queueName }) });
      if ((await res.json()).success) { toast.success('Failed jobs cleaned'); fetchData(); }
    } catch { toast.error('Failed'); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><Cog className="h-8 w-8" /> Job Monitor</h1><p className="text-muted-foreground mt-1">BullMQ queue status and management</p></div>
        <Button variant="outline" onClick={() => { setRefreshing(true); fetchData(); }}><RefreshCw className={cn('h-4 w-4 mr-2', refreshing && 'animate-spin')} /> Refresh</Button>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4"><div className="text-sm text-muted-foreground flex items-center gap-1"><Activity className="h-4 w-4" /> Queues</div><p className="text-2xl font-bold">{summary.totalQueues}</p></Card>
          <Card className="p-4"><div className="text-sm text-muted-foreground flex items-center gap-1"><Cog className="h-4 w-4 text-blue-500" /> Active</div><p className="text-2xl font-bold text-blue-500">{summary.activeJobs}</p></Card>
          <Card className="p-4"><div className="text-sm text-muted-foreground flex items-center gap-1"><Clock className="h-4 w-4 text-yellow-500" /> Waiting</div><p className="text-2xl font-bold text-yellow-500">{summary.waitingJobs}</p></Card>
          <Card className="p-4"><div className="text-sm text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-4 w-4 text-red-500" /> Failed</div><p className="text-2xl font-bold text-red-500">{summary.failedJobs}</p></Card>
        </div>
      )}

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">Queue</th><th className="text-center p-3 font-medium">Status</th>
              <th className="text-center p-3 font-medium">Active</th><th className="text-center p-3 font-medium">Waiting</th>
              <th className="text-center p-3 font-medium">Completed</th><th className="text-center p-3 font-medium">Failed</th>
              <th className="text-center p-3 font-medium">Delayed</th><th className="text-right p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {queues.map((q) => (
              <tr key={q.name} className="hover:bg-muted/30">
                <td className="p-3 font-medium">{q.name}</td>
                <td className="p-3 text-center"><Badge className={q.status === 'active' ? 'bg-green-100 text-green-800' : q.status === 'idle' ? 'bg-gray-100 text-gray-800' : 'bg-yellow-100 text-yellow-800'}>{q.status}</Badge></td>
                <td className="p-3 text-center font-mono">{q.active}</td>
                <td className="p-3 text-center font-mono">{q.waiting}</td>
                <td className="p-3 text-center font-mono text-green-600">{q.completed}</td>
                <td className={cn('p-3 text-center font-mono', q.failed > 0 && 'text-red-500 font-bold')}>{q.failed}</td>
                <td className="p-3 text-center font-mono">{q.delayed}</td>
                <td className="p-3 text-right">{q.failed > 0 && <Button size="sm" variant="ghost" className="text-red-500 h-7" onClick={() => handleCleanFailed(q.name)}><Trash2 className="h-3 w-3 mr-1" /> Clean</Button>}</td>
              </tr>
            ))}
            {queues.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No queues (Redis may not be available)</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
