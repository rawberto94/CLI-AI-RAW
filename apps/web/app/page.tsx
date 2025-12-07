"use client";

import { useMemo } from "react";
import { DashboardLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import dynamic from "next/dynamic";
import {
  Grid,
  formatCurrency,
  formatPercentage,
} from "@/components/ui/design-system";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDashboardSummary } from "@/hooks/use-queries";
import { motion } from "framer-motion";

// Lazy load heavy components
const CostSavingsDashboardWidget = dynamic(
  () => import("@/components/lazy").then((mod) => ({ default: mod.LazyCostSavingsDashboardWidget })),
  { ssr: false, loading: () => <div className="h-32 bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 animate-pulse rounded-xl" /> }
);

// Import new dashboard components
import { UpcomingRenewals } from "@/components/dashboard/UpcomingRenewals";
import { ContractTypeChart } from "@/components/dashboard/ContractTypeChart";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { StatusOverview } from "@/components/dashboard/StatusOverview";
import { FloatingAIBubble } from "@/components/ai/FloatingAIBubble";
import { 
  IntelligenceWidget, 
  ApprovalsWidget, 
  RenewalsWidget, 
  GovernanceWidget 
} from "@/components/dashboard/CrossModuleWidgets";

import {
  FileText,
  TrendingUp,
  Shield,
  CheckCircle,
  Calendar,
  TrendingDown,
  AlertCircle,
  Users,
  Sparkles,
  RefreshCw,
  BarChart3,
} from "lucide-react";
import Link from "next/link";
import { DashboardSkeleton } from "@/components/ui/skeletons";
import { useRealTimeEvents } from "@/contexts/RealTimeContext";

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

interface RenewalItem {
  id: string;
  name: string;
  type: string;
  endDate: string;
  daysUntilExpiry: number;
  priority: 'urgent' | 'high' | 'medium';
}

const fetchDashboardData = async (): Promise<{ stats: DashboardData | null; renewals: RenewalItem[] }> => {
  // Get data mode from localStorage (synced with context)
  const dataMode = typeof window !== 'undefined' ? localStorage.getItem('dataMode') || 'real' : 'real';
  const headers = { 'x-data-mode': dataMode };
  
  try {
    const [statsRes, renewalsRes] = await Promise.all([
      fetch('/api/dashboard/stats', { headers }),
      fetch('/api/dashboard/renewals?days=90', { headers })
    ]);
    
    const statsData = statsRes.ok ? await statsRes.json() : { success: false };
    const renewalsData = renewalsRes.ok ? await renewalsRes.json() : { success: false };
    
    return {
      stats: statsData.success ? statsData.data : null,
      renewals: renewalsData.success ? renewalsData.data : []
    };
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return { stats: null, renewals: [] };
  }
};

