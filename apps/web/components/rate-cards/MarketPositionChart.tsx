'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface MarketPositionChartProps {
  metrics: any;
}

export function MarketPositionChart({ metrics }: MarketPositionChartProps) {
  const percentiles = [
    { label: 'P25', value: 25, color: 'bg-green-500' },
    { label: 'P50', value: 50, color: 'bg-violet-500' },
    { label: 'P75', value: 75, color: 'bg-yellow-500' },
    { label: 'P90', value: 90, color: 'bg-red-500' },
  ];

  const yourPosition = metrics.marketPosition.percentile;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Market Position Comparison</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Visual representation */}
          <div className="relative h-16 bg-gradient-to-r from-violet-100 via-yellow-100 to-red-100 rounded-lg">
            {/* Percentile markers */}
            {percentiles.map((p) => (
              <div
                key={p.label}
                className="absolute top-0 bottom-0 w-0.5 bg-gray-400"
                style={{ left: `${p.value}%` }}
              >
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs text-muted-foreground">
                  {p.label}
                </div>
              </div>
            ))}

            {/* Your position marker */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-violet-600 border-2 border-white shadow-lg"
              style={{ left: `${yourPosition}%`, marginLeft: '-8px' }}
            >
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-sm font-semibold">
                You ({yourPosition}th)
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-8">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-sm">Excellent (90-100)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-violet-500" />
              <span className="text-sm">Good (75-89)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <span className="text-sm">Average (60-74)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-sm">Below Avg (&lt;60)</span>
            </div>
          </div>

          {/* Interpretation */}
          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              {yourPosition >= 75 ? (
                <>
                  Your rates are <strong>competitive</strong>. You&apos;re performing better than{' '}
                  {yourPosition}% of the market.
                </>
              ) : yourPosition >= 50 ? (
                <>
                  Your rates are <strong>average</strong>. There&apos;s room for improvement to reach
                  top-tier competitiveness.
                </>
              ) : (
                <>
                  Your rates are <strong>above market average</strong>. Significant opportunities
                  exist for cost reduction.
                </>
              )}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
