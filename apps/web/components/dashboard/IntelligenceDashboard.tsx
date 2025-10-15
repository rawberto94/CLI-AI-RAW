"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle,
  Zap,
  Target,
  DollarSign,
  Shield,
  Users,
  FileText,
  BarChart3,
  PieChart,
  Activity,
  Brain,
  Lightbulb,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Eye,
  Download,
} from "lucide-react";
import Link from "next/link";

interface DashboardData {
  overview: {
    totalContracts: number;
    totalValue: number;
    activeContracts: number;
    expiringContracts: number;
  };
  intelligence: {
    patternsDetected: number;
    insightsGenerated: number;
    highPriorityInsights: number;
    lastAnalysisTime: string;
  };
  trends: {
    contractVelocity: number;
    valueVelocity: number;
    processingEfficiency: number;
    errorRate: number;
  };
  recommendations: Array<{
    id: string;
    type: string;
    priority: string;
    title: string;
    description: string;
    action: string;
    potentialValue?: number;
  }>;
  recentActivity: Array<{
    type: string;
    title: string;
    timestamp: string;
    impact: string;
  }>;
}

export default function IntelligenceDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchDashboardData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async (showRefreshing = false) => {
    try {
      if (showRefreshing) setRefreshing(true);
      setError(null);

      const response = await fetch(
        "/api/intelligence/comprehensive?tenantId=demo"
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch dashboard data: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        // Transform the comprehensive data into dashboard format
        const dashboardData: DashboardData = {
          overview: {
            totalContracts: result.data.portfolio.overview.totalContracts,
            totalValue: result.data.portfolio.overview.totalValue,
            activeContracts: result.data.portfolio.overview.activeContracts,
            expiringContracts: result.data.portfolio.overview.expiringContracts,
          },
          intelligence: {
            patternsDetected: result.data.patterns.total,
            insightsGenerated: result.data.insights.total,
            highPriorityInsights: result.data.insights.highPriority.length,
            lastAnalysisTime: result.data.metadata.generatedAt,
          },
          trends: {
            contractVelocity: result.data.realTime.trends.contractVelocity,
            valueVelocity: result.data.realTime.trends.valueVelocity,
            processingEfficiency:
              result.data.portfolio.performance.processingEfficiency,
            errorRate: result.data.realTime.trends.errorRate,
          },
          recommendations: result.data.recommendations || [],
          recentActivity: [
            {
              type: "pattern_detected",
              title: "New supplier risk pattern detected",
              timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
              impact: "medium",
            },
            {
              type: "insight_generated",
              title: "Cost optimization opportunity identified",
              timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
              impact: "high",
            },
            {
              type: "contract_processed",
              title: "New contract analysis completed",
              timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
              impact: "low",
            },
          ],
        };

        setData(dashboardData);
      } else {
        throw new Error(result.error || "Failed to load dashboard data");
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-US").format(num);
  };

  const getTrendIcon = (value: number) => {
    if (value > 0) return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (value < 0) return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-gray-500" />;
  };

  const getTrendColor = (value: number) => {
    if (value > 0) return "text-green-600";
    if (value < 0) return "text-red-600";
    return "text-gray-600";
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "pattern_detected":
        return <Target className="w-4 h-4 text-blue-500" />;
      case "insight_generated":
        return <Lightbulb className="w-4 h-4 text-yellow-500" />;
      case "contract_processed":
        return <FileText className="w-4 h-4 text-green-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case "high":
        return "bg-red-100 text-red-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      case "low":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Intelligence Dashboard
            </h1>
            <p className="text-gray-600 mt-1">
              AI-powered contract insights and analytics
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-8 bg-gray-200 rounded mb-2"></div>
                <div className="h-3 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Dashboard Error
            </h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={() => fetchDashboardData(true)}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl shadow-lg">
            <Brain className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Intelligence Dashboard
            </h1>
            <p className="text-gray-600 mt-1">
              AI-powered contract insights and analytics
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => fetchDashboardData(true)}
            disabled={refreshing}
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Link href="/contracts">
            <Button>
              <Eye className="w-4 h-4 mr-2" />
              View Contracts
            </Button>
          </Link>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="shadow-lg border-0 bg-gradient-to-br from-blue-50 to-blue-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-700">
                  Total Contracts
                </p>
                <p className="text-3xl font-bold text-blue-900">
                  {formatNumber(data.overview.totalContracts)}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  {getTrendIcon(data.trends.contractVelocity)}
                  <span
                    className={`text-xs ${getTrendColor(
                      data.trends.contractVelocity
                    )}`}
                  >
                    {data.trends.contractVelocity > 0 ? "+" : ""}
                    {data.trends.contractVelocity} this month
                  </span>
                </div>
              </div>
              <FileText className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-0 bg-gradient-to-br from-green-50 to-green-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-700">
                  Portfolio Value
                </p>
                <p className="text-3xl font-bold text-green-900">
                  {formatCurrency(data.overview.totalValue)}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  {getTrendIcon(data.trends.valueVelocity)}
                  <span
                    className={`text-xs ${getTrendColor(
                      data.trends.valueVelocity
                    )}`}
                  >
                    {formatCurrency(data.trends.valueVelocity)} this month
                  </span>
                </div>
              </div>
              <DollarSign className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-0 bg-gradient-to-br from-purple-50 to-purple-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-700">
                  AI Insights
                </p>
                <p className="text-3xl font-bold text-purple-900">
                  {formatNumber(data.intelligence.insightsGenerated)}
                </p>
                <p className="text-xs text-purple-600 mt-1">
                  {data.intelligence.highPriorityInsights} high priority
                </p>
              </div>
              <Zap className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-0 bg-gradient-to-br from-orange-50 to-orange-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-700">
                  Processing Efficiency
                </p>
                <p className="text-3xl font-bold text-orange-900">
                  {Math.round(data.trends.processingEfficiency)}%
                </p>
                <p className="text-xs text-orange-600 mt-1">
                  {data.trends.errorRate}% error rate
                </p>
              </div>
              <Activity className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Intelligence Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Smart Recommendations */}
        <Card className="shadow-xl border-0">
          <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 border-b">
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="w-6 h-6 text-amber-600" />
              Smart Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {data.recommendations.length > 0 ? (
              <div className="space-y-4">
                {data.recommendations.slice(0, 3).map((rec) => (
                  <div
                    key={rec.id}
                    className="flex items-start gap-4 p-4 bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow"
                  >
                    <div
                      className={`p-2 rounded-lg ${
                        rec.priority === "high"
                          ? "bg-red-100"
                          : rec.priority === "medium"
                          ? "bg-yellow-100"
                          : "bg-blue-100"
                      }`}
                    >
                      {rec.type === "urgent" ? (
                        <AlertTriangle className="w-5 h-5 text-red-600" />
                      ) : rec.type === "cost_optimization" ? (
                        <DollarSign className="w-5 h-5 text-green-600" />
                      ) : (
                        <Target className="w-5 h-5 text-blue-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-gray-900">
                          {rec.title}
                        </h4>
                        <Badge className={getImpactColor(rec.priority)}>
                          {rec.priority}
                        </Badge>
                      </div>
                      <p className="text-gray-600 text-sm mb-2">
                        {rec.description}
                      </p>
                      {rec.potentialValue && (
                        <p className="text-green-600 text-sm font-medium mb-2">
                          Potential value: {formatCurrency(rec.potentialValue)}
                        </p>
                      )}
                      <Button variant="outline" size="sm">
                        {rec.action}
                      </Button>
                    </div>
                  </div>
                ))}

                {data.recommendations.length > 3 && (
                  <div className="text-center pt-4 border-t">
                    <Button variant="outline">
                      View All {data.recommendations.length} Recommendations
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <Lightbulb className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No recommendations available</p>
                <p className="text-gray-400 text-sm">
                  Upload more contracts to generate insights
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="shadow-xl border-0">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-6 h-6 text-blue-600" />
              Recent Intelligence Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {data.recentActivity.map((activity, index) => (
                <div
                  key={index}
                  className="flex items-start gap-4 p-3 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <div className="flex-shrink-0 mt-1">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-gray-900">
                        {activity.title}
                      </h4>
                      <Badge
                        className={getImpactColor(activity.impact)}
                        variant="outline"
                      >
                        {activity.impact}
                      </Badge>
                    </div>
                    <p className="text-gray-500 text-sm">
                      {new Date(activity.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Intelligence Metrics */}
      <Card className="shadow-xl border-0">
        <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-gray-700" />
            Intelligence Metrics
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600 mb-2">
                {formatNumber(data.intelligence.patternsDetected)}
              </div>
              <div className="text-sm text-gray-600 mb-1">
                Patterns Detected
              </div>
              <div className="text-xs text-gray-500">
                AI-identified patterns in contracts
              </div>
            </div>

            <div className="text-center">
              <div className="text-4xl font-bold text-green-600 mb-2">
                {formatNumber(data.intelligence.insightsGenerated)}
              </div>
              <div className="text-sm text-gray-600 mb-1">
                Insights Generated
              </div>
              <div className="text-xs text-gray-500">
                Actionable recommendations
              </div>
            </div>

            <div className="text-center">
              <div className="text-4xl font-bold text-purple-600 mb-2">
                {Math.round(data.trends.processingEfficiency)}%
              </div>
              <div className="text-sm text-gray-600 mb-1">
                Processing Efficiency
              </div>
              <div className="text-xs text-gray-500">
                Successful analysis rate
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t text-center">
            <p className="text-sm text-gray-500">
              Last analysis:{" "}
              {new Date(data.intelligence.lastAnalysisTime).toLocaleString()}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper functions
function getImpactColor(impact: string) {
  switch (impact) {
    case "high":
      return "bg-red-100 text-red-800";
    case "medium":
      return "bg-yellow-100 text-yellow-800";
    case "low":
      return "bg-blue-100 text-blue-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function getActivityIcon(type: string) {
  switch (type) {
    case "pattern_detected":
      return <Target className="w-4 h-4 text-blue-500" />;
    case "insight_generated":
      return <Lightbulb className="w-4 h-4 text-yellow-500" />;
    case "contract_processed":
      return <FileText className="w-4 h-4 text-green-500" />;
    default:
      return <Activity className="w-4 h-4 text-gray-500" />;
  }
}
