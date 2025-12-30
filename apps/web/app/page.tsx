"use client";

import { useMemo } from "react";
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
  Sparkles,
  RefreshCw,
  Clock,
  Plus,
  Zap,
  Eye,
  FileUp,
  Bot,
} from "lucide-react";
import Link from "next/link";
import { DashboardSkeleton } from "@/components/ui/skeletons";
import { useRealTimeEvents } from "@/contexts/RealTimeContext";
import { FloatingAIBubble } from "@/components/ai/FloatingAIBubble";

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
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
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

// Quick action buttons - only ACTIVE features
const quickActions = [
  {
    icon: Upload,
    label: "Upload Contract",
    description: "Add new contracts to your portfolio",
    href: "/upload",
    gradient: "from-blue-500 to-cyan-500",
    shadow: "shadow-blue-500/25",
    hoverBg: "group-hover:bg-blue-50 dark:group-hover:bg-blue-950/30"
  },
  {
    icon: MessageSquare,
    label: "AI Assistant",
    description: "Ask anything about your contracts",
    href: "/ai/chat",
    gradient: "from-purple-500 to-pink-500",
    shadow: "shadow-purple-500/25",
    hoverBg: "group-hover:bg-purple-50 dark:group-hover:bg-purple-950/30",
    isNew: true
  },
  {
    icon: Bot,
    label: "AI Insights",
    description: "Autonomous agent recommendations",
    href: "/ai-insights",
    gradient: "from-indigo-500 to-purple-500",
    shadow: "shadow-indigo-500/25",
    hoverBg: "group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/30",
    isNew: true
  },
  {
    icon: Search,
    label: "Smart Search",
    description: "Find contracts instantly",
    href: "/search",
    gradient: "from-emerald-500 to-teal-500",
    shadow: "shadow-emerald-500/25",
    hoverBg: "group-hover:bg-emerald-50 dark:group-hover:bg-emerald-950/30"
  },
  {
    icon: BarChart3,
    label: "Analytics",
    description: "View insights and reports",
    href: "/analytics",
    gradient: "from-amber-500 to-orange-500",
    shadow: "shadow-amber-500/25",
    hoverBg: "group-hover:bg-amber-50 dark:group-hover:bg-amber-950/30"
  }
];

