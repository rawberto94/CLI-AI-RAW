"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/components/ui/design-system";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, ResponsiveContainer, XAxis, YAxis,
  CartesianGrid, Tooltip as RechartsTooltip, Legend,
} from "recharts";
import {
  Activity, ArrowDown, ArrowRight, ArrowUp, BarChart3,
  Building2, CheckCircle, CircleDot, Cloud, Database,
  DollarSign, FileText, GitBranch, Globe, Layers,
  LayoutGrid, Link2, Loader2, Network, Package,
  RefreshCw, Server, Shield, TrendingDown, TrendingUp,
  Wallet, Zap, AlertTriangle, Clock, ArrowUpRight,
  PieChart as PieChartIcon, Target, Boxes,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

interface EcosystemData {
  portfolio: {
    totalContracts: number;
    portfolioValue: number;
    annualCommitment: number;
    byStatus: Array<{ status: string; count: number }>;
    bySpendType: Array<{ type: string; count: number }>;
    byCurrency: Array<{ currency: string; count: number }>;
    expiringIn30: number;
    expiringIn90: number;
  };
  spend: {
    totalPOs: number;
    totalInvoices: number;
    matchedInvoices: number;
    discrepantInvoices: number;
    unmatchedInvoices: number;
    openExceptions: number;
    totalPoValue: number;
    totalInvoiceValue: number;
    poValue30d: number;
    invoiceValue30d: number;
    invoiceMatchRate: number;
  };
  integrations: {
    total: number;
    connected: number;
    erroring: number;
    erp: Array<{
      id: string; name: string; provider: string; status: string;
      lastSync: string | null; recordsProcessed: number | null;
      healthStatus: string | null; uptime: number | null; errors24h: number | null;
    }>;
    procurement: Array<{
      id: string; name: string; provider: string; status: string;
      lastSync: string | null; recordsProcessed: number | null;
    }>;
    all: Array<{
      id: string; name: string; type: string; provider: string;
      status: string; lastSync: string | null; latestSyncStatus: string | null;
    }>;
  };
  crossSystem: {
    contractToSpendVariance: number;
    erpSyncCoverage: number;
    invoiceMatchRate: number;
    dataCompleteness: number;
  };
  topSuppliers: Array<{
    name: string | null;
    totalValue: number;
    annualValue: number;
    contractCount: number;
  }>;
  categories: Array<{
    category: string | null;
    totalValue: number;
    contractCount: number;
  }>;
  monthlyTrend: Array<{ month: string; poSpend: number }>;
  recentSyncs: Array<{
    id: string; integrationName: string | null; provider: string | null;
    type: string | null; status: string; recordsTotal: number | null;
    recordsSuccess: number | null; recordsFailed: number | null;
    startedAt: string; completedAt: string | null; duration: number | null;
  }>;
  workflows: { pending: number; inProgress: number; completed: number; failed: number };
}

const PIE_COLORS = ["#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#6366f1", "#14b8a6"];

const statusColors: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  DRAFT: "bg-slate-100 text-slate-600",
  EXPIRED: "bg-red-100 text-red-700",
  PENDING: "bg-amber-100 text-amber-700",
  TERMINATED: "bg-red-100 text-red-600",
};

function getTenantId() {
  if (typeof window !== "undefined") {
    return localStorage.getItem("tenantId") || localStorage.getItem("x-tenant-id") || "";
  }
  return "";
}