export default function DashboardPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboardData,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  const dashboardData = data?.stats || null;
  const renewals = data?.renewals || [];

  // Real-time updates for dashboard
  const eventHandlers = useMemo(() => ({
    'contract:created': () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    'contract:completed': () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    'job:progress': () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    'notification': () => {
      // Handle notification silently
    },
  }), [queryClient]);

  useRealTimeEvents(eventHandlers);

  if (isLoading || !dashboardData) {
    return (
      <DashboardLayout
        title="Contracts Dashboard"
        description="Comprehensive contract management overview"
      >
        <DashboardSkeleton />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Contracts Dashboard"
      description="Your complete contract intelligence command center"
      actions={
        <div className="flex gap-3">
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => queryClient.invalidateQueries({ queryKey: ['dashboard'] })}
              className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-slate-200/60 dark:border-slate-700/60 hover:bg-white dark:hover:bg-slate-800 shadow-sm"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button 
              size="sm" 
              asChild
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/25"
            >
              <Link href="/analytics">
                <BarChart3 className="h-4 w-4 mr-2" />
                View Full Analytics
              </Link>
            </Button>
          </motion.div>
        </div>
      }
    >
      <div className="space-y-10 isolate">
        <section className="relative z-0">
          {/* Hero KPIs - Full Width */}
          <Grid cols={4} gap="md">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <Card className="group relative overflow-hidden bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-white/50 dark:border-slate-700/50 shadow-xl shadow-blue-500/5 hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Contracts
                  </CardTitle>
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform duration-300">
                    <FileText className="h-5 w-5" />
                  </div>
                </CardHeader>
                <CardContent className="relative">
                  <div className="text-4xl font-bold tracking-tight mb-2 bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-200 bg-clip-text text-transparent">
                    {dashboardData.overview.totalContracts.toLocaleString()}
                  </div>
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      {dashboardData.overview.activeContracts} active
                    </span>
                    <span className="text-green-600 dark:text-green-400 font-medium">+{dashboardData.overview.recentlyAdded} this month</span>
                  </p>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="mt-4 w-full justify-center text-xs group-hover:bg-blue-50 dark:group-hover:bg-blue-950/50 rounded-xl" 
                    asChild
                  >
                    <Link href="/contracts">View All Contracts →</Link>
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <Card className="group relative overflow-hidden bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-white/50 dark:border-slate-700/50 shadow-xl shadow-emerald-500/5 hover:shadow-2xl hover:shadow-emerald-500/10 transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Portfolio Value
                  </CardTitle>
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30 group-hover:scale-110 transition-transform duration-300">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                </CardHeader>
                <CardContent className="relative">
                  <div className="text-4xl font-bold tracking-tight mb-2 bg-gradient-to-r from-emerald-700 to-emerald-500 dark:from-emerald-400 dark:to-emerald-300 bg-clip-text text-transparent">
                    {formatCurrency(dashboardData.overview.portfolioValue)}
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Total contract value
                  </p>
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
                      <TrendingUp className="h-3 w-3" />
                      +12%
                    </span>
                    <span className="text-muted-foreground">from last quarter</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
            >
              <Card className="group relative overflow-hidden bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-white/50 dark:border-slate-700/50 shadow-xl shadow-orange-500/5 hover:shadow-2xl hover:shadow-orange-500/10 transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Upcoming Renewals
                  </CardTitle>
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/30 group-hover:scale-110 transition-transform duration-300">
                    <Calendar className="h-5 w-5" />
                  </div>
                </CardHeader>
                <CardContent className="relative">
                  <div className="text-4xl font-bold tracking-tight mb-2 bg-gradient-to-r from-orange-700 to-amber-500 dark:from-orange-400 dark:to-amber-300 bg-clip-text text-transparent">
                    {dashboardData.renewals.expiringIn90Days}
                  </div>
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium animate-pulse">
                      <AlertCircle className="h-3 w-3" />
                      {dashboardData.renewals.urgentCount} urgent
                    </span>
                    <span>next 90 days</span>
                  </p>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="mt-4 w-full justify-center text-xs group-hover:bg-orange-50 dark:group-hover:bg-orange-950/50 rounded-xl" 
                    asChild
                  >
                    <Link href="/contracts?filter=expiring">Review Renewals →</Link>
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.4 }}
            >
              <Card className="group relative overflow-hidden bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-white/50 dark:border-slate-700/50 shadow-xl shadow-purple-500/5 hover:shadow-2xl hover:shadow-purple-500/10 transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Compliance Score
                  </CardTitle>
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg shadow-purple-500/30 group-hover:scale-110 transition-transform duration-300">
                    <Shield className="h-5 w-5" />
                  </div>
                </CardHeader>
                <CardContent className="relative">
                  <div className="text-4xl font-bold tracking-tight mb-3 bg-gradient-to-r from-purple-700 to-indigo-500 dark:from-purple-400 dark:to-indigo-300 bg-clip-text text-transparent">
                    {formatPercentage(dashboardData.complianceScore)}
                  </div>
                  <div className="relative h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden mb-3">
                    <motion.div 
                      className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${dashboardData.complianceScore}%` }}
                      transition={{ duration: 1, delay: 0.5 }}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    Risk Score: <span className="font-semibold text-foreground">{dashboardData.riskScore}/100</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
                      <CheckCircle className="h-3 w-3" />
                      Low risk
                    </span>
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </Grid>
        </section>

        <section className="relative z-0">
          {/* Cost Savings Widget */}
          <CostSavingsDashboardWidget />
        </section>

        {/* Cross-Module Integration Widgets */}
        <section className="relative z-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <IntelligenceWidget />
            <ApprovalsWidget />
          </div>
        </section>
        
        <section className="relative z-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RenewalsWidget />
            <GovernanceWidget />
          </div>
        </section>

        <section className="relative z-0">
          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - 2/3 width */}
            <div className="lg:col-span-2 space-y-6">
              {/* Renewals List */}
              <UpcomingRenewals renewals={renewals} />
              
              {/* Contract Type Distribution */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ContractTypeChart data={dashboardData.breakdown.byType} />
                <StatusOverview 
                  data={dashboardData.breakdown.byStatus}
                  totalContracts={dashboardData.overview.totalContracts}
                />
              </div>
            </div>

            {/* Right Column - 1/3 width */}
            <div className="space-y-6">
              {/* Quick Actions */}
              <QuickActions />
              
              {/* Key Insights Card */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.6 }}
              >
                <Card className="relative overflow-hidden bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-white/50 dark:border-slate-700/50 shadow-xl">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      Key Insights
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">Smart alerts and recommendations</p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <motion.div 
                      className="p-4 rounded-xl border border-rose-200 dark:border-rose-800/50 bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/30 hover:shadow-lg hover:shadow-rose-500/10 transition-all duration-300 cursor-pointer"
                      whileHover={{ scale: 1.02, x: 4 }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-rose-500 to-pink-500 text-white shadow-md shadow-rose-500/30 flex-shrink-0">
                          <AlertCircle className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-rose-900 dark:text-rose-100">Urgent Action Required</p>
                          <p className="text-xs text-rose-700 dark:text-rose-400 mt-0.5">
                            {dashboardData.renewals.urgentCount} contracts expiring within 30 days
                          </p>
                        </div>
                      </div>
                    </motion.div>
                    
                    <motion.div 
                      className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 hover:shadow-lg hover:shadow-emerald-500/10 transition-all duration-300 cursor-pointer"
                      whileHover={{ scale: 1.02, x: 4 }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500 to-green-500 text-white shadow-md shadow-emerald-500/30 flex-shrink-0">
                          <TrendingUp className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">Growing Portfolio</p>
                          <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                            {dashboardData.overview.recentlyAdded} new contracts added this month
                          </p>
                        </div>
                      </div>
                    </motion.div>
                    
                    <motion.div 
                      className="p-4 rounded-xl border border-blue-200 dark:border-blue-800/50 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300 cursor-pointer"
                      whileHover={{ scale: 1.02, x: 4 }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-md shadow-blue-500/30 flex-shrink-0">
                          <CheckCircle className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">High Compliance</p>
                          <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">
                            Maintaining {dashboardData.complianceScore}% compliance rate
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </section>
      </div>

      {/* Floating AI Assistant */}
      <FloatingAIBubble />
    </DashboardLayout>
  );
}
