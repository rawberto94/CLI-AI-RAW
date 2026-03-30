'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ForecastsList } from '@/components/rate-cards/ForecastsList';
import { HighRiskRatesAlert } from '@/components/rate-cards/HighRiskRatesAlert';
import { motion } from 'framer-motion';
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
    } catch {
      toast.error('Failed to export forecasts');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/30 to-violet-50/20">
      <div className="container mx-auto py-8 space-y-6">
        {/* Page Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl shadow-lg shadow-violet-500/25">
              <TrendingUp className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
                Rate Forecasts
              </h1>
              <p className="text-slate-600 mt-1">
                Predictive analytics and trend forecasts for your rate cards
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={loading}
              className="bg-white/80 backdrop-blur-sm border-white/50 hover:bg-white"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              onClick={handleExport}
              className="bg-white/80 backdrop-blur-sm border-white/50 hover:bg-white"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </motion.div>

        {/* High-Risk Rates Alert */}
        <HighRiskRatesAlert
          tenantId={tenantId}
          minRiskScore={60}
          limit={5}
          autoRefresh={true}
          refreshInterval={300}
        />

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-white/90 backdrop-blur-sm border-white/50 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Risk Level
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
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
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Trend Direction
              </label>
              <select
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
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
              <label htmlFor="minConfidence" className="block text-sm font-medium text-slate-700 mb-2">
                Min Confidence (%)
              </label>
              <input
                id="minConfidence"
                type="number"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
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
        </motion.div>

        {/* Loading State */}
        {loading && forecasts.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Card className="bg-white/90 backdrop-blur-sm border-white/50 shadow-lg">
              <CardContent className="py-12">
                <div className="flex flex-col items-center justify-center">
                  <div className="p-4 bg-gradient-to-br from-violet-500 to-violet-600 rounded-2xl shadow-lg shadow-violet-500/25 mb-4">
                    <RefreshCw className="w-8 h-8 text-white animate-spin" />
                  </div>
                  <p className="text-slate-600 font-medium">Loading forecasts...</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Error State */}
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Card className="bg-white/90 backdrop-blur-sm border-white/50 shadow-lg border-l-4 border-l-red-500">
              <CardContent className="py-8">
                <div className="text-center text-red-600">
                  {error}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Forecasts List */}
        {!loading && !error && forecasts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <ForecastsList 
              forecasts={forecasts} 
              showFilters={true}
            />
          </motion.div>
        )}

        {/* Empty State */}
        {!loading && !error && forecasts.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Card className="bg-white/90 backdrop-blur-sm border-white/50 shadow-lg">
              <CardContent className="py-12">
                <div className="text-center text-slate-500">
                  <div className="p-4 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl inline-block mb-4">
                    <TrendingUp className="w-12 h-12 text-slate-400" />
                  </div>
                  <p className="text-lg font-medium mb-2 text-slate-700">No forecasts found</p>
                  <p className="text-sm text-slate-500">
                    Try adjusting your filters or generate forecasts for your rate cards.
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-white/90 backdrop-blur-sm border-white/50 shadow-lg">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-slate-600">
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
                      className="bg-white/80 hover:bg-white border-white/50"
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-slate-600 px-3">
                      Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={!pagination.hasNextPage}
                      className="bg-white/80 hover:bg-white border-white/50"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}
