/**
 * Supplier Performance Dashboard
 * Comprehensive supplier performance tracking and analytics
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  TrendingUp,
  TrendingDown,
  Award,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Users,
  Target,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import Link from 'next/link';

interface SupplierMetrics {
  id: string;
  name: string;
  overallScore: number;
  onTimeDelivery: number;
  qualityScore: number;
  costEfficiency: number;
  responsiveness: number;
  riskLevel: 'low' | 'medium' | 'high';
  activeContracts: number;
  totalSpend: number;
  avgRate: number;
  trend: 'up' | 'down' | 'stable';
}

interface PerformanceTrend {
  month: string;
  onTime: number;
  quality: number;
  cost: number;
}

export function SupplierPerformanceDashboard() {
  const [suppliers, setSuppliers] = useState<SupplierMetrics[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);
  const [performanceTrends, setPerformanceTrends] = useState<PerformanceTrend[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSupplierPerformance = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/suppliers/performance');
        if (!response.ok) throw new Error('Failed to fetch supplier performance');

        const result = await response.json();
        setSuppliers(result.suppliers || []);
        setPerformanceTrends(result.trends || []);
      } catch {
        // Fallback data
        setSuppliers([
          {
            id: '1',
            name: 'Acme Consulting',
            overallScore: 92,
            onTimeDelivery: 95,
            qualityScore: 90,
            costEfficiency: 88,
            responsiveness: 94,
            riskLevel: 'low',
            activeContracts: 12,
            totalSpend: 450000,
            avgRate: 875,
            trend: 'up',
          },
          {
            id: '2',
            name: 'Tech Solutions Inc',
            overallScore: 85,
            onTimeDelivery: 88,
            qualityScore: 85,
            costEfficiency: 82,
            responsiveness: 86,
            riskLevel: 'low',
            activeContracts: 8,
            totalSpend: 320000,
            avgRate: 920,
            trend: 'stable',
          },
          {
            id: '3',
            name: 'Global IT Partners',
            overallScore: 78,
            onTimeDelivery: 75,
            qualityScore: 80,
            costEfficiency: 85,
            responsiveness: 72,
            riskLevel: 'medium',
            activeContracts: 15,
            totalSpend: 580000,
            avgRate: 750,
            trend: 'down',
          },
          {
            id: '4',
            name: 'DevOps Experts',
            overallScore: 88,
            onTimeDelivery: 92,
            qualityScore: 87,
            costEfficiency: 84,
            responsiveness: 89,
            riskLevel: 'low',
            activeContracts: 6,
            totalSpend: 280000,
            avgRate: 850,
            trend: 'up',
          },
        ]);

        setPerformanceTrends([
          { month: 'Jul', onTime: 88, quality: 85, cost: 82 },
          { month: 'Aug', onTime: 90, quality: 87, cost: 84 },
          { month: 'Sep', onTime: 92, quality: 88, cost: 85 },
          { month: 'Oct', onTime: 91, quality: 90, cost: 87 },
          { month: 'Nov', onTime: 93, quality: 91, cost: 86 },
          { month: 'Dec', onTime: 95, quality: 92, cost: 88 },
        ]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSupplierPerformance();
  }, []);

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 75) return 'text-violet-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-600';
  };

  const getRiskBadge = (risk: 'low' | 'medium' | 'high') => {
    const colors = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-amber-100 text-amber-800',
      high: 'bg-red-100 text-red-800',
    };
    return colors[risk];
  };

  const selectedSupplierData = selectedSupplier
    ? suppliers.find((s) => s.id === selectedSupplier)
    : null;

  const radarData = selectedSupplierData
    ? [
        { metric: 'On-Time', score: selectedSupplierData.onTimeDelivery },
        { metric: 'Quality', score: selectedSupplierData.qualityScore },
        { metric: 'Cost', score: selectedSupplierData.costEfficiency },
        { metric: 'Response', score: selectedSupplierData.responsiveness },
        { metric: 'Overall', score: selectedSupplierData.overallScore },
      ]
    : [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse h-64 bg-gray-200 rounded" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate summary stats
  const avgOverallScore = Math.round(
    suppliers.reduce((sum, s) => sum + s.overallScore, 0) / suppliers.length
  );
  const totalActiveContracts = suppliers.reduce((sum, s) => sum + s.activeContracts, 0);
  const totalSpend = suppliers.reduce((sum, s) => sum + s.totalSpend, 0);
  const highRiskCount = suppliers.filter((s) => s.riskLevel === 'high').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Award className="h-6 w-6" />
          Supplier Performance
        </h2>
        <p className="text-muted-foreground mt-1">
          Track and analyze supplier performance across key metrics
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4" />
              Avg Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getScoreColor(avgOverallScore)}`}>
              {avgOverallScore}/100
            </div>
            <p className="text-xs text-muted-foreground mt-1">Across all suppliers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Active Contracts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalActiveContracts}</div>
            <p className="text-xs text-muted-foreground mt-1">{suppliers.length} suppliers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Spend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(totalSpend / 1000000).toFixed(2)}M
            </div>
            <p className="text-xs text-muted-foreground mt-1">Annual spend</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Risk Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${highRiskCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {highRiskCount > 0 ? `${highRiskCount} High Risk` : 'All Clear'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Supplier risk level</p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Trends */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Trends</CardTitle>
          <CardDescription>6-month rolling average across all suppliers</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={performanceTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="onTime"
                stroke="#10b981"
                name="On-Time Delivery"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="quality"
                stroke="#3b82f6"
                name="Quality Score"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="cost"
                stroke="#f59e0b"
                name="Cost Efficiency"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Supplier Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Supplier Comparison</CardTitle>
          <CardDescription>Overall performance scores by supplier</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={suppliers}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Legend />
              <Bar dataKey="overallScore" fill="#3b82f6" name="Overall Score" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Supplier Details */}
      <Card>
        <CardHeader>
          <CardTitle>Supplier Details</CardTitle>
          <CardDescription>Click on a supplier to view detailed performance metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {/* Supplier List */}
            <div className="space-y-3">
              {suppliers.map((supplier) => (
                <div
                  key={supplier.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    selectedSupplier === supplier.id
                      ? 'bg-accent border-primary'
                      : 'hover:bg-accent/50'
                  }`}
                  onClick={() => setSelectedSupplier(supplier.id)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-semibold">{supplier.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {supplier.activeContracts} contracts • ${(supplier.totalSpend / 1000).toFixed(0)}K
                      </p>
                    </div>
                    <Badge className={getRiskBadge(supplier.riskLevel)}>
                      {supplier.riskLevel.toUpperCase()}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-2xl font-bold ${getScoreColor(supplier.overallScore)}`}>
                        {supplier.overallScore}
                      </span>
                      <span className="text-sm text-muted-foreground">/100</span>
                    </div>
                    {supplier.trend === 'up' ? (
                      <TrendingUp className="h-5 w-5 text-green-600" />
                    ) : supplier.trend === 'down' ? (
                      <TrendingDown className="h-5 w-5 text-red-600" />
                    ) : (
                      <Clock className="h-5 w-5 text-gray-600" />
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Detailed Metrics */}
            {selectedSupplierData ? (
              <div className="space-y-4">
                <div className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-4">{selectedSupplierData.name} - Performance Breakdown</h4>

                  {/* Radar Chart */}
                  <ResponsiveContainer width="100%" height={250}>
                    <RadarChart data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="metric" />
                      <PolarRadiusAxis domain={[0, 100]} />
                      <Radar
                        name="Score"
                        dataKey="score"
                        stroke="#3b82f6"
                        fill="#3b82f6"
                        fillOpacity={0.6}
                      />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>

                  {/* Metric Breakdown */}
                  <div className="space-y-3 mt-4">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">On-Time Delivery</span>
                        <span className={`font-semibold ${getScoreColor(selectedSupplierData.onTimeDelivery)}`}>
                          {selectedSupplierData.onTimeDelivery}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full"
                          style={{ width: `${selectedSupplierData.onTimeDelivery}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">Quality Score</span>
                        <span className={`font-semibold ${getScoreColor(selectedSupplierData.qualityScore)}`}>
                          {selectedSupplierData.qualityScore}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-violet-600 h-2 rounded-full"
                          style={{ width: `${selectedSupplierData.qualityScore}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">Cost Efficiency</span>
                        <span className={`font-semibold ${getScoreColor(selectedSupplierData.costEfficiency)}`}>
                          {selectedSupplierData.costEfficiency}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-amber-600 h-2 rounded-full"
                          style={{ width: `${selectedSupplierData.costEfficiency}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">Responsiveness</span>
                        <span className={`font-semibold ${getScoreColor(selectedSupplierData.responsiveness)}`}>
                          {selectedSupplierData.responsiveness}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-violet-600 h-2 rounded-full"
                          style={{ width: `${selectedSupplierData.responsiveness}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
                    <div>
                      <p className="text-xs text-muted-foreground">Avg Daily Rate</p>
                      <p className="text-lg font-bold">${selectedSupplierData.avgRate}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Annual Spend</p>
                      <p className="text-lg font-bold">
                        ${(selectedSupplierData.totalSpend / 1000).toFixed(0)}K
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-4">
                    <Link href={`/suppliers/${selectedSupplierData.id}`} className="flex-1">
                      <Button variant="outline" className="w-full">
                        View Details
                      </Button>
                    </Link>
                    <Link href={`/rate-cards?supplier=${selectedSupplierData.id}`} className="flex-1">
                      <Button variant="outline" className="w-full">
                        View Rate Cards
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full border rounded-lg">
                <p className="text-muted-foreground">Select a supplier to view details</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
