"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowRightLeft, RefreshCw, RotateCcw } from "lucide-react";

interface IntegrationEventRow {
  id: string;
  tenantId: string;
  eventType: string;
  resourceId: string | null;
  payload: unknown;
  createdAt: string;
}

interface IntegrationEventListResponse {
  data: IntegrationEventRow[];
  nextCursor: string | null;
  hasMore: boolean;
}

const EVENT_TYPE_STYLES: Record<string, string> = {
  "contract.created": "bg-emerald-100 text-emerald-800 border-emerald-300",
  "contract.updated": "bg-blue-100 text-blue-800 border-blue-300",
  "contract.processed": "bg-cyan-100 text-cyan-800 border-cyan-300",
  "contract.deleted": "bg-rose-100 text-rose-800 border-rose-300",
  "contract.expired": "bg-orange-100 text-orange-800 border-orange-300",
  "contract.renewed": "bg-indigo-100 text-indigo-800 border-indigo-300",
  "obligation.created": "bg-violet-100 text-violet-800 border-violet-300",
  "obligation.completed": "bg-lime-100 text-lime-800 border-lime-300",
  "obligation.overdue": "bg-amber-100 text-amber-800 border-amber-300",
  "artifact.generated": "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300",
  "signature.completed": "bg-teal-100 text-teal-800 border-teal-300",
};

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function IntegrationEventsPage() {
  const [rows, setRows] = useState<IntegrationEventRow[]>([]);
  const [eventTypeFilter, setEventTypeFilter] = useState("");
  const [resourceIdFilter, setResourceIdFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [replayingEventId, setReplayingEventId] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const load = async (cursor?: string, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);

    try {
      const params = new URLSearchParams();
      params.set("limit", "100");
      if (cursor) params.set("cursor", cursor);
      if (eventTypeFilter.trim()) params.set("eventType", eventTypeFilter.trim());
      if (resourceIdFilter.trim()) params.set("resourceId", resourceIdFilter.trim());

      const res = await fetch(`/api/admin/integration-events?${params.toString()}`);
      const json: IntegrationEventListResponse = await res.json();
      if (!res.ok) {
        toast.error((json as unknown as { error?: string }).error || "Failed to load event log");
        return;
      }

      setRows((prev) => (append ? [...prev, ...(json.data || [])] : (json.data || [])));
      setNextCursor(json.nextCursor);
      setHasMore(Boolean(json.hasMore));
    } catch {
      toast.error("Failed to load event log");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventTypeFilter, resourceIdFilter]);

  const replayEvent = async (row: IntegrationEventRow) => {
    if (!confirm(`Replay ${row.eventType} to current active webhook subscribers?`)) return;
    setReplayingEventId(row.id);
    try {
      const res = await fetch(`/api/admin/integration-events/${row.id}/replay`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Replay failed");
        return;
      }

      const dispatchId = json?.replay?.dispatchId;
      const delivered = json?.replay?.delivered ?? 0;
      const failed = json?.replay?.failed ?? 0;
      const message = failed > 0
        ? `Replay queued: ${delivered} delivered, ${failed} failed`
        : delivered > 0
          ? `Replay queued to ${delivered} webhook${delivered === 1 ? "" : "s"}`
          : "Replay finished: no active subscribers for this event";

      if (dispatchId && (delivered > 0 || failed > 0)) {
        toast.success(`${message}. Opening matching deliveries…`);
        window.location.assign(`/settings/webhook-deliveries?dispatchId=${encodeURIComponent(dispatchId)}`);
        return;
      }

      toast.success(message);
    } catch {
      toast.error("Replay failed");
    } finally {
      setReplayingEventId(null);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Integration Events</h1>
          <p className="text-sm text-muted-foreground">
            Browse the durable outbound event log that backs `/api/v1/events`. Use this to confirm
            an event was recorded even if downstream webhooks failed.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.assign("/settings/webhook-deliveries")}
          >
            <ArrowRightLeft className="w-4 h-4 mr-2" />
            Deliveries
          </Button>
          <Button variant="outline" size="sm" onClick={() => load()} disabled={loading || loadingMore}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Loaded rows</CardDescription>
            <CardTitle className="text-3xl">{rows.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Newest event id</CardDescription>
            <CardTitle className="text-lg font-mono">{rows[0]?.id ?? "—"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Filter: type</CardDescription>
            <CardTitle className="text-lg font-mono">{eventTypeFilter || "all"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Filter: resource</CardDescription>
            <CardTitle className="text-lg font-mono truncate">{resourceIdFilter || "all"}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Event type</label>
            <Input
              placeholder="contract.updated"
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Resource ID</label>
            <Input
              placeholder="ckxx..."
              value={resourceIdFilter}
              onChange={(e) => setResourceIdFilter(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Event Log</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {rows.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {loading ? "Loading…" : "No events match the current filters."}
            </div>
          ) : (
            rows.map((row) => (
              <div key={row.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={EVENT_TYPE_STYLES[row.eventType] || "bg-slate-100 text-slate-800 border-slate-300"} variant="outline">
                        {row.eventType}
                      </Badge>
                      <span className="text-xs font-mono text-muted-foreground">#{row.id}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatTime(row.createdAt)}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 min-w-0">
                    <div className="text-right text-xs font-mono text-muted-foreground min-w-0">
                      {row.resourceId ?? "—"}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.location.assign(`/settings/webhook-deliveries?event=${encodeURIComponent(row.eventType)}`)}
                      >
                        Deliveries
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => replayEvent(row)}
                        disabled={replayingEventId === row.id}
                      >
                        <RotateCcw className={`w-4 h-4 mr-2 ${replayingEventId === row.id ? "animate-spin" : ""}`} />
                        Replay
                      </Button>
                    </div>
                  </div>
                </div>

                <details className="rounded-md bg-muted/40 p-3">
                  <summary className="cursor-pointer text-sm font-medium">Payload</summary>
                  <pre className="mt-3 overflow-x-auto text-xs leading-5 whitespace-pre-wrap break-all">
                    {JSON.stringify(row.payload, null, 2)}
                  </pre>
                </details>
              </div>
            ))
          )}

          {hasMore && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => nextCursor && load(nextCursor, true)}
                disabled={loadingMore}
              >
                {loadingMore ? "Loading…" : "Load older events"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}