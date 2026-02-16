"use client";

import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, CheckCircle2, Clock, ClipboardList,
  AlertTriangle, FileText, Filter, Loader2, Plus, RefreshCw,
  Send, XCircle, Inbox, Timer,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

interface ContractRequest {
  id: string;
  title: string;
  description: string | null;
  request_type: string;
  urgency: string;
  status: string;
  department: string | null;
  counterparty_name: string | null;
  estimated_value: number | null;
  currency: string | null;
  contract_id: string | null;
  sla_deadline: string | null;
  rejected_reason: string | null;
  created_at: string;
  updated_at: string;
}

interface Metrics {
  total: number;
  submitted: number;
  in_triage: number;
  approved: number;
  in_progress: number;
  completed: number;
  rejected: number;
  sla_breached: number;
}

// ═══════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════

const statusConfig: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }>; bg: string }> = {
  SUBMITTED: { label: "Submitted", color: "text-blue-700", icon: Send, bg: "bg-blue-50 border-blue-200" },
  IN_TRIAGE: { label: "In Triage", color: "text-amber-700", icon: Clock, bg: "bg-amber-50 border-amber-200" },
  APPROVED: { label: "Approved", color: "text-emerald-700", icon: CheckCircle2, bg: "bg-emerald-50 border-emerald-200" },
  IN_PROGRESS: { label: "In Progress", color: "text-violet-700", icon: ArrowRight, bg: "bg-violet-50 border-violet-200" },
  COMPLETED: { label: "Completed", color: "text-emerald-700", icon: CheckCircle2, bg: "bg-emerald-50 border-emerald-200" },
  REJECTED: { label: "Rejected", color: "text-red-700", icon: XCircle, bg: "bg-red-50 border-red-200" },
  CANCELLED: { label: "Cancelled", color: "text-slate-500", icon: XCircle, bg: "bg-slate-50 border-slate-200" },
};

const urgencyBadge: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-800 border-red-200",
  HIGH: "bg-orange-100 text-orange-800 border-orange-200",
  MEDIUM: "bg-yellow-100 text-yellow-800 border-yellow-200",
  LOW: "bg-slate-100 text-slate-600 border-slate-200",
};

const STEPS = ["SUBMITTED", "IN_TRIAGE", "APPROVED", "IN_PROGRESS", "COMPLETED"];

// ═══════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════

