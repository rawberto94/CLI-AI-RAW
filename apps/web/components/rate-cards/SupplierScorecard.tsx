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
  Target,
  Users,
  Activity,
  Zap,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowRight,
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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
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

interface SupplierIntelligence {
  supplierId: string;
  competitiveness: {
    supplierId: string;
    supplierName: string;
    overallScore: number;
    dimensions: {
      priceCompetitiveness: number;
      geographicCoverage: number;
      rateStability: number;
      growthTrajectory: number;
    };
    ranking: number;
    trend: 'improving' | 'declining' | 'stable';
    calculatedAt: string;
  };
  trends: {
    supplierId: string;
    supplierName: string;
    overallTrend: 'improving' | 'declining' | 'stable';
    trendStrength: number;
    avgRateChange: number;
    rateChangeVelocity: number;
    recentRateChanges: Array<{
      date: string;
      avgRate: number;
      changePercent: number;
      changeType: 'increase' | 'decrease' | 'stable';
      magnitude: 'minor' | 'moderate' | 'significant' | 'major';
    }>;
    competitivenessChange: number;
    marketShareTrend: 'growing' | 'shrinking' | 'stable';
    patterns: Array<{
      type: string;
      description: string;
      confidence: number;
      detectedAt: string;
      affectedPeriods: number;
    }>;
    periodsAnalyzed: number;
  };
  rateIncreaseAnalysis: {
    hasAboveMarketIncreases: boolean;
    aboveMarketPeriods: number;
    avgMarketIncrease: number;
    avgSupplierIncrease: number;
    excessIncrease: number;
    severity: 'low' | 'medium' | 'high';
    recommendation: string;
  };
  alternatives: {
    currentSupplierId: string;
    currentSupplierName: string;
    recommendations: Array<{
      supplierId: string;
      supplierName: string;
      supplierTier: string;
      competitivenessScore: number;
      ranking: number;
      rateDifference: number;
      rateDifferenceUSD: number;
      geographicCoverage: number;
      roleCoverage: number;
      coverageGaps: string[];
      switchingRecommendation: 'highly_recommended' | 'recommended' | 'consider' | 'not_recommended';
      switchingScore: number;
      estimatedSavings: number;
      riskFactors: Array<{
        type: string;
        severity: 'low' | 'medium' | 'high';
        description: string;
        impact: string;
      }>;
      riskLevel: 'low' | 'medium' | 'high';
      strengths: string[];
      metrics: {
        avgRate: number;
        currentSupplierAvgRate: number;
        rateStability: number;
        marketPosition: number;
        trendDirection: 'improving' | 'declining' | 'stable';
      };
      similarityToCurrentSupplier: number;
    }>;
    summary: {
      totalAlternatives: number;
      highlyRecommended: number;
      averagePotentialSavings: number;
    };
  } | null;
  generatedAt: string;
}

