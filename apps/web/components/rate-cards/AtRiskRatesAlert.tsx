'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ArrowRight } from 'lucide-react';

interface AtRiskRate {
  id: string;
  role: string;
  supplier: string;
  currentRate: number;
  marketMedian: number;
  percentileRank: number;
  riskLevel: 'high' | 'critical';
  reason: string;
  recommendedAction: string;
}

interface AtRiskRatesAlertProps {
  atRiskRates: AtRiskRate[];
}

export function AtRiskRatesAlert({ atRiskRates }: AtRiskRatesAlertProps) {
  const getRiskColor = (level: string) => {
    if (level === 'critical') return 'bg-red-100 text-red-800 border-red-200';
    return 'bg-orange-100 text-orange-800 border-orange-200';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (atRiskRates.length === 0) {
    return null;
  }

  return (
    <Card className="border-red-200 bg-red-50/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-700">
          <AlertTriangle className="h-5 w-5" />
          At-Risk Rates Requiring Attention
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {atRiskRates.map((rate) => (
            <div
              key={rate.id}
              className="flex items-center justify-between p-4 bg-white border rounded-lg"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <Badge className={getRiskColor(rate.riskLevel)} variant="outline">
                    {rate.riskLevel.toUpperCase()}
                  </Badge>
                  <h4 className="font-semibold">{rate.role}</h4>
                  <span className="text-sm text-muted-foreground">• {rate.supplier}</span>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-2">
                  <div>
                    <div className="text-xs text-muted-foreground">Current Rate</div>
                    <div className="font-semibold">{formatCurrency(rate.currentRate)}/day</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Market Median</div>
                    <div className="font-semibold">{formatCurrency(rate.marketMedian)}/day</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Percentile</div>
                    <div className="font-semibold text-red-600">{rate.percentileRank}th</div>
                  </div>
                </div>

                <div className="text-sm text-muted-foreground mb-1">
                  <strong>Issue:</strong> {rate.reason}
                </div>
                <div className="text-sm text-blue-600">
                  <strong>Recommended:</strong> {rate.recommendedAction}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-xl font-bold text-red-600">
                    +{formatCurrency(rate.currentRate - rate.marketMedian)}
                  </div>
                  <div className="text-xs text-muted-foreground">Above Market</div>
                </div>
                <Button variant="outline" size="icon">
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {atRiskRates.length > 5 && (
          <div className="mt-4 text-center">
            <Button variant="outline">View All At-Risk Rates</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
