'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ForecastsList } from '@/components/rate-cards/ForecastsList';
import { HighRiskRatesAlert } from '@/components/rate-cards/HighRiskRatesAlert';
import { RefreshCw, Download, TrendingUp } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface ForecastPrediction {
  rate: number;
  confidence: number;
  percentChange: number;
}

interface ForecastItem {
  id: string;
  rateCardId: string;
  rateCard: {
    id: string;
    role: string;
    currentRate: number;
    country: string;
    supplier: string;
    seniority?: string;
    lineOfService?: string;
  };
  currentRate: number;
  forecastDate: Date;
  predictions: {
    threeMonth: ForecastPrediction;
    sixMonth: ForecastPrediction;
    twelveMonth: ForecastPrediction;
  };
  trendDirection: 'increasing' | 'decreasing' | 'stable';
  trendCoefficient: number;
  riskLevel: 'low' | 'medium' | 'high';
  confidence: number;
  historicalDataPoints: number;
  createdAt: Date;
}

interface PaginationInfo {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// ============================================================================
// Rate Card Forecasts Page
// ============================================================================

export default function RateCardForecastsPage() {
  const [forecasts, setForecasts] = useState<ForecastItem[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Filters
  const [riskLevel, setRiskLevel] = useState<string>('');
  const [trendDirection, setTrendDirection] = useState<string>('');
  const [minConfidence, setMinConfidence] = useState<number>(0);

  // Get tenant ID from user context (you may need to adjust this based on your auth setup)
  const tenantId = 'default-tenant'; // Replace with actual tenant ID from context

  const fetchForecasts = async (page: number = 1) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      if (riskLevel) params.append('riskLevel', riskLevel);
      if (trendDirection) params.append('trendDirection', trendDirection);
      if (minConfidence > 0) params.append('minConfidence', minConfidence.toString());

      const response = await fetch(`/api/rate-cards/forecasts?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch forecasts');
      }

      const result = await response.json();
      setForecasts(result.data || []);
      setPagination(result.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching forecasts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchForecasts(currentPage);
  }, [currentPage, riskLevel, trendDirection, minConfidence]);

  const handleRefresh = () => {
    fetchForecasts(currentPage);
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        format: 'csv',
      });

      if (riskLevel) params.append('riskLevel', riskLevel);
      if (trendDirection) params.append('trendDirection', trendDirection);
      if (minConfidence > 0) params.append('minConfidence', minConfidence.toString());

      const response = await fetch(`/api/rate-cards/forecasts/export?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to export forecasts');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rate-forecasts-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error exporting forecasts:', err);
      alert('Failed to export forecasts');
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-8 h-8" />
            Rate Forecasts
          </h1>
          <p className="text-gray-600 mt-1">
            Predictive analytics and trend forecasts for your rate cards
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={handleExport}
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* High-Risk Rates Alert */}
      <HighRiskRatesAlert
        tenantId={tenantId}
        minRiskScore={60}
        limit={5}
        autoRefresh={true}
        refreshInterval={300}
      />

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Risk Level
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                value={riskLevel}
                onChange={(e) => {
                  setRiskLevel(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="">All</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Trend Direction
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                value={trendDirection}
                onChange={(e) => {
                  setTrendDirection(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="">All</option>
                <option value="increasing">Increasing</option>
                <option value="stable">Stable</option>
                <option value="decreasing">Decreasing</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Min Confidence (%)
              </label>
              <input
                type="number"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                value={minConfidence || ''}
                onChange={(e) => {
                  setMinConfidence(parseInt(e.target.value) || 0);
                  setCurrentPage(1);
                }}
                min="0"
                max="100"
                placeholder="0"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {loading && forecasts.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="flex items-center justify-center">
              <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-red-600">
              {error}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Forecasts List */}
      {!loading && !error && forecasts.length > 0 && (
        <ForecastsList 
          forecasts={forecasts} 
          showFilters={true}
        />
      )}

      {/* Empty State */}
      {!loading && !error && forecasts.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-gray-500">
              <TrendingUp className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium mb-2">No forecasts found</p>
              <p className="text-sm">
                Try adjusting your filters or generate forecasts for your rate cards.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.totalCount)} of{' '}
                {pagination.totalCount} forecasts
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={!pagination.hasPreviousPage}
                >
                  Previous
                </Button>
                <span className="text-sm text-gray-600">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={!pagination.hasNextPage}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
