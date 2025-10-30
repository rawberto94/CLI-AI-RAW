'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface GeographicData {
  region: string;
  country?: string;
  avgRate: number;
  rateCount: number;
  percentile: number;
}

interface GeographicHeatMapProps {
  data: GeographicData[];
  title?: string;
  description?: string;
  metric?: 'avgRate' | 'rateCount' | 'percentile';
}

export function GeographicHeatMap({
  data,
  title = 'Geographic Rate Distribution',
  description = 'Average rates by region',
  metric = 'avgRate',
}: GeographicHeatMapProps) {
  const { min, max, colorScale } = useMemo(() => {
    const values = data.map((d) => d[metric]);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);

    const getColor = (value: number) => {
      const normalized = (value - minVal) / (maxVal - minVal);
      
      // Color gradient from green (low) to red (high)
      if (normalized < 0.33) {
        const intensity = Math.round(normalized * 3 * 255);
        return `rgb(${intensity}, 200, ${intensity})`;
      } else if (normalized < 0.67) {
        const intensity = Math.round((normalized - 0.33) * 3 * 255);
        return `rgb(255, ${200 - intensity}, 0)`;
      } else {
        const intensity = Math.round((normalized - 0.67) * 3 * 100);
        return `rgb(${200 + intensity}, ${50 - intensity / 2}, 0)`;
      }
    };

    return { min: minVal, max: maxVal, colorScale: getColor };
  }, [data, metric]);

  const formatValue = (value: number) => {
    if (metric === 'avgRate') return `$${value.toFixed(2)}/hr`;
    if (metric === 'percentile') return `${value.toFixed(0)}th`;
    return value.toString();
  };

  const getMetricLabel = () => {
    if (metric === 'avgRate') return 'Average Rate';
    if (metric === 'rateCount') return 'Rate Count';
    return 'Percentile';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Legend */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{getMetricLabel()}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Low</span>
              <div className="flex h-4 w-32 rounded">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1"
                    style={{
                      backgroundColor: colorScale(min + (i / 19) * (max - min)),
                    }}
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">High</span>
            </div>
          </div>

          {/* Heat Map Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {data.map((item) => {
              const value = item[metric];
              const color = colorScale(value);

              return (
                <div
                  key={item.region}
                  className="relative rounded-lg p-4 transition-all hover:scale-105 hover:shadow-lg cursor-pointer"
                  style={{ backgroundColor: color }}
                >
                  <div className="space-y-1">
                    <div className="font-semibold text-white drop-shadow-md">
                      {item.region}
                    </div>
                    {item.country && (
                      <div className="text-xs text-white/90 drop-shadow">
                        {item.country}
                      </div>
                    )}
                    <div className="text-lg font-bold text-white drop-shadow-md">
                      {formatValue(value)}
                    </div>
                    <div className="text-xs text-white/80 drop-shadow">
                      {item.rateCount} rates
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t">
            <div className="text-center">
              <div className="text-sm text-muted-foreground">Lowest</div>
              <div className="text-lg font-semibold">{formatValue(min)}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-muted-foreground">Average</div>
              <div className="text-lg font-semibold">
                {formatValue(data.reduce((sum, d) => sum + d[metric], 0) / data.length)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-muted-foreground">Highest</div>
              <div className="text-lg font-semibold">{formatValue(max)}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
