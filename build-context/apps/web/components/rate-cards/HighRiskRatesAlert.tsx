'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, TrendingUp, ExternalLink, RefreshCw } from 'lucide-react';
import Link from 'next/link';

// ============================================================================
// Types
// ============================================================================

interface HighRiskRate {
  rateCardEntryId: string;
  role: string;
  supplier: string;
  country: string;
  currentRate: number;
  projectedSixMonthRate: number;
  quarterOverQuarterChange: number;
  riskScore: number;
  riskFactors: string[];
  rateCard?: {
    id: string;
    role: string;
    country: string;
    supplier: string;
    seniority?: string;
    lineOfService?: string;
  };
}

interface HighRiskRatesAlertProps {
  tenantId: string;
  minRiskScore?: number;
  limit?: number;
  autoRefresh?: boolean;
  refreshInterval?: number; // in seconds
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function getRiskScoreColor(score: number): string {
  if (score >= 80) return 'text-red-700 bg-red-100';
  if (score >= 60) return 'text-orange-700 bg-orange-100';
  if (score >= 40) return 'text-yellow-700 bg-yellow-100';
  return 'text-green-700 bg-green-100';
}

// ============================================================================
// High Risk Rates Alert Component
// ============================================================================

export function HighRiskRatesAlert({
  tenantId,
  minRiskScore = 60,
  limit = 5,
  autoRefresh = false,
  refreshInterval = 300, // 5 minutes default
}: HighRiskRatesAlertProps) {
  const [highRiskRates, setHighRiskRates] = useState<HighRiskRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchHighRiskRates = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        tenantId,
        minRiskScore: minRiskScore.toString(),
        limit: limit.toString(),
      });

      const response = await fetch(`/api/rate-cards/forecasts/high-risk?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch high-risk rates');
      }

      const result = await response.json();
      setHighRiskRates(result.data || []);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHighRiskRates();

    if (autoRefresh && refreshInterval > 0) {
      const interval = setInterval(fetchHighRiskRates, refreshInterval * 1000);
      return () => clearInterval(interval);
    }
    
  }, [tenantId, minRiskScore, limit, autoRefresh, refreshInterval]);

  if (loading && !highRiskRates.length) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            High-Risk Rates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            High-Risk Rates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-red-600 p-4 bg-red-50 rounded-lg">
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (highRiskRates.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-green-600" />
            High-Risk Rates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-600 p-4 bg-green-50 rounded-lg">
            No high-risk rates detected. All rates are within acceptable thresholds.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            High-Risk Rates
            <Badge variant="destructive" className="ml-2">
              {highRiskRates.length}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            {lastUpdated && (
              <span className="text-xs text-gray-500">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchHighRiskRates}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {highRiskRates.map((rate) => (
            <div
              key={rate.rateCardEntryId}
              className="p-4 border border-red-200 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="font-medium text-gray-900 mb-1">
                    {rate.rateCard?.role || rate.role}
                  </div>
                  <div className="text-sm text-gray-600">
                    {rate.rateCard?.supplier || rate.supplier} • {rate.rateCard?.country || rate.country}
                    {rate.rateCard?.seniority && ` • ${rate.rateCard.seniority}`}
                  </div>
                </div>
                <div className={`px-2 py-1 rounded text-xs font-semibold ${getRiskScoreColor(rate.riskScore)}`}>
                  Risk: {rate.riskScore.toFixed(0)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <div className="text-xs text-gray-600">Current Rate</div>
                  <div className="text-sm font-semibold text-gray-900">
                    {formatCurrency(rate.currentRate)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-600">6-Mo Projection</div>
                  <div className="text-sm font-semibold text-red-700 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    {formatCurrency(rate.projectedSixMonthRate)}
                  </div>
                </div>
              </div>

              <div className="mb-3">
                <div className="text-xs text-gray-600 mb-1">QoQ Change</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-red-600 h-2 rounded-full"
                      style={{ width: `${Math.min(rate.quarterOverQuarterChange, 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-red-700">
                    +{rate.quarterOverQuarterChange.toFixed(1)}%
                  </span>
                </div>
              </div>

              {rate.riskFactors && rate.riskFactors.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs text-gray-600 mb-1">Risk Factors</div>
                  <div className="flex flex-wrap gap-1">
                    {rate.riskFactors.slice(0, 3).map((factor, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {factor}
                      </Badge>
                    ))}
                    {rate.riskFactors.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{rate.riskFactors.length - 3} more
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-red-200">
                <div className="text-xs text-gray-600">
                  Potential savings: {formatCurrency((rate.projectedSixMonthRate - rate.currentRate) * 250)}
                </div>
                <Link href={`/rate-cards/entries?id=${rate.rateCardEntryId}`}>
                  <Button variant="ghost" size="sm" className="text-xs">
                    View Details
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>

        {highRiskRates.length >= limit && (
          <div className="mt-4 text-center">
            <Link href="/rate-cards/forecasts?riskLevel=high">
              <Button variant="outline" size="sm">
                View All High-Risk Rates
                <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
