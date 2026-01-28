'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, TrendingDown } from 'lucide-react';

interface Opportunity {
  id: string;
  type: string;
  title: string;
  description: string;
  potentialSavings: number;
  savingsPercentage: number;
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  priority: number;
  affectedRates: number;
}

interface TopOpportunitiesTableProps {
  opportunities: Opportunity[];
}

export function TopOpportunitiesTable({ opportunities }: TopOpportunitiesTableProps) {
  const getEffortColor = (effort: string) => {
    if (effort === 'low') return 'bg-green-100 text-green-800';
    if (effort === 'medium') return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getImpactColor = (impact: string) => {
    if (impact === 'high') return 'bg-purple-100 text-purple-800';
    if (impact === 'medium') return 'bg-violet-100 text-violet-800';
    return 'bg-gray-100 text-gray-800';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (opportunities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Opportunities</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            No opportunities identified at this time
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            Top 10 Savings Opportunities
          </CardTitle>
          <Badge variant="secondary">
            Total: {formatCurrency(opportunities.reduce((sum, o) => sum + o.potentialSavings, 0))}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {opportunities.map((opp, index) => (
            <div
              key={opp.id}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-lg font-semibold text-muted-foreground">#{index + 1}</span>
                  <h4 className="font-semibold">{opp.title}</h4>
                  <Badge className={getEffortColor(opp.effort)} variant="outline">
                    {opp.effort} effort
                  </Badge>
                  <Badge className={getImpactColor(opp.impact)} variant="outline">
                    {opp.impact} impact
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{opp.description}</p>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span>{opp.affectedRates} rate(s) affected</span>
                  <span>•</span>
                  <span>{opp.savingsPercentage.toFixed(1)}% reduction potential</span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(opp.potentialSavings)}
                  </div>
                  <div className="text-xs text-muted-foreground">Annual Savings</div>
                </div>
                <Button variant="ghost" size="icon">
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
