'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, Award } from 'lucide-react';

interface CategoryTrend {
  category: string;
  avgRate: number;
  changePercent: number;
  trend: 'UP' | 'DOWN' | 'STABLE';
  count: number;
}

interface SupplierCompetitiveness {
  supplierName: string;
  competitivenessScore: number;
  avgRateVsMarket: number;
}

interface SavingsPipelineItem {
  status: string;
  totalSavings: number;
  count: number;
}

interface TrendData {
  rateInflationByCategory: CategoryTrend[];
  supplierCompetitiveness: SupplierCompetitiveness[];
  savingsPipeline: SavingsPipelineItem[];
}

export function DashboardTrendCharts() {
  const [data, setData] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTrendData();
  }, []);

  const fetchTrendData = async () => {
    try {
      const response = await fetch('/api/rate-cards/dashboard/trends');
      if (response.ok) {
        const trendData = await response.json();
        setData(trendData);
      }
    } catch {
      // Error fetching trend data
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'UP':
        return <TrendingUp className="h-4 w-4 text-red-600" />;
      case 'DOWN':
        return <TrendingDown className="h-4 w-4 text-green-600" />;
      default:
        return <Minus className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      IDENTIFIED: 'Identified',
      UNDER_REVIEW: 'Under Review',
      APPROVED: 'Approved',
      IN_PROGRESS: 'In Progress',
      IMPLEMENTED: 'Implemented',
      REJECTED: 'Rejected',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      IDENTIFIED: 'bg-violet-100 text-violet-800',
      UNDER_REVIEW: 'bg-yellow-100 text-yellow-800',
      APPROVED: 'bg-violet-100 text-violet-800',
      IN_PROGRESS: 'bg-orange-100 text-orange-800',
      IMPLEMENTED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <CardTitle>Loading...</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 bg-gray-200 animate-pulse rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Rate Inflation by Category */}
      <Card>
        <CardHeader>
          <CardTitle>Rate Inflation by Role Category</CardTitle>
        </CardHeader>
        <CardContent>
          {data.rateInflationByCategory.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data available</p>
          ) : (
            <div className="space-y-3">
              {data.rateInflationByCategory.slice(0, 8).map((item) => (
                <div key={item.category} className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.category}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.count} rates • Avg: {formatCurrency(item.avgRate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getTrendIcon(item.trend)}
                    <span
                      className={`text-sm font-medium ${
                        item.changePercent > 0 ? 'text-red-600' : 'text-green-600'
                      }`}
                    >
                      {item.changePercent >= 0 ? '+' : ''}
                      {item.changePercent.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Supplier Competitiveness */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Top Competitive Suppliers
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.supplierCompetitiveness.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data available</p>
          ) : (
            <div className="space-y-3">
              {data.supplierCompetitiveness.map((supplier, index) => (
                <div key={supplier.supplierName} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                    <div>
                      <p className="text-sm font-medium">{supplier.supplierName}</p>
                      <p className="text-xs text-muted-foreground">
                        Score: {supplier.competitivenessScore.toFixed(1)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-sm font-medium ${
                        supplier.avgRateVsMarket < 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {supplier.avgRateVsMarket >= 0 ? '+' : ''}
                      {supplier.avgRateVsMarket.toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground">vs market</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Savings Pipeline */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Savings Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          {data.savingsPipeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">No opportunities in pipeline</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
              {data.savingsPipeline.map((item) => (
                <div
                  key={item.status}
                  className="p-4 rounded-lg border bg-white"
                >
                  <div className={`inline-block px-2 py-1 rounded-full text-xs mb-2 ${getStatusColor(item.status)}`}>
                    {getStatusLabel(item.status)}
                  </div>
                  <p className="text-2xl font-bold">{formatCurrency(item.totalSavings)}</p>
                  <p className="text-xs text-muted-foreground">{item.count} opportunities</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
