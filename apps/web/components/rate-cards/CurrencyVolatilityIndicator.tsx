'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';

interface VolatilityAlert {
  currency: string;
  baseCurrency: string;
  changePercent: number;
  previousRate: number;
  currentRate: number;
  timestamp: Date;
}

interface CurrencyVolatilityIndicatorProps {
  currency: string;
  baseCurrency?: string;
  showDetails?: boolean;
}

export function CurrencyVolatilityIndicator({
  currency,
  baseCurrency = 'USD',
  showDetails = false,
}: CurrencyVolatilityIndicatorProps) {
  const [volatility, setVolatility] = useState<VolatilityAlert | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVolatility();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency, baseCurrency]);

  const fetchVolatility = async () => {
    try {
      const response = await fetch(
        `/api/rate-cards/currency/volatility?baseCurrency=${baseCurrency}`
      );
      const data = await response.json();

      // Find alert for this currency
      const alert = data.alerts?.find((a: VolatilityAlert) => a.currency === currency);
      setVolatility(alert || null);
    } catch (error) {
      console.error('Error fetching currency volatility:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return null;
  }

  if (!volatility) {
    return null;
  }

  const isIncrease = volatility.changePercent > 0;
  const severity =
    Math.abs(volatility.changePercent) > 10
      ? 'high'
      : Math.abs(volatility.changePercent) > 5
      ? 'medium'
      : 'low';

  const severityColors = {
    high: 'bg-red-100 text-red-800 border-red-300',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    low: 'bg-blue-100 text-blue-800 border-blue-300',
  };

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${severityColors[severity]}`}
    >
      <AlertTriangle className="w-4 h-4" />
      <div className="flex items-center gap-2">
        {isIncrease ? (
          <TrendingUp className="w-4 h-4" />
        ) : (
          <TrendingDown className="w-4 h-4" />
        )}
        <span className="text-sm font-medium">
          {currency} {isIncrease ? '+' : ''}
          {volatility.changePercent.toFixed(2)}%
        </span>
      </div>
      {showDetails && (
        <span className="text-xs opacity-75">
          {volatility.previousRate.toFixed(4)} → {volatility.currentRate.toFixed(4)}
        </span>
      )}
    </div>
  );
}