export default function MyRequestsPage() {
  const [requests, setRequests] = useState<ContractRequest[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ view: "my-requests" });
      if (filter !== "all") params.set("status", filter);
      const res = await fetch(`/api/requests?${params}`);
      const json = await res.json();
      if (json.success) {
        setRequests(json.data.requests || []);
        setMetrics(json.data.metrics || null);
      }
    } catch {
      toast.error("Failed to load requests");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const isOverdue = (d: string | null) => d && new Date(d) < new Date();

  const formatDate = (d: string) => {
    const date = new Date(d);
    return isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const timeAgo = (d: string) => {
    const ms = Date.now() - new Date(d).getTime();
    if (ms < 60_000) return "just now";
    if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
    if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
    return `${Math.floor(ms / 86_400_000)}d ago`;
  };

  const slaRemaining = (deadline: string | null) => {
    if (!deadline) return null;
    const ms = new Date(deadline).getTime() - Date.now();
    if (ms <= 0) return "Overdue";
    if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m left`;
    if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h left`;
    return `${Math.floor(ms / 86_400_000)}d left`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50/30">
      <div className="max-w-[1100px] mx-auto p-6 space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/self-service">
                <Button variant="ghost" size="sm" className="gap-1.5">
                  <ArrowLeft className="h-3.5 w-3.5" /> Hub
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-violet-600" />
                  My Requests
                </h1>
                <p className="text-xs text-slate-500">Track the status of your contract requests</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={fetchData} className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </Button>
              <Link href="/requests/new">
                <Button size="sm" className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> New Request
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>

        {/* Status Pipeline */}
        {metrics && metrics.total > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              {[
                { key: "submitted", label: "Submitted", value: metrics.submitted, icon: Send, color: "text-blue-600", bg: "bg-blue-50" },
                { key: "in_triage", label: "In Triage", value: metrics.in_triage, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
                { key: "approved", label: "Approved", value: metrics.approved, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
                { key: "in_progress", label: "In Progress", value: metrics.in_progress, icon: ArrowRight, color: "text-violet-600", bg: "bg-violet-50" },
                { key: "completed", label: "Completed", value: metrics.completed, icon: CheckCircle2, color: "text-teal-600", bg: "bg-teal-50" },
                { key: "sla_breached", label: "SLA Breached", value: metrics.sla_breached, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50" },
              ].map((m) => (
                <Card key={m.key} className={cn("border cursor-pointer transition-all hover:shadow-md", filter === m.key.toUpperCase() && "ring-2 ring-violet-300")}
                  onClick={() => setFilter(f => f === m.key.toUpperCase() ? "all" : m.key.toUpperCase())}>
                  <CardContent className="p-3 flex items-center gap-2">
                    <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", m.bg)}>
                      <m.icon className={cn("h-4 w-4", m.color)} />
                    </div>
                    <div>
                      <p className={cn("text-lg font-bold leading-none", m.color)}>{m.value}</p>
                      <p className="text-[10px] text-slate-500">{m.label}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.div>
        )}

        {/* Filter row */}
        <div className="flex items-center gap-3">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-3.5 w-3.5 mr-2 text-slate-400" />
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="SUBMITTED">Submitted</SelectItem>
              <SelectItem value="IN_TRIAGE">In Triage</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
            </SelectContent>
          </Select>
          {filter !== "all" && (
            <Button variant="ghost" size="sm" onClick={() => setFilter("all")} className="text-xs text-slate-500">
              Clear filter
            </Button>
          )}
          <span className="text-xs text-slate-400 ml-auto">
            {requests.length} request{requests.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
          </div>
        )}

        {/* Empty */}
        {!loading && requests.length === 0 && (
          <Card className="border-dashed border-slate-300">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Inbox className="h-10 w-10 text-slate-300 mb-3" />
              <p className="text-sm text-slate-500 font-medium">No requests found</p>
              <p className="text-xs text-slate-400 mt-1">
                {filter !== "all" ? "Try clearing your filter" : "Submit your first contract request to get started"}
              </p>
              <Link href="/requests/new">
                <Button size="sm" className="mt-4 gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> New Request
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Request Cards */}
        {!loading && (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {requests.map((req) => {
                const cfg = statusConfig[req.status] || statusConfig.SUBMITTED;
                const overdue = isOverdue(req.sla_deadline) && !["COMPLETED", "REJECTED", "CANCELLED"].includes(req.status);
                const isExpanded = expanded === req.id;
                const currentStep = STEPS.indexOf(req.status);

                return (
                  <motion.div key={req.id}
                    layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                    <Card className={cn("border transition-all cursor-pointer hover:shadow-md",
                      overdue && "border-red-300 bg-red-50/30",
                      isExpanded && "ring-1 ring-violet-200")}
                      onClick={() => setExpanded(e => e === req.id ? null : req.id)}>
                      <CardContent className="p-4">
                        {/* Main row */}
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-sm font-semibold text-slate-800 truncate">{req.title}</h3>
                              <Badge variant="outline" className={cn("text-[10px]", cfg.bg, cfg.color)}>
                                {cfg.label}
                              </Badge>
                              <Badge variant="outline" className={cn("text-[10px]", urgencyBadge[req.urgency])}>
                                {req.urgency}
                              </Badge>
                              {overdue && (
                                <Badge variant="destructive" className="text-[10px] gap-0.5">
                                  <AlertTriangle className="h-2.5 w-2.5" /> OVERDUE
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                              <span>{req.request_type.replace(/_/g, " ")}</span>
                              {req.counterparty_name && <span>• {req.counterparty_name}</span>}
                              {req.department && <span>• {req.department}</span>}
                              {req.estimated_value && (
                                <span>• {(req.currency || "USD")} {Number(req.estimated_value).toLocaleString()}</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs text-slate-400">{timeAgo(req.created_at)}</p>
                            {req.sla_deadline && !["COMPLETED", "REJECTED", "CANCELLED"].includes(req.status) && (
                              <p className={cn("text-[10px] mt-0.5 flex items-center gap-1 justify-end",
                                overdue ? "text-red-600 font-medium" : "text-slate-400")}>
                                <Timer className="h-3 w-3" />
                                {slaRemaining(req.sla_deadline)}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Expanded detail */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                              <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
                                {/* Progress Pipeline */}
                                {req.status !== "REJECTED" && req.status !== "CANCELLED" && (
                                  <div>
                                    <p className="text-[10px] text-slate-400 font-medium uppercase mb-2">Progress</p>
                                    <div className="flex items-center gap-1">
                                      {STEPS.map((step, i) => {
                                        const active = i <= currentStep;
                                        const isCurrent = i === currentStep;
                                        return (
                                          <div key={step} className="flex items-center gap-1 flex-1">
                                            <div className={cn("h-2 flex-1 rounded-full transition-colors",
                                              active ? "bg-violet-500" : "bg-slate-200",
                                              isCurrent && "bg-violet-600")} />
                                          </div>
                                        );
                                      })}
                                    </div>
                                    <div className="flex justify-between mt-1">
                                      {STEPS.map((step) => (
                                        <span key={step} className="text-[9px] text-slate-400">
                                          {step.replace(/_/g, " ")}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Details grid */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                  <DetailItem label="Created" value={formatDate(req.created_at)} />
                                  <DetailItem label="Last Updated" value={formatDate(req.updated_at)} />
                                  {req.sla_deadline && (
                                    <DetailItem label="SLA Deadline" value={formatDate(req.sla_deadline)}
                                      highlight={!!overdue} />
                                  )}
                                  {req.contract_id && (
                                    <div>
                                      <p className="text-slate-400 mb-0.5">Contract</p>
                                      <Link href={`/contracts/${req.contract_id}`}
                                        className="text-violet-600 hover:underline font-medium"
                                        onClick={(e) => e.stopPropagation()}>
                                        View contract →
                                      </Link>
                                    </div>
                                  )}
                                </div>

                                {/* Rejection reason */}
                                {req.status === "REJECTED" && req.rejected_reason && (
                                  <div className="p-3 bg-red-50 rounded-lg border border-red-100">
                                    <p className="text-xs font-medium text-red-700 mb-0.5">Rejection Reason</p>
                                    <p className="text-xs text-red-600">{req.rejected_reason}</p>
                                  </div>
                                )}

                                {/* Description */}
                                {req.description && (
                                  <div>
                                    <p className="text-[10px] text-slate-400 font-medium uppercase mb-1">Description</p>
                                    <p className="text-xs text-slate-600">{req.description}</p>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════

function DetailItem({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-slate-400 mb-0.5">{label}</p>
      <p className={cn("font-medium", highlight ? "text-red-600" : "text-slate-700")}>{value}</p>
    </div>
  );
}
