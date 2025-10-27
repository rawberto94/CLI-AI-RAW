'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Database, Building2, Globe2, Briefcase } from 'lucide-react';

interface DashboardMetrics {
  totalRateCards: number;
  totalSuppliers: number;
  geographicCoverage: number;
  serviceLineCoverage: number;
  countries?: string[];
  serviceLines?: string[];
}

export function DashboardKPICards() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/rate-cards/dashboard/metrics');
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      }
    } catch (error) {
      console.error('Error fetching dashboard metrics:', error);
    } finally {
      setLoading(false);
    }
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

  const kpiCards = [
    {
      title: 'Total Rate Cards',
      value: metrics.totalRateCards.toLocaleString(),
      icon: Database,
      description: 'Rate cards tracked',
      color: 'text-blue-600',
    },
    {
      title: 'Total Suppliers',
      value: metrics.totalSuppliers.toLocaleString(),
      icon: Building2,
      description: 'Unique suppliers',
      color: 'text-green-600',
    },
    {
      title: 'Geographic Coverage',
      value: metrics.geographicCoverage.toLocaleString(),
      icon: Globe2,
      description: `${metrics.geographicCoverage} countries`,
      color: 'text-purple-600',
    },
    {
      title: 'Service Lines',
      value: metrics.serviceLineCoverage.toLocaleString(),
      icon: Briefcase,
      description: 'Lines of service',
      color: 'text-orange-600',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {kpiCards.map((kpi) => {
        const Icon = kpi.icon;
        return (
          <Card key={kpi.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
              <Icon className={`h-4 w-4 ${kpi.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
              <p className="text-xs text-muted-foreground">{kpi.description}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
