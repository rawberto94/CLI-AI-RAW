/**
 * Compliance Trend Chart
 * Visualize compliance trends over time
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface TrendDataPoint {
  date: string;
  compliant: number;
  warning: number;
  nonCompliant: number;
  total: number;
}

interface ComplianceTrendChartProps {
  data: TrendDataPoint[];
  isLoading?: boolean;
}

export function ComplianceTrendChart({ data, isLoading }: ComplianceTrendChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Compliance Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse h-64 bg-gray-200 rounded" />
        </CardContent>
      </Card>
    );
  }

  const latestData = data[data.length - 1];
  const previousData = data[data.length - 2];

  const latestCompliance = latestData
    ? Math.round((latestData.compliant / latestData.total) * 100)
    : 0;
  const previousCompliance = previousData
    ? Math.round((previousData.compliant / previousData.total) * 100)
    : 0;

  const trend = latestCompliance - previousCompliance;
  const getTrendIcon = () => {
    if (trend > 0) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (trend < 0) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-gray-600" />;
  };

  const getTrendColor = () => {
    if (trend > 0) return 'text-green-600';
    if (trend < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const maxValue = Math.max(...data.map((d) => d.total));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Compliance Trend</CardTitle>
        <div className="flex items-center gap-2">
          {getTrendIcon()}
          <span className={`font-semibold ${getTrendColor()}`}>
            {trend > 0 ? '+' : ''}
            {trend}%
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4 pb-4 border-b">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {latestData?.compliant || 0}
              </div>
              <div className="text-xs text-muted-foreground">Compliant</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-600">
                {latestData?.warning || 0}
              </div>
              <div className="text-xs text-muted-foreground">Warnings</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {latestData?.nonCompliant || 0}
              </div>
              <div className="text-xs text-muted-foreground">Non-Compliant</div>
            </div>
          </div>

          {/* Simple Bar Chart */}
          <div className="space-y-2">
            {data.slice(-6).map((point, index) => {
              const compliantPct = (point.compliant / point.total) * 100;
              const warningPct = (point.warning / point.total) * 100;
              const nonCompliantPct = (point.nonCompliant / point.total) * 100;

              return (
                <div key={index} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {new Date(point.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <span className="font-medium">
                      {Math.round(compliantPct)}% compliant
                    </span>
                  </div>
                  <div className="flex h-6 rounded overflow-hidden">
                    <div
                      className="bg-green-500"
                      style={{ width: `${compliantPct}%` }}
                      title={`Compliant: ${point.compliant}`}
                    />
                    <div
                      className="bg-amber-500"
                      style={{ width: `${warningPct}%` }}
                      title={`Warning: ${point.warning}`}
                    />
                    <div
                      className="bg-red-500"
                      style={{ width: `${nonCompliantPct}%` }}
                      title={`Non-Compliant: ${point.nonCompliant}`}
                    />
                    {compliantPct + warningPct + nonCompliantPct < 100 && (
                      <div
                        className="bg-gray-200"
                        style={{
                          width: `${100 - compliantPct - warningPct - nonCompliantPct}%`,
                        }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 pt-4 border-t text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-500 rounded" />
              <span>Compliant</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-amber-500 rounded" />
              <span>Warning</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-red-500 rounded" />
              <span>Non-Compliant</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
