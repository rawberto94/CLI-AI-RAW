'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  TrendingUp,
  TrendingDown,
  Target,
  AlertTriangle,
  CheckCircle,
  DollarSign,
  BarChart3,
} from 'lucide-react';

interface TrackingData {
  summary: {
    totalBaselines: number;
    activeBaselines: number;
    totalRateCards: number;
    ratesWithinBaseline: number;
    ratesExceedingBaseline: number;
    achievementRate: number;
    totalSavingsIdentified: number;
    totalSavingsRealized: number;
  };
  byType: Array<{
    type: string;
    count: number;
    avgRate: number;
  }>;
  byCategory: Array<{
    category: string;
    count: number;
  }>;
  topViolations: Array<{
    entryId: string;
    resourceType: string;
    lineOfService: string;
    actualRate: number;
    maxSavings: number;
    comparisons: any[];
  }>;
  recentComparisons: any[];
}

export function BaselineTrackingDashboard() {
  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTrackingData();
  }, []);

  const fetchTrackingData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/rate-cards/baselines/tracking');
      
      if (!response.ok) {
        throw new Error('Failed to fetch tracking data');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Error fetching tracking data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const getTypeBadge = (type: string) => {
    const labels: Record<string, string> = {
      TARGET_RATE: 'Target',
      MARKET_BENCHMARK: 'Market',
      HISTORICAL_BEST: 'Historical',
      NEGOTIATED_CAP: 'Cap',
      INTERNAL_POLICY: 'Policy',
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-center text-gray-500 py-8">Loading tracking data...</div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error || 'Failed to load tracking data'}
          </div>
        </div>
      </div>
    );
  }

  const { summary } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Baseline Tracking Dashboard</h2>
          <p className="text-gray-600 mt-1">
            Monitor baseline achievement rates and identify savings opportunities
          </p>
        </div>
        <Button onClick={fetchTrackingData} variant="outline">
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-500">Active Baselines</p>
            <Target className="h-5 w-5 text-blue-500" />
          </div>
          <p className="text-3xl font-bold">{summary.activeBaselines}</p>
          <p className="text-xs text-gray-500 mt-1">
            of {summary.totalBaselines} total
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-500">Achievement Rate</p>
            {summary.achievementRate >= 80 ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            )}
          </div>
          <p className="text-3xl font-bold">{summary.achievementRate}%</p>
          <p className="text-xs text-gray-500 mt-1">
            {summary.ratesWithinBaseline} of {summary.totalRateCards} rates
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-500">Savings Identified</p>
            <TrendingUp className="h-5 w-5 text-orange-500" />
          </div>
          <p className="text-3xl font-bold text-orange-600">
            ${Math.round(summary.totalSavingsIdentified).toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {summary.ratesExceedingBaseline} rates above baseline
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-500">Savings Realized</p>
            <DollarSign className="h-5 w-5 text-green-500" />
          </div>
          <p className="text-3xl font-bold text-green-600">
            ${Math.round(summary.totalSavingsRealized).toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {summary.totalSavingsRealized > 0
              ? `${Math.round((summary.totalSavingsRealized / summary.totalSavingsIdentified) * 100)}% realized`
              : 'No savings realized yet'}
          </p>
        </div>
      </div>

      {/* Performance by Type */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-semibold">Baseline Performance by Type</h3>
        </div>
        <div className="grid grid-cols-5 gap-4">
          {data.byType.map((type) => (
            <div key={type.type} className="border rounded-lg p-4">
              <Badge variant="outline" className="mb-2">
                {getTypeBadge(type.type)}
              </Badge>
              <p className="text-2xl font-bold">{type.count}</p>
              <p className="text-xs text-gray-500 mt-1">
                Avg: ${Math.round(type.avgRate).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Top Violations */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <h3 className="text-lg font-semibold">Top Baseline Violations</h3>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Rates with the highest potential savings vs baselines
          </p>
        </div>

        {data.topViolations.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
            <p>All rates are within baseline targets!</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Resource Type</TableHead>
                <TableHead>Line of Service</TableHead>
                <TableHead>Actual Rate</TableHead>
                <TableHead>Baseline Comparisons</TableHead>
                <TableHead>Potential Savings</TableHead>
                <TableHead>Priority</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.topViolations.map((violation) => (
                <TableRow key={violation.entryId}>
                  <TableCell className="font-medium">
                    {violation.resourceType}
                  </TableCell>
                  <TableCell>{violation.lineOfService}</TableCell>
                  <TableCell>${violation.actualRate.toLocaleString()}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {violation.comparisons.slice(0, 2).map((comp: any, idx: number) => (
                        <div key={idx} className="text-sm">
                          <span className="font-medium">{comp.baselineName}:</span>{' '}
                          <span className="text-red-600">
                            +{comp.variancePercentage.toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-green-600 font-semibold">
                      ${violation.maxSavings.toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell>
                    {violation.maxSavings > 100 ? (
                      <Badge variant="destructive">High</Badge>
                    ) : violation.maxSavings > 50 ? (
                      <Badge variant="default">Medium</Badge>
                    ) : (
                      <Badge variant="secondary">Low</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Performance by Category */}
      {data.byCategory.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Baseline Coverage by Category</h3>
          <div className="grid grid-cols-4 gap-4">
            {data.byCategory.map((cat) => (
              <div key={cat.category} className="border rounded-lg p-4">
                <p className="text-sm font-medium text-gray-700">{cat.category}</p>
                <p className="text-2xl font-bold mt-1">{cat.count}</p>
                <p className="text-xs text-gray-500">baselines</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold">Recent Baseline Comparisons</h3>
        </div>
        {data.recentComparisons.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No recent comparisons found
          </div>
        ) : (
          <div className="divide-y">
            {data.recentComparisons.slice(0, 10).map((comp: any) => (
              <div key={comp.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{comp.comparisonName}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {comp.rateCardEntry?.roleStandardized} - {comp.rateCardEntry?.supplierName}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline">
                        {getTypeBadge(comp.baseline?.baselineType)}
                      </Badge>
                      {comp.actionRequired && (
                        <Badge variant="destructive">Action Required</Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Variance</p>
                    <p className={`text-lg font-semibold ${
                      Number(comp.variance) > 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {Number(comp.variance) > 0 ? '+' : ''}
                      ${Math.abs(Number(comp.variance)).toLocaleString()}
                    </p>
                    {Number(comp.potentialSavings) > 0 && (
                      <p className="text-xs text-green-600 mt-1">
                        Save ${Number(comp.potentialSavings).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
