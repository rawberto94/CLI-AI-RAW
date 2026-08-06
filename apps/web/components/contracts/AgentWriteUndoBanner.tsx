'use client';

/**
 * Shows recently applied / auto-applied agent field writes on a contract
 * with an Undo action (Phase 1.3). Mounted near the contract activity surface.
 */

import { useCallback, useEffect, useState } from 'react';
import { RotateCcw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { formatFieldValue } from '@/lib/ai/citations';

interface RevertableDecision {
  id: string;
  field: string;
  outcome: string;
  previousValue: unknown;
  appliedValue: unknown;
  createdAt: string;
  agentId: string;
}

export function AgentWriteUndoBanner({ contractId }: { contractId: string }) {
  const [items, setItems] = useState<RevertableDecision[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const appliedRes = await fetch(
        `/api/contracts/${contractId}/agent-writes?status=applied&limit=5`,
      );
      if (!appliedRes.ok) {
        setItems([]);
        return;
      }
      const json = await appliedRes.json();
      const data = json.data ?? json;
      setItems(data.items ?? data.decisions ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useEffect(() => {
    load();
  }, [load]);

  const revert = async (decisionId: string) => {
    try {
      const res = await fetch(`/api/agents/decisions/${decisionId}/revert`, {
        method: 'POST',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || body?.message || 'Undo failed');
      }
      toast.success('Agent change undone');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Undo failed');
    }
  };

  if (loading || items.length === 0) return null;

  return (
    <div
      className="mb-4 rounded-xl border border-violet-200 bg-violet-50/60 p-3 space-y-2"
      data-testid="agent-write-undo-banner"
    >
      <div className="flex items-center gap-2 text-sm font-medium text-violet-900">
        <Sparkles className="h-4 w-4" />
        Recent agent changes you can undo
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-start justify-between gap-3 bg-white/80 rounded-lg border border-violet-100 px-3 py-2"
          >
            <div className="min-w-0 text-sm">
              <p className="font-mono text-xs text-slate-500">{item.field}</p>
              <p className="text-slate-700 truncate">
                {formatFieldValue(item.previousValue)} → {formatFieldValue(item.appliedValue)}
              </p>
              <p className="text-[11px] text-slate-400">
                {item.agentId} · {item.outcome}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void revert(item.id);
              }}
              aria-label={`Undo agent change to ${item.field}`}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Undo
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default AgentWriteUndoBanner;