export function SupplierScorecard({
  supplierId,
  periodMonths = 12,
}: SupplierScorecardProps) {
  const [scorecard, setScorecard] = useState<ScorecardData | null>(null);
  const [stability, setStability] = useState<StabilityData | null>(null);
  const [intelligence, setIntelligence] = useState<SupplierIntelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAlternatives, setShowAlternatives] = useState(false);

  const fetchScorecard = async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // Fetch scorecard data
      const scorecardUrl = `/api/rate-cards/suppliers/${supplierId}/scorecard?periodMonths=${periodMonths}`;
      const scorecardResponse = forceRefresh
        ? await fetch(scorecardUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ periodMonths }),
          })
        : await fetch(scorecardUrl);

      if (!scorecardResponse.ok) {
        throw new Error('Failed to fetch scorecard');
      }

      const scorecardData = await scorecardResponse.json();
      setScorecard(scorecardData.scorecard);
      setStability(scorecardData.stability);

      // Fetch intelligence data
      const intelligenceUrl = `/api/rate-cards/suppliers/${supplierId}/intelligence?monthsBack=${periodMonths}`;
      const intelligenceResponse = await fetch(intelligenceUrl);

      if (intelligenceResponse.ok) {
        const intelligenceData = await intelligenceResponse.json();
        setIntelligence(intelligenceData);
      }
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
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
    if (score >= 60) return { stars: 4, label: 'Good', color: 'text-violet-600' };
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
    return <Minus className="h-4 w-4 text-gray-600 dark:text-slate-400" />;
  };

  const getRecommendationBadge = (recommendation: string) => {
    switch (recommendation) {
      case 'highly_recommended':
        return <Badge className="bg-green-600">Highly Recommended</Badge>;
      case 'recommended':
        return <Badge className="bg-violet-600">Recommended</Badge>;
      case 'consider':
        return <Badge className="bg-yellow-600">Consider</Badge>;
      case 'not_recommended':
        return <Badge variant="destructive">Not Recommended</Badge>;
      default:
        return <Badge variant="secondary">{recommendation}</Badge>;
    }
  };

  const getRiskBadge = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low':
        return <Badge className="bg-green-600">Low Risk</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-600">Medium Risk</Badge>;
      case 'high':
        return <Badge variant="destructive">High Risk</Badge>;
      default:
        return <Badge variant="secondary">{riskLevel}</Badge>;
    }
  };

  const getTrendBadge = (trend: string) => {
    switch (trend) {
      case 'improving':
        return (
          <Badge className="bg-green-600">
            <TrendingUp className="h-3 w-3 mr-1" />
            Improving
          </Badge>
        );
      case 'declining':
        return (
          <Badge variant="destructive">
            <TrendingDown className="h-3 w-3 mr-1" />
            Declining
          </Badge>
        );
      case 'stable':
        return (
          <Badge variant="secondary">
            <Minus className="h-3 w-3 mr-1" />
            Stable
          </Badge>
        );
      default:
        return <Badge variant="secondary">{trend}</Badge>;
    }
  };

  // Prepare radar chart data
  const radarData = intelligence?.competitiveness
    ? [
        {
          dimension: 'Price',
          score: intelligence.competitiveness.dimensions.priceCompetitiveness,
          fullMark: 100,
        },
        {
          dimension: 'Coverage',
          score: intelligence.competitiveness.dimensions.geographicCoverage,
          fullMark: 100,
        },
        {
          dimension: 'Stability',
          score: intelligence.competitiveness.dimensions.rateStability,
          fullMark: 100,
        },
        {
          dimension: 'Growth',
          score: intelligence.competitiveness.dimensions.growthTrajectory,
          fullMark: 100,
        },
      ]
    : [];

  // Prepare historical trend data
  const historicalTrendData = intelligence?.trends?.recentRateChanges?.map((change) => ({
    date: new Date(change.date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    rate: change.avgRate,
    change: change.changePercent,
  })) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{scorecard.supplierName}</h2>
          <p className="text-sm text-gray-600 dark:text-slate-400">
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
              <p className="text-sm text-gray-600 dark:text-slate-400">
                Score: {scorecard.competitivenessScore.toFixed(1)}/100
              </p>
            </div>
            <div className="text-right">
              {scorecard.costRank && (
                <div className="mb-2">
                  <p className="text-sm text-gray-600 dark:text-slate-400">Cost Rank</p>
                  <p className="text-2xl font-bold">#{scorecard.costRank}</p>
                </div>
              )}
              {scorecard.overallRank && (
                <div>
                  <p className="text-sm text-gray-600 dark:text-slate-400">Overall Rank</p>
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
              <DollarSign className="h-4 w-4 text-gray-600 dark:text-slate-400" />
              <p className="text-sm text-gray-600 dark:text-slate-400">Average Rate</p>
            </div>
            <p className="text-2xl font-bold">
              ${scorecard.averageRate.toFixed(0)}
            </p>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Market: ${scorecard.marketAverage.toFixed(0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Briefcase className="h-4 w-4 text-gray-600 dark:text-slate-400" />
              <p className="text-sm text-gray-600 dark:text-slate-400">Total Roles</p>
            </div>
            <p className="text-2xl font-bold">{scorecard.totalRoles}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              {scorecard.totalContracts} contracts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="h-4 w-4 text-gray-600 dark:text-slate-400" />
              <p className="text-sm text-gray-600 dark:text-slate-400">Geographic Coverage</p>
            </div>
            <p className="text-2xl font-bold">
              {scorecard.geographicCoverage.countries.length}
            </p>
            <p className="text-xs text-gray-500 dark:text-slate-400">countries</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              {getTrendIcon()}
              <p className="text-sm text-gray-600 dark:text-slate-400">Rate Trend</p>
            </div>
            <p className="text-2xl font-bold">
              {stability?.overallTrend || 'N/A'}
            </p>
            <p className="text-xs text-gray-500 dark:text-slate-400">
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
                  className="bg-violet-600 h-2 rounded-full"
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
                      className="bg-violet-600 h-2 rounded-full"
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
              <p className="text-sm text-gray-600 dark:text-slate-400 mb-1">Total Annual Value</p>
              <p className="text-2xl font-bold">
                ${scorecard.totalAnnualValue.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-slate-400 mb-1">Potential Savings</p>
              <p className="text-2xl font-bold text-green-600">
                ${scorecard.potentialSavings.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-slate-400 mb-1">Data Quality Score</p>
              <p className="text-2xl font-bold">
                {scorecard.dataQualityScore.toFixed(0)}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Intelligence Data Section */}
      {intelligence && (
        <>
          {/* Multi-Factor Competitiveness Radar Chart */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Multi-Factor Competitiveness Analysis
                  </CardTitle>
                  <CardDescription>
                    Comprehensive scoring across key performance dimensions
                  </CardDescription>
                </div>
                <div className="text-right">
                  {getTrendBadge(intelligence.competitiveness.trend)}
                  <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                    Rank #{intelligence.competitiveness.ranking}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Radar Chart */}
                <div>
                  <ResponsiveContainer width="100%" height={300}>
                    <RadarChart data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="dimension" />
                      <PolarRadiusAxis angle={90} domain={[0, 100]} />
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
                </div>

                {/* Dimension Scores */}
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-gray-600 dark:text-slate-400" />
                        <span className="text-sm font-medium">Price Competitiveness</span>
                      </div>
                      <span className="text-sm font-bold">
                        {intelligence.competitiveness.dimensions.priceCompetitiveness.toFixed(1)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-violet-600 h-2 rounded-full"
                        style={{
                          width: `${intelligence.competitiveness.dimensions.priceCompetitiveness}%`,
                        }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-gray-600 dark:text-slate-400" />
                        <span className="text-sm font-medium">Geographic Coverage</span>
                      </div>
                      <span className="text-sm font-bold">
                        {intelligence.competitiveness.dimensions.geographicCoverage.toFixed(1)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full"
                        style={{
                          width: `${intelligence.competitiveness.dimensions.geographicCoverage}%`,
                        }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-gray-600 dark:text-slate-400" />
                        <span className="text-sm font-medium">Rate Stability</span>
                      </div>
                      <span className="text-sm font-bold">
                        {intelligence.competitiveness.dimensions.rateStability.toFixed(1)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-violet-600 h-2 rounded-full"
                        style={{
                          width: `${intelligence.competitiveness.dimensions.rateStability}%`,
                        }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-gray-600 dark:text-slate-400" />
                        <span className="text-sm font-medium">Growth Trajectory</span>
                      </div>
                      <span className="text-sm font-bold">
                        {intelligence.competitiveness.dimensions.growthTrajectory.toFixed(1)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-orange-600 h-2 rounded-full"
                        style={{
                          width: `${intelligence.competitiveness.dimensions.growthTrajectory}%`,
                        }}
                      ></div>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Overall Score</span>
                      <span className="text-2xl font-bold text-violet-600">
                        {intelligence.competitiveness.overallScore.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Historical Trends */}
          {historicalTrendData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Historical Performance Trends
                </CardTitle>
                <CardDescription>
                  Rate changes and patterns over the past {intelligence.trends.periodsAnalyzed} periods
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Trend Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-slate-400 mb-1">Overall Trend</p>
                      <div className="flex items-center gap-2">
                        {getTrendBadge(intelligence.trends.overallTrend)}
                        <span className="text-sm text-gray-600 dark:text-slate-400">
                          ({intelligence.trends.trendStrength.toFixed(0)}% strength)
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-slate-400 mb-1">Avg Rate Change</p>
                      <p className={`text-xl font-bold ${
                        intelligence.trends.avgRateChange < 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {intelligence.trends.avgRateChange > 0 ? '+' : ''}
                        {intelligence.trends.avgRateChange.toFixed(2)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-slate-400 mb-1">Market Share</p>
                      <div className="flex items-center gap-2">
                        {intelligence.trends.marketShareTrend === 'growing' && (
                          <Badge className="bg-green-600">Growing</Badge>
                        )}
                        {intelligence.trends.marketShareTrend === 'shrinking' && (
                          <Badge variant="destructive">Shrinking</Badge>
                        )}
                        {intelligence.trends.marketShareTrend === 'stable' && (
                          <Badge variant="secondary">Stable</Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Historical Chart */}
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={historicalTrendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip />
                      <Legend />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="rate"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        name="Avg Rate ($)"
                        dot={{ r: 4 }}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="change"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        name="Change (%)"
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>

                  {/* Detected Patterns */}
                  {intelligence.trends.patterns.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-3">Detected Patterns</h4>
                      <div className="space-y-2">
                        {intelligence.trends.patterns.map((pattern, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-3 p-3 bg-violet-50 rounded-lg"
                          >
                            <AlertTriangle className="h-5 w-5 text-violet-600 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-sm font-medium">{pattern.description}</p>
                              <p className="text-xs text-gray-600 dark:text-slate-400 mt-1">
                                Confidence: {pattern.confidence.toFixed(0)}% • 
                                Affected {pattern.affectedPeriods} periods
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Rate Increase Analysis */}
                  {intelligence.rateIncreaseAnalysis.hasAboveMarketIncreases && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-red-900 mb-2">
                            Above-Market Rate Increases Detected
                          </h4>
                          <p className="text-sm text-red-800 mb-3">
                            {intelligence.rateIncreaseAnalysis.recommendation}
                          </p>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-red-700">Supplier Increase</p>
                              <p className="font-bold text-red-900">
                                +{intelligence.rateIncreaseAnalysis.avgSupplierIncrease.toFixed(2)}%
                              </p>
                            </div>
                            <div>
                              <p className="text-red-700">Market Increase</p>
                              <p className="font-bold text-red-900">
                                +{intelligence.rateIncreaseAnalysis.avgMarketIncrease.toFixed(2)}%
                              </p>
                            </div>
                          </div>
                        </div>
                        <Badge variant="destructive">
                          {intelligence.rateIncreaseAnalysis.severity.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Alternative Suppliers */}
          {intelligence.alternatives && intelligence.alternatives.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Alternative Supplier Recommendations
                    </CardTitle>
                    <CardDescription>
                      {intelligence.alternatives.summary.totalAlternatives} alternatives analyzed •{' '}
                      {intelligence.alternatives.summary.highlyRecommended} highly recommended
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAlternatives(!showAlternatives)}
                  >
                    {showAlternatives ? 'Hide' : 'Show'} Details
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Summary */}
                <div className="mb-6 p-4 bg-violet-50 rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-slate-400 mb-1">Best Alternative</p>
                      <p className="text-lg font-bold">
                        {intelligence.alternatives.recommendations[0]?.supplierName || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-slate-400 mb-1">Potential Savings</p>
                      <p className="text-lg font-bold text-green-600">
                        ${intelligence.alternatives.recommendations[0]?.estimatedSavings.toLocaleString() || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-slate-400 mb-1">Switching Score</p>
                      <p className="text-lg font-bold text-violet-600">
                        {intelligence.alternatives.recommendations[0]?.switchingScore.toFixed(1) || 0}/100
                      </p>
                    </div>
                  </div>
                </div>

                {/* Detailed Recommendations */}
                {showAlternatives && (
                  <div className="space-y-4">
                    {intelligence.alternatives.recommendations.slice(0, 5).map((alt, idx) => (
                      <div
                        key={alt.supplierId}
                        className="p-4 border rounded-lg hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-semibold text-lg">{alt.supplierName}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary">{alt.supplierTier}</Badge>
                              {getRecommendationBadge(alt.switchingRecommendation)}
                              {getRiskBadge(alt.riskLevel)}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-600 dark:text-slate-400">Rank #{alt.ranking}</p>
                            <p className="text-2xl font-bold text-violet-600">
                              {alt.switchingScore.toFixed(1)}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                          <div>
                            <p className="text-xs text-gray-600 dark:text-slate-400">Rate Difference</p>
                            <p className={`text-sm font-bold ${
                              alt.rateDifference < 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {alt.rateDifference > 0 ? '+' : ''}
                              {alt.rateDifference.toFixed(1)}%
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 dark:text-slate-400">Est. Savings</p>
                            <p className="text-sm font-bold text-green-600">
                              ${alt.estimatedSavings.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 dark:text-slate-400">Geo Coverage</p>
                            <p className="text-sm font-bold">
                              {alt.geographicCoverage.toFixed(0)}%
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 dark:text-slate-400">Role Coverage</p>
                            <p className="text-sm font-bold">
                              {alt.roleCoverage.toFixed(0)}%
                            </p>
                          </div>
                        </div>

                        {/* Strengths */}
                        {alt.strengths.length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-2">Strengths</p>
                            <div className="flex flex-wrap gap-2">
                              {alt.strengths.map((strength, sIdx) => (
                                <div
                                  key={sIdx}
                                  className="flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-1 rounded"
                                >
                                  <CheckCircle className="h-3 w-3" />
                                  {strength}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Risk Factors */}
                        {alt.riskFactors.length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-2">Risk Factors</p>
                            <div className="space-y-1">
                              {alt.riskFactors.map((risk, rIdx) => (
                                <div
                                  key={rIdx}
                                  className="flex items-start gap-2 text-xs bg-yellow-50 text-yellow-800 px-2 py-1 rounded"
                                >
                                  <XCircle className="h-3 w-3 mt-0.5" />
                                  <div>
                                    <p className="font-medium">{risk.description}</p>
                                    <p className="text-yellow-700">{risk.impact}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Coverage Gaps */}
                        {alt.coverageGaps.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-2">Coverage Gaps</p>
                            <div className="space-y-1">
                              {alt.coverageGaps.map((gap, gIdx) => (
                                <p key={gIdx} className="text-xs text-gray-600 dark:text-slate-400">
                                  • {gap}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