export default function DashboardPage() {
  const queryClient = useQueryClient();

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
            onClick={() => queryClient.invalidateQueries({ queryKey: ['dashboard'] })}
            className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button 
            size="sm" 
            asChild
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/25"
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
        {/* Welcome Banner */}
        <motion.div variants={itemVariants}>
          <Card className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 border-0 shadow-xl shadow-purple-500/20">
            {/* Animated background elements */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-white/10 rounded-full blur-2xl" />
              <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-white/10 rounded-full blur-xl" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
            </div>
            
            <CardContent className="relative p-8">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl">
                      <Sparkles className="h-6 w-6 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">
                      Welcome to ConTigo
                    </h2>
                  </div>
                  <p className="text-white/80 text-lg max-w-xl">
                    AI-powered contract intelligence platform. Upload contracts, get instant insights, and make smarter decisions.
                  </p>
                </div>
                
                <div className="flex flex-wrap gap-3">
                  <Button 
                    asChild
                    className="bg-white text-indigo-700 hover:bg-white/90 shadow-lg font-semibold"
                  >
                    <Link href="/upload">
                      <FileUp className="h-4 w-4 mr-2" />
                      Upload Contract
                    </Link>
                  </Button>
                  <Button 
                    variant="outline"
                    asChild
                    className="bg-white/10 border-white/30 text-white hover:bg-white/20 backdrop-blur-sm"
                  >
                    <Link href="/ai/chat">
                      <Bot className="h-4 w-4 mr-2" />
                      Ask AI
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Total Contracts */}
          <motion.div variants={itemVariants}>
            <Card className="group relative overflow-hidden bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-700/60 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform duration-300">
                    <FileText className="h-5 w-5" />
                  </div>
                  <Link href="/contracts" className="text-xs text-muted-foreground hover:text-blue-600 flex items-center gap-1">
                    View All <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Total Contracts</p>
                  <p className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-200 bg-clip-text text-transparent">
                    {dashboardData.overview.totalContracts.toLocaleString()}
                  </p>
                  <div className="flex items-center gap-2 pt-2">
                    <Badge variant="outline" className="px-3 py-1 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
                      {dashboardData.overview.activeContracts} active
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Portfolio Value */}
          <motion.div variants={itemVariants}>
            <Card className="group relative overflow-hidden bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-700/60 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30 group-hover:scale-110 transition-transform duration-300">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <Badge variant="outline" className="px-3 py-1 bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                    <TrendingUp className="h-3.5 w-3.5 mr-1" /> +12%
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Portfolio Value</p>
                  <p className="text-3xl font-bold tracking-tight bg-gradient-to-r from-emerald-700 to-emerald-500 dark:from-emerald-400 dark:to-emerald-300 bg-clip-text text-transparent">
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
          <motion.div variants={itemVariants}>
            <Card className="group relative overflow-hidden bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-700/60 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg shadow-purple-500/30 group-hover:scale-110 transition-transform duration-300">
                    <Plus className="h-5 w-5" />
                  </div>
                  <Link href="/upload" className="text-xs text-muted-foreground hover:text-purple-600 flex items-center gap-1">
                    Upload <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Recently Added</p>
                  <p className="text-3xl font-bold tracking-tight bg-gradient-to-r from-purple-700 to-indigo-500 dark:from-purple-400 dark:to-indigo-300 bg-clip-text text-transparent">
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
          <motion.div variants={itemVariants}>
            <Card className="group relative overflow-hidden bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-700/60 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30 group-hover:scale-110 transition-transform duration-300">
                    <CheckCircle className="h-5 w-5" />
                  </div>
                  <Badge variant="outline" className="px-3 py-1 bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
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

        {/* Quick Actions */}
        <motion.div variants={itemVariants}>
          <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200/60 dark:border-slate-700/60 shadow-lg">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {quickActions.map((action, index) => {
                  const Icon = action.icon;
                  return (
                    <motion.div
                      key={action.label}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 * index }}
                    >
                      <Link href={action.href}>
                        <motion.div
                          whileHover={{ scale: 1.02, y: -4 }}
                          whileTap={{ scale: 0.98 }}
                          className={`group relative flex flex-col items-center p-6 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-lg ${action.shadow} transition-all duration-300 ${action.hoverBg}`}
                        >
                          {action.isNew && (
                            <Badge className="absolute -top-2 -right-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[10px] border-0 shadow-md">
                              NEW
                            </Badge>
                          )}
                          <div className={`p-3.5 rounded-xl bg-gradient-to-br ${action.gradient} text-white shadow-lg ${action.shadow} group-hover:scale-110 transition-transform duration-300 mb-4`}>
                            <Icon className="h-6 w-6" />
                          </div>
                          <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
                            {action.label}
                          </h3>
                          <p className="text-xs text-muted-foreground text-center">
                            {action.description}
                          </p>
                        </motion.div>
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
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30">
                      <FolderOpen className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Recent Contracts</CardTitle>
                      <p className="text-sm text-muted-foreground">Your latest additions</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" asChild className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">
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
                      <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
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
                      <Badge variant="outline" className="px-3 py-1 text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                        Active
                      </Badge>
                    </motion.div>
                  ))}
                </div>
                <Button 
                  variant="outline" 
                  className="w-full mt-4 border-dashed border-slate-300 dark:border-slate-600 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/30"
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
            <Card className="flex-1 bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50 dark:from-purple-950/30 dark:via-indigo-950/30 dark:to-blue-950/30 border-purple-200/60 dark:border-purple-700/40 shadow-lg">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/30">
                      <Bot className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        AI Assistant
                        <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[10px] border-0">
                          NEW
                        </Badge>
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">Ask anything about your contracts</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" asChild className="text-purple-600 hover:text-purple-700 hover:bg-purple-50">
                    <Link href="/ai/chat">Open Chat</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-5">
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-white/80 dark:bg-slate-900/50 border border-purple-200/50 dark:border-purple-800/30">
                    <p className="text-sm text-muted-foreground mb-3">Try asking:</p>
                    <div className="space-y-2">
                      {[
                        "What contracts are expiring soon?",
                        "Summarize the key terms of my latest contract",
                        "Find all contracts with auto-renewal clauses",
                        "What is my total contract value this year?"
                      ].map((suggestion, idx) => (
                        <motion.button
                          key={idx}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.1 * idx }}
                          className="w-full text-left p-3 rounded-lg bg-gradient-to-r from-purple-100/50 to-transparent dark:from-purple-900/20 dark:to-transparent border border-purple-200/50 dark:border-purple-800/30 text-sm text-slate-700 dark:text-slate-300 hover:from-purple-200/50 hover:border-purple-300 dark:hover:from-purple-900/40 dark:hover:border-purple-700 transition-all duration-200 flex items-center gap-2"
                        >
                          <MessageSquare className="h-3.5 w-3.5 text-purple-500 flex-shrink-0" />
                          <span className="truncate">{suggestion}</span>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                  
                  <Button 
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg shadow-purple-500/25"
                    asChild
                  >
                    <Link href="/ai/chat">
                      <Sparkles className="h-4 w-4 mr-2" />
                      Start AI Conversation
                    </Link>
                  </Button>
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
                    { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', bar: 'bg-blue-500' },
                    { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300', bar: 'bg-emerald-500' },
                    { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', bar: 'bg-amber-500' },
                    { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', bar: 'bg-purple-500' },
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
    </DashboardLayout>
  );
}
