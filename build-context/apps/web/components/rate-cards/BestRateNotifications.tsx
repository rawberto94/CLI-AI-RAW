'use client';

/**
 * Best Rate Notifications Component
 * 
 * Displays notifications when best rates change in the market
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Bell, TrendingDown, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';

interface BestRateChange {
  roleStandardized: string;
  seniority: string;
  country: string;
  lineOfService: string;
  previousBestRate: number;
  newBestRate: number;
  changeAmount: number;
  changePercentage: number;
  newBestSupplier: string;
  detectedAt: string;
  affectedRateCards: number;
}

interface BestRateChangesResponse {
  changes: BestRateChange[];
  total: number;
  summary: {
    improvements: number;
    deteriorations: number;
    totalAffectedRateCards: number;
  };
}

export function BestRateNotifications() {
  const [data, setData] = useState<BestRateChangesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchChanges();
  }, []);

  const fetchChanges = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/rate-cards/best-rates/changes');
      
      if (!response.ok) {
        throw new Error('Failed to fetch best rate changes');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const dismissChange = (index: number) => {
    setDismissed(prev => new Set(prev).add(index.toString()));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">Loading notifications...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!data || data.changes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Best Rate Changes
          </CardTitle>
          <CardDescription>
            No significant best rate changes detected in the last 30 days
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground">
            <CheckCircle className="h-4 w-4" />
            <span>Market rates are stable</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const visibleChanges = data.changes.filter((_, index) => !dismissed.has(index.toString()));

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Best Rate Changes
          </CardTitle>
          <CardDescription>
            Significant changes in market best rates over the last 30 days
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingDown className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{data.summary.improvements}</div>
                <p className="text-sm text-muted-foreground">Rate Improvements</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{data.summary.deteriorations}</div>
                <p className="text-sm text-muted-foreground">Rate Increases</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-100 rounded-lg">
                <AlertCircle className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{data.summary.totalAffectedRateCards}</div>
                <p className="text-sm text-muted-foreground">Affected Rate Cards</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Individual Change Notifications */}
      {visibleChanges.length > 0 && (
        <div className="space-y-3">
          {visibleChanges.map((change, index) => {
            const isImprovement = change.changePercentage < 0;
            const Icon = isImprovement ? TrendingDown : TrendingUp;
            const colorClass = isImprovement ? 'text-green-600' : 'text-red-600';
            const bgClass = isImprovement ? 'bg-green-50' : 'bg-red-50';
            const borderClass = isImprovement ? 'border-green-200' : 'border-red-200';

            return (
              <Alert key={index} className={`${bgClass} ${borderClass}`}>
                <Icon className={`h-4 w-4 ${colorClass}`} />
                <AlertTitle className="flex items-center justify-between">
                  <span>
                    {change.roleStandardized} - {change.country}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => dismissChange(index)}
                  >
                    Dismiss
                  </Button>
                </AlertTitle>
                <AlertDescription>
                  <div className="space-y-2 mt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">
                        New best rate from <strong>{change.newBestSupplier}</strong>
                      </span>
                      <Badge variant={isImprovement ? 'default' : 'destructive'}>
                        {isImprovement ? '↓' : '↑'} {Math.abs(change.changePercentage).toFixed(1)}%
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Previous Best:</span>
                        <span className="ml-2 font-medium">${Math.round(change.previousBestRate)}/day</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">New Best:</span>
                        <span className={`ml-2 font-medium ${colorClass}`}>
                          ${Math.round(change.newBestRate)}/day
                        </span>
                      </div>
                    </div>

                    {change.affectedRateCards > 0 && (
                      <div className="text-sm text-muted-foreground">
                        <AlertCircle className="h-3 w-3 inline mr-1" />
                        {change.affectedRateCards} of your rate cards could benefit from this change
                      </div>
                    )}

                    <div className="text-xs text-muted-foreground">
                      Detected: {new Date(change.detectedAt).toLocaleDateString()}
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            );
          })}
        </div>
      )}

      {visibleChanges.length === 0 && data.changes.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              All notifications dismissed
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
