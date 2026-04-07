"use client";

import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatPercentage } from "@/components/ui/design-system";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";

import {
  FileText,
  TrendingUp,
  CheckCircle,
  Upload,
  Search,
  MessageSquare,
  FolderOpen,
  ArrowRight,
  RefreshCw,
  Clock,
  Plus,
  Zap,
  Eye,
  FileUp,
  Bot,
  Target,
  LayoutGrid,
} from "lucide-react";
import Link from "next/link";
import { DashboardSkeleton } from "@/components/ui/skeletons";
import { useRealTimeEvents } from "@/contexts/RealTimeContext";
import { type DashboardWidget } from "@/components/dashboard/CustomDashboardBuilder";

const ContractLifecyclePipeline = lazy(() => import("@/components/dashboard/ContractLifecyclePipeline"));
const CustomDashboardBuilder = lazy(() => import("@/components/dashboard/CustomDashboardBuilder"));

interface DashboardData {
  overview: {
    totalContracts: number;
    activeContracts: number;
    portfolioValue: number;
    recentlyAdded: number;
  };
  renewals: {
    expiringIn30Days: number;
    expiringIn90Days: number;
    urgentCount: number;
  };
  breakdown: {
    byStatus: Array<{ status: string; count: number }>;
    byType: Array<{ type: string; count: number }>;
  };
  riskScore: number;
  complianceScore: number;
}

const fetchDashboardData = async (): Promise<{ stats: DashboardData | null; recentContracts: Array<{ id: string; fileName: string; status: string; createdAt: string }>; error?: string }> => {
  try {
    const [statsRes, contractsRes] = await Promise.all([
      fetch('/api/dashboard/stats', { credentials: 'same-origin' }),
      fetch('/api/contracts?limit=4&sortBy=createdAt&sortOrder=desc', { credentials: 'same-origin' }),
    ]);

    if (!statsRes.ok) {
      console.error('[Dashboard] Stats API failed:', statsRes.status, statsRes.statusText);
      return { stats: null, recentContracts: [], error: `Stats API returned ${statsRes.status}` };
    }

    const statsData = await statsRes.json();
    const contractsData = contractsRes.ok ? await contractsRes.json() : { success: false, data: [] };
    
    return {
      stats: statsData.success ? statsData.data : null,
      recentContracts: contractsData.success ? (contractsData.data?.contracts || contractsData.data || []).slice(0, 4) : [],
      error: statsData.success ? undefined : 'Stats API returned unsuccessful response',
    };
  } catch (err) {
    console.error('[Dashboard] Failed to fetch dashboard data:', err);
    return { stats: null, recentContracts: [], error: err instanceof Error ? err.message : 'Network error' };
  }
};

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }
  }
};

