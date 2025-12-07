/**
 * Extraction Analytics Dashboard Component
 * 
 * Displays AI extraction performance metrics including:
 * - Success rates
 * - Confidence distributions
 * - Field type performance
 * - Daily trends
 * - Improvement recommendations
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Activity,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  Target,
  Lightbulb,
  RefreshCw,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

interface FieldTypeMetrics {
  fieldType: string;
  totalExtractions: number;
  successfulExtractions: number;
  autoApplied: number;
  corrected: number;
  rejected: number;
  averageConfidence: number;
  accuracyRate: number;
  correctionRate: number;
}

interface DailyTrend {
  date: string;
  extractions: number;
  successRate: number;
  avgConfidence: number;
}

interface TenantAnalytics {
  tenantId: string;
  period: { start: string; end: string };
  totalExtractions: number;
  successfulExtractions: number;
  failedExtractions: number;
  averageProcessingTime: number;
  averageConfidence: number;
  fieldMetrics: FieldTypeMetrics[];
  topErrors: Array<{ error: string; count: number }>;
  dailyTrend: DailyTrend[];
}

interface AnalyticsDashboardProps {
  tenantId?: string;
  className?: string;
}

// ============================================================================
// COLORS
// ============================================================================

const COLORS = {
  primary: "#3b82f6",
  success: "#22c55e",
  warning: "#f59e0b",
  danger: "#ef4444",
  muted: "#94a3b8",
  chart: [
    "#3b82f6",
    "#22c55e",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
    "#06b6d4",
    "#84cc16",
  ],
};

// ============================================================================
// COMPONENT
// ============================================================================

export function ExtractionAnalyticsDashboard({
  tenantId,
  className = "",
}: AnalyticsDashboardProps) {
  const [analytics, setAnalytics] = useState<TenantAnalytics | null>(null);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d">("30d");

  // Fetch analytics data
  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const days = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90;
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      
      const response = await fetch(
        `/api/analytics/extraction?startDate=${startDate}&recommendations=true`,
        {
          headers: {
            "x-tenant-id": tenantId || "demo",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch analytics");
      }

      const data = await response.json();
      setAnalytics(data.analytics);
      setRecommendations(data.recommendations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [tenantId, dateRange]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-12 ${className}`}>
        <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-red-500">
            <AlertTriangle className="h-5 w-5" />
            <span>Error loading analytics: {error}</span>
          </div>
          <Button onClick={fetchAnalytics} className="mt-4">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!analytics) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center text-muted-foreground">
          No analytics data available
        </CardContent>
      </Card>
    );
  }

  const successRate = analytics.totalExtractions > 0
    ? (analytics.successfulExtractions / analytics.totalExtractions) * 100
    : 0;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Extraction Analytics</h2>
          <p className="text-muted-foreground">
            AI metadata extraction performance insights
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={dateRange === "7d" ? "default" : "outline"}
            size="sm"
            onClick={() => setDateRange("7d")}
          >
            7 Days
          </Button>
          <Button
            variant={dateRange === "30d" ? "default" : "outline"}
            size="sm"
            onClick={() => setDateRange("30d")}
          >
            30 Days
          </Button>
          <Button
            variant={dateRange === "90d" ? "default" : "outline"}
            size="sm"
            onClick={() => setDateRange("90d")}
          >
            90 Days
          </Button>
          <Button variant="ghost" size="icon" onClick={fetchAnalytics}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Extractions</p>
                <p className="text-3xl font-bold">{analytics.totalExtractions}</p>
              </div>
              <Activity className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className="text-3xl font-bold">{successRate.toFixed(1)}%</p>
              </div>
              <CheckCircle className={`h-8 w-8 ${
                successRate >= 90 ? "text-green-500" : 
                successRate >= 70 ? "text-yellow-500" : "text-red-500"
              }`} />
            </div>
            <Progress value={successRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Confidence</p>
                <p className="text-3xl font-bold">
                  {(analytics.averageConfidence * 100).toFixed(0)}%
                </p>
              </div>
              <Target className={`h-8 w-8 ${
                analytics.averageConfidence >= 0.8 ? "text-green-500" :
                analytics.averageConfidence >= 0.6 ? "text-yellow-500" : "text-red-500"
              }`} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Processing Time</p>
                <p className="text-3xl font-bold">
                  {(analytics.averageProcessingTime / 1000).toFixed(1)}s
                </p>
              </div>
              <Clock className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-500" />
              Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2">
                  <TrendingUp className="h-4 w-4 mt-1 text-blue-500 flex-shrink-0" />
                  <span className="text-sm">{rec}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Tabs for detailed views */}
      <Tabs defaultValue="trends" className="w-full">
        <TabsList>
          <TabsTrigger value="trends">Daily Trends</TabsTrigger>
          <TabsTrigger value="fields">Field Performance</TabsTrigger>
          <TabsTrigger value="errors">Top Errors</TabsTrigger>
        </TabsList>

        {/* Daily Trends */}
        <TabsContent value="trends">
          <Card>
            <CardHeader>
              <CardTitle>Extraction Trends</CardTitle>
              <CardDescription>
                Daily extraction volume and success rate
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.dailyTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(date) => new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" domain={[0, 100]} />
                    <Tooltip
                      labelFormatter={(date) => new Date(date).toLocaleDateString()}
                      formatter={(value: number, name: string) => [
                        name === "successRate" || name === "avgConfidence" 
                          ? `${(value * 100).toFixed(1)}%` 
                          : value,
                        name === "extractions" ? "Extractions" :
                        name === "successRate" ? "Success Rate" : "Avg Confidence"
                      ]}
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="extractions"
                      stroke={COLORS.primary}
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="successRate"
                      stroke={COLORS.success}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Field Performance */}
        <TabsContent value="fields">
          <Card>
            <CardHeader>
              <CardTitle>Field Type Performance</CardTitle>
              <CardDescription>
                Accuracy and confidence by field type
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Bar chart */}
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      data={analytics.fieldMetrics}
                      layout="vertical"
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" domain={[0, 100]} />
                      <YAxis 
                        dataKey="fieldType" 
                        type="category" 
                        width={100}
                      />
                      <Tooltip
                        formatter={(value: number) => [`${value.toFixed(1)}%`, "Accuracy"]}
                      />
                      <Bar 
                        dataKey="accuracyRate" 
                        fill={COLORS.primary}
                        radius={[0, 4, 4, 0]}
                        name="Accuracy"
                      >
                        {analytics.fieldMetrics.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={
                              entry.accuracyRate >= 0.9 ? COLORS.success :
                              entry.accuracyRate >= 0.7 ? COLORS.warning : COLORS.danger
                            } 
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Metrics table */}
                <div className="space-y-4 max-h-80 overflow-y-auto">
                  {analytics.fieldMetrics.map((metric) => (
                    <div key={metric.fieldType} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium capitalize">
                          {metric.fieldType.replace("_", " ")}
                        </span>
                        <Badge variant={
                          metric.accuracyRate >= 0.9 ? "default" :
                          metric.accuracyRate >= 0.7 ? "secondary" : "destructive"
                        }>
                          {(metric.accuracyRate * 100).toFixed(0)}% accuracy
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm text-muted-foreground">
                        <div>
                          <span className="text-green-600 font-medium">
                            {metric.autoApplied}
                          </span> auto-applied
                        </div>
                        <div>
                          <span className="text-yellow-600 font-medium">
                            {metric.corrected}
                          </span> corrected
                        </div>
                        <div>
                          <span className="text-red-600 font-medium">
                            {metric.rejected}
                          </span> rejected
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Top Errors */}
        <TabsContent value="errors">
          <Card>
            <CardHeader>
              <CardTitle>Top Extraction Errors</CardTitle>
              <CardDescription>
                Most common errors encountered during extraction
              </CardDescription>
            </CardHeader>
            <CardContent>
              {analytics.topErrors.length === 0 ? (
                <div className="flex items-center justify-center p-8 text-muted-foreground">
                  <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
                  No extraction errors in this period
                </div>
              ) : (
                <div className="space-y-3">
                  {analytics.topErrors.map((error, i) => (
                    <div 
                      key={i} 
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                        <span className="text-sm font-mono truncate max-w-md">
                          {error.error}
                        </span>
                      </div>
                      <Badge variant="outline">{error.count} occurrences</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ExtractionAnalyticsDashboard;
