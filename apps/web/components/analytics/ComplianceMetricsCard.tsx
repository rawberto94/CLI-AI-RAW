/**
 * Compliance Metrics Card
 * Display key compliance metrics and status
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertTriangle, XCircle, Clock } from 'lucide-react';

interface ComplianceMetric {
  label: string;
  value: number;
  total: number;
  status: 'compliant' | 'warning' | 'non-compliant' | 'pending';
}

interface ComplianceMetricsCardProps {
  metrics: ComplianceMetric[];
  isLoading?: boolean;
}

export function ComplianceMetricsCard({ metrics, isLoading }: ComplianceMetricsCardProps) {
  const getStatusIcon = (status: ComplianceMetric['status']) => {
    switch (status) {
      case 'compliant':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-amber-600" />;
      case 'non-compliant':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'pending':
        return <Clock className="h-5 w-5 text-blue-600" />;
    }
  };

  const getStatusColor = (status: ComplianceMetric['status']) => {
    switch (status) {
      case 'compliant':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'warning':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'non-compliant':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'pending':
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Compliance Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-gray-200 rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Compliance Metrics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {metrics.map((metric, index) => {
          const percentage = Math.round((metric.value / metric.total) * 100);
          return (
            <div
              key={index}
              className={`p-3 rounded-lg border ${getStatusColor(metric.status)}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getStatusIcon(metric.status)}
                  <span className="font-medium">{metric.label}</span>
                </div>
                <Badge variant="outline" className="bg-white">
                  {metric.value} / {metric.total}
                </Badge>
              </div>
              <div className="w-full bg-white/50 rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor:
                      metric.status === 'compliant'
                        ? '#16a34a'
                        : metric.status === 'warning'
                        ? '#d97706'
                        : metric.status === 'non-compliant'
                        ? '#dc2626'
                        : '#2563eb',
                  }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
