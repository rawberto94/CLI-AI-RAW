"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { RefreshCw, RotateCcw } from "lucide-react";

interface DeliveryRow {
  id: string;
  webhookId: string;
  event: string;
  status: "pending" | "success" | "failed" | "dead";
  attempt: number;
  maxAttempts: number;
  statusCode: number | null;
  error: string | null;
  deliveryId: string | null;
  createdAt: string;
  updatedAt: string;
  lastAttemptAt: string | null;
  nextAttemptAt: string | null;
  deadAt: string | null;
  sentAt: string | null;
}

interface DeliveryListResponse {
  data: DeliveryRow[];
  summary: { pending: number; success: number; failed: number; dead: number };
  nextCursor: string | null;
  hasMore: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
  success: "bg-green-100 text-green-800 border-green-300",
  failed: "bg-orange-100 text-orange-800 border-orange-300",
  dead: "bg-red-100 text-red-800 border-red-300",
};

const STATUS_FILTERS: Array<{ key: string; label: string }> = [
  { key: "", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "success", label: "Success" },
  { key: "failed", label: "Failed" },
  { key: "dead", label: "Dead (DLQ)" },
];

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function WebhookDeliveriesPage() {
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<DeliveryRow[]>([]);
  const [summary, setSummary] = useState<DeliveryListResponse["summary"]>({
    pending: 0,
    success: 0,
    failed: 0,
    dead: 0,
  });
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>(() => searchParams.get("status") ?? "");
  const [eventFilter, setEventFilter] = useState<string>(() => searchParams.get("event") ?? "");
  const [webhookIdFilter, setWebhookIdFilter] = useState<string>(() => searchParams.get("webhookId") ?? "");
  const [loading, setLoading] = useState(true);
  const [requeueing, setRequeueing] = useState<string | null>(null);

  const visibleDeadCount = rows.filter((row) => row.status === "dead").length;
  const canBulkRequeue =
    visibleDeadCount > 0 ||
    (!eventFilter.trim() && !webhookIdFilter.trim() && !statusFilter && summary.dead > 0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (eventFilter.trim()) params.set("event", eventFilter.trim());
      if (webhookIdFilter.trim()) params.set("webhookId", webhookIdFilter.trim());
      params.set("limit", "100");
      const res = await fetch(`/api/admin/webhook-deliveries?${params.toString()}`);
      const json: DeliveryListResponse = await res.json();
      if (!res.ok) {
        toast.error((json as unknown as { error?: string }).error || "Failed to load deliveries");
        return;
      }
      setRows(json.data || []);
      setSummary(json.summary || { pending: 0, success: 0, failed: 0, dead: 0 });
    } catch {
      toast.error("Failed to load deliveries");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, eventFilter, webhookIdFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const onRequeue = async (id: string) => {
    if (!confirm("Requeue this delivery? It will be retried on the next cron tick.")) return;
    setRequeueing(id);
    try {
      const res = await fetch(`/api/admin/webhook-deliveries/${id}/requeue`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Requeue failed");
        return;
      }
      toast.success("Delivery requeued");
      load();
    } catch {
      toast.error("Requeue failed");
    } finally {
      setRequeueing(null);
    }
  };

  const onBulkRequeue = async () => {
    if (!confirm("Requeue all dead deliveries matching the current filters?")) return;
    setRequeueing("bulk");
    try {
      const res = await fetch("/api/admin/webhook-deliveries/requeue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: eventFilter.trim() || undefined,
          webhookId: webhookIdFilter.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Bulk requeue failed");
        return;
      }
      toast.success(
        json.requeued > 0
          ? `Requeued ${json.requeued} dead ${json.requeued === 1 ? "delivery" : "deliveries"}`
          : "No dead deliveries matched the current filters",
      );
      load();
    } catch {
      toast.error("Bulk requeue failed");
    } finally {
      setRequeueing(null);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Webhook Deliveries</h1>
          <p className="text-sm text-muted-foreground">
            Inspect outbound webhook attempts. Failed deliveries retry with exponential backoff;
            after {/* default */}8 attempts they move to the dead-letter queue and can be requeued
            manually.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.assign("/settings/integration-events")}
            disabled={requeueing !== null}
          >
            Event Log
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onBulkRequeue}
            disabled={requeueing !== null || !canBulkRequeue}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Requeue Dead
          </Button>
          <Button variant="outline" size="sm" onClick={load} disabled={loading || requeueing !== null}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(["pending", "success", "failed", "dead"] as const).map((k) => (
          <Card key={k}>
            <CardHeader className="pb-2">
              <CardDescription className="capitalize">{k}</CardDescription>
              <CardTitle className="text-3xl">{summary[k] ?? 0}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((f) => (
              <Button
                key={f.key || "all"}
                variant={statusFilter === f.key ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(f.key)}
              >
                {f.label}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Event</label>
              <Input
                placeholder="contract.created"
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Webhook ID</label>
              <Input
                placeholder="wh_…"
                value={webhookIdFilter}
                onChange={(e) => setWebhookIdFilter(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Deliveries ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-2">Status</th>
                  <th className="text-left px-4 py-2">Event</th>
                  <th className="text-left px-4 py-2">Webhook</th>
                  <th className="text-left px-4 py-2">Attempts</th>
                  <th className="text-left px-4 py-2">Last attempt</th>
                  <th className="text-left px-4 py-2">Next attempt</th>
                  <th className="text-left px-4 py-2">Code</th>
                  <th className="text-left px-4 py-2">Error</th>
                  <th className="text-right px-4 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                      {loading ? "Loading…" : "No deliveries match the current filters."}
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-2">
                      <Badge className={STATUS_COLORS[r.status]} variant="outline">
                        {r.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{r.event}</td>
                    <td className="px-4 py-2 font-mono text-xs">{r.webhookId.slice(0, 12)}…</td>
                    <td className="px-4 py-2">
                      {r.attempt} / {r.maxAttempts}
                    </td>
                    <td className="px-4 py-2 text-xs">{formatTime(r.lastAttemptAt)}</td>
                    <td className="px-4 py-2 text-xs">{formatTime(r.nextAttemptAt)}</td>
                    <td className="px-4 py-2 text-xs">{r.statusCode ?? "—"}</td>
                    <td className="px-4 py-2 text-xs max-w-xs truncate" title={r.error ?? ""}>
                      {r.error ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {(r.status === "dead" || r.status === "failed") && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={requeueing === r.id}
                          onClick={() => onRequeue(r.id)}
                        >
                          <RotateCcw className="w-3 h-3 mr-1" />
                          Requeue
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
