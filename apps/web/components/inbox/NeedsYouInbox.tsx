'use client';

/**
 * Unified "Needs you" inbox — aggregates agent writes, goals, workflow approvals,
 * metadata review, RFx, compliance, and renewals.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Filter,
  Inbox,
  Loader2,
  RefreshCw,
  Search,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { CitationList } from '@/components/ai/CitationList';
import { formatFieldValue } from '@/lib/ai/citations';
import type { InboxItem, InboxItemType, InboxRisk } from '@/lib/inbox/types';
import { cn } from '@/lib/utils';
import { GraduationNudgeCard } from '@/components/agents/GraduationNudgeCard';
import { AutoApprovalDigestCard } from '@/components/agents/AutoApprovalDigestCard';

/** Virtualize inbox lists past this row count (Phase 3.3) */
const INBOX_VIRTUALIZE_THRESHOLD = 50;

const TYPE_LABELS: Record<InboxItemType, string> = {
  agent_write: 'Field change',
  agent_goal: 'Agent goal',
  workflow_approval: 'Workflow',
  metadata_review: 'Metadata review',
  rfx_award: 'RFx award',
  compliance_alert: 'Compliance',
  renewal_decision: 'Renewal',
};

const RISK_STYLES: Record<InboxRisk, string> = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  medium: 'bg-amber-100 text-amber-800 border-amber-200',
  low: 'bg-slate-100 text-slate-700 border-slate-200',
};

function formatMoney(value: number): string {
  if (!value) return '';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return String(value);
  }
}

export function NeedsYouInbox() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialType = (searchParams.get('type') as InboxItemType | 'all') || 'all';

  const [items, setItems] = useState<InboxItem[]>([]);
  const [stats, setStats] = useState<{ total: number; critical: number; byType: Record<string, number> }>({
    total: 0,
    critical: 0,
    byType: {},
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>(initialType);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchInbox = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter && typeFilter !== 'all') params.set('type', typeFilter);
      params.set('limit', '100');
      const res = await fetch(`/api/inbox?${params}`);
      if (!res.ok) throw new Error('Failed to load inbox');
      const json = await res.json();
      const data = json.data ?? json;
      setItems(data.items ?? []);
      setStats(data.stats ?? { total: 0, critical: 0, byType: {} });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inbox');
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => {
    fetchInbox();
    const id = setInterval(fetchInbox, 60_000);
    return () => clearInterval(id);
  }, [fetchInbox]);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        (i.description || '').toLowerCase().includes(q) ||
        i.type.includes(q),
    );
  }, [items, search]);

  const selectedItems = useMemo(
    () => filtered.filter((i) => selected.has(i.id)),
    [filtered, selected],
  );

  const homogeneousType =
    selectedItems.length > 0 && selectedItems.every((i) => i.type === selectedItems[0].type)
      ? selectedItems[0].type
      : null;

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const act = async (item: InboxItem, action: string) => {
    setProcessing(item.id);
    try {
      if (action === 'open' || action === 'review') {
        router.push(item.deepLink);
        return;
      }
      const res = await fetch('/api/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          type: item.type,
          action,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || body?.message || 'Action failed');
      }
      toast.success(`${action} succeeded`);
      await fetchInbox();
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setProcessing(null);
    }
  };

  const bulkAct = async (action: string) => {
    if (!homogeneousType || selectedItems.length === 0) return;
    for (const item of selectedItems) {
      // Sequential to avoid thundering herd on shared resources
      // eslint-disable-next-line no-await-in-loop
      await act(item, action);
    }
  };

  return (
    <div className="space-y-4" role="main" aria-label="Needs you inbox">
      <GraduationNudgeCard />
      <AutoApprovalDigestCard days={7} />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
            <Inbox className="h-6 w-6 text-violet-600" />
            Needs you
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {stats.total} item{stats.total !== 1 ? 's' : ''} needing attention
            {stats.critical > 0 ? ` · ${stats.critical} critical` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="pl-8 pr-3 py-1.5 border rounded-md text-sm w-48 focus:ring-2 focus:ring-violet-400 focus:outline-none"
              aria-label="Search inbox"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 border rounded-md text-sm"
            aria-label="Filter by type"
          >
            <option value="all">All types</option>
            {Object.entries(TYPE_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
                {stats.byType[k] ? ` (${stats.byType[k]})` : ''}
              </option>
            ))}
          </select>
          <Button variant="ghost" size="sm" onClick={fetchInbox} disabled={loading} aria-label="Refresh">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Bulk actions — only when homogeneous selection */}
      {selectedItems.length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-violet-50 border border-violet-100 rounded-lg">
          <Filter className="h-4 w-4 text-violet-600" />
          <span className="text-sm text-violet-900">
            {selectedItems.length} selected
            {homogeneousType ? ` · ${TYPE_LABELS[homogeneousType]}` : ' · mixed types (bulk disabled)'}
          </span>
          {homogeneousType && (
            <>
              <Button size="sm" className="ml-2 bg-green-600 hover:bg-green-700" onClick={() => bulkAct('approve')}>
                Bulk approve
              </Button>
              <Button size="sm" variant="destructive" onClick={() => bulkAct('reject')}>
                Bulk reject
              </Button>
            </>
          )}
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg" role="alert">
          {error}
        </div>
      )}

      {loading && items.length === 0 && (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading inbox…
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-16 bg-slate-50 rounded-xl border border-dashed">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
          <h2 className="text-lg font-medium text-slate-900">You&apos;re all caught up</h2>
          <p className="text-slate-500 text-sm mt-1">No items need your attention right now.</p>
        </div>
      )}

      <InboxItemList
        items={filtered}
        selected={selected}
        processing={processing}
        onToggleSelect={toggleSelect}
        onAct={act}
        onOpen={(item) => router.push(item.deepLink)}
      />
    </div>
  );
}

