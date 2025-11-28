'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, TrendingUp, DollarSign } from 'lucide-react';

interface ClientMetrics {
  totalClients: number;
  totalRateCards: number;
  topClients: Array<{
    name: string;
    rateCardCount: number;
    totalSpend: number;
  }>;
  unassignedRateCards: number;
}

interface ClientOverviewWidgetProps {
  metrics: ClientMetrics;
  loading?: boolean;
}

export function ClientOverviewWidget({
  metrics,
  loading = false,
}: ClientOverviewWidgetProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Client Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            Loading...
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Client Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">
              {metrics.totalClients}
            </div>
            <div className="text-sm text-muted-foreground">Total Clients</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold">{metrics.totalRateCards}</div>
            <div className="text-sm text-muted-foreground">Rate Cards</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-orange-600">
              {metrics.unassignedRateCards}
            </div>
            <div className="text-sm text-muted-foreground">Unassigned</div>
          </div>
        </div>

        {/* Top Clients */}
        <div>
          <h4 className="text-sm font-semibold mb-3">Top Clients by Volume</h4>
          <div className="space-y-3">
            {(metrics.topClients || []).slice(0, 5).map((client, index) => (
              <div
                key={client.name}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="w-8 h-8 flex items-center justify-center">
                    {index + 1}
                  </Badge>
                  <div>
                    <div className="font-medium">{client.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {client.rateCardCount} rate cards
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-green-600">
                    {formatCurrency(client.totalSpend)}
                  </div>
                  <div className="text-xs text-muted-foreground">Est. spend</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        {metrics.unassignedRateCards > 0 && (
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-start gap-2">
              <TrendingUp className="h-5 w-5 text-orange-600 mt-0.5" />
              <div>
                <div className="font-medium text-orange-900">
                  Action Required
                </div>
                <div className="text-sm text-orange-700">
                  {metrics.unassignedRateCards} rate cards need client assignment
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
