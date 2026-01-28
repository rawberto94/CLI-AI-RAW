'use client';

/**
 * Extraction Insights Dashboard
 * 
 * Displays real-time AI extraction performance metrics,
 * quality scores, trends, and recommendations.
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  useExtractionInsights,
  getTrendIcon,
  getTrendColor,
  getGradeColor,
  formatProcessingTime,
  formatPercentage,
} from '@/hooks/useExtractionInsights';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  Info,
  Zap,
  Target,
  Clock,
  ThumbsUp,
  Brain,
  Lightbulb,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExtractionInsightsDashboardProps {
  tenantId?: string;
  className?: string;
  compact?: boolean;
}

export function ExtractionInsightsDashboard({
  tenantId,
  className = '',
  compact = false,
}: ExtractionInsightsDashboardProps) {
  const {
    insights,
    quality,
    loading,
    error,
    refresh,
  } = useExtractionInsights({
    tenantId,
    autoRefresh: true,
    refreshInterval: 60000, // Refresh every minute
  });

  if (loading && !insights) {
    return (
      <div className={cn('flex items-center justify-center p-8', className)}>
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading insights...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!insights || !quality) {
    return null;
  }

  const TrendIcon = ({ trend }: { trend: 'improving' | 'stable' | 'declining' }) => {
    if (trend === 'improving') return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (trend === 'declining') return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-gray-500" />;
  };

  const AlertIcon = ({ type }: { type: 'warning' | 'error' | 'info' }) => {
    if (type === 'error') return <AlertCircle className="h-4 w-4 text-red-600" />;
    if (type === 'warning') return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    return <Info className="h-4 w-4 text-violet-600" />;
  };

  if (compact) {
    return (
      <Card className={className}>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={cn(
                'text-2xl font-bold px-3 py-1 rounded-lg',
                getGradeColor(quality.grade)
              )}>
                {quality.grade}
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Extraction Quality</div>
                <div className="text-lg font-semibold">{quality.score}/100</div>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-1">
                <TrendIcon trend={insights.trends.successRateTrend} />
                <span>{formatPercentage(insights.currentPerformance.successRate)}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={refresh}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {insights.alerts.length > 0 && insights.alerts[0] && (
            <div className="mt-3 flex items-center gap-2">
              <AlertIcon type={insights.alerts[0].type} />
              <span className="text-sm text-muted-foreground">{insights.alerts[0].message}</span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-purple-600" />
            AI Extraction Insights
          </h2>
          <p className="text-muted-foreground">Real-time performance metrics and recommendations</p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Quality Score Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Quality Score
          </CardTitle>
          <CardDescription>Overall extraction quality rating</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className={cn(
              'text-5xl font-bold px-6 py-4 rounded-2xl',
              getGradeColor(quality.grade)
            )}>
              {quality.grade}
            </div>
            <div className="flex-1 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-3xl font-bold">{quality.score}</span>
                <span className="text-muted-foreground">/100</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Accuracy</span>
                    <span>{quality.breakdown.accuracy}%</span>
                  </div>
                  <Progress value={quality.breakdown.accuracy} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Confidence</span>
                    <span>{quality.breakdown.confidence}%</span>
                  </div>
                  <Progress value={quality.breakdown.confidence} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Efficiency</span>
                    <span>{quality.breakdown.efficiency}%</span>
                  </div>
                  <Progress value={quality.breakdown.efficiency} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>User Satisfaction</span>
                    <span>{quality.breakdown.userSatisfaction}%</span>
                  </div>
                  <Progress value={quality.breakdown.userSatisfaction} className="h-2" />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Target className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Success Rate</p>
                  <p className="text-2xl font-bold">
                    {formatPercentage(insights.currentPerformance.successRate)}
                  </p>
                </div>
              </div>
              <TrendIcon trend={insights.trends.successRateTrend} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-violet-100 rounded-lg">
                  <Zap className="h-5 w-5 text-violet-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg Confidence</p>
                  <p className="text-2xl font-bold">
                    {formatPercentage(insights.currentPerformance.avgConfidence)}
                  </p>
                </div>
              </div>
              <TrendIcon trend={insights.trends.confidenceTrend} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Clock className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg Processing Time</p>
                  <p className="text-2xl font-bold">
                    {formatProcessingTime(insights.currentPerformance.avgProcessingTime)}
                  </p>
                </div>
              </div>
              <TrendIcon trend={insights.trends.processingTimeTrend} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {insights.alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {insights.alerts.map((alert, index) => (
              <Alert
                key={index}
                variant={alert.type === 'error' ? 'destructive' : 'default'}
                className={cn(
                  alert.type === 'warning' && 'border-yellow-500 bg-yellow-50',
                  alert.type === 'info' && 'border-violet-500 bg-violet-50'
                )}
              >
                <AlertIcon type={alert.type} />
                <AlertDescription className="ml-2">
                  {alert.message}
                  {alert.fieldType && (
                    <Badge variant="outline" className="ml-2">{alert.fieldType}</Badge>
                  )}
                </AlertDescription>
              </Alert>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {insights.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-500" />
              Recommendations
            </CardTitle>
            <CardDescription>Suggestions to improve extraction quality</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {insights.recommendations.map((recommendation, index) => (
                <li key={index} className="flex items-start gap-3">
                  <div className="mt-1 p-1 bg-yellow-100 rounded">
                    <ThumbsUp className="h-4 w-4 text-yellow-600" />
                  </div>
                  <span className="text-sm">{recommendation}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default ExtractionInsightsDashboard;
