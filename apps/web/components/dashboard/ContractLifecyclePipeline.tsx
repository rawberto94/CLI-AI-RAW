'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, FileText, CheckCircle2, AlertTriangle, Clock, RefreshCw, Archive, Pen, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface StageInfo {
  key: string;
  label: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  borderColor: string;
}

const STAGES: StageInfo[] = [
  { key: 'DRAFT', label: 'Draft', icon: Pen, color: 'text-gray-600', bgColor: 'bg-gray-50', borderColor: 'border-gray-300' },
  { key: 'IN_REVIEW', label: 'Review', icon: Clock, color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-300' },
  { key: 'NEGOTIATION', label: 'Negotiation', icon: ArrowRight, color: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-300' },
  { key: 'PENDING_APPROVAL', label: 'Approval', icon: AlertTriangle, color: 'text-orange-600', bgColor: 'bg-orange-50', borderColor: 'border-orange-300' },
  { key: 'ACTIVE', label: 'Active', icon: CheckCircle2, color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-300' },
  { key: 'EXPIRING', label: 'Expiring', icon: RefreshCw, color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-300' },
  { key: 'ARCHIVED', label: 'Archived', icon: Archive, color: 'text-slate-500', bgColor: 'bg-slate-50', borderColor: 'border-slate-300' },
];

export default function ContractLifecyclePipeline() {
  const [stageCounts, setStageCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [totalContracts, setTotalContracts] = useState(0);

  const fetchPipelineData = useCallback(async () => {
    try {
      const res = await fetch('/api/contracts?type=status-breakdown');
      const json = await res.json();
      if (json.success && json.data) {
        // Map the API response - may come as array of {status, count} or object
        const counts: Record<string, number> = {};
        if (Array.isArray(json.data.statusBreakdown || json.data)) {
          const arr = json.data.statusBreakdown || json.data;
          arr.forEach((item: any) => {
            counts[item.status || item.lifecycle_status] = Number(item.count || item._count || 0);
          });
        } else if (json.data.statusBreakdown) {
          Object.assign(counts, json.data.statusBreakdown);
        }
        setStageCounts(counts);
        setTotalContracts(Object.values(counts).reduce((sum: number, c) => sum + (c as number), 0));
      }
    } catch {
      toast.error('Failed to load pipeline data');
      setStageCounts({});
      setTotalContracts(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPipelineData(); }, [fetchPipelineData]);

  if (loading) return <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  const maxCount = Math.max(1, ...Object.values(stageCounts).map(Number));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5 text-violet-500" />
          Contract Lifecycle Pipeline
          <Badge variant="outline" className="ml-2">{totalContracts} contracts</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-stretch gap-1 overflow-x-auto pb-2">
          {STAGES.map((stage, idx) => {
            const count = stageCounts[stage.key] || 0;
            const pct = totalContracts > 0 ? Math.round((count / totalContracts) * 100) : 0;
            const barWidth = Math.max(20, (count / maxCount) * 100);
            const Icon = stage.icon;

            return (
              <div key={stage.key} className="flex items-center">
                <div className={cn(
                  'flex flex-col items-center rounded-xl border-2 p-3 min-w-[110px] transition-all hover:shadow-md cursor-default',
                  stage.bgColor, stage.borderColor,
                  count > 0 ? 'opacity-100' : 'opacity-60'
                )}>
                  <Icon className={cn('h-5 w-5 mb-1', stage.color)} />
                  <span className="text-xs font-medium text-muted-foreground">{stage.label}</span>
                  <span className={cn('text-2xl font-bold mt-1', stage.color)}>{count}</span>
                  <span className="text-[10px] text-muted-foreground">{pct}%</span>
                  {/* Mini bar */}
                  <div className="w-full h-1.5 bg-white/50 rounded-full mt-2 overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all', stage.color.replace('text-', 'bg-'))} style={{ width: `${barWidth}%` }} />
                  </div>
                </div>
                {idx < STAGES.length - 1 && (
                  <ArrowRight className="h-4 w-4 text-muted-foreground mx-0.5 shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
