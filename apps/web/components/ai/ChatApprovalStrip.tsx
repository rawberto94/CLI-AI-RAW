'use client';

/**
 * Inline approval actions inside chat (Phase 3.1).
 * Surfaces a few pending inbox items with approve/reject without leaving chat.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { CheckCircle2, ExternalLink, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PendingItem {
  id: string;
  type: string;
  title: string;
  deepLink?: string;
  actions?: Array<{ kind: string; label: string; actionId?: string }>;
}

export function ChatApprovalStrip({ enabled }: { enabled: boolean }) {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await fetch('/api/inbox?limit=5');
      if (!res.ok) return;
      const json = await res.json();
      const list = (json.data ?? json).items ?? [];
      setItems(
        list.filter((i: PendingItem) =>
          ['agent_write', 'agent_goal'].includes(i.type),
        ),
      );
    } catch {
      /* best-effort */
    }
  }, [enabled]);

  useEffect(() => {
    load();
    if (!enabled) return;
    const id = setInterval(load, 45_000);
    return () => clearInterval(id);
  }, [enabled, load]);

  const act = async (item: PendingItem, action: 'approve' | 'reject') => {
    setBusy(item.id);
    try {
      const res = await fetch('/api/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, type: item.type, action }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || 'Action failed');
      }
      toast.success(action === 'approve' ? 'Approved' : 'Rejected');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(null);
    }
  };

  if (!enabled || items.length === 0) return null;

  return (
    <div
      className="border-t border-violet-100 bg-violet-50/60 px-3 py-2 space-y-2"
      data-testid="chat-approval-strip"
    >
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-violet-800 uppercase tracking-wide">
          Needs you ({items.length})
        </p>
        <Link href="/inbox" className="text-[11px] text-violet-600 hover:underline flex items-center gap-0.5">
          All <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
      {items.slice(0, 3).map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-2 rounded-lg border border-violet-100 bg-white px-2 py-1.5"
        >
          <p className="flex-1 min-w-0 text-xs text-slate-700 truncate" title={item.title}>
            {item.title}
          </p>
          <Button
            size="sm"
            className="h-7 px-2 bg-green-600 hover:bg-green-700 text-white"
            disabled={busy === item.id}
            onClick={() => act(item, 'approve')}
          >
            {busy === item.id ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3 w-3" />
            )}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="h-7 px-2"
            disabled={busy === item.id}
            onClick={() => act(item, 'reject')}
          >
            <XCircle className="h-3 w-3" />
          </Button>
          {item.type === 'agent_goal' && (
            <Button size="sm" variant="ghost" className="h-7 px-2" asChild>
              <Link href={`/runs/${item.id.replace(/^goal-/, '')}`}>Run</Link>
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

export default ChatApprovalStrip;
