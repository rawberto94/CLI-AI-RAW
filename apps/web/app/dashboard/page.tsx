"use client";

import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/AppLayout";
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
  BarChart3,
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
import { FloatingAIBubble } from "@/components/ai/FloatingAIBubble";
import ContractLifecyclePipeline from "@/components/dashboard/ContractLifecyclePipeline";
import CustomDashboardBuilder, { type DashboardWidget} from "@/components/dashboard/CustomDashboardBuilder";

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

const fetchDashboardData = async (): Promise<{ stats: DashboardData | null }> => {
  const dataMode = typeof window !== 'undefined' ? localStorage.getItem('dataMode') || 'real' : 'real';
  const headers = { 'x-data-mode': dataMode };
  
  try {
    const statsRes = await fetch('/api/dashboard/stats', { headers });
    const statsData = statsRes.ok ? await statsRes.json() : { success: false };
    
    return {
      stats: statsData.success ? statsData.data : null,
    };
  } catch {
    return { stats: null };
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
    gradient: "from-violet-500 to-purple-500",
  },
  {
    icon: Zap,
    label: "Generate Contract",
    description: "Create with AI",
    href: "/generate",
    gradient: "from-violet-500 to-purple-600",
  },
  {
    icon: Target,
    label: "Obligations",
    description: "Track compliance",
    href: "/obligations",
    gradient: "from-rose-500 to-pink-600",
  },
  {
    icon: RefreshCw,
    label: "Renewals",
    description: "Track renewals",
    href: "/renewals",
    gradient: "from-violet-500 to-violet-500",
  },
  {
    icon: MessageSquare,
    label: "AI Assistant",
    description: "Ask about contracts",
    href: "/ai/chat",
    gradient: "from-violet-500 to-pink-500",
  },
  {
    icon: Search,
    label: "Search",
    description: "Find contracts",
    href: "/search",
    gradient: "from-violet-500 to-violet-500",
  },
];

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [dashboardWidgets, setDashboardWidgets] = useState<DashboardWidget[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboardData,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (previously cacheTime)
    refetchOnWindowFocus: false,
  });

  const dashboardData = data?.stats || null;

  // Real-time updates
  const eventHandlers = useMemo(() => ({
    'contract:created': () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    'contract:completed': () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    'job:progress': () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    'notification': () => {},
  }), [queryClient]);

  useRealTimeEvents(eventHandlers);

  if (isLoading || !dashboardData) {
    return (
      <DashboardLayout
        title="Dashboard"
        description="Your contract management overview"
      >
        <DashboardSkeleton />
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
            <Card className="group relative overflow-hidden bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-700/60 shadow-lg hover:shadow-xl transition-all duration-300 h-full">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-6 h-full flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/30 group-hover:scale-110 transition-transform duration-300">
                    <FileText className="h-5 w-5" />
                  </div>
                  <Link href="/contracts" className="text-xs text-muted-foreground hover:text-violet-600 flex items-center gap-1">
                    View All <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Total Contracts</p>
                  <p className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-200 bg-clip-text text-transparent">
                    {dashboardData.overview.totalContracts.toLocaleString()}
                  </p>
                  <div className="flex items-center gap-2 pt-2">
                    <Badge variant="outline" className="px-3 py-1 bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/50 dark:text-violet-400 dark:border-violet-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-500 mr-1.5 animate-pulse" />
                      {dashboardData.overview.activeContracts} active
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Renewals Due - NEW CARD */}
          <motion.div variants={itemVariants} className="h-full">
            <Link href="/renewals" className="block h-full">
              <Card className="group relative overflow-hidden bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-700/60 shadow-lg hover:shadow-xl transition-all duration-300 h-full cursor-pointer">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                {dashboardData.renewals.urgentCount > 0 && (
                  <div className="absolute top-3 right-3">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                  </div>
                )}
                <CardContent className="p-6 h-full flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/30 group-hover:scale-110 transition-transform duration-300">
                      <RefreshCw className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Renewals Due</p>
                    <p className="text-3xl font-bold tracking-tight bg-gradient-to-r from-orange-600 to-red-500 dark:from-orange-400 dark:to-red-300 bg-clip-text text-transparent">
                      {dashboardData.renewals.expiringIn30Days}
                    </p>
                    <div className="flex items-center gap-2 pt-2">
                      {dashboardData.renewals.urgentCount > 0 ? (
                        <Badge variant="outline" className="px-3 py-1 bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800">
                          <Clock className="h-3 w-3 mr-1" />
                          {dashboardData.renewals.urgentCount} urgent
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="px-3 py-1 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800">
                          Next 30 days
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </motion.div>

          {/* Portfolio Value */}
          <motion.div variants={itemVariants} className="h-full">
            <Card className="group relative overflow-hidden bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-700/60 shadow-lg hover:shadow-xl transition-all duration-300 h-full">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-6 h-full flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-lg shadow-violet-500/30 group-hover:scale-110 transition-transform duration-300">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <Badge variant="outline" className="px-3 py-1 bg-violet-50 text-violet-700 border-violet-200 text-xs">
                    <TrendingUp className="h-3.5 w-3.5 mr-1" /> +12%
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Portfolio Value</p>
                  <p className="text-3xl font-bold tracking-tight bg-gradient-to-r from-violet-700 to-violet-500 dark:from-violet-400 dark:to-violet-300 bg-clip-text text-transparent">
                    {formatCurrency(dashboardData.overview.portfolioValue)}
                  </p>
                  <p className="text-xs text-muted-foreground pt-2">
                    From {dashboardData.overview.totalContracts} contracts
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Recently Added */}
          <motion.div variants={itemVariants} className="h-full">
            <Card className="group relative overflow-hidden bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-700/60 shadow-lg hover:shadow-xl transition-all duration-300 h-full">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-6 h-full flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/30 group-hover:scale-110 transition-transform duration-300">
                    <Plus className="h-5 w-5" />
                  </div>
                  <Link href="/upload" className="text-xs text-muted-foreground hover:text-violet-600 flex items-center gap-1">
                    Upload <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Recently Added</p>
                  <p className="text-3xl font-bold tracking-tight bg-gradient-to-r from-violet-700 to-purple-500 dark:from-violet-400 dark:to-purple-300 bg-clip-text text-transparent">
                    +{dashboardData.overview.recentlyAdded}
                  </p>
                  <p className="text-xs text-muted-foreground pt-2">
                    Contracts this month
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Compliance Score */}
          <motion.div variants={itemVariants} className="h-full">
            <Card className="group relative overflow-hidden bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-700/60 shadow-lg hover:shadow-xl transition-all duration-300 h-full">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-6 h-full flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30 group-hover:scale-110 transition-transform duration-300">
                    <CheckCircle className="h-5 w-5" />
                  </div>
                  <Badge variant="outline" className="px-3 py-1 bg-violet-50 text-violet-700 border-violet-200 text-xs">
                    Low Risk
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Compliance Score</p>
                  <p className="text-3xl font-bold tracking-tight bg-gradient-to-r from-amber-600 to-orange-500 dark:from-amber-400 dark:to-orange-300 bg-clip-text text-transparent">
                    {formatPercentage(dashboardData.complianceScore)}
                  </p>
                  <div className="pt-2">
                    <Progress 
                      value={dashboardData.complianceScore} 
                      className="h-1.5 bg-slate-200 dark:bg-slate-700"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Contract Lifecycle Pipeline */}
        <motion.div variants={itemVariants}>
          <ContractLifecyclePipeline />
        </motion.div>

        {/* Quick Actions */}
        <motion.div variants={itemVariants}>
          <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200/60 dark:border-slate-700/60 shadow-lg">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/30">
                    <Zap className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Quick Actions</CardTitle>
                    <p className="text-sm text-muted-foreground">Common tasks at your fingertips</p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5">
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
                        <div
                          className="group relative flex flex-col items-center p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-md hover:border-slate-300 transition-all duration-200"
                        >
                          <div className={`p-2.5 rounded-lg bg-gradient-to-br ${action.gradient} text-white mb-2`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <h3 className="font-medium text-sm text-slate-900 dark:text-white text-center">
                            {action.label}
                          </h3>
                          <p className="text-[11px] text-muted-foreground text-center mt-0.5">
                            {action.description}
                          </p>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Two Column Layout - Contracts & AI Assistant */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Contracts */}
          <motion.div variants={itemVariants} className="flex">
            <Card className="flex-1 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200/60 dark:border-slate-700/60 shadow-lg">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/30">
                      <FolderOpen className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Recent Contracts</CardTitle>
                      <p className="text-sm text-muted-foreground">Your latest additions</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" asChild className="text-violet-600 hover:text-violet-700 hover:bg-violet-50">
                    <Link href="/contracts">View All</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-5">
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((_, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 * idx }}
                      className="group flex items-center gap-4 p-4 rounded-xl border border-slate-200/60 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 hover:shadow-md transition-all duration-200 cursor-pointer"
                    >
                      <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate text-slate-900 dark:text-white">
                          Sample Contract {idx + 1}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          Added recently
                        </p>
                      </div>
                      <Badge variant="outline" className="px-3 py-1 text-xs bg-violet-50 text-violet-700 border-violet-200">
                        Active
                      </Badge>
                    </motion.div>
                  ))}
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
            <Card className="flex-1 bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-700/60 shadow-lg">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white">
                      <Bot className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">AI Assistant</CardTitle>
                      <p className="text-sm text-muted-foreground">Ask about your contracts</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/ai/chat">Open</Link>
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
                        href="/ai/chat"
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
          <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200/60 dark:border-slate-700/60 shadow-lg">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Contract Overview</CardTitle>
                    <p className="text-sm text-muted-foreground">Status breakdown</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" asChild className="text-amber-600 hover:text-amber-700 hover:bg-amber-50">
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

      {/* Floating AI Assistant */}
      <FloatingAIBubble />

      {/* Dashboard Customizer Dialog */}
      <CustomDashboardBuilder
        open={customizerOpen}
        onOpenChange={setCustomizerOpen}
        onSave={setDashboardWidgets}
        currentWidgets={dashboardWidgets.length > 0 ? dashboardWidgets : undefined}
      />
    </DashboardLayout>
  );
}
