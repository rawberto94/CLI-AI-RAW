'use client';

/**
 * Per-agent autonomy settings UI (Phase 2.1).
 * Mode: suggest | review | auto — defaults to review when no config exists.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Save, Shield, Zap, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type AutonomyMode = 'suggest' | 'review' | 'auto';
type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

interface AutonomyConfig {
  id?: string;
  agentId: string;
  actionType: string;
  mode: AutonomyMode;
  confidenceThreshold: number;
  costThreshold: number | null;
  riskThreshold: RiskLevel;
  notifyEmail?: boolean;
  notifyInApp?: boolean;
}

const MODE_META: Record<
  AutonomyMode,
  { label: string; description: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  suggest: {
    label: 'Suggest',
    description: 'Agent proposes only — never writes without you',
    icon: Eye,
    color: 'bg-slate-100 text-slate-800 border-slate-200',
  },
  review: {
    label: 'Review',
    description: 'Queue for approval (safe default)',
    icon: Shield,
    color: 'bg-amber-100 text-amber-900 border-amber-200',
  },
  auto: {
    label: 'Auto',
    description: 'Apply when under thresholds',
    icon: Zap,
    color: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  },
};

/** Common agents from the Labs catalog — extendable list */
const KNOWN_AGENTS = [
  { id: 'proactive-validation-agent', name: 'Sentinel' },
  { id: 'compliance-monitoring-agent', name: 'Vigil' },
  { id: 'risk-detection-agent', name: 'Warden' },
  { id: 'autonomous-deadline-manager', name: 'Clockwork' },
  { id: 'opportunity-discovery-engine', name: 'Prospector' },
  { id: 'rfx-procurement-agent', name: 'Merchant' },
  { id: 'test-agent', name: 'Test Agent' },
  { id: 'default', name: 'Default (all agents)' },
];

export function AgentAutonomySettingsPanel() {
  const [configs, setConfigs] = useState<AutonomyConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState(KNOWN_AGENTS[0].id);
  const [draft, setDraft] = useState<AutonomyConfig>({
    agentId: KNOWN_AGENTS[0].id,
    actionType: 'agent_write',
    mode: 'review',
    confidenceThreshold: 0.85,
    costThreshold: null,
    riskThreshold: 'medium',
    notifyEmail: true,
    notifyInApp: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/agents/autonomy');
      if (!res.ok) throw new Error('Failed to load');
      const json = await res.json();
      const data = json.data ?? json;
      setConfigs(data.configs ?? []);
    } catch {
      toast.error('Could not load autonomy settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Sync draft when agent selection or configs change
  useEffect(() => {
    const existing = configs.find(
      (c) => c.agentId === selectedAgent && c.actionType === 'agent_write',
    );
    if (existing) {
      setDraft({
        ...existing,
        mode: (existing.mode as AutonomyMode) || 'review',
        riskThreshold: (existing.riskThreshold as RiskLevel) || 'medium',
      });
    } else {
      setDraft({
        agentId: selectedAgent,
        actionType: 'agent_write',
        mode: 'review',
        confidenceThreshold: 0.85,
        costThreshold: null,
        riskThreshold: 'medium',
        notifyEmail: true,
        notifyInApp: true,
      });
    }
  }, [selectedAgent, configs]);

  const modeBadge = useMemo(() => MODE_META[draft.mode], [draft.mode]);

  const save = async () => {
    setSaving(selectedAgent);
    try {
      const res = await fetch('/api/agents/autonomy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: draft.agentId,
          actionType: draft.actionType || 'agent_write',
          mode: draft.mode,
          confidenceThreshold: draft.confidenceThreshold,
          costThreshold: draft.costThreshold,
          riskThreshold: draft.riskThreshold,
          notifyEmail: draft.notifyEmail,
          notifyInApp: draft.notifyInApp,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || 'Save failed');
      }
      toast.success(`Autonomy for ${draft.agentId} set to ${draft.mode}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading autonomy settings…
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-violet-600" />
            Agent autonomy
          </CardTitle>
          <CardDescription>
            Control when agents may write without approval. New agents default to{' '}
            <strong>Review</strong> — nothing is auto-upgraded silently.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="text-sm font-medium">Agent</label>
            <select
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
            >
              {KNOWN_AGENTS.map((a) => {
                const cfg = configs.find((c) => c.agentId === a.id && c.actionType === 'agent_write');
                return (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.id})
                    {cfg ? ` — ${cfg.mode}` : ' — review (default)'}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Mode</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(Object.keys(MODE_META) as AutonomyMode[]).map((m) => {
                const meta = MODE_META[m];
                const Icon = meta.icon;
                const active = draft.mode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, mode: m }))}
                    className={cn(
                      'rounded-xl border p-3 text-left transition-all',
                      active
                        ? 'border-violet-500 ring-2 ring-violet-200 bg-violet-50/50'
                        : 'border-slate-200 hover:border-slate-300',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <span className="font-semibold text-sm">{meta.label}</span>
                      {active && (
                        <Badge className={cn('ml-auto text-[10px]', meta.color)}>{m}</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{meta.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium">
                Confidence threshold ({Math.round(draft.confidenceThreshold * 100)}%)
              </label>
              <input
                type="range"
                min={0.5}
                max={0.99}
                step={0.01}
                value={draft.confidenceThreshold}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, confidenceThreshold: Number(e.target.value) }))
                }
                className="mt-2 w-full"
                disabled={draft.mode !== 'auto'}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Cost ceiling (optional)</label>
              <input
                type="number"
                min={0}
                placeholder="No limit"
                value={draft.costThreshold ?? ''}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    costThreshold: e.target.value === '' ? null : Number(e.target.value),
                  }))
                }
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                disabled={draft.mode !== 'auto'}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Max risk for auto</label>
              <select
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                value={draft.riskThreshold}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, riskThreshold: e.target.value as RiskLevel }))
                }
                disabled={draft.mode !== 'auto'}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-2 border-t">
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              Current:
              <Badge className={cn('border', modeBadge.color)}>{modeBadge.label}</Badge>
            </div>
            <Button onClick={save} disabled={saving === selectedAgent}>
              {saving === selectedAgent ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      {configs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Configured agents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {configs.map((c) => (
              <div
                key={`${c.agentId}-${c.actionType}`}
                className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium font-mono text-xs">{c.agentId}</p>
                  <p className="text-xs text-muted-foreground">{c.actionType}</p>
                </div>
                <Badge className={cn('border capitalize', MODE_META[c.mode as AutonomyMode]?.color)}>
                  {c.mode}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default AgentAutonomySettingsPanel;