function InboxItemRow({
  item,
  isSelected,
  processing,
  onToggleSelect,
  onAct,
  onOpen,
}: {
  item: InboxItem;
  isSelected: boolean;
  processing: string | null;
  onToggleSelect: (id: string) => void;
  onAct: (item: InboxItem, action: string) => void;
  onOpen: (item: InboxItem) => void;
}) {
  const ctx = item.context ?? {};
  return (
    <li
      className={cn(
        'bg-white border rounded-xl p-4 shadow-sm transition-colors list-none',
        isSelected ? 'border-violet-400 ring-1 ring-violet-200' : 'border-slate-200',
      )}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect(item.id)}
          aria-label={`Select ${item.title}`}
          className="mt-1"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
              {TYPE_LABELS[item.type] || item.type}
            </span>
            <span
              className={cn(
                'text-xs font-medium px-2 py-0.5 rounded-full border capitalize',
                RISK_STYLES[item.risk],
              )}
            >
              {item.risk}
            </span>
            {item.value > 0 && (
              <span className="text-xs text-slate-500">{formatMoney(item.value)}</span>
            )}
            {item.deadline && (
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Due {formatDistanceToNow(new Date(item.deadline), { addSuffix: true })}
              </span>
            )}
          </div>
          <h3 className="mt-1.5 text-base font-semibold text-slate-900">{item.title}</h3>
          {item.description && (
            <p className="mt-0.5 text-sm text-slate-600 line-clamp-2">{item.description}</p>
          )}

          {item.type === 'agent_write' && (
            <div className="mt-3 space-y-2">
              {ctx.hasPreviousValue ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div className="p-2 bg-red-50/60 rounded border border-red-100">
                    <p className="text-[10px] font-medium text-red-700/80 mb-0.5">Before</p>
                    <pre className="whitespace-pre-wrap break-all text-xs">
                      {formatFieldValue(ctx.previousValue)}
                    </pre>
                  </div>
                  <div className="p-2 bg-emerald-50/70 rounded border border-emerald-100">
                    <p className="text-[10px] font-medium text-emerald-800 mb-0.5">After</p>
                    <pre className="whitespace-pre-wrap break-all text-xs font-medium">
                      {formatFieldValue(ctx.proposedValue)}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="p-2 bg-slate-50 rounded border text-xs">
                  <span className="text-slate-500">Proposed: </span>
                  {formatFieldValue(ctx.proposedValue)}
                </div>
              )}
              <CitationList
                citations={
                  Array.isArray(ctx.citations) && (ctx.citations as unknown[]).length > 0
                    ? ctx.citations
                    : ctx.evidenceChain
                }
                contractId={item.contractId}
                emptyLabel="No evidence recorded"
                compact
              />
            </div>
          )}

          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {item.actions.map((a) => (
              <Button
                key={`${item.id}-${a.kind}`}
                size="sm"
                variant={
                  a.kind === 'approve'
                    ? 'default'
                    : a.kind === 'reject'
                      ? 'destructive'
                      : 'outline'
                }
                className={a.kind === 'approve' ? 'bg-green-600 hover:bg-green-700' : undefined}
                disabled={processing === item.id}
                onClick={() =>
                  onAct(
                    item,
                    a.kind === 'open' || a.kind === 'review'
                      ? a.kind
                      : a.kind === 'acknowledge'
                        ? 'reject'
                        : a.kind,
                  )
                }
              >
                {a.kind === 'approve' && <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
                {a.kind === 'reject' && <XCircle className="h-3.5 w-3.5 mr-1" />}
                {a.kind === 'review' && <AlertTriangle className="h-3.5 w-3.5 mr-1" />}
                {a.label}
              </Button>
            ))}
            <Button size="sm" variant="ghost" onClick={() => onOpen(item)} aria-label="Open deep link">
              <ExternalLink className="h-3.5 w-3.5 mr-1" />
              Open
            </Button>
            {item.type === 'agent_goal' && typeof item.context?.runUrl === 'string' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  onOpen({ ...item, deepLink: item.context!.runUrl as string })
                }
              >
                Inspect run
              </Button>
            )}
            <span className="text-xs text-slate-400 ml-auto">
              {formatDistanceToNow(new Date(item.requestedAt), { addSuffix: true })}
            </span>
          </div>
        </div>
      </div>
    </li>
  );
}

