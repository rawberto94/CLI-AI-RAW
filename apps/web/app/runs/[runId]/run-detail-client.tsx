"use client";

/**
 * Run inspector (Phase 2.4) — loads AgentGoal timeline and renders expandable steps.
 * Primary data: GET /api/agents/runs/[runId]
 * Live shim: EventSource /api/v2/stream/[runId] (emits historical steps + done)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Clock,
  Coins,
  ExternalLink,
  Loader2,
  RefreshCw,
  Wrench,
  Zap,
  Brain,
  Eye,
  Target,
  MessageSquare,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StepType = "thought" | "action" | "observation" | "tool_call" | "critique" | "decision";

interface RunStep {
  id: string;
  stepNumber: number;
  type: StepType;
  content: string;
  name?: string;
  status?: string;
  timestamp: string;
  durationMs: number;
  toolId?: string;
  toolInput?: Record<string, unknown>;
  toolOutput?: Record<string, unknown>;
  confidence?: number;
  tokens?: number;
  error?: string | null;
}

interface RunDetail {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  type?: string;
  contractId?: string | null;
  progress?: number;
  error?: string | null;
  summary?: string | null;
  tokensUsed?: number;
  estimatedCost?: number;
  totalDurationMs?: number;
  steps: RunStep[];
  createdAt?: string;
  startedAt?: string | null;
  completedAt?: string | null;
}

const TYPE_ICON: Record<StepType, React.ComponentType<{ className?: string }>> = {
  thought: Brain,
  action: Zap,
  observation: Eye,
  tool_call: Wrench,
  critique: MessageSquare,
  decision: Target,
};

const TYPE_STYLE: Record<StepType, string> = {
  thought: "bg-violet-100 text-violet-800",
  action: "bg-orange-100 text-orange-800",
  observation: "bg-green-100 text-green-800",
  tool_call: "bg-violet-100 text-violet-800",
  critique: "bg-yellow-100 text-yellow-800",
  decision: "bg-indigo-100 text-indigo-800",
};

function mapStreamStep(raw: Record<string, unknown>, index: number): RunStep {
  const typeRaw = String(raw.type || "action").toLowerCase();
  let type: StepType = "action";
  if (typeRaw.includes("tool")) type = "tool_call";
  else if (typeRaw.includes("think") || typeRaw.includes("plan")) type = "thought";
  else if (typeRaw.includes("observ")) type = "observation";
  else if (typeRaw.includes("crit")) type = "critique";
  else if (typeRaw.includes("decid")) type = "decision";

  return {
    id: String(raw.id || `sse-${index}`),
    stepNumber: typeof raw.order === "number" ? (raw.order as number) : index + 1,
    type,
    content: String(raw.name || raw.content || `Step ${index + 1}`),
    name: String(raw.name || ""),
    status: String(raw.status || ""),
    timestamp: new Date().toISOString(),
    durationMs: typeof raw.durationMs === "number" ? (raw.durationMs as number) : 0,
    toolInput: (raw.toolInput as Record<string, unknown>) || undefined,
    toolOutput: (raw.toolOutput as Record<string, unknown>) || undefined,
    error: (raw.error as string) || null,
  };
}

function StepRow({ step }: { step: RunStep }) {
  const [open, setOpen] = useState(Boolean(step.error) || step.type === "tool_call");
  const Icon = TYPE_ICON[step.type] || Zap;
  const hasDetail =
    step.toolInput ||
    step.toolOutput ||
    step.error ||
    (step.tokens != null && step.tokens > 0);

  return (
    <div
      className={cn(
        "rounded-lg border bg-white",
        step.error ? "border-red-200" : "border-slate-200",
      )}
    >
      <button
        type="button"
        className="flex w-full items-start gap-3 p-3 text-left hover:bg-slate-50"
        onClick={() => setOpen((v) => !v)}
        disabled={!hasDetail}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-50 text-sm font-semibold text-violet-700">
          {step.stepNumber}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn("capitalize gap-1", TYPE_STYLE[step.type])}>
              <Icon className="h-3 w-3" />
              {step.type.replace("_", " ")}
            </Badge>
            {step.status && (
              <Badge variant="secondary" className="text-[10px] uppercase">
                {step.status}
              </Badge>
            )}
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {step.durationMs}ms
            </span>
            {typeof step.confidence === "number" && (
              <span className="text-xs text-slate-500">
                {Math.round(step.confidence * 100)}% conf
              </span>
            )}
            {typeof step.tokens === "number" && step.tokens > 0 && (
              <span className="text-xs text-slate-500">{step.tokens} tok</span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-800">{step.content}</p>
          {step.error && (
            <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {step.error}
            </p>
          )}
        </div>
        {hasDetail &&
          (open ? (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-400" />
          ))}
      </button>
      {open && hasDetail && (
        <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-3 space-y-2 text-xs">
          {step.toolInput && Object.keys(step.toolInput).length > 0 && (
            <div>
              <p className="font-semibold text-slate-600 mb-1">Args</p>
              <pre className="overflow-x-auto rounded bg-white border p-2 text-[11px] text-slate-700">
                {JSON.stringify(step.toolInput, null, 2)}
              </pre>
            </div>
          )}
          {step.toolOutput && Object.keys(step.toolOutput).length > 0 && (
            <div>
              <p className="font-semibold text-slate-600 mb-1">Result</p>
              <pre className="overflow-x-auto rounded bg-white border p-2 text-[11px] text-slate-700">
                {JSON.stringify(step.toolOutput, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function RunDetailClient({ params }: { params: { runId: string } }) {
  const { runId } = params;
  const [run, setRun] = useState<RunDetail | null>(null);
  const [steps, setSteps] = useState<RunStep[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/agents/runs/${runId}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || body?.message || "Failed to load run");
      }
      const json = await res.json();
      const data = (json.data?.run ?? json.run) as RunDetail;
      setRun(data);
      setSteps(data.steps || []);
      setSummary(data.summary ?? null);
      setDone(
        ["COMPLETED", "FAILED", "CANCELLED"].includes(String(data.status || "").toUpperCase()),
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load run");
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    load();
  }, [load]);

  // SSE shim — fills steps if REST was empty / for progressive display
  useEffect(() => {
    const es = new EventSource(`/api/v2/stream/${runId}`);
    esRef.current = es;
    let idx = 0;
    es.addEventListener("step", (ev) => {
      try {
        const raw = JSON.parse((ev as MessageEvent).data);
        const step = mapStreamStep(raw, idx++);
        setSteps((prev) => {
          if (prev.some((p) => p.id === step.id)) return prev;
          // Prefer REST steps if already loaded
          if (prev.length > 0 && !prev[0].id.startsWith("sse-")) return prev;
          return [...prev, step];
        });
      } catch {
        /* ignore parse errors */
      }
    });
    es.addEventListener("done", (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data);
        if (data.summary) setSummary(data.summary);
      } catch {
        /* ignore */
      }
      setDone(true);
      es.close();
      esRef.current = null;
    });
    es.onerror = () => {
      es.close();
      esRef.current = null;
    };
    return () => {
      esRef.current?.close();
    };
  }, [runId]);

  const totals = useMemo(() => {
    const duration = steps.reduce((a, s) => a + (s.durationMs || 0), 0);
    const tokens = steps.reduce((a, s) => a + (s.tokens || 0), 0);
    return { duration, tokens };
  }, [steps]);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-violet-600">
            Run inspector
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            {run?.title || `Run ${runId}`}
          </h1>
          {run?.description && (
            <p className="mt-1 text-sm text-slate-600">{run.description}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <Badge variant="secondary">{run?.status || (done ? "done" : "running")}</Badge>
            {run?.type && <span>{run.type}</span>}
            <span className="font-mono text-[11px] text-slate-400">{runId}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {run?.contractId && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/contracts/${run.contractId}`}>
                <ExternalLink className="mr-1 h-3.5 w-3.5" />
                Contract
              </Link>
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] uppercase text-slate-500">Steps</p>
            <p className="text-xl font-semibold">{steps.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] uppercase text-slate-500">Duration</p>
            <p className="text-xl font-semibold">
              {run?.totalDurationMs ?? totals.duration}ms
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] uppercase text-slate-500">Tokens</p>
            <p className="text-xl font-semibold">{run?.tokensUsed ?? totals.tokens}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] uppercase text-slate-500 flex items-center gap-1">
              <Coins className="h-3 w-3" /> Cost est.
            </p>
            <p className="text-xl font-semibold">
              ${(run?.estimatedCost ?? 0).toFixed(4)}
            </p>
          </CardContent>
        </Card>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && !run && (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading run…
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Steps</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {steps.length === 0 && !loading ? (
            <p className="text-sm text-slate-500 py-6 text-center">
              No steps recorded for this run yet.
            </p>
          ) : (
            steps.map((s) => <StepRow key={s.id} step={s} />)
          )}
        </CardContent>
      </Card>

      {(summary || run?.error) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap text-slate-700">
              {summary || run?.error}
            </p>
          </CardContent>
        </Card>
      )}

      {done && (
        <p className="text-center text-xs text-slate-400">Run stream completed</p>
      )}
    </div>
  );
}
