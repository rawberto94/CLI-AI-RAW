'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Star, AlertTriangle, TrendingUp, CheckCircle } from 'lucide-react';

interface BaselineMetrics {
  totalBaselines: number;
  baselineTypes: Record<string, number>;
  compliancePercentage: number;
  averageVariance: number;
  atRiskCount: number;
  compliantCount: number;
}

interface BaselineTrackingWidgetProps {
  metrics: BaselineMetrics;
  loading?: boolean;
}

export function BaselineTrackingWidget({
  metrics,
  loading = false,
}: BaselineTrackingWidgetProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            Baseline Tracking
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            Loading...
          </div>
        </CardContent>
      </Card>
    );
  }

  const getComplianceColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getComplianceStatus = (percentage: number) => {
    if (percentage >= 90) return 'Excellent';
    if (percentage >= 70) return 'Good';
    return 'Needs Attention';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="h-5 w-5 text-indigo-600" />
          Baseline Tracking
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-4 rounded-lg bg-indigo-50">
            <div className="text-3xl font-bold text-indigo-600">
              {metrics.totalBaselines ?? 0}
            </div>
            <div className="text-sm text-indigo-700">Total Baselines</div>
          </div>
          <div className="text-center p-4 rounded-lg bg-muted">
            <div className={`text-3xl font-bold ${getComplianceColor(metrics.compliancePercentage ?? 0)}`}>
              {(metrics.compliancePercentage ?? 0).toFixed(1)}%
            </div>
            <div className="text-sm text-muted-foreground">Compliance</div>
          </div>
        </div>

        {/* Compliance Progress */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Compliance Status</span>
            <Badge
              variant={(metrics.compliancePercentage ?? 0) >= 90 ? 'default' : 'secondary'}
              className={
                (metrics.compliancePercentage ?? 0) >= 90
                  ? 'bg-green-100 text-green-700'
                  : (metrics.compliancePercentage ?? 0) >= 70
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-red-100 text-red-700'
              }
            >
              {getComplianceStatus(metrics.compliancePercentage ?? 0)}
            </Badge>
          </div>
          <Progress value={metrics.compliancePercentage ?? 0} className="h-2" />
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span>{metrics.compliantCount ?? 0} compliant</span>
            <span>{metrics.atRiskCount ?? 0} at risk</span>
          </div>
        </div>

        {/* Baseline Types Breakdown */}
        <div>
          <h4 className="text-sm font-semibold mb-3">Baseline Types</h4>
          <div className="space-y-2">
            {Object.entries(metrics.baselineTypes || {}).map(([type, count]) => (
              <div
                key={type}
                className="flex items-center justify-between p-2 rounded bg-muted/50"
              >
                <span className="text-sm">{type}</span>
                <Badge variant="outline">{count}</Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Variance Summary */}
        <div className="p-3 rounded-lg bg-muted">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Avg. Variance</span>
            </div>
            <span
              className={`text-lg font-bold ${
                Math.abs(metrics.averageVariance ?? 0) > 10
                  ? 'text-red-600'
                  : 'text-green-600'
              }`}
            >
              {(metrics.averageVariance ?? 0) > 0 ? '+' : ''}
              {(metrics.averageVariance ?? 0).toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Alerts */}
        {(metrics.atRiskCount ?? 0) > 0 && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <div className="font-medium text-red-900">At-Risk Baselines</div>
                <div className="text-sm text-red-700">
                  {metrics.atRiskCount ?? 0} baselines exceed variance threshold
                </div>
              </div>
            </div>
          </div>
        )}

        {(metrics.compliancePercentage ?? 0) >= 90 && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <div className="font-medium text-green-900">
                  Excellent Compliance
                </div>
                <div className="text-sm text-green-700">
                  Your baseline compliance is above target
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