function InboxItemList({
  items,
  selected,
  processing,
  onToggleSelect,
  onAct,
  onOpen,
}: {
  items: InboxItem[];
  selected: Set<string>;
  processing: string | null;
  onToggleSelect: (id: string) => void;
  onAct: (item: InboxItem, action: string) => void;
  onOpen: (item: InboxItem) => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const useVirtual = items.length >= INBOX_VIRTUALIZE_THRESHOLD;

  const rowVirtualizer = useVirtualizer({
    count: useVirtual ? items.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 180,
    overscan: 8,
  });

  if (!useVirtual) {
    return (
      <ul className="space-y-3">
        {items.map((item) => (
          <InboxItemRow
            key={item.id}
            item={item}
            isSelected={selected.has(item.id)}
            processing={processing}
            onToggleSelect={onToggleSelect}
            onAct={onAct}
            onOpen={onOpen}
          />
        ))}
      </ul>
    );
  }

  return (
    <div
      ref={parentRef}
      className="h-[min(70vh,720px)] overflow-auto"
      style={{ contain: 'strict' }}
      data-testid="inbox-virtual-list"
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const item = items[virtualRow.index];
          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={rowVirtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
                paddingBottom: 12,
              }}
            >
              <InboxItemRow
                item={item}
                isSelected={selected.has(item.id)}
                processing={processing}
                onToggleSelect={onToggleSelect}
                onAct={onAct}
                onOpen={onOpen}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default NeedsYouInbox;
