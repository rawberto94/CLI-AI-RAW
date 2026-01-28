'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Award, Handshake, PiggyBank } from 'lucide-react';

interface PerformanceMetrics {
  percentAboveMarket: number;
  percentTopQuartile: number;
  percentNegotiated: number;
  avgSavingsPerRate: number;
  totalRatesAnalyzed: number;
}

export function PerformanceIndicators() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/rate-cards/dashboard/performance');
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      }
    } catch {
      // Error fetching performance indicators
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Loading...</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-gray-200 animate-pulse rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  const performanceCards = [
    {
      title: 'Above Market Average',
      value: formatPercentage(metrics.percentAboveMarket),
      icon: AlertCircle,
      description: 'Rates above market',
      color: metrics.percentAboveMarket > 50 ? 'text-red-600' : 'text-yellow-600',
    },
    {
      title: 'In Top Quartile',
      value: formatPercentage(metrics.percentTopQuartile),
      icon: Award,
      description: '75th percentile or higher',
      color: metrics.percentTopQuartile > 25 ? 'text-red-600' : 'text-green-600',
    },
    {
      title: 'Negotiated Rates',
      value: formatPercentage(metrics.percentNegotiated),
      icon: Handshake,
      description: 'Successfully negotiated',
      color: 'text-violet-600',
    },
    {
      title: 'Avg Savings Per Rate',
      value: formatCurrency(metrics.avgSavingsPerRate),
      icon: PiggyBank,
      description: 'Potential per rate card',
      color: 'text-green-600',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {performanceCards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <Icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground">{card.description}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
