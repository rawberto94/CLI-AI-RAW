'use client';

/**
 * Minimal internal dashboard for agentic UX success metrics (Phase 1.5).
 * Admin audience — the six plan metrics + derived rates.
 */

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, LineChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageBreadcrumb } from '@/components/navigation';

interface UxMetrics {
  approval_requested: number;
  approval_decided: number;
  notification_impression: number;
  notification_click: number;
  agent_undo_used: number;
  autonomy_changed: number;
  approval_decision_rate: number | null;
  avg_approval_latency_ms: number | null;
  evidence_viewed_rate: number | null;
}

const METRIC_META: { key: keyof UxMetrics; label: string; format?: 'rate' | 'ms' | 'count' }[] = [
  { key: 'approval_requested', label: 'Approvals requested', format: 'count' },
  { key: 'approval_decided', label: 'Approvals decided', format: 'count' },
  { key: 'approval_decision_rate', label: 'Decision rate', format: 'rate' },
  { key: 'avg_approval_latency_ms', label: 'Avg decision latency', format: 'ms' },
  { key: 'evidence_viewed_rate', label: 'Evidence viewed rate', format: 'rate' },
  { key: 'notification_impression', label: 'Notification impressions', format: 'count' },
  { key: 'notification_click', label: 'Notification clicks', format: 'count' },
  { key: 'agent_undo_used', label: 'Agent undos used', format: 'count' },
  { key: 'autonomy_changed', label: 'Autonomy changes (Phase 2)', format: 'count' },
];

function formatValue(value: number | null | undefined, format?: 'rate' | 'ms' | 'count'): string {
  if (value == null || Number.isNaN(value)) return '—';
  if (format === 'rate') return `${(value * 100).toFixed(1)}%`;
  if (format === 'ms') {
    if (value < 1000) return `${Math.round(value)} ms`;
    if (value < 60_000) return `${(value / 1000).toFixed(1)} s`;
    return `${(value / 60_000).toFixed(1)} min`;
  }
  return String(value);
}

export default function UxMetricsAdminPage() {
  const [metrics, setMetrics] = useState<UxMetrics | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalEvents, setTotalEvents] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics/ux-metrics?days=${days}`);
      if (!res.ok) throw new Error('Failed to load metrics');
      const json = await res.json();
      const data = json.data ?? json;
      setMetrics(data.metrics);
      setTotalEvents(data.totalEvents ?? 0);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <PageBreadcrumb />
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 mb-1">
            Admin · Analytics
          </p>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
            <LineChart className="h-6 w-6 text-violet-600" />
            UX Metrics
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Agent approval rates, notification funnel, and HITL outcomes · last {days} days ·{' '}
            {totalEvents} events
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="px-3 py-1.5 border rounded-md text-sm"
            aria-label="Period"
          >
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
          </select>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg" role="alert">
          {error}
        </div>
      )}

      {loading && !metrics && (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading metrics…
        </div>
      )}

      {metrics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {METRIC_META.map((m) => (
            <div
              key={m.key}
              className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm"
              data-testid={`metric-${m.key}`}
            >
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{m.label}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {formatValue(metrics[m.key], m.format)}
              </p>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-400">
        Events: approval_requested, approval_decided, notification_impression, notification_click,
        agent_undo_used, autonomy_changed (reserved for Phase 2.1).
      </p>
    </div>
  );
}