// Quick action buttons - core features
const quickActions = [
  {
    icon: Upload,
    label: "Upload Contract",
    description: "Add new contracts",
    href: "/upload",
    color: "bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400",
  },
  {
    icon: Zap,
    label: "Generate Contract",
    description: "Create with AI",
    href: "/drafting",
    color: "bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400",
  },
  {
    icon: Target,
    label: "Obligations",
    description: "Track compliance",
    href: "/obligations",
    color: "bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400",
  },
  {
    icon: RefreshCw,
    label: "Renewals",
    description: "Track renewals",
    href: "/renewals",
    color: "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400",
  },
  {
    icon: MessageSquare,
    label: "AI Assistant",
    description: "Ask about contracts",
    href: "/contigo-labs?tab=chat",
    color: "bg-pink-100 dark:bg-pink-900/40 text-pink-600 dark:text-pink-400",
  },
  {
    icon: Search,
    label: "Search",
    description: "Find contracts",
    href: "/search",
    color: "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400",
  },
];

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [dashboardWidgets, setDashboardWidgets] = useState<DashboardWidget[]>(() => {
    // Load persisted widget configuration from localStorage
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('contigo-dashboard-widgets');
        if (saved) return JSON.parse(saved);
      } catch {
        // Ignore parse errors
      }
    }
    return [];
  });

  // Persist widget configuration to localStorage on change
  useEffect(() => {
    try {
      if (dashboardWidgets.length > 0) {
        localStorage.setItem('contigo-dashboard-widgets', JSON.stringify(dashboardWidgets));
      } else {
        localStorage.removeItem('contigo-dashboard-widgets');
      }
    } catch {
      // Ignore storage errors
    }
  }, [dashboardWidgets]);

  const { data, isLoading, error: queryError, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboardData,
    staleTime: 30_000, // 30 seconds – keep in sync with contract-stats
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 2,
  });

  const dashboardData = data?.stats || null;
  const recentContracts = data?.recentContracts || [];
  const fetchError = data?.error || (queryError instanceof Error ? queryError.message : null);

  // Real-time updates
  const eventHandlers = useMemo(() => ({
    'contract:created': () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    'contract:completed': () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    'job:progress': () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
  }), [queryClient]);

  useRealTimeEvents(eventHandlers);

  if (isLoading) {
    return (
      <DashboardLayout
        title="Dashboard"
        description="Your contract management overview"
      >
        <DashboardSkeleton />
      </DashboardLayout>
    );
  }

  if (!dashboardData) {
    return (
      <DashboardLayout
        title="Dashboard"
        description="Your contract management overview"
      >
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="text-center space-y-2">
            <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-300">
              Unable to load dashboard
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
              {fetchError || 'Could not connect to the server. Please check your connection and try again.'}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => refetch()}
            className="mt-2"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Dashboard"
      description="Your contract management command center"
      actions={
        <motion.div 
          className="flex gap-3"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => setCustomizerOpen(true)}
            className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm"
            aria-label="Customize dashboard layout"
          >
            <LayoutGrid className="h-4 w-4 mr-2" aria-hidden="true" />
            Customize
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => queryClient.invalidateQueries({ queryKey: ['dashboard'] })}
            className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm"
            aria-label="Refresh dashboard data"
          >
            <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
            Refresh
          </Button>
          <Button 
            size="sm" 
            asChild
            className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-lg shadow-violet-500/25"
          >
            <Link href="/upload">
              <Plus className="h-4 w-4 mr-2" />
              Add Contract
            </Link>
          </Button>
        </motion.div>
      }
    >
      <motion.div 
        className="space-y-8"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* First-run: Get started */}
        {dashboardData.overview.totalContracts === 0 && (
          <motion.div variants={itemVariants}>
            <Card className="border-slate-200/60 dark:border-slate-700/60 bg-white dark:bg-slate-900 shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  Get started in 2 minutes
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-lg border border-slate-200/60 dark:border-slate-700/60 p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 p-2">
                        <FileUp className="h-4 w-4 text-slate-700 dark:text-slate-200" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Upload your first contract</div>
                        <div className="text-xs text-muted-foreground">PDF or text — we’ll extract metadata automatically.</div>
                        <div className="mt-3">
                          <Button asChild size="sm">
                            <Link href="/upload">Upload</Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200/60 dark:border-slate-700/60 p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 p-2">
                        <FolderOpen className="h-4 w-4 text-slate-700 dark:text-slate-200" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Browse templates</div>
                        <div className="text-xs text-muted-foreground">Start from a managed template and generate drafts faster.</div>
                        <div className="mt-3">
                          <Button asChild size="sm" variant="outline">
                            <Link href="/templates">Templates</Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200/60 dark:border-slate-700/60 p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 p-2">
                        <Bot className="h-4 w-4 text-slate-700 dark:text-slate-200" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Ask the AI assistant</div>
                        <div className="text-xs text-muted-foreground">Try contract Q&A, comparisons, and reports.</div>
                        <div className="mt-3">
                          <Button asChild size="sm" variant="outline">
                            <Link href="/ai/chat">Open chat</Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
          {/* Total Contracts */}
          <motion.div variants={itemVariants} className="h-full">
            <Card className="group relative overflow-hidden bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-shadow duration-200 h-full">
              <CardContent className="p-5 h-full flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2.5 rounded-xl bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400">
                    <FileText className="h-5 w-5" />
                  </div>
                  <Link href="/contracts" className="text-xs text-muted-foreground hover:text-violet-600 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    View <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
                <div className="space-y-1 mt-auto">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Contracts</p>
                  <p className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {dashboardData.overview.totalContracts.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground pt-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5" />
                    {dashboardData.overview.activeContracts} active
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Renewals Due */}
          <motion.div variants={itemVariants} className="h-full">
            <Link href="/renewals" className="block h-full">
              <Card className="group relative overflow-hidden bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-shadow duration-200 h-full cursor-pointer">
                {dashboardData.renewals.urgentCount > 0 && (
                  <div className="absolute top-3 right-3">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                    </span>
                  </div>
                )}
                <CardContent className="p-5 h-full flex flex-col">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2.5 rounded-xl bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400">
                      <RefreshCw className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="space-y-1 mt-auto">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Renewals Due</p>
                    <p className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                      {dashboardData.renewals.expiringIn30Days}
                    </p>
                    <p className="text-xs pt-1">
                      {dashboardData.renewals.urgentCount > 0 ? (
                        <span className="text-red-600 dark:text-red-400 font-medium">{dashboardData.renewals.urgentCount} urgent</span>
                      ) : (
                        <span className="text-muted-foreground">Next 30 days</span>
                      )}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </motion.div>

          {/* Portfolio Value */}
          <motion.div variants={itemVariants} className="h-full">
            <Card className="group relative overflow-hidden bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-shadow duration-200 h-full">
              <CardContent className="p-5 h-full flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                </div>
                <div className="space-y-1 mt-auto">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Portfolio Value</p>
                  <p className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {formatCurrency(dashboardData.overview.portfolioValue)}
                  </p>
                  <p className="text-xs text-muted-foreground pt-1">
                    From {dashboardData.overview.totalContracts} contracts
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Recently Added */}
          <motion.div variants={itemVariants} className="h-full">
            <Card className="group relative overflow-hidden bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-shadow duration-200 h-full">
              <CardContent className="p-5 h-full flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                    <Plus className="h-5 w-5" />
                  </div>
                  <Link href="/upload" className="text-xs text-muted-foreground hover:text-violet-600 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    Upload <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
                <div className="space-y-1 mt-auto">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recently Added</p>
                  <p className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {dashboardData.overview.recentlyAdded > 0 ? `+${dashboardData.overview.recentlyAdded}` : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground pt-1">
                    {dashboardData.overview.recentlyAdded > 0 ? 'This month' : 'None this month'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Compliance Score */}
          <motion.div variants={itemVariants} className="h-full">
            <Card className="group relative overflow-hidden bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-shadow duration-200 h-full">
              <CardContent className="p-5 h-full flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <div className={cn(
                    'p-2.5 rounded-xl',
                    dashboardData.complianceScore >= 80 ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400'
                      : dashboardData.complianceScore >= 60 ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400'
                      : 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'
                  )}>
                    <CheckCircle className="h-5 w-5" />
                  </div>
                  <span className={cn(
                    'text-[10px] font-semibold uppercase tracking-wide',
                    dashboardData.complianceScore >= 80 ? 'text-green-600 dark:text-green-400'
                      : dashboardData.complianceScore >= 60 ? 'text-amber-600 dark:text-amber-400'
                      : 'text-red-600 dark:text-red-400'
                  )}>
                    {dashboardData.complianceScore >= 80 ? 'Low Risk' : dashboardData.complianceScore >= 60 ? 'Medium' : 'High Risk'}
                  </span>
                </div>
                <div className="space-y-1 mt-auto">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Compliance</p>
                  <p className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {formatPercentage(dashboardData.complianceScore)}
                  </p>
                  <div className="pt-1.5">
                    <Progress 
                      value={dashboardData.complianceScore} 
                      className="h-1.5 bg-slate-100 dark:bg-slate-700"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Contract Lifecycle Pipeline */}
        <motion.div variants={itemVariants}>
          <Suspense fallback={<div className="h-32 bg-slate-100 rounded-lg animate-pulse" />}>
            <ContractLifecyclePipeline />
          </Suspense>
        </motion.div>

        {/* Quick Actions */}
        <motion.div variants={itemVariants}>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <motion.div
                  key={action.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * index }}
                >
                  <Link href={action.href}>
                    <div className="group flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200/60 dark:border-slate-700/60 bg-white dark:bg-slate-900 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200">
                      <div className={`p-2.5 rounded-xl ${action.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="text-center">
                        <h3 className="font-medium text-sm text-slate-900 dark:text-white">
                          {action.label}
                        </h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {action.description}
                        </p>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Two Column Layout - Contracts & AI Assistant */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Contracts */}
          <motion.div variants={itemVariants} className="flex">
            <Card className="flex-1 bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-700/60 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold text-slate-900 dark:text-white">Recent Contracts</CardTitle>
                  <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-slate-900 dark:hover:text-white">
                    <Link href="/contracts">View All</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-5">
                <div className="space-y-3">
                  {recentContracts.length > 0 ? recentContracts.map((contract: { id: string; fileName?: string; originalName?: string; status?: string; createdAt?: string }, idx: number) => (
                    <Link key={contract.id} href={`/contracts/${contract.id}`}>
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 * idx }}
                        className="group flex items-center gap-4 p-4 rounded-xl border border-slate-200/60 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 hover:shadow-md transition-all duration-200"
                      >
                        <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate text-slate-900 dark:text-white">
                            {contract.originalName || contract.fileName || `Contract ${contract.id.slice(0, 8)}`}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-2">
                            <Clock className="h-3 w-3" />
                            {contract.createdAt ? new Date(contract.createdAt).toLocaleDateString() : 'Recently added'}
                          </p>
                        </div>
                        <Badge variant="outline" className="px-3 py-1 text-xs bg-violet-50 text-violet-700 border-violet-200">
                          {{ completed: 'Active', processing: 'Processing', uploaded: 'Uploaded', queued: 'Queued', error: 'Error', draft: 'Draft' }[contract.status || ''] || contract.status || 'Active'}
                        </Badge>
                      </motion.div>
                    </Link>
                  )) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No contracts yet</p>
                      <p className="text-xs mt-1">Upload your first contract to get started</p>
                    </div>
                  )}
                </div>
                <Button 
                  variant="outline" 
                  className="w-full mt-4 border-dashed border-slate-300 dark:border-slate-600 hover:border-violet-400 hover:bg-violet-50/50 dark:hover:bg-violet-950/30"
                  asChild
                >
                  <Link href="/contracts">
                    <Eye className="h-4 w-4 mr-2" />
                    Browse All Contracts
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* AI Assistant Preview */}
          <motion.div variants={itemVariants} className="flex">
            <Card className="flex-1 bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-700/60 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold text-slate-900 dark:text-white">AI Assistant</CardTitle>
                  <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-slate-900 dark:hover:text-white">
                    <Link href="/ai/chat">Open Chat</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-5">
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Example questions:</p>
                  <div className="space-y-2">
                    {[
                      "What contracts are expiring soon?",
                      "Summarize the key terms of my latest contract",
                      "Find contracts with auto-renewal clauses",
                    ].map((suggestion, idx) => (
                      <Link
                        key={idx}
                        href={`/ai/chat?query=${encodeURIComponent(suggestion)}`}
                        className="block p-3 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        <MessageSquare className="h-3.5 w-3.5 text-slate-400 inline mr-2" />
                        {suggestion}
                      </Link>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Contract Stats Overview */}
        <motion.div variants={itemVariants}>
          <Card className="bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-700/60 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-slate-900 dark:text-white">Contract Overview</CardTitle>
                <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-slate-900 dark:hover:text-white">
                  <Link href="/analytics">Full Analytics</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {dashboardData.breakdown.byStatus.slice(0, 4).map((item, idx) => {
                  const colors = [
                    { bg: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-700 dark:text-violet-300', bar: 'bg-violet-500' },
                    { bg: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-700 dark:text-violet-300', bar: 'bg-violet-500' },
                    { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', bar: 'bg-amber-500' },
                    { bg: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-700 dark:text-violet-300', bar: 'bg-violet-500' },
                  ];
                  const defaultColor = { bg: 'bg-gray-100', text: 'text-gray-700', bar: 'bg-gray-500' };
                  const color = colors[idx % colors.length] ?? defaultColor;
                  const percentage = dashboardData.overview.totalContracts > 0 
                    ? Math.round((item.count / dashboardData.overview.totalContracts) * 100) 
                    : 0;
                  
                  return (
                    <motion.div
                      key={item.status}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.1 * idx }}
                      className={`p-4 rounded-xl ${color.bg}`}
                    >
                      <p className={`text-sm font-medium ${color.text} capitalize mb-1`}>
                        {item.status}
                      </p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                        {item.count}
                      </p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <motion.div 
                            className={`h-full ${color.bar} rounded-full`}
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ duration: 0.6, delay: 0.2 * idx }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{percentage}%</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Dashboard Customizer Dialog */}
      <Suspense fallback={null}>
        <CustomDashboardBuilder
          open={customizerOpen}
          onOpenChange={setCustomizerOpen}
          onSave={setDashboardWidgets}
          currentWidgets={dashboardWidgets.length > 0 ? dashboardWidgets : undefined}
        />
      </Suspense>
    </DashboardLayout>
  );
}
