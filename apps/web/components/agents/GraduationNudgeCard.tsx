'use client';

/**
 * Graduation nudge (Phase 2.2): "You accepted @agent's last N actions — automate?"
 */

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Sparkles, Zap, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface Nudge {
  agentId: string;
  actionType: string;
  sampleSize: number;
  acceptanceRate: number;
  suggestedConfidenceThreshold: number;
  message: string;
}

export function GraduationNudgeCard({ className = '' }: { className?: string }) {
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/agents/autonomy/graduation');
      if (!res.ok) return;
      const json = await res.json();
      setNudges((json.data ?? json).nudges ?? []);
    } catch {
      /* best-effort */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const accept = async (n: Nudge) => {
    const key = `${n.agentId}::${n.actionType}`;
    setActing(key);
    try {
      const res = await fetch('/api/agents/autonomy/graduation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: n.agentId,
          actionType: n.actionType,
          confidenceThreshold: n.suggestedConfidenceThreshold,
        }),
      });
      if (!res.ok) throw new Error('Failed to enable auto');
      toast.success(`Auto mode enabled for ${n.agentId}`);
      setDismissed((prev) => new Set(prev).add(key));
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setActing(null);
    }
  };

  const visible = nudges.filter((n) => !dismissed.has(`${n.agentId}::${n.actionType}`));
  if (loading || visible.length === 0) return null;

  return (
    <div className={`space-y-2 ${className}`} data-testid="graduation-nudges">
      {visible.slice(0, 3).map((n) => {
        const key = `${n.agentId}::${n.actionType}`;
        return (
          <Card key={key} className="border-violet-200 bg-gradient-to-r from-violet-50/80 to-purple-50/50">
            <CardContent className="p-4 flex items-start gap-3">
              <div className="mt-0.5 rounded-lg bg-violet-100 p-2">
                <Sparkles className="h-4 w-4 text-violet-700" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900">{n.message}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Suggested confidence ≥ {Math.round(n.suggestedConfidenceThreshold * 100)}% ·{' '}
                  {n.sampleSize} samples · {Math.round(n.acceptanceRate * 100)}% accepted
                </p>
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    className="bg-violet-600 hover:bg-violet-700"
                    disabled={acting === key}
                    onClick={() => accept(n)}
                  >
                    <Zap className="h-3.5 w-3.5 mr-1" />
                    Automate these
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDismissed((prev) => new Set(prev).add(key))}
                  >
                    <X className="h-3.5 w-3.5 mr-1" />
                    Not now
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default GraduationNudgeCard;
