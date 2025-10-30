'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Calendar, TrendingUp, FileText, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

interface NegotiationMetrics {
  totalNegotiated: number;
  successRate: number;
  upcomingRenewals: Array<{
    clientName: string;
    msaReference: string;
    renewalDate: Date;
    rateCardCount: number;
  }>;
  recentNegotiations: Array<{
    clientName: string;
    negotiationDate: Date;
    savingsPercentage: number;
  }>;
  opportunitiesCount: number;
}

interface NegotiationStatusWidgetProps {
  metrics: NegotiationMetrics;
  loading?: boolean;
  onViewOpportunities?: () => void;
}

export function NegotiationStatusWidget({
  metrics,
  loading = false,
  onViewOpportunities,
}: NegotiationStatusWidgetProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            Negotiation Status
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

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 80) return 'text-green-600';
    if (rate >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getDaysUntilRenewal = (date: Date) => {
    const today = new Date();
    const renewal = new Date(date);
    const diffTime = renewal.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          Negotiation Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 rounded-lg bg-green-50">
            <div className="text-3xl font-bold text-green-600">
              {metrics.totalNegotiated}
            </div>
            <div className="text-sm text-green-700">Negotiated</div>
          </div>
          <div className="text-center p-4 rounded-lg bg-muted">
            <div className={`text-3xl font-bold ${getSuccessRateColor(metrics.successRate)}`}>
              {metrics.successRate.toFixed(0)}%
            </div>
            <div className="text-sm text-muted-foreground">Success Rate</div>
          </div>
          <div className="text-center p-4 rounded-lg bg-blue-50">
            <div className="text-3xl font-bold text-blue-600">
              {metrics.opportunitiesCount}
            </div>
            <div className="text-sm text-blue-700">Opportunities</div>
          </div>
        </div>

        {/* Upcoming Renewals */}
        {metrics.upcomingRenewals.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Upcoming MSA Renewals
            </h4>
            <div className="space-y-2">
              {metrics.upcomingRenewals.slice(0, 3).map((renewal) => {
                const daysUntil = getDaysUntilRenewal(renewal.renewalDate);
                const isUrgent = daysUntil <= 30;

                return (
                  <div
                    key={renewal.msaReference}
                    className={`p-3 rounded-lg border ${
                      isUrgent
                        ? 'bg-red-50 border-red-200'
                        : 'bg-muted/50 border-border'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium">{renewal.clientName}</div>
                        <div className="text-sm text-muted-foreground">
                          {renewal.msaReference}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {renewal.rateCardCount} rate cards
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge
                          variant={isUrgent ? 'destructive' : 'secondary'}
                          className="mb-1"
                        >
                          {daysUntil} days
                        </Badge>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(renewal.renewalDate), 'MMM d, yyyy')}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent Negotiations */}
        {metrics.recentNegotiations.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Recent Negotiations
            </h4>
            <div className="space-y-2">
              {metrics.recentNegotiations.slice(0, 3).map((negotiation, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 rounded bg-muted/50"
                >
                  <div>
                    <div className="text-sm font-medium">
                      {negotiation.clientName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(negotiation.negotiationDate), 'MMM d, yyyy')}
                    </div>
                  </div>
                  <Badge
                    variant="secondary"
                    className="bg-green-100 text-green-700"
                  >
                    {negotiation.savingsPercentage.toFixed(1)}% saved
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Opportunities Alert */}
        {metrics.opportunitiesCount > 0 && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-2 flex-1">
                <FileText className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <div className="font-medium text-blue-900">
                    Negotiation Opportunities
                  </div>
                  <div className="text-sm text-blue-700">
                    {metrics.opportunitiesCount} rates ready for negotiation
                  </div>
                </div>
              </div>
              {onViewOpportunities && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onViewOpportunities}
                  className="ml-2"
                >
                  View
                </Button>
              )}
            </div>
          </div>
        )}

        {/* No Upcoming Renewals */}
        {metrics.upcomingRenewals.length === 0 && (
          <div className="p-3 bg-muted rounded-lg text-center">
            <AlertCircle className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
            <div className="text-sm text-muted-foreground">
              No upcoming MSA renewals in the next 90 days
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
