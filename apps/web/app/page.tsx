"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LazyCostSavingsDashboardWidget as CostSavingsDashboardWidget } from "@/components/lazy";
import {
  Grid,
  StatusIndicator,
  AIBadge,
  formatCurrency,
  formatPercentage,
} from "@/components/ui/design-system";
import {
  FileText,
  TrendingUp,
  Shield,
  Activity,
  Brain,
  Zap,
  BarChart3,
  Clock,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Network,
} from "lucide-react";
import Link from "next/link";
import { DashboardSkeleton } from "@/components/ui/skeletons";
import { useRealTimeEvents } from "@/contexts/RealTimeContext";

// Mock data - in real app this would come from API
// Moved outside component to prevent recreation on every render
const getDashboardData = () => ({
  overview: {
    totalContracts: 1247,
    totalValue: 45600000,
    activeContracts: 892,
    processingJobs: 12,
    riskScore: 23,
    complianceScore: 94,
  },
  recentActivity: [
    {
      id: "1",
      type: "contract_uploaded",
      title: "New service agreement uploaded",
      description: "TechCorp-ServiceAgreement-2024.pdf",
      timestamp: "2 minutes ago",
      status: "processing",
    },
    {
      id: "2",
      type: "analysis_complete",
      title: "Contract analysis completed",
      description: "High-value procurement contract analyzed",
      timestamp: "15 minutes ago",
      status: "success",
    },
    {
      id: "3",
      type: "risk_alert",
      title: "Risk threshold exceeded",
      description: "Contract ABC-123 flagged for review",
      timestamp: "1 hour ago",
      status: "warning",
    },
  ],
  quickStats: [
    {
      title: "Processing Queue",
      value: "12",
      change: "+3",
      trend: "up",
      icon: Activity,
      color: "blue",
    },
    {
      title: "Avg Processing Time",
      value: "2.3m",
      change: "-15%",
      trend: "down",
      icon: Clock,
      color: "green",
    },
    {
      title: "Success Rate",
      value: "98.7%",
      change: "+0.3%",
      trend: "up",
      icon: CheckCircle,
      color: "green",
    },
    {
      title: "Active Alerts",
      value: "3",
      change: "-2",
      trend: "down",
      icon: AlertTriangle,
      color: "yellow",
    },
  ],
});

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    // Simulate loading data
    const timer = setTimeout(() => {
      setLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

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

  if (loading) {
    return (
      <DashboardLayout
        title="Dashboard"
        description="Overview of your contract intelligence platform"
      >
        <DashboardSkeleton />
      </DashboardLayout>
    );
  }

  return (
    <>
      {/* Onboarding Manager - handles first-time user experience */}
      {/* <OnboardingManager /> */}

      <DashboardLayout
        title="Dashboard"
        description="Contract lifecycle management overview"
        actions={
          <Button size="sm" asChild>
            <Link href="/dashboard">
              <BarChart3 className="h-4 w-4 mr-2" />
              View Analytics
            </Link>
          </Button>
        }
      >
        {/* Cost Savings Widget - Full Width */}
        <div className="mb-6">
          <CostSavingsDashboardWidget />
        </div>

        {/* Key Metrics */}
        <Grid cols={4} gap="md">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Contracts
              </CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboardData.overview.totalContracts.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                {dashboardData.overview.activeContracts} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Portfolio Value
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(dashboardData.overview.totalValue)}
              </div>
              <p className="text-xs text-muted-foreground">
                +12% from last month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Risk Score</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {dashboardData.overview.riskScore}
              </div>
              <p className="text-xs text-muted-foreground">
                Low risk portfolio
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Compliance Score
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatPercentage(dashboardData.overview.complianceScore)}
              </div>
              <Progress
                value={dashboardData.overview.complianceScore}
                className="mt-2"
              />
            </CardContent>
          </Card>
        </Grid>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle>System Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <Grid cols={4} gap="sm">
                  {dashboardData.quickStats.map((stat, index) => (
                    <div
                      key={index}
                      className="text-center p-4 bg-muted/50 rounded-lg"
                    >
                      <stat.icon
                        className={`h-6 w-6 mx-auto mb-2 text-${stat.color}-600`}
                      />
                      <div className="text-2xl font-bold">{stat.value}</div>
                      <div className="text-sm text-muted-foreground">
                        {stat.title}
                      </div>
                      <div
                        className={`text-xs ${
                          stat.trend === "up"
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {stat.change}
                      </div>
                    </div>
                  ))}
                </Grid>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <Button variant="outline" className="h-24 flex-col" asChild>
                    <Link href="/upload">
                      <Upload className="h-8 w-8 mb-2 text-blue-600" />
                      <span className="font-semibold">Upload Contract</span>
                    </Link>
                  </Button>
                  <Button variant="outline" className="h-24 flex-col" asChild>
                    <Link href="/search">
                      <Search className="h-8 w-8 mb-2 text-purple-600" />
                      <span className="font-semibold">Search Contracts</span>
                    </Link>
                  </Button>
                  <Button variant="outline" className="h-24 flex-col" asChild>
                    <Link href="/dashboard">
                      <BarChart3 className="h-8 w-8 mb-2 text-green-600" />
                      <span className="font-semibold">View Analytics</span>
                    </Link>
                  </Button>
                  <Button variant="outline" className="h-24 flex-col" asChild>
                    <Link href="/contracts">
                      <FileText className="h-8 w-8 mb-2 text-orange-600" />
                      <span className="font-semibold">All Contracts</span>
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {dashboardData.recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3">
                    <StatusIndicator status={activity.status as any}>
                      <div className="w-2 h-2 rounded-full bg-current" />
                    </StatusIndicator>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{activity.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {activity.description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {activity.timestamp}
                      </p>
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="w-full">
                  View All Activity
                </Button>
              </CardContent>
            </Card>

            {/* System Health */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  System Health
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>API Response Time</span>
                    <span className="text-green-600">142ms</span>
                  </div>
                  <Progress value={85} className="h-2" />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Worker Utilization</span>
                    <span className="text-blue-600">67%</span>
                  </div>
                  <Progress value={67} className="h-2" />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Storage Usage</span>
                    <span className="text-yellow-600">43%</span>
                  </div>
                  <Progress value={43} className="h-2" />
                </div>

                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link href="/processing-status">View Detailed Status</Link>
                </Button>
              </CardContent>
            </Card>


          </div>
        </div>
      </DashboardLayout>
    </>
  );
}
