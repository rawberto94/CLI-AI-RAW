"use client";

import { useState, useEffect, useMemo } from "react";
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
import { MessageCircle } from "lucide-react";

// Lazy load heavy components
const CostSavingsDashboardWidget = dynamic(
  () => import("@/components/lazy").then((mod) => ({ default: mod.LazyCostSavingsDashboardWidget })),
  { ssr: false, loading: () => <div className="h-32 bg-muted animate-pulse rounded-lg" /> }
);

// Import new dashboard components
import { UpcomingRenewals } from "@/components/dashboard/UpcomingRenewals";
import { ContractTypeChart } from "@/components/dashboard/ContractTypeChart";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { StatusOverview } from "@/components/dashboard/StatusOverview";
import { DashboardChatbot } from "@/components/dashboard/DashboardChatbot";
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

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [renewals, setRenewals] = useState<RenewalItem[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    loadDashboardData();
  }, [refreshKey]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [statsRes, renewalsRes] = await Promise.all([
        fetch('/api/dashboard/stats'),
        fetch('/api/dashboard/renewals?days=90')
      ]);
      
      const statsData = await statsRes.json();
      const renewalsData = await renewalsRes.json();
      
      if (statsData.success) {
        setDashboardData(statsData.data);
      }
      
      if (renewalsData.success) {
        setRenewals(renewalsData.data);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Real-time updates for dashboard
  const eventHandlers = useMemo(() => ({
    'contract:created': (data: any) => {
      console.log('[Dashboard] New contract created:', data);
      setRefreshKey(prev => prev + 1);
    },
    'contract:completed': (data: any) => {
      console.log('[Dashboard] Contract completed:', data);
      setRefreshKey(prev => prev + 1);
    },
    'job:progress': (data: any) => {
      console.log('[Dashboard] Job progress update:', data);
      setRefreshKey(prev => prev + 1);
    },
    'notification': (data: any) => {
      console.log('[Dashboard] Notification received:', data);
    },
  }), []);

  useRealTimeEvents(eventHandlers);

  if (loading || !dashboardData) {
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
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setRefreshKey(k => k + 1)}>
            Refresh
          </Button>
          <Button size="sm" asChild>
            <Link href="/analytics">
              View Full Analytics
            </Link>
          </Button>
        </div>
      }
    >
      <div className="space-y-10 isolate">
        <section className="relative z-0">
          {/* Hero KPIs - Full Width */}
          <Grid cols={4} gap="md">
            <Card className="card-elevated group">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Contracts
                </CardTitle>
                <div className="icon-md bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
                  <FileText className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tracking-tight mb-2">
                  {dashboardData.overview.totalContracts.toLocaleString()}
                </div>
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <span className="status-success">{dashboardData.overview.activeContracts} active</span>
                  <span>•</span>
                  <span className="text-green-600 dark:text-green-400">+{dashboardData.overview.recentlyAdded} this month</span>
                </p>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="mt-4 w-full justify-center text-xs group-hover:bg-blue-50 dark:group-hover:bg-blue-950/50" 
                  asChild
                >
                  <Link href="/contracts">View All Contracts →</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="card-elevated group">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Portfolio Value
                </CardTitle>
                <div className="icon-md bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400">
                  <TrendingUp className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tracking-tight mb-2">
                  {formatCurrency(dashboardData.overview.portfolioValue)}
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Total contract value
                </p>
                <div className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span className="font-medium">+12%</span>
                  <span className="text-muted-foreground">from last quarter</span>
                </div>
              </CardContent>
            </Card>

            <Card className="card-elevated group">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Upcoming Renewals
                </CardTitle>
                <div className="icon-md bg-orange-50 dark:bg-orange-950 text-orange-600 dark:text-orange-400">
                  <Calendar className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tracking-tight mb-2">
                  {dashboardData.renewals.expiringIn90Days}
                </div>
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <span className="status-warning">{dashboardData.renewals.urgentCount} urgent</span>
                  <span>•</span>
                  <span>next 90 days</span>
                </p>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="mt-4 w-full justify-center text-xs group-hover:bg-orange-50 dark:group-hover:bg-orange-950/50" 
                  asChild
                >
                  <Link href="/contracts?filter=expiring">Review Renewals →</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="card-elevated group">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Compliance Score
                </CardTitle>
                <div className="icon-md bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400">
                  <Shield className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tracking-tight mb-3">
                  {formatPercentage(dashboardData.complianceScore)}
                </div>
                <Progress
                  value={dashboardData.complianceScore}
                  className="h-2 mb-3"
                />
                <p className="text-sm text-muted-foreground">
                  Risk Score: <span className="font-semibold text-foreground">{dashboardData.riskScore}/100</span>
                  <span className="ml-2 text-xs status-success">Low risk</span>
                </p>
              </CardContent>
            </Card>
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
              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <div className="icon-sm bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                      <AlertCircle className="h-4 w-4" />
                    </div>
                    Key Insights
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">Smart alerts and recommendations</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="p-3.5 rounded-lg border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/30 card-hover">
                    <div className="flex items-start gap-3">
                      <div className="icon-sm bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 flex-shrink-0">
                        <AlertCircle className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-red-900 dark:text-red-100">Urgent Action Required</p>
                        <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">
                          {dashboardData.renewals.urgentCount} contracts expiring within 30 days
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-3.5 rounded-lg border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/30 card-hover">
                    <div className="flex items-start gap-3">
                      <div className="icon-sm bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 flex-shrink-0">
                        <TrendingUp className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-green-900 dark:text-green-100">Growing Portfolio</p>
                        <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">
                          {dashboardData.overview.recentlyAdded} new contracts added this month
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-3.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30 card-hover">
                    <div className="flex items-start gap-3">
                      <div className="icon-sm bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 flex-shrink-0">
                        <CheckCircle className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">High Compliance</p>
                        <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">
                          Maintaining {dashboardData.complianceScore}% compliance rate
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="relative z-0">
          {/* AI Chatbot - Full Width Section */}
          <div>
            <Card>
              <CardHeader className="pb-4">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MessageCircle className="h-5 w-5 text-blue-600" />
                    AI Assistant
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    I can help you with contract queries, renewals, insights, and more
                  </p>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <DashboardChatbot />
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