async function fetchEcosystem(): Promise<EcosystemData> {
  const res = await fetch("/api/ecosystem", {
    headers: { "x-tenant-id": getTenantId() },
  });
  if (!res.ok) throw new Error("Failed to load ecosystem data");
  const json = await res.json();
  return json.data;
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════

export default function EcosystemDashboardPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["ecosystem-dashboard"],
    queryFn: fetchEcosystem,
    refetchInterval: 60_000,
  });

  if (isLoading) return <LoadingSkeleton />;
  if (error || !data) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-3 py-8">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <p className="text-red-700">Failed to load ecosystem data.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50/30">
      <div className="max-w-[1600px] mx-auto p-6 space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
                <Network className="h-5 w-5 text-white" />
              </div>
              Ecosystem Command Center
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Unified view across ERP, Spend Management &amp; Contract Intelligence
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1 text-xs">
              <CircleDot className="h-3 w-3 text-emerald-500" /> Live
            </Badge>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
          </div>
        </motion.div>

        {/* Cross-System Health Bar */}
        <CrossSystemHealthBar data={data} />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white border shadow-sm">
            <TabsTrigger value="overview" className="gap-1.5"><LayoutGrid className="h-3.5 w-3.5" /> Overview</TabsTrigger>
            <TabsTrigger value="erp" className="gap-1.5"><Server className="h-3.5 w-3.5" /> ERP &amp; Integrations</TabsTrigger>
            <TabsTrigger value="spend" className="gap-1.5"><Wallet className="h-3.5 w-3.5" /> Spend Analytics</TabsTrigger>
            <TabsTrigger value="suppliers" className="gap-1.5"><Building2 className="h-3.5 w-3.5" /> Suppliers</TabsTrigger>
          </TabsList>

          <AnimatePresence mode="wait">
            <TabsContent value="overview" className="mt-4">
              <OverviewTab data={data} />
            </TabsContent>
            <TabsContent value="erp" className="mt-4">
              <ERPTab data={data} />
            </TabsContent>
            <TabsContent value="spend" className="mt-4">
              <SpendTab data={data} />
            </TabsContent>
            <TabsContent value="suppliers" className="mt-4">
              <SuppliersTab data={data} />
            </TabsContent>
          </AnimatePresence>
        </Tabs>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// CROSS-SYSTEM HEALTH BAR
// ═══════════════════════════════════════════════════════════════════════

