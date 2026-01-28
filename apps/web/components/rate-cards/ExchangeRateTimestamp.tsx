'use client';

import { useEffect, useState } from 'react';
import { Clock, RefreshCw } from 'lucide-react';

interface ExchangeRateTimestampProps {
  fromCurrency: string;
  toCurrency: string;
  onRefresh?: () => void;
}

export function ExchangeRateTimestamp({
  fromCurrency,
  toCurrency,
  onRefresh,
}: ExchangeRateTimestampProps) {
  const [rateInfo, setRateInfo] = useState<{
    rate: number;
    timestamp: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchExchangeRate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromCurrency, toCurrency]);

  const fetchExchangeRate = async () => {
    try {
      const response = await fetch(
        `/api/rate-cards/currency/exchange-rate?from=${fromCurrency}&to=${toCurrency}`
      );
      const data = await response.json();
      setRateInfo({
        rate: data.rate,
        timestamp: data.timestamp,
      });
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchExchangeRate();
    if (onRefresh) {
      onRefresh();
    }
  };

  if (loading || !rateInfo) {
    return null;
  }

  const timestamp = new Date(rateInfo.timestamp);
  const now = new Date();
  const minutesAgo = Math.floor((now.getTime() - timestamp.getTime()) / 60000);

  const timeAgoText =
    minutesAgo < 1
      ? 'Just now'
      : minutesAgo < 60
      ? `${minutesAgo}m ago`
      : minutesAgo < 1440
      ? `${Math.floor(minutesAgo / 60)}h ago`
      : `${Math.floor(minutesAgo / 1440)}d ago`;

  return (
    <div className="flex items-center gap-3 text-sm text-gray-600">
      <div className="flex items-center gap-1.5">
        <Clock className="w-4 h-4" />
        <span>
          Exchange rate: {rateInfo.rate.toFixed(4)} ({timeAgoText})
        </span>
      </div>
      <button
        onClick={handleRefresh}
        disabled={refreshing}
        className="flex items-center gap-1 px-2 py-1 text-xs text-violet-600 hover:text-violet-700 hover:bg-violet-50 rounded transition-colors disabled:opacity-50"
      >
        <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
        Refresh
      </button>
    </div>
  );
}
