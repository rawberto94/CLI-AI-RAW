'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DollarSign, TrendingUp, Zap, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface DashboardCostSavings {
  totalPotentialSavings: number;
  currency: string;
  totalOpportunities: number;
  quickWinsCount: number;
  topOpportunities: Array<{
    id: string;
    title: string;
    amount: number;
    confidence: string;
  }>;
}

export function CostSavingsDashboardWidget() {
  const [data, setData] = useState<DashboardCostSavings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Get tenant ID from environment or session
      // For now, using a placeholder - replace with actual tenant context
      const tenantId = process.env.NEXT_PUBLIC_TENANT_ID || 'default-tenant';
      
      const response = await fetch(`/api/analytics/cost-savings?tenantId=${tenantId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch cost savings data');
      }
      
      const result = await response.json();
      
      if (result.success && result.data) {
        setData({
          totalPotentialSavings: result.data.totalPotentialSavings || 0,
          currency: result.data.currency || 'USD',
          totalOpportunities: result.data.totalOpportunities || 0,
          quickWinsCount: result.data.quickWinsCount || 0,
          topOpportunities: result.data.topOpportunities || []
        });
      } else {
        // Fallback to empty state
        setData({
          totalPotentialSavings: 0,
          currency: 'USD',
          totalOpportunities: 0,
          quickWinsCount: 0,
          topOpportunities: []
        });
      }
    } catch (error) {
      console.error('Failed to load cost savings:', error);
      // Fallback to empty state on error
      setData({
        totalPotentialSavings: 0,
        currency: 'USD',
        totalOpportunities: 0,
        quickWinsCount: 0,
        topOpportunities: []
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-white">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              Cost Savings Opportunities
            </CardTitle>
            <CardDescription className="mt-1">
              Identified across all contracts
            </CardDescription>
          </div>
          <Link href="/analytics/cost-savings">
            <Button variant="outline" size="sm">
              View All
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-white rounded-lg border">
            <div className="text-2xl font-bold text-green-600">
              ${(data.totalPotentialSavings / 1000).toFixed(0)}K
            </div>
            <div className="text-xs text-gray-600 mt-1">Total Potential</div>
          </div>
          <div className="text-center p-3 bg-white rounded-lg border">
            <div className="text-2xl font-bold text-blue-600">{data.totalOpportunities}</div>
            <div className="text-xs text-gray-600 mt-1">Opportunities</div>
          </div>
          <div className="text-center p-3 bg-white rounded-lg border">
            <div className="text-2xl font-bold text-yellow-600 flex items-center justify-center gap-1">
              <Zap className="h-5 w-5" />
              {data.quickWinsCount}
            </div>
            <div className="text-xs text-gray-600 mt-1">Quick Wins</div>
          </div>
        </div>

        {/* Top Opportunities */}
        <div>
          <h4 className="text-sm font-semibold mb-2">Top Opportunities</h4>
          <div className="space-y-2">
            {data.topOpportunities.map((opp, idx) => (
              <div key={opp.id} className="flex items-center justify-between p-2 bg-white rounded border hover:shadow-sm transition-shadow">
                <div className="flex items-center gap-2 flex-1">
                  <div className="text-sm font-medium text-gray-500">#{idx + 1}</div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{opp.title}</div>
                    <div className="text-xs text-gray-600">
                      ${(opp.amount / 1000).toFixed(0)}K potential savings
                    </div>
                  </div>
                </div>
                <Badge className="bg-green-100 text-green-800 border-green-300">
                  {opp.confidence}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <Link href="/analytics/cost-savings" className="block">
          <Button className="w-full" variant="default">
            <TrendingUp className="h-4 w-4 mr-2" />
            Explore All Opportunities
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
