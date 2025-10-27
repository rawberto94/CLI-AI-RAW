'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Star,
  TrendingUp,
  TrendingDown,
  Minus,
  MapPin,
  Briefcase,
  DollarSign,
  Award,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';

interface SupplierScorecardProps {
  supplierId: string;
  periodMonths?: number;
}

interface ScorecardData {
  supplierId: string;
  supplierName: string;
  averageRate: number;
  medianRate: number;
  marketAverage: number;
  competitivenessScore: number;
  totalRoles: number;
  totalContracts: number;
  geographicCoverage: {
    countries: string[];
    regions: string[];
    coverageScore: number;
  };
  serviceLineCoverage: {
    linesOfService: string[];
    diversityScore: number;
  };
  rateStability: {
    averageChange: number;
    volatilityScore: number;
  };
  dataQualityScore: number;
  totalAnnualValue: number;
  potentialSavings: number;
  costRank?: number;
  qualityRank?: number;
  overallRank?: number;
}

interface StabilityData {
  supplier: string;
  periods: Array<{
    month: string;
    averageRate: number;
    changePercent: number;
  }>;
  overallTrend: 'INCREASING' | 'DECREASING' | 'STABLE';
  volatility: number;
}

export function SupplierScorecard({
  supplierId,
  periodMonths = 12,
}: SupplierScorecardProps) {
  const [scorecard, setScorecard] = useState<ScorecardData | null>(null);
  const [stability, setStability] = useState<StabilityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchScorecard = async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const url = `/api/rate-cards/suppliers/${supplierId}/scorecard?periodMonths=${periodMonths}`;
      const response = forceRefresh
        ? await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ periodMonths }),
          })
        : await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to fetch scorecard');
      }

      const data = await response.json();
      setScorecard(data.scorecard);
      setStability(data.stability);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchScorecard();
  }, [supplierId, periodMonths]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !scorecard) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <p>{error || 'Failed to load scorecard'}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getCompetitivenessRating = (score: number) => {
    if (score >= 80) return { stars: 5, label: 'Excellent', color: 'text-green-600' };
    if (score >= 60) return { stars: 4, label: 'Good', color: 'text-blue-600' };
    if (score >= 40) return { stars: 3, label: 'Average', color: 'text-yellow-600' };
    if (score >= 20) return { stars: 2, label: 'Below Average', color: 'text-orange-600' };
    return { stars: 1, label: 'Poor', color: 'text-red-600' };
  };

  const rating = getCompetitivenessRating(scorecard.competitivenessScore);

  const getTrendIcon = () => {
    if (!stability) return <Minus className="h-4 w-4" />;
    if (stability.overallTrend === 'INCREASING')
      return <TrendingUp className="h-4 w-4 text-red-600" />;
    if (stability.overallTrend === 'DECREASING')
      return <TrendingDown className="h-4 w-4 text-green-600" />;
    return <Minus className="h-4 w-4 text-gray-600" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{scorecard.supplierName}</h2>
          <p className="text-sm text-gray-600">
            Supplier Performance Scorecard
          </p>
        </div>
        <Button
          onClick={() => fetchScorecard(true)}
          disabled={refreshing}
          variant="outline"
          size="sm"
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`}
          />
          Refresh
        </Button>
      </div>

      {/* Competitiveness Rating */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Competitiveness Rating
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`h-6 w-6 ${
                      i < rating.stars
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-300'
                    }`}
                  />
                ))}
              </div>
              <p className={`text-lg font-semibold ${rating.color}`}>
                {rating.label}
              </p>
              <p className="text-sm text-gray-600">
                Score: {scorecard.competitivenessScore.toFixed(1)}/100
              </p>
            </div>
            <div className="text-right">
              {scorecard.costRank && (
                <div className="mb-2">
                  <p className="text-sm text-gray-600">Cost Rank</p>
                  <p className="text-2xl font-bold">#{scorecard.costRank}</p>
                </div>
              )}
              {scorecard.overallRank && (
                <div>
                  <p className="text-sm text-gray-600">Overall Rank</p>
                  <p className="text-2xl font-bold">#{scorecard.overallRank}</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-gray-600" />
              <p className="text-sm text-gray-600">Average Rate</p>
            </div>
            <p className="text-2xl font-bold">
              ${scorecard.averageRate.toFixed(0)}
            </p>
            <p className="text-xs text-gray-500">
              Market: ${scorecard.marketAverage.toFixed(0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Briefcase className="h-4 w-4 text-gray-600" />
              <p className="text-sm text-gray-600">Total Roles</p>
            </div>
            <p className="text-2xl font-bold">{scorecard.totalRoles}</p>
            <p className="text-xs text-gray-500">
              {scorecard.totalContracts} contracts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="h-4 w-4 text-gray-600" />
              <p className="text-sm text-gray-600">Geographic Coverage</p>
            </div>
            <p className="text-2xl font-bold">
              {scorecard.geographicCoverage.countries.length}
            </p>
            <p className="text-xs text-gray-500">countries</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              {getTrendIcon()}
              <p className="text-sm text-gray-600">Rate Trend</p>
            </div>
            <p className="text-2xl font-bold">
              {stability?.overallTrend || 'N/A'}
            </p>
            <p className="text-xs text-gray-500">
              Volatility: {stability?.volatility.toFixed(1) || 'N/A'}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Rate Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Rate Comparison</CardTitle>
          <CardDescription>
            How this supplier compares to market average
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm">Average Rate</span>
                <span className="text-sm font-medium">
                  ${scorecard.averageRate.toFixed(0)}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{
                    width: `${Math.min(
                      100,
                      (scorecard.averageRate / scorecard.marketAverage) * 100
                    )}%`,
                  }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm">Market Average</span>
                <span className="text-sm font-medium">
                  ${scorecard.marketAverage.toFixed(0)}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-gray-400 h-2 rounded-full w-full"></div>
              </div>
            </div>

            {scorecard.averageRate < scorecard.marketAverage ? (
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <TrendingDown className="h-4 w-4" />
                <span>
                  {(
                    ((scorecard.marketAverage - scorecard.averageRate) /
                      scorecard.marketAverage) *
                    100
                  ).toFixed(1)}
                  % below market average
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <TrendingUp className="h-4 w-4" />
                <span>
                  {(
                    ((scorecard.averageRate - scorecard.marketAverage) /
                      scorecard.marketAverage) *
                    100
                  ).toFixed(1)}
                  % above market average
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Rate Stability Chart */}
      {stability && stability.periods.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Rate Stability Over Time</CardTitle>
            <CardDescription>
              Historical rate trends for the past {periodMonths} months
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stability.periods}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip
                  formatter={(value: any) => [`$${value.toFixed(0)}`, 'Rate']}
                />
                <Line
                  type="monotone"
                  dataKey="averageRate"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Coverage Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Geographic Coverage</CardTitle>
            <CardDescription>
              Countries and regions where supplier operates
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">Countries</p>
                <div className="flex flex-wrap gap-2">
                  {scorecard.geographicCoverage.countries.map((country) => (
                    <Badge key={country} variant="secondary">
                      {country}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Coverage Score</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full"
                      style={{
                        width: `${scorecard.geographicCoverage.coverageScore}%`,
                      }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium">
                    {scorecard.geographicCoverage.coverageScore.toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Service Line Coverage</CardTitle>
            <CardDescription>
              Diversity of services offered by supplier
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">Lines of Service</p>
                <div className="flex flex-wrap gap-2">
                  {scorecard.serviceLineCoverage.linesOfService.map((los) => (
                    <Badge key={los} variant="secondary">
                      {los}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Diversity Score</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{
                        width: `${scorecard.serviceLineCoverage.diversityScore}%`,
                      }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium">
                    {scorecard.serviceLineCoverage.diversityScore.toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Financial Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Financial Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Annual Value</p>
              <p className="text-2xl font-bold">
                ${scorecard.totalAnnualValue.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Potential Savings</p>
              <p className="text-2xl font-bold text-green-600">
                ${scorecard.potentialSavings.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Data Quality Score</p>
              <p className="text-2xl font-bold">
                {scorecard.dataQualityScore.toFixed(0)}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
