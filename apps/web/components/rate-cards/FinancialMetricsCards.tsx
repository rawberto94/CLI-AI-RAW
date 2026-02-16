'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingUp, TrendingDown, Target } from 'lucide-react';

interface FinancialMetrics {
  totalAnnualSpend: number;
  totalSavingsIdentified: number;
  totalSavingsRealized: number;
  avgRateVsMarket: number;
  savingsRealizationRate: number;
}

export function FinancialMetricsCards() {
  const [metrics, setMetrics] = useState<FinancialMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/rate-cards/dashboard/financial');
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      }
    } catch {
      // Error fetching financial metrics
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
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
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

  const financialCards = [
    {
      title: 'Total Annual Spend',
      value: formatCurrency(metrics.totalAnnualSpend),
      icon: DollarSign,
      description: 'On tracked rates',
      color: 'text-violet-600',
    },
    {
      title: 'Savings Identified',
      value: formatCurrency(metrics.totalSavingsIdentified),
      icon: TrendingUp,
      description: 'Potential annual savings',
      color: 'text-green-600',
    },
    {
      title: 'Savings Realized',
      value: formatCurrency(metrics.totalSavingsRealized),
      icon: Target,
      description: `${metrics.savingsRealizationRate.toFixed(0)}% of identified`,
      color: 'text-violet-600',
    },
    {
      title: 'Avg Rate vs Market',
      value: formatPercentage(metrics.avgRateVsMarket),
      icon: metrics.avgRateVsMarket > 0 ? TrendingUp : TrendingDown,
      description: metrics.avgRateVsMarket > 0 ? 'Above market' : 'Below market',
      color: metrics.avgRateVsMarket > 0 ? 'text-red-600' : 'text-green-600',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {financialCards.map((card) => {
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