function CrossSystemHealthBar({ data }: { data: EcosystemData }) {
  const metrics = [
    { label: "Data Completeness", value: data.crossSystem.dataCompleteness, icon: Database, color: "text-violet-600", bg: "bg-violet-100" },
    { label: "ERP Sync Coverage", value: data.crossSystem.erpSyncCoverage, icon: Cloud, color: "text-cyan-600", bg: "bg-cyan-100" },
    { label: "Invoice Match Rate", value: data.crossSystem.invoiceMatchRate, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-100" },
    { label: "Spend Variance", value: Math.abs(data.crossSystem.contractToSpendVariance), icon: data.crossSystem.contractToSpendVariance > 0 ? TrendingUp : TrendingDown, color: Math.abs(data.crossSystem.contractToSpendVariance) > 15 ? "text-red-600" : "text-amber-600", bg: Math.abs(data.crossSystem.contractToSpendVariance) > 15 ? "bg-red-100" : "bg-amber-100" },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
      className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {metrics.map((m) => (
        <Card key={m.label} className="border-slate-200 hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className={`p-1.5 rounded-lg ${m.bg}`}>
                <m.icon className={`h-4 w-4 ${m.color}`} />
              </div>
              <span className={`text-xl font-bold ${m.color}`}>{m.value}%</span>
            </div>
            <Progress value={Math.min(m.value, 100)} className="h-1.5 mb-1" />
            <p className="text-xs text-slate-500">{m.label}</p>
          </CardContent>
        </Card>
      ))}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// OVERVIEW TAB
// ═══════════════════════════════════════════════════════════════════════

function OverviewTab({ data }: { data: EcosystemData }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Top KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPICard icon={FileText} label="Contracts" value={data.portfolio.totalContracts} color="violet" />
        <KPICard icon={DollarSign} label="Portfolio Value" value={formatCurrency(data.portfolio.portfolioValue)} color="emerald" />
        <KPICard icon={Wallet} label="Annual Commitment" value={formatCurrency(data.portfolio.annualCommitment)} color="cyan" />
        <KPICard icon={Package} label="Purchase Orders" value={data.spend.totalPOs} subtitle={formatCurrency(data.spend.totalPoValue)} color="amber" />
        <KPICard icon={Link2} label="Integrations" value={`${data.integrations.connected}/${data.integrations.total}`} subtitle={data.integrations.erroring > 0 ? `${data.integrations.erroring} errors` : "All healthy"} color={data.integrations.erroring > 0 ? "red" : "emerald"} />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contract Status Breakdown */}
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <PieChartIcon className="h-4 w-4 text-violet-500" />
              Contract Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.portfolio.byStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={data.portfolio.byStatus} dataKey="count" nameKey="status" cx="50%" cy="50%"
                    innerRadius={50} outerRadius={80} paddingAngle={3}>
                    {data.portfolio.byStatus.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <EmptyState message="No contracts yet" />}
          </CardContent>
        </Card>

        {/* Spend Type Split */}
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Boxes className="h-4 w-4 text-cyan-500" />
              Spend Type Allocation
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.portfolio.bySpendType.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.portfolio.bySpendType} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="type" type="category" width={70} tick={{ fontSize: 11 }} />
                  <RechartsTooltip />
                  <Bar dataKey="count" fill="#06b6d4" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyState message="No spend types categorized" />}
          </CardContent>
        </Card>

        {/* Workflow Pipeline */}
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-amber-500" />
              Workflow Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <WorkflowBar label="Pending" count={data.workflows.pending} color="bg-amber-500" total={Math.max(data.workflows.pending + data.workflows.inProgress + data.workflows.completed + data.workflows.failed, 1)} />
            <WorkflowBar label="In Progress" count={data.workflows.inProgress} color="bg-blue-500" total={Math.max(data.workflows.pending + data.workflows.inProgress + data.workflows.completed + data.workflows.failed, 1)} />
            <WorkflowBar label="Completed" count={data.workflows.completed} color="bg-emerald-500" total={Math.max(data.workflows.pending + data.workflows.inProgress + data.workflows.completed + data.workflows.failed, 1)} />
            <WorkflowBar label="Failed" count={data.workflows.failed} color="bg-red-500" total={Math.max(data.workflows.pending + data.workflows.inProgress + data.workflows.completed + data.workflows.failed, 1)} />
            <div className="pt-2 border-t">
              <Link href="/workflows" className="text-xs text-violet-600 hover:text-violet-700 flex items-center gap-1">
                View all workflows <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trend + Renewals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Monthly PO Spend Trend (12 months)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.monthlyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={data.monthlyTrend}>
                  <defs>
                    <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <RechartsTooltip formatter={(v: number) => formatCurrency(v)} />
                  <Area type="monotone" dataKey="poSpend" stroke="#8b5cf6" fill="url(#spendGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <EmptyState message="No spend data for trend" />}
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-red-500" />
              Renewal &amp; Expiry Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
              <div>
                <p className="text-sm font-semibold text-red-700">Expiring in 30 days</p>
                <p className="text-xs text-red-500">Requires immediate attention</p>
              </div>
              <span className="text-2xl font-bold text-red-700">{data.portfolio.expiringIn30}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-100">
              <div>
                <p className="text-sm font-semibold text-amber-700">Expiring in 90 days</p>
                <p className="text-xs text-amber-500">Plan renewal strategy</p>
              </div>
              <span className="text-2xl font-bold text-amber-700">{data.portfolio.expiringIn90}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div>
                <p className="text-sm font-semibold text-slate-700">30-day spend volume</p>
                <p className="text-xs text-slate-500">POs + Invoices this month</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-slate-700">{formatCurrency(data.spend.poValue30d + data.spend.invoiceValue30d)}</p>
              </div>
            </div>
            <Link href="/renewals" className="text-xs text-violet-600 hover:text-violet-700 flex items-center gap-1">
              Manage renewals <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown */}
      {data.categories.length > 0 && (
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-500" />
              Portfolio by Procurement Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.categories}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="category" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <RechartsTooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="totalValue" fill="#6366f1" radius={[4, 4, 0, 0]} name="Contract Value" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ERP & INTEGRATIONS TAB
// ═══════════════════════════════════════════════════════════════════════

function ERPTab({ data }: { data: EcosystemData }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Integration Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard icon={Link2} label="Total Integrations" value={data.integrations.total} color="violet" />
        <KPICard icon={CheckCircle} label="Connected" value={data.integrations.connected} color="emerald" />
        <KPICard icon={AlertTriangle} label="With Errors" value={data.integrations.erroring} color={data.integrations.erroring > 0 ? "red" : "emerald"} />
        <KPICard icon={Cloud} label="ERP Sync Coverage" value={`${data.crossSystem.erpSyncCoverage}%`} color="cyan" />
      </div>

      {/* ERP Integrations Detail */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Server className="h-4 w-4 text-violet-500" />
            ERP Connections
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.integrations.erp.length > 0 ? (
            <div className="space-y-3">
              {data.integrations.erp.map((erp) => (
                <div key={erp.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center">
                      <Server className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{erp.name}</p>
                      <p className="text-xs text-slate-500">{erp.provider} &middot; {erp.recordsProcessed?.toLocaleString()} records</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <Badge className={erp.status === "CONNECTED" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}>
                        {erp.status}
                      </Badge>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {erp.uptime ? `${erp.uptime}% uptime` : ""}
                        {erp.errors24h ? ` · ${erp.errors24h} errors` : ""}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="No ERP integrations configured" action={{ label: "Connect ERP", href: "/admin/integrations" }} />
          )}
        </CardContent>
      </Card>

      {/* All Integrations Grid */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Globe className="h-4 w-4 text-cyan-500" />
            All Connected Systems
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.integrations.all.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.integrations.all.map((int) => (
                <div key={int.id} className="p-3 border rounded-lg hover:shadow-sm transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-400 uppercase">{int.type}</span>
                    <Badge variant="outline" className={int.status === "CONNECTED" ? "border-emerald-300 text-emerald-600" : "border-red-300 text-red-600"}>
                      {int.status === "CONNECTED" ? "●" : "○"} {int.status}
                    </Badge>
                  </div>
                  <p className="text-sm font-semibold text-slate-800">{int.name}</p>
                  <p className="text-xs text-slate-500">{int.provider}</p>
                  {int.lastSync && (
                    <p className="text-xs text-slate-400 mt-1">Last sync: {new Date(int.lastSync).toLocaleDateString()}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="No integrations configured" action={{ label: "Set Up Integrations", href: "/admin/integrations" }} />
          )}
        </CardContent>
      </Card>

      {/* Recent Sync Activity */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-500" />
            Recent Sync Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentSyncs.length > 0 ? (
            <div className="space-y-2">
              {data.recentSyncs.map((sync) => (
                <div key={sync.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${sync.status === "COMPLETED" ? "bg-emerald-500" : sync.status === "FAILED" ? "bg-red-500" : "bg-amber-500"}`} />
                    <div>
                      <p className="text-sm text-slate-700">{sync.integrationName} <span className="text-slate-400">({sync.provider})</span></p>
                      <p className="text-xs text-slate-400">{sync.recordsSuccess ?? 0} records synced{sync.recordsFailed ? `, ${sync.recordsFailed} failed` : ""}</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400">{new Date(sync.startedAt).toLocaleString()}</p>
                </div>
              ))}
            </div>
          ) : <EmptyState message="No sync activity yet" />}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// SPEND ANALYTICS TAB
// ═══════════════════════════════════════════════════════════════════════

function SpendTab({ data }: { data: EcosystemData }) {
  const matchData = [
    { name: "Matched", value: data.spend.matchedInvoices, fill: "#10b981" },
    { name: "Discrepancy", value: data.spend.discrepantInvoices, fill: "#f59e0b" },
    { name: "Unmatched", value: data.spend.unmatchedInvoices, fill: "#ef4444" },
  ].filter(d => d.value > 0);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Spend KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPICard icon={Package} label="Purchase Orders" value={data.spend.totalPOs} subtitle={formatCurrency(data.spend.totalPoValue)} color="violet" />
        <KPICard icon={FileText} label="Invoices" value={data.spend.totalInvoices} subtitle={formatCurrency(data.spend.totalInvoiceValue)} color="cyan" />
        <KPICard icon={CheckCircle} label="Match Rate" value={`${data.spend.invoiceMatchRate}%`} color="emerald" />
        <KPICard icon={AlertTriangle} label="Open Exceptions" value={data.spend.openExceptions} color={data.spend.openExceptions > 0 ? "red" : "emerald"} />
        <KPICard icon={TrendingUp} label="30-Day Volume" value={formatCurrency(data.spend.poValue30d)} subtitle="POs this month" color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 3-Way Match Donut */}
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Target className="h-4 w-4 text-emerald-500" />
              Invoice 3-Way Match Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {matchData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={matchData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                    innerRadius={60} outerRadius={90} paddingAngle={4}>
                    {matchData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <EmptyState message="No invoices processed yet" />}
          </CardContent>
        </Card>

        {/* Contract vs Spend Variance */}
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-indigo-500" />
              Contract vs Actual Spend
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-violet-50 rounded-lg">
                <p className="text-xs text-violet-500 font-medium">Contract Value</p>
                <p className="text-lg font-bold text-violet-700">{formatCurrency(data.portfolio.portfolioValue)}</p>
              </div>
              <div className="p-3 bg-cyan-50 rounded-lg">
                <p className="text-xs text-cyan-500 font-medium">Total PO Value</p>
                <p className="text-lg font-bold text-cyan-700">{formatCurrency(data.spend.totalPoValue)}</p>
              </div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-500">Spend Variance</span>
                <span className={`text-sm font-bold ${Math.abs(data.crossSystem.contractToSpendVariance) > 15 ? "text-red-600" : "text-amber-600"}`}>
                  {data.crossSystem.contractToSpendVariance > 0 ? "+" : ""}{data.crossSystem.contractToSpendVariance}%
                </span>
              </div>
              <Progress value={Math.min(Math.abs(data.crossSystem.contractToSpendVariance), 100)} className="h-1.5" />
              <p className="text-xs text-slate-400 mt-1">
                {data.crossSystem.contractToSpendVariance > 0 ? "Over-spending vs committed contract value" : data.crossSystem.contractToSpendVariance < 0 ? "Under-spending vs committed contract value" : "Perfectly aligned"}
              </p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-500">Invoice vs PO Coverage</span>
                <span className="text-sm font-bold text-slate-700">
                  {data.spend.totalPoValue > 0 ? `${((data.spend.totalInvoiceValue / data.spend.totalPoValue) * 100).toFixed(1)}%` : "N/A"}
                </span>
              </div>
              <Progress value={data.spend.totalPoValue > 0 ? Math.min((data.spend.totalInvoiceValue / data.spend.totalPoValue) * 100, 100) : 0} className="h-1.5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly trend */}
      {data.monthlyTrend.length > 0 && (
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-violet-500" />
              12-Month Spend Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={data.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <RechartsTooltip formatter={(v: number) => formatCurrency(v)} />
                <Line type="monotone" dataKey="poSpend" stroke="#8b5cf6" strokeWidth={2.5} dot={{ fill: "#8b5cf6", r: 3 }} name="PO Spend" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// SUPPLIERS TAB
// ═══════════════════════════════════════════════════════════════════════

function SuppliersTab({ data }: { data: EcosystemData }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Top Suppliers Table */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Building2 className="h-4 w-4 text-violet-500" />
            Top Suppliers by Contract Value
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.topSuppliers.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left py-2 text-xs font-medium text-slate-400">#</th>
                      <th className="text-left py-2 text-xs font-medium text-slate-400">Supplier</th>
                      <th className="text-right py-2 text-xs font-medium text-slate-400">Contracts</th>
                      <th className="text-right py-2 text-xs font-medium text-slate-400">Total Value</th>
                      <th className="text-right py-2 text-xs font-medium text-slate-400">Annual Value</th>
                      <th className="text-right py-2 text-xs font-medium text-slate-400">% of Portfolio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topSuppliers.map((s, i) => (
                      <tr key={s.name ?? i} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="py-2.5 text-slate-400">{i + 1}</td>
                        <td className="py-2.5 font-medium text-slate-800">{s.name || "—"}</td>
                        <td className="py-2.5 text-right text-slate-600">{s.contractCount}</td>
                        <td className="py-2.5 text-right font-medium text-slate-800">{formatCurrency(s.totalValue)}</td>
                        <td className="py-2.5 text-right text-slate-600">{formatCurrency(s.annualValue)}</td>
                        <td className="py-2.5 text-right">
                          <span className="text-xs font-medium text-violet-600">
                            {data.portfolio.portfolioValue > 0 ? `${((s.totalValue / data.portfolio.portfolioValue) * 100).toFixed(1)}%` : "—"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Supplier Concentration Chart */}
              <div className="mt-6">
                <p className="text-xs text-slate-500 mb-3 font-medium">Supplier Spend Concentration</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.topSuppliers.slice(0, 8)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-20} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <RechartsTooltip formatter={(v: number) => formatCurrency(v)} />
                    <Bar dataKey="totalValue" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Total Value" />
                    <Bar dataKey="annualValue" fill="#06b6d4" radius={[4, 4, 0, 0]} name="Annual Value" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : <EmptyState message="No supplier data yet" />}
        </CardContent>
      </Card>

      {/* Categories */}
      {data.categories.length > 0 && (
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-500" />
              Category Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={data.categories} dataKey="totalValue" nameKey="category" cx="50%" cy="50%"
                  outerRadius={80} paddingAngle={3}>
                  {data.categories.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════════════

function KPICard({ icon: Icon, label, value, subtitle, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  subtitle?: string;
  color: string;
}) {
  const colorMap: Record<string, { bg: string; text: string; iconBg: string }> = {
    violet: { bg: "bg-violet-50", text: "text-violet-700", iconBg: "bg-violet-100" },
    emerald: { bg: "bg-emerald-50", text: "text-emerald-700", iconBg: "bg-emerald-100" },
    cyan: { bg: "bg-cyan-50", text: "text-cyan-700", iconBg: "bg-cyan-100" },
    amber: { bg: "bg-amber-50", text: "text-amber-700", iconBg: "bg-amber-100" },
    red: { bg: "bg-red-50", text: "text-red-700", iconBg: "bg-red-100" },
    indigo: { bg: "bg-indigo-50", text: "text-indigo-700", iconBg: "bg-indigo-100" },
  };
  const c = colorMap[color] || colorMap.violet;

  return (
    <Card className="border-slate-200 hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className={`p-1.5 rounded-lg ${c.iconBg}`}>
            <Icon className={`h-4 w-4 ${c.text}`} />
          </div>
          <span className="text-xs text-slate-500 font-medium">{label}</span>
        </div>
        <p className={`text-xl font-bold ${c.text}`}>{value}</p>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

function WorkflowBar({ label, count, color, total }: { label: string; count: number; color: string; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-600">{label}</span>
        <span className="text-xs font-semibold text-slate-700">{count}</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function EmptyState({ message, action }: { message: string; action?: { label: string; href: string } }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <Database className="h-8 w-8 text-slate-300 mb-2" />
      <p className="text-sm text-slate-400">{message}</p>
      {action && (
        <Link href={action.href}>
          <Button variant="outline" size="sm" className="mt-3 gap-1.5">
            {action.label} <ArrowUpRight className="h-3 w-3" />
          </Button>
        </Link>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50/30">
      <div className="max-w-[1600px] mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-slate-200 animate-pulse" />
          <div>
            <div className="h-6 w-64 bg-slate-200 rounded animate-pulse" />
            <div className="h-4 w-48 bg-slate-100 rounded animate-pulse mt-1" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-10 bg-slate-100 rounded-lg w-96 animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-64 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
