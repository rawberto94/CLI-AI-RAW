'use client';

/**
 * Auto-approval digest (Phase 2.3) — list of auto_applied decisions with undo.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { Bot, RotateCcw, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { formatFieldValue } from '@/lib/ai/citations';

interface AutoItem {
  id: string;
  decisionId: string;
  agentId: string;
  field: string;
  contractId?: string | null;
  value: unknown;
  previousValue?: unknown;
  confidence: number;
  createdAt: string;
  canRevert: boolean;
}

export function AutoApprovalDigestCard({
  days = 7,
  className = '',
}: {
  days?: number;
  className?: string;
}) {
  const [items, setItems] = useState<AutoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [reverting, setReverting] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/auto-applied?days=${days}&limit=20`);
      if (!res.ok) return;
      const json = await res.json();
      setItems((json.data ?? json).items ?? []);
    } catch {
      /* best-effort */
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  const revert = async (decisionId: string) => {
    setReverting(decisionId);
    try {
      const res = await fetch(`/api/agents/decisions/${decisionId}/revert`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || 'Revert failed');
      }
      toast.success('Auto-applied change undone');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Revert failed');
    } finally {
      setReverting(null);
    }
  };

  if (loading) return null;
  if (items.length === 0) return null;

  return (
    <Card className={className} data-testid="auto-approval-digest">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Bot className="h-4 w-4 text-emerald-600" />
          Agents auto-applied {items.length} low-risk update{items.length !== 1 ? 's' : ''}
        </CardTitle>
        <CardDescription>Last {days} days · each item can be undone</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2"
          >
            <div className="min-w-0 text-sm">
              <p className="font-medium text-slate-900">
                <span className="font-mono text-xs text-violet-700">{item.field}</span>
                <span className="text-slate-400 mx-1">·</span>
                <span className="text-xs text-slate-500">{item.agentId}</span>
              </p>
              <p className="text-xs text-slate-600 truncate">
                {formatFieldValue(item.previousValue)} → {formatFieldValue(item.value)}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })} ·{' '}
                {Math.round((item.confidence || 0) * 100)}% conf
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {item.contractId && (
                <Button size="sm" variant="ghost" asChild>
                  <Link href={`/contracts/${item.contractId}`}>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              )}
              {item.canRevert && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={reverting === item.decisionId}
                  onClick={() => revert(item.decisionId)}
                  aria-label={`Undo auto-applied change to ${item.field}`}
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                  Undo
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default AutoApprovalDigestCard;
