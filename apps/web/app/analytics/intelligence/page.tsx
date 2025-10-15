"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EnhancedCard, MetricCard } from "@/components/ui/enhanced-card";
import { ScoreGauge } from "@/components/ui/data-visualization";
import { LoadingState } from "@/components/ui/loading-states";
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  LineChart,
  Target,
  DollarSign,
  Users,
  Clock,
  Zap,
  Brain,
  Award,
  AlertTriangle,
  CheckCircle,
  Search,
  Download,
  RefreshCw,
} from "lucide-react";
import { analyticalIntelligenceService } from "@/lib/services/analytical-intelligence.service";

interface AnalyticsData {
  overview: {
    totalContracts: number;
    totalValue: number;
    avgSavings: number;
    complianceScore: number;
    renewalsNext90Days: number;
    activeSuppliers: number;
  };
  rateCard: {
    benchmarkedContracts: number;
    savingsOpportunities: number;
    avgVariance: number;
    topOpportunities: Array<{
      supplier: string;
      category: string;
      potentialSavings: number;
      confidence: number;
    }>;
  };
  renewals: {
    totalRenewals: number;
    highRiskRenewals: number;
    avgDaysToExpiry: number;
    upcomingRenewals: Array<{
      contractId: string;
      supplier: string;
      expiryDate: string;
      riskLevel: string;
      value: number;
    }>;
  };
  compliance: {
    averageScore: number;
    criticalIssues: number;
    riskDistribution: Record<string, number>;
    topIssues: Array<{
      issue: string;
      frequency: number;
      impact: string;
    }>;
  };
  suppliers: {
    totalSuppliers: number;
    topPerformers: Array<{
      name: string;
      score: number;
      riskLevel: string;
      contractValue: number;
    }>;
    riskAlerts: number;
  };
  nlq: {
    totalQueries: number;
    avgConfidence: number;
    popularQueries: string[];
  };
}

export default function AnalyticalIntelligenceDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [queryResult, setQueryResult] = useState<any>(null);
  const [queryLoading, setQueryLoading] = useState(false);

  useEffect(() => {
    loadAnalyticsData();
  }, []);

  const loadAnalyticsData = async () => {
    try {
      setLoading(true);
      // Fetch real data from enhanced engines
      const dashboardData =
        await analyticalIntelligenceService.getDashboardData("default", false);

      if (dashboardData) {
        const analyticsData: AnalyticsData = {
          overview: dashboardData.overview,
          rateCard: dashboardData.rateCard,
          renewals: dashboardData.renewals,
          compliance: dashboardData.compliance,
          suppliers: dashboardData.suppliers,
          nlq: dashboardData.nlq,
        };

        setData(analyticsData);
      } else {
        // Fallback to mock data if API fails
        const mockData: AnalyticsData = {
          overview: {
            totalContracts: 1247,
            totalValue: 45600000,
            avgSavings: 18.5,
            complianceScore: 87.3,
            renewalsNext90Days: 23,
            activeSuppliers: 156,
          },
          rateCard: {
            benchmarkedContracts: 892,
            savingsOpportunities: 34,
            avgVariance: 12.3,
            topOpportunities: [
              {
                supplier: "Accenture",
                category: "IT Services",
                potentialSavings: 340000,
                confidence: 0.92,
              },
              {
                supplier: "Deloitte",
                category: "Consulting",
                potentialSavings: 280000,
                confidence: 0.87,
              },
              {
                supplier: "PwC",
                category: "Advisory",
                potentialSavings: 195000,
                confidence: 0.84,
              },
            ],
          },
          renewals: {
            totalRenewals: 67,
            highRiskRenewals: 12,
            avgDaysToExpiry: 145,
            upcomingRenewals: [
              {
                contractId: "CNT-001",
                supplier: "Microsoft",
                expiryDate: "2024-04-15",
                riskLevel: "high",
                value: 2400000,
              },
              {
                contractId: "CNT-002",
                supplier: "Oracle",
                expiryDate: "2024-05-20",
                riskLevel: "medium",
                value: 1800000,
              },
              {
                contractId: "CNT-003",
                supplier: "SAP",
                expiryDate: "2024-06-10",
                riskLevel: "low",
                value: 950000,
              },
            ],
          },
          compliance: {
            averageScore: 82.4,
            criticalIssues: 7,
            riskDistribution: { low: 45, medium: 32, high: 18, critical: 5 },
            topIssues: [
              {
                issue: "Missing liability clauses",
                frequency: 23,
                impact: "high",
              },
              {
                issue: "Weak termination terms",
                frequency: 18,
                impact: "medium",
              },
              {
                issue: "GDPR compliance gaps",
                frequency: 12,
                impact: "critical",
              },
            ],
          },
          suppliers: {
            totalSuppliers: 156,
            topPerformers: [
              {
                name: "Accenture",
                score: 94,
                riskLevel: "low",
                contractValue: 8500000,
              },
              {
                name: "Deloitte",
                score: 91,
                riskLevel: "low",
                contractValue: 6200000,
              },
              {
                name: "IBM",
                score: 88,
                riskLevel: "medium",
                contractValue: 4800000,
              },
            ],
            riskAlerts: 8,
          },
          nlq: {
            totalQueries: 1456,
            avgConfidence: 0.84,
            popularQueries: [
              "Show contracts expiring this quarter",
              "Compare rates for senior consultants",
              "Which suppliers have compliance issues?",
              "What are our biggest savings opportunities?",
            ],
          },
        };

        setData(mockData);
      }
    } catch (error) {
      console.error("Failed to load analytics data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAnalyticsData();
    setRefreshing(false);
  };

  const handleQuery = async () => {
    if (!query.trim()) return;

    try {
      setQueryLoading(true);
      const result =
        await analyticalIntelligenceService.processNaturalLanguageQuery(query, {
          tenantId: "default",
          sessionId: `session-${Date.now()}`,
          userId: "user-1",
        });
      setQueryResult(result);
    } catch (error) {
      console.error("Query failed:", error);
      setQueryResult({ error: "Query failed. Please try again." });
    } finally {
      setQueryLoading(false);
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case "critical":
        return "text-red-600 bg-red-50 border-red-200";
      case "high":
        return "text-orange-600 bg-orange-50 border-orange-200";
      case "medium":
        return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "low":
        return "text-green-600 bg-green-50 border-green-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <LoadingState
          message="Loading analytical intelligence dashboard..."
          details="Aggregating data from all analytical engines"
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Failed to Load Data
          </h2>
          <p className="text-gray-600 mb-4">
            Unable to load analytical intelligence data
          </p>
          <Button onClick={loadAnalyticsData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Analytical Intelligence
          </h1>
          <p className="text-gray-600 mt-1">
            Comprehensive procurement analytics and insights
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
        <MetricCard
          title="Total Contracts"
          value={data.overview.totalContracts.toLocaleString()}
          subtitle="Active contracts"
          icon={<Users className="w-5 h-5" />}
          color="blue"
        />
        <MetricCard
          title="Total Value"
          value={`$${(data.overview.totalValue / 1000000).toFixed(1)}M`}
          subtitle="Contract portfolio"
          icon={<DollarSign className="w-5 h-5" />}
          color="green"
        />
        <MetricCard
          title="Avg Savings"
          value={`${data.overview.avgSavings}%`}
          subtitle="Cost reduction"
          icon={<TrendingUp className="w-5 h-5" />}
          color="purple"
        />
        <MetricCard
          title="Compliance"
          value={`${data.overview.complianceScore}%`}
          subtitle="Overall score"
          icon={<CheckCircle className="w-5 h-5" />}
          color="green"
        />
        <MetricCard
          title="Renewals"
          value={data.overview.renewalsNext90Days.toString()}
          subtitle="Next 90 days"
          icon={<Clock className="w-5 h-5" />}
          color="orange"
        />
        <MetricCard
          title="Suppliers"
          value={data.overview.activeSuppliers.toString()}
          subtitle="Active suppliers"
          icon={<Award className="w-5 h-5" />}
          color="blue"
        />
      </div>

      {/* Natural Language Query */}
      <EnhancedCard
        title="Procurement Copilot"
        subtitle="Ask questions about your contracts and suppliers"
        className="border-l-4 border-l-blue-500"
      >
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask me anything about your contracts, rates, or suppliers..."
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onKeyPress={(e) => e.key === "Enter" && handleQuery()}
              />
            </div>
            <Button
              onClick={handleQuery}
              disabled={queryLoading || !query.trim()}
            >
              <Search className="w-4 h-4 mr-2" />
              {queryLoading ? "Searching..." : "Ask"}
            </Button>
          </div>

          {queryResult && (
            <div className="p-4 bg-gray-50 rounded-md">
              {queryResult.error ? (
                <div className="text-red-600">{queryResult.error}</div>
              ) : (
                <div>
                  <div className="font-medium text-gray-900 mb-2">
                    {queryResult.answer}
                  </div>
                  {queryResult.evidence && queryResult.evidence.length > 0 && (
                    <div className="text-sm text-gray-600">
                      <div className="font-medium mb-1">Sources:</div>
                      {queryResult.evidence.map(
                        (evidence: any, index: number) => (
                          <div key={index} className="ml-2">
                            • {evidence.excerpt}
                          </div>
                        )
                      )}
                    </div>
                  )}
                  <div className="mt-2 text-xs text-gray-500">
                    Confidence: {Math.round(queryResult.confidence * 100)}%
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="text-sm text-gray-600">
            <div className="font-medium mb-1">Popular queries:</div>
            <div className="flex flex-wrap gap-2">
              {data.nlq.popularQueries.map((popularQuery, index) => (
                <button
                  key={index}
                  onClick={() => setQuery(popularQuery)}
                  className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs hover:bg-blue-100"
                >
                  {popularQuery}
                </button>
              ))}
            </div>
          </div>
        </div>
      </EnhancedCard>

      {/* Main Analytics Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="benchmarking">Rate Benchmarking</TabsTrigger>
          <TabsTrigger value="renewals">Renewal Radar</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
          <TabsTrigger value="insights">AI Insights</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <EnhancedCard
              title="Contract Portfolio Health"
              subtitle="Overall portfolio metrics"
            >
              <div className="text-center space-y-4">
                <ScoreGauge
                  score={data.overview.complianceScore}
                  size="lg"
                  label="Portfolio Health"
                />
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      $
                      {(
                        (data.overview.avgSavings * data.overview.totalValue) /
                        100 /
                        1000000
                      ).toFixed(1)}
                      M
                    </div>
                    <div className="text-sm text-gray-600">
                      Potential Savings
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">
                      {data.overview.renewalsNext90Days}
                    </div>
                    <div className="text-sm text-gray-600">
                      Upcoming Renewals
                    </div>
                  </div>
                </div>
              </div>
            </EnhancedCard>

            <EnhancedCard
              title="Key Performance Indicators"
              subtitle="Critical metrics at a glance"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">
                    Benchmarked Contracts
                  </span>
                  <span className="font-medium">
                    {Math.round(
                      (data.rateCard.benchmarkedContracts /
                        data.overview.totalContracts) *
                        100
                    )}
                    %
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">
                    Compliance Score
                  </span>
                  <span className="font-medium">
                    {data.compliance.averageScore}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">
                    Supplier Performance
                  </span>
                  <span className="font-medium">89%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Risk Alerts</span>
                  <Badge className={getRiskColor("medium")}>
                    {data.suppliers.riskAlerts} Active
                  </Badge>
                </div>
              </div>
            </EnhancedCard>
          </div>
        </TabsContent>

        {/* Rate Benchmarking Tab */}
        <TabsContent value="benchmarking" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <EnhancedCard
              title="Savings Opportunities"
              subtitle="Top potential savings identified"
            >
              <div className="space-y-4">
                {data.rateCard.topOpportunities.map((opportunity, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded"
                  >
                    <div>
                      <div className="font-medium">{opportunity.supplier}</div>
                      <div className="text-sm text-gray-600">
                        {opportunity.category}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-600">
                        ${(opportunity.potentialSavings / 1000).toFixed(0)}K
                      </div>
                      <div className="text-xs text-gray-500">
                        {Math.round(opportunity.confidence * 100)}% confidence
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </EnhancedCard>

            <EnhancedCard
              title="Benchmarking Summary"
              subtitle="Rate analysis overview"
            >
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="p-3 bg-blue-50 rounded">
                  <div className="text-2xl font-bold text-blue-600">
                    {data.rateCard.benchmarkedContracts}
                  </div>
                  <div className="text-sm text-blue-700">Benchmarked</div>
                </div>
                <div className="p-3 bg-green-50 rounded">
                  <div className="text-2xl font-bold text-green-600">
                    {data.rateCard.savingsOpportunities}
                  </div>
                  <div className="text-sm text-green-700">Opportunities</div>
                </div>
                <div className="p-3 bg-orange-50 rounded">
                  <div className="text-2xl font-bold text-orange-600">
                    {data.rateCard.avgVariance}%
                  </div>
                  <div className="text-sm text-orange-700">Avg Variance</div>
                </div>
                <div className="p-3 bg-purple-50 rounded">
                  <div className="text-2xl font-bold text-purple-600">
                    $
                    {(
                      data.rateCard.topOpportunities.reduce(
                        (sum, opp) => sum + opp.potentialSavings,
                        0
                      ) / 1000000
                    ).toFixed(1)}
                    M
                  </div>
                  <div className="text-sm text-purple-700">Total Savings</div>
                </div>
              </div>
            </EnhancedCard>
          </div>
        </TabsContent>

        {/* Renewal Radar Tab */}
        <TabsContent value="renewals" className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            <EnhancedCard
              title="Upcoming Renewals"
              subtitle="Contracts requiring attention"
            >
              <div className="space-y-4">
                {data.renewals.upcomingRenewals.map((renewal, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 border rounded"
                  >
                    <div>
                      <div className="font-medium">{renewal.supplier}</div>
                      <div className="text-sm text-gray-600">
                        Contract: {renewal.contractId}
                      </div>
                      <div className="text-sm text-gray-600">
                        Expires: {renewal.expiryDate}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">
                        ${(renewal.value / 1000000).toFixed(1)}M
                      </div>
                      <Badge className={getRiskColor(renewal.riskLevel)}>
                        {renewal.riskLevel.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </EnhancedCard>
          </div>
        </TabsContent>

        {/* Compliance Tab */}
        <TabsContent value="compliance" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <EnhancedCard
              title="Compliance Overview"
              subtitle="Risk distribution and scores"
            >
              <div className="text-center space-y-4">
                <ScoreGauge
                  score={data.compliance.averageScore}
                  size="lg"
                  label="Compliance Score"
                />
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {data.compliance.criticalIssues}
                    </div>
                    <div className="text-sm text-gray-600">Critical Issues</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {data.compliance.riskDistribution.low +
                        data.compliance.riskDistribution.medium}
                    </div>
                    <div className="text-sm text-gray-600">Low-Medium Risk</div>
                  </div>
                </div>
              </div>
            </EnhancedCard>

            <EnhancedCard
              title="Top Compliance Issues"
              subtitle="Most frequent issues identified"
            >
              <div className="space-y-3">
                {data.compliance.topIssues.map((issue, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded"
                  >
                    <div>
                      <div className="font-medium">{issue.issue}</div>
                      <div className="text-sm text-gray-600">
                        {issue.frequency} contracts affected
                      </div>
                    </div>
                    <Badge className={getRiskColor(issue.impact)}>
                      {issue.impact.toUpperCase()}
                    </Badge>
                  </div>
                ))}
              </div>
            </EnhancedCard>
          </div>
        </TabsContent>

        {/* Suppliers Tab */}
        <TabsContent value="suppliers" className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            <EnhancedCard
              title="Top Performing Suppliers"
              subtitle="Highest rated suppliers by performance"
            >
              <div className="space-y-4">
                {data.suppliers.topPerformers.map((supplier, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 border rounded"
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-2xl font-bold text-blue-600">
                        #{index + 1}
                      </div>
                      <div>
                        <div className="font-medium">{supplier.name}</div>
                        <div className="text-sm text-gray-600">
                          Score: {supplier.score}/100
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">
                        ${(supplier.contractValue / 1000000).toFixed(1)}M
                      </div>
                      <Badge className={getRiskColor(supplier.riskLevel)}>
                        {supplier.riskLevel.toUpperCase()} RISK
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </EnhancedCard>
          </div>
        </TabsContent>

        {/* AI Insights Tab */}
        <TabsContent value="insights" className="space-y-6">
          <div className="text-center py-12">
            <Brain className="w-12 h-12 text-blue-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              AI-Powered Insights
            </h3>
            <p className="text-gray-600 mb-4">
              Advanced analytics and predictive insights coming soon...
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
              <div className="p-4 bg-blue-50 rounded border border-blue-200">
                <Zap className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                <div className="text-sm font-medium text-blue-900">
                  Predictive Analytics
                </div>
                <div className="text-xs text-blue-700">
                  Contract risk prediction
                </div>
              </div>
              <div className="p-4 bg-green-50 rounded border border-green-200">
                <Target className="w-6 h-6 text-green-600 mx-auto mb-2" />
                <div className="text-sm font-medium text-green-900">
                  Smart Recommendations
                </div>
                <div className="text-xs text-green-700">
                  AI-driven optimization
                </div>
              </div>
              <div className="p-4 bg-purple-50 rounded border border-purple-200">
                <Brain className="w-6 h-6 text-purple-600 mx-auto mb-2" />
                <div className="text-sm font-medium text-purple-900">
                  Pattern Recognition
                </div>
                <div className="text-xs text-purple-700">Anomaly detection</div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
