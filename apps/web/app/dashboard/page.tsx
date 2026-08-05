"use client";

import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/components/ui/design-system";
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
  AlertTriangle,
  CalendarDays,
  Activity,
} from "lucide-react";
import Link from "next/link";
import { DashboardSkeleton } from "@/components/ui/skeletons";
import { useRealTimeEvents } from "@/contexts/RealTimeContext";
import { type DashboardWidget } from "@/components/dashboard/CustomDashboardBuilder";
import { useDemoMode } from "@/hooks/useDemoMode";
import { useTranslations } from "next-intl";

const CustomDashboardBuilder = lazy(() => import("@/components/dashboard/CustomDashboardBuilder"));

interface ObligationsMetrics {
  totalObligations: number;
  overdueCount: number;
  atRiskCount: number;
  dueSoon: number;
  completedThisMonth: number;
  complianceRate: number;
}

interface DeadlineItem {
  id: string;
  contractId: string;
  contractName: string;
  type: string;
  date: string;
  daysUntil: number;
  status: string;
  priority: string;
}

interface ActivityItem {
  id: string;
  type: string;
  title: string;
  description?: string;
  timestamp: string;
  contractId?: string;
  contractName?: string;
}

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
// `demo: 'hide'` actions are filtered out when demo mode is active so the
// dashboard only surfaces routes that exist in the demo navigation.
type QuickAction = {
  icon: typeof Upload;
  label: string;
  description: string;
  href: string;
  color: string;
  demo?: 'hide';
};

