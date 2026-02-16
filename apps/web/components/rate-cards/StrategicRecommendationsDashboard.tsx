'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Target, TrendingDown, Users, Shield, Settings, 
  Loader2, ChevronRight, DollarSign, RefreshCw
} from 'lucide-react';
import { useStrategicRecommendations, type StrategicRecommendation } from '@/hooks/use-rate-card-queries';
import { DataFreshnessIndicator } from '@/components/shared/DataFreshnessIndicator';

// ============================================================================
// Types (re-exported from hook for local use)
// ============================================================================

interface StrategicRecommendationsDashboardProps {
  tenantId: string;
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getCategoryIcon(category: StrategicRecommendation['category']) {
  switch (category) {
    case 'COST_REDUCTION':
      return <TrendingDown className="h-5 w-5" />;
    case 'SUPPLIER_OPTIMIZATION':
      return <Users className="h-5 w-5" />;
    case 'MARKET_POSITIONING':
      return <Target className="h-5 w-5" />;
    case 'RISK_MITIGATION':
      return <Shield className="h-5 w-5" />;
    case 'PROCESS_IMPROVEMENT':
      return <Settings className="h-5 w-5" />;
  }
}

function getCategoryColor(category: StrategicRecommendation['category']): string {
  switch (category) {
    case 'COST_REDUCTION':
      return 'text-green-600 bg-green-50';
    case 'SUPPLIER_OPTIMIZATION':
      return 'text-violet-600 bg-violet-50';
    case 'MARKET_POSITIONING':
      return 'text-violet-600 bg-violet-50';
    case 'RISK_MITIGATION':
      return 'text-red-600 bg-red-50';
    case 'PROCESS_IMPROVEMENT':
      return 'text-gray-600 bg-gray-50';
  }
}

function getImpactColor(impact: 'LOW' | 'MEDIUM' | 'HIGH'): string {
  switch (impact) {
    case 'HIGH':
      return 'bg-red-100 text-red-800';
    case 'MEDIUM':
      return 'bg-yellow-100 text-yellow-800';
    case 'LOW':
      return 'bg-green-100 text-green-800';
  }
}

function getEffortColor(effort: 'LOW' | 'MEDIUM' | 'HIGH'): string {
  switch (effort) {
    case 'LOW':
      return 'bg-green-100 text-green-800';
    case 'MEDIUM':
      return 'bg-yellow-100 text-yellow-800';
    case 'HIGH':
      return 'bg-red-100 text-red-800';
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ============================================================================
// Strategic Recommendations Dashboard Component
// ============================================================================

export function StrategicRecommendationsDashboard({ 
  tenantId, 
  className = '' 
}: StrategicRecommendationsDashboardProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  const { 
    data, 
    isLoading: loading, 
    isFetching,
    error, 
    refetch,
    dataUpdatedAt,
  } = useStrategicRecommendations({ tenantId });

  const recommendations = data?.recommendations ?? [];
  const totalSavings = data?.totalSavings ?? 0;

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Strategic Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-2 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Strategic Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-sm text-red-600 mb-4">
              {error instanceof Error ? error.message : 'Failed to load recommendations'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (recommendations.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Strategic Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Target className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-sm text-gray-600">No recommendations available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <span>Strategic Recommendations</span>
              <Badge variant="secondary">{recommendations.length} Recommendations</Badge>
            </CardTitle>
            <Button onClick={() => refetch()} variant="ghost" size="sm" disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <DataFreshnessIndicator
            dataUpdatedAt={dataUpdatedAt}
            isFetching={isFetching}
          />
        </CardHeader>
        <CardContent>
          {totalSavings > 0 && (
            <div className="flex items-center gap-2 p-4 bg-green-50 rounded-lg mb-4">
              <DollarSign className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-900">Total Potential Savings</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(totalSavings)}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recommendations List */}
      <div className="space-y-3">
        {recommendations.map((rec) => {
          const isExpanded = expandedId === rec.id;

          return (
            <Card key={rec.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`p-2 rounded-lg ${getCategoryColor(rec.category)}`}>
                      {getCategoryIcon(rec.category)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          Priority {rec.priority}
                        </Badge>
                        <Badge className={`text-xs ${getImpactColor(rec.impact)}`}>
                          {rec.impact} Impact
                        </Badge>
                        <Badge className={`text-xs ${getEffortColor(rec.effort)}`}>
                          {rec.effort} Effort
                        </Badge>
                      </div>
                      <h3 className="font-semibold text-base mb-1">{rec.title}</h3>
                      <p className="text-sm text-gray-600">{rec.description}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedId(isExpanded ? null : rec.id)}
                  >
                    <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  </Button>
                </div>

                {/* Metrics */}
                <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                  {rec.estimatedSavings && (
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-4 w-4" />
                      <span className="font-medium text-green-600">
                        {formatCurrency(rec.estimatedSavings)}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="font-medium">{rec.affectedRateCards}</span> rate cards affected
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="font-semibold text-sm mb-2">Action Items</h4>
                    <ul className="space-y-2">
                      {rec.actionItems.map((item, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <span className="text-violet-500 mt-0.5">→</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