// `key` resolves to messages/{locale}.json under dashboard.quickActions.<key>.{name,desc}
const quickActionsConfig: Array<Omit<QuickAction, 'label' | 'description'> & { key: string }> = [
  {
    key: 'upload',
    icon: Upload,
    href: "/upload",
    color: "bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400",
    demo: 'hide',
  },
  {
    key: 'generate',
    icon: Zap,
    href: "/drafting",
    color: "bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400",
    demo: 'hide',
  },
  {
    key: 'obligations',
    icon: Target,
    href: "/obligations",
    color: "bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400",
  },
  {
    key: 'renewals',
    icon: RefreshCw,
    href: "/renewals",
    color: "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400",
  },
  {
    key: 'deadlines',
    icon: Clock,
    href: "/deadlines",
    color: "bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400",
  },
  {
    key: 'contracts',
    icon: FolderOpen,
    href: "/contracts",
    color: "bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400",
  },
  {
    key: 'aiAssistant',
    icon: MessageSquare,
    href: "/contigo-labs?tab=chat",
    color: "bg-pink-100 dark:bg-pink-900/40 text-pink-600 dark:text-pink-400",
    demo: 'hide',
  },
  {
    key: 'search',
    icon: Search,
    href: "/search",
    color: "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400",
    demo: 'hide',
  },
];

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const isDemo = useDemoMode();
  const t = useTranslations('dashboard');
  const tCommon = useTranslations('common');
  const quickActions: QuickAction[] = useMemo(
    () => quickActionsConfig.map(({ key, ...rest }) => ({
      ...rest,
      label: t(`quickActions.${key}.name`),
      description: t(`quickActions.${key}.desc`),
    })),
    [t],
  );
  const visibleQuickActions = useMemo(
    () => quickActions.filter((a) => !(isDemo && a.demo === 'hide')),
    [quickActions, isDemo],
  );
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

  const { data: obligationsMetrics } = useQuery<ObligationsMetrics | null>({
    queryKey: ['obligations-metrics'],
    queryFn: async () => {
      const res = await fetch('/api/obligations/metrics', { credentials: 'same-origin' });
      if (!res.ok) return null;
      const json = await res.json();
      return json.success ? json.data as ObligationsMetrics : null;
    },
    staleTime: 60_000,
    enabled: !!dashboardData,
  });

  const { data: upcomingDeadlines } = useQuery<DeadlineItem[]>({
    queryKey: ['deadlines-summary'],
    queryFn: async () => {
      const res = await fetch('/api/deadlines', { credentials: 'same-origin' });
      if (!res.ok) return [];
      const json = await res.json();
      const deadlines: DeadlineItem[] = json.success ? json.data.deadlines ?? [] : [];
      return deadlines.filter((d) => d.daysUntil >= 0).slice(0, 5);
    },
    staleTime: 60_000,
    enabled: !!dashboardData,
  });

  const { data: activityFeed } = useQuery<ActivityItem[]>({
    queryKey: ['activity-feed'],
    queryFn: async () => {
      const res = await fetch('/api/activity?limit=6&category=contracts', { credentials: 'same-origin' });
      if (!res.ok) return [];
      const json = await res.json();
      return json.success ? json.data.activities as ActivityItem[] : [];
    },
    staleTime: 30_000,
    enabled: !!dashboardData,
  });

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
        title={t('title')}
        description={t('description')}
      >
        <DashboardSkeleton />
      </DashboardLayout>
    );
  }

  if (!dashboardData) {
    return (
      <DashboardLayout
        title={t('title')}
        description={t('description')}
      >
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="text-center space-y-2">
            <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-300">
              {t('unableToLoad')}
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
            {t('retry')}
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title={t('title')}
      description={t('description')}
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
            {t('customize')}
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => queryClient.invalidateQueries({ queryKey: ['dashboard'] })}
            className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm"
            aria-label="Refresh dashboard data"
          >
            <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
            {t('refresh')}
          </Button>
          <Button 
            size="sm" 
            asChild
            className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-lg shadow-violet-500/25"
          >
            {isDemo ? (
              <Link href="/contracts">
                <FolderOpen className="h-4 w-4 mr-2" />
                {t('browseContracts')}
              </Link>
            ) : (
              <Link href="/upload">
                <Plus className="h-4 w-4 mr-2" />
                {t('addContract')}
              </Link>
            )}
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
        {dashboardData.overview.totalContracts === 0 && !isDemo && (
          <motion.div variants={itemVariants}>
            <Card className="border-slate-200/60 dark:border-slate-700/60 bg-white dark:bg-slate-900 shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  {t('empty.title')}
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
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('empty.uploadFirst')}</div>
                        <div className="text-xs text-muted-foreground">{t('empty.uploadDescription')}</div>
                        <div className="mt-3">
                          <Button asChild size="sm">
                            <Link href="/upload">{tCommon('upload')}</Link>
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
                            <Link href="/contigo-labs?tab=chat">Open chat</Link>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
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
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('kpi.totalContracts')}</p>
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
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('kpi.renewalsDue')}</p>
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
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('kpi.portfolioValue')}</p>
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
                  <Link href="/contracts" className="text-xs text-muted-foreground hover:text-violet-600 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    View <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
                <div className="space-y-1 mt-auto">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('kpi.recentlyAdded')}</p>
                  <p className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {dashboardData.overview.recentlyAdded > 0 ? `+${dashboardData.overview.recentlyAdded}` : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground pt-1">
                    {dashboardData.overview.recentlyAdded > 0 ? t('obligationsSection.thisMonth') : t('recentContracts.noneYet')}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

        </div>

        {/* Renewals & Deadlines Breakdown */}
        <motion.div variants={itemVariants}>
          <Card className="bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-700/60 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-orange-500" />
                  {t('renewalsSection.title')}
                </CardTitle>
                <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-slate-900 dark:hover:text-white">
                  <Link href="/renewals">{t('viewAll')} <ArrowRight className="h-3.5 w-3.5 ml-1" /></Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              {dashboardData.renewals.expiringIn90Days === 0 ? (
                <div className="flex items-center justify-center py-6 text-muted-foreground gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-sm">{t('renewalsSection.noneIn90')}</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Critical: 0–30 days */}
                  <Link href="/renewals?range=30">
                    <div className={cn(
                      "group rounded-xl border p-4 transition-all duration-200 hover:shadow-md cursor-pointer",
                      dashboardData.renewals.expiringIn30Days > 0
                        ? "border-red-200 dark:border-red-800/60 bg-red-50/60 dark:bg-red-950/20 hover:border-red-300"
                        : "border-slate-200/60 dark:border-slate-700/60 bg-slate-50/40 dark:bg-slate-800/30"
                    )}>
                      <div className="flex items-center justify-between mb-3">
                        <span className={cn(
                          "text-xs font-semibold uppercase tracking-wide",
                          dashboardData.renewals.expiringIn30Days > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
                        )}>{t('renewalsSection.critical')}</span>
                        {dashboardData.renewals.urgentCount > 0 && (
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                          </span>
                        )}
                      </div>
                      <p className={cn(
                        "text-3xl font-bold",
                        dashboardData.renewals.expiringIn30Days > 0 ? "text-red-700 dark:text-red-300" : "text-slate-400 dark:text-slate-500"
                      )}>
                        {dashboardData.renewals.expiringIn30Days}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{t('renewalsSection.expiring30')}</p>
                    </div>
                  </Link>

                  {/* Upcoming: 31–90 days */}
                  <Link href="/renewals?range=90">
                    <div className={cn(
                      "group rounded-xl border p-4 transition-all duration-200 hover:shadow-md cursor-pointer",
                      (dashboardData.renewals.expiringIn90Days - dashboardData.renewals.expiringIn30Days) > 0
                        ? "border-amber-200 dark:border-amber-800/60 bg-amber-50/60 dark:bg-amber-950/20 hover:border-amber-300"
                        : "border-slate-200/60 dark:border-slate-700/60 bg-slate-50/40 dark:bg-slate-800/30"
                    )}>
                      <div className="mb-3">
                        <span className={cn(
                          "text-xs font-semibold uppercase tracking-wide",
                          (dashboardData.renewals.expiringIn90Days - dashboardData.renewals.expiringIn30Days) > 0
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-muted-foreground"
                        )}>{t('renewalsSection.upcoming')}</span>
                      </div>
                      <p className={cn(
                        "text-3xl font-bold",
                        (dashboardData.renewals.expiringIn90Days - dashboardData.renewals.expiringIn30Days) > 0
                          ? "text-amber-700 dark:text-amber-300"
                          : "text-slate-400 dark:text-slate-500"
                      )}>
                        {dashboardData.renewals.expiringIn90Days - dashboardData.renewals.expiringIn30Days}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{t('renewalsSection.expiring3190')}</p>
                    </div>
                  </Link>

                  {/* Total: 90-day window */}
                  <Link href="/renewals">
                    <div className="group rounded-xl border border-slate-200/60 dark:border-slate-700/60 bg-slate-50/40 dark:bg-slate-800/30 p-4 transition-all duration-200 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 cursor-pointer">
                      <div className="mb-3">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('renewalsSection.totalWindow')}</span>
                      </div>
                      <p className="text-3xl font-bold text-slate-700 dark:text-slate-200">
                        {dashboardData.renewals.expiringIn90Days}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{t('renewalsSection.expiring90')}</p>
                    </div>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Obligations At a Glance */}
        <motion.div variants={itemVariants}>
          <Card className="bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-700/60 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Target className="h-4 w-4 text-rose-500" />
                  {t('obligationsSection.title')}
                </CardTitle>
                <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-slate-900 dark:hover:text-white">
                  <Link href="/obligations">{t('viewAll')} <ArrowRight className="h-3.5 w-3.5 ml-1" /></Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              {!obligationsMetrics || obligationsMetrics.totalObligations === 0 ? (
                <div className="flex items-center justify-center py-6 text-muted-foreground gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-sm">{t('obligationsSection.none')}</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="rounded-xl border border-slate-200/60 dark:border-slate-700/60 bg-slate-50/40 dark:bg-slate-800/30 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{t('obligationsSection.total')}</p>
                    <p className="text-3xl font-bold text-slate-700 dark:text-slate-200">{obligationsMetrics.totalObligations}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t('obligationsSection.tracked')}</p>
                  </div>
                  <Link href="/obligations?status=overdue">
                    <div className={cn(
                      "rounded-xl border p-4 transition-all hover:shadow-md cursor-pointer",
                      obligationsMetrics.overdueCount > 0
                        ? "border-red-200 dark:border-red-800/60 bg-red-50/60 dark:bg-red-950/20 hover:border-red-300"
                        : "border-slate-200/60 dark:border-slate-700/60 bg-slate-50/40 dark:bg-slate-800/30"
                    )}>
                      <p className={cn("text-xs font-semibold uppercase tracking-wide mb-2",
                        obligationsMetrics.overdueCount > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
                      )}>{t('obligationsSection.overdue')}</p>
                      <p className={cn("text-3xl font-bold",
                        obligationsMetrics.overdueCount > 0 ? "text-red-700 dark:text-red-300" : "text-slate-400 dark:text-slate-500"
                      )}>{obligationsMetrics.overdueCount}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t('obligationsSection.needAction')}</p>
                    </div>
                  </Link>
                  <Link href="/obligations?status=at_risk">
                    <div className={cn(
                      "rounded-xl border p-4 transition-all hover:shadow-md cursor-pointer",
                      obligationsMetrics.dueSoon > 0
                        ? "border-amber-200 dark:border-amber-800/60 bg-amber-50/60 dark:bg-amber-950/20 hover:border-amber-300"
                        : "border-slate-200/60 dark:border-slate-700/60 bg-slate-50/40 dark:bg-slate-800/30"
                    )}>
                      <p className={cn("text-xs font-semibold uppercase tracking-wide mb-2",
                        obligationsMetrics.dueSoon > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                      )}>{t('obligationsSection.dueSoon')}</p>
                      <p className={cn("text-3xl font-bold",
                        obligationsMetrics.dueSoon > 0 ? "text-amber-700 dark:text-amber-300" : "text-slate-400 dark:text-slate-500"
                      )}>{obligationsMetrics.dueSoon}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t('obligationsSection.within7Days')}</p>
                    </div>
                  </Link>
                  <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 mb-2">{t('obligationsSection.done')}</p>
                    <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">{obligationsMetrics.completedThisMonth}</p>
                    <p className="text-xs text-muted-foreground mt-1">this month</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Actions */}
        <motion.div variants={itemVariants}>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {visibleQuickActions.map((action, index) => {
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
        <div className={cn(
          "grid grid-cols-1 gap-6",
          isDemo ? "lg:grid-cols-1" : "lg:grid-cols-2",
        )}>
          {/* Recent Contracts */}
          <motion.div variants={itemVariants} className="flex">
            <Card className="flex-1 bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-700/60 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold text-slate-900 dark:text-white">{t('recentContracts.title')}</CardTitle>
                  <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-slate-900 dark:hover:text-white">
                    <Link href="/contracts">{t('viewAll')}</Link>
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
                            {contract.createdAt ? new Date(contract.createdAt).toLocaleDateString() : t('recentContracts.recentlyAdded')}
                          </p>
                        </div>
                        <Badge variant="outline" className="px-3 py-1 text-xs bg-violet-50 text-violet-700 border-violet-200">
                          {{
                            completed: t('recentContracts.statuses.active'),
                            processing: t('recentContracts.statuses.processing'),
                            uploaded: t('recentContracts.statuses.uploaded'),
                            queued: t('recentContracts.statuses.queued'),
                            error: t('recentContracts.statuses.error'),
                            draft: t('recentContracts.statuses.draft'),
                          }[contract.status || ''] || contract.status || t('recentContracts.statuses.active')}
                        </Badge>
                      </motion.div>
                    </Link>
                  )) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">{t('recentContracts.noneYet')}</p>
                      <p className="text-xs mt-1">
                        {isDemo ? t('recentContracts.demoHint') : t('recentContracts.uploadHint')}
                      </p>
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
                    {t('recentContracts.browseAll')}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* AI Assistant Preview */}
          {!isDemo && (
          <motion.div variants={itemVariants} className="flex">
            <Card className="flex-1 bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-700/60 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold text-slate-900 dark:text-white">{t('aiAssistant.title')}</CardTitle>
                  <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-slate-900 dark:hover:text-white">
                    <Link href="/ai/chat">{t('aiAssistant.openChat')}</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-5">
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">{t('aiAssistant.exampleQuestions')}</p>
                  <div className="space-y-2">
                    {[
                      t('aiAssistant.q1'),
                      t('aiAssistant.q2'),
                      t('aiAssistant.q3'),
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
          )}
        </div>

        {/* Upcoming Deadlines + Activity Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming Deadlines */}
          <motion.div variants={itemVariants} className="flex">
            <Card className="flex-1 bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-700/60 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-blue-500" />
                    {t('deadlinesSection.title')}
                  </CardTitle>
                  <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-slate-900 dark:hover:text-white">
                    <Link href="/deadlines">{t('viewAll')} <ArrowRight className="h-3.5 w-3.5 ml-1" /></Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                {!upcomingDeadlines || upcomingDeadlines.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
                    <CalendarDays className="h-8 w-8 opacity-30" />
                    <p className="text-sm">{t('deadlinesSection.none')}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {upcomingDeadlines.map((d) => {
                      const isOverdue = d.daysUntil < 0;
                      const isUrgent = d.daysUntil <= 7;
                      const isSoon = d.daysUntil <= 30;
                      const chipClass = isOverdue
                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                        : isUrgent
                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                        : isSoon
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                        : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
                      const typeLabel: Record<string, string> = {
                        expiration: t('deadlinesSection.typeExpires'),
                        renewal: t('deadlinesSection.typeRenewal'),
                        milestone: t('deadlinesSection.typeMilestone'),
                      };
                      return (
                        <Link key={d.id} href={`/contracts/${d.contractId}`}>
                          <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-200/60 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm transition-all">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{d.contractName}</p>
                              <p className="text-xs text-muted-foreground">{typeLabel[d.type] ?? d.type} · {new Date(d.date).toLocaleDateString()}</p>
                            </div>
                            <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap", chipClass)}>
                              {d.daysUntil === 0 ? t('deadlinesSection.today') : `${d.daysUntil}d`}
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Activity Feed */}
          <motion.div variants={itemVariants} className="flex">
            <Card className="flex-1 bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-700/60 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Activity className="h-4 w-4 text-violet-500" />
                    {t('activitySection.title')}
                  </CardTitle>
                  <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-slate-900 dark:hover:text-white">
                    <Link href="/contracts">{t('viewAll')} <ArrowRight className="h-3.5 w-3.5 ml-1" /></Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                {!activityFeed || activityFeed.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
                    <Activity className="h-8 w-8 opacity-30" />
                    <p className="text-sm">{t('activitySection.none')}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activityFeed.map((item) => {
                      const iconMap: Record<string, { icon: typeof FileText; color: string }> = {
                        contract_created: { icon: FileText, color: "text-violet-500" },
                        upload: { icon: FileUp, color: "text-violet-500" },
                        processing_completed: { icon: CheckCircle, color: "text-green-500" },
                        processing_started: { icon: Zap, color: "text-amber-500" },
                        processing_failed: { icon: AlertTriangle, color: "text-red-500" },
                        contract_approved: { icon: CheckCircle, color: "text-green-500" },
                        contract_rejected: { icon: AlertTriangle, color: "text-red-500" },
                      };
                      const { icon: Icon, color } = iconMap[item.type] ?? { icon: FileText, color: "text-slate-400" };
                      const elapsed = Math.floor((Date.now() - new Date(item.timestamp).getTime()) / 60000);
                      const timeAgo = elapsed < 1
                        ? t('activitySection.justNow')
                        : elapsed < 60
                        ? t('activitySection.minutesAgo', { n: elapsed })
                        : elapsed < 1440
                        ? t('activitySection.hoursAgo', { n: Math.floor(elapsed / 60) })
                        : t('activitySection.daysAgo', { n: Math.floor(elapsed / 1440) });
                      return (
                        <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg border border-slate-200/60 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-800/30">
                          <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", color)} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{item.title}</p>
                            {item.contractName && (
                              <p className="text-xs text-muted-foreground truncate">{item.contractName}</p>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Contract Stats Overview */}
        <motion.div variants={itemVariants}>
          <Card className="bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-700/60 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-slate-900 dark:text-white">{t('overviewSection.title')}</CardTitle>
                {!isDemo && (
                  <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-slate-900 dark:hover:text-white">
                    <Link href="/analytics">{t('overviewSection.fullAnalytics')}</Link>
                  </Button>
                )}
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
