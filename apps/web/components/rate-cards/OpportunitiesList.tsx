'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Opportunity {
  id: string;
  title: string;
  description: string;
  category: string;
  currentAnnualCost: number;
  projectedAnnualCost: number;
  annualSavings: number;
  annualSavingsPotential: number;
  savingsPercentage: number;
  effort: string;
  risk: string;
  confidence: number;
  status: string;
  rateCardEntry: any;
}

interface OpportunitiesSummary {
  totalOpportunities: number;
  totalSavings: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
}

export function OpportunitiesList() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [summary, setSummary] = useState<OpportunitiesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('annualSavings');

  useEffect(() => {
    fetchOpportunities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, categoryFilter, sortBy]);

  const fetchOpportunities = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        tenantId: 'demo-tenant',
        sortBy,
        sortOrder: 'desc',
      });

      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (categoryFilter !== 'all') params.append('category', categoryFilter);

      const response = await fetch(`/api/rate-cards/opportunities?${params}`);
      const data = await response.json();

      if (data.success) {
        setOpportunities(data.opportunities);
        setSummary(data.summary);
      }
    } catch {
      // Error fetching opportunities
    } finally {
      setLoading(false);
    }
  };

  const detectOpportunities = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/rate-cards/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: 'demo-tenant',
          options: {
            minSavingsAmount: 1000,
            minSavingsPercent: 5,
          },
        }),
      });

      const data = await response.json();
      if (data.success) {
        await fetchOpportunities();
      }
    } catch {
      // Error detecting opportunities
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const response = await fetch(`/api/rate-cards/opportunities/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        await fetchOpportunities();
      }
    } catch {
      // Error updating status
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      IDENTIFIED: 'bg-violet-100 text-violet-800',
      UNDER_REVIEW: 'bg-yellow-100 text-yellow-800',
      APPROVED: 'bg-green-100 text-green-800',
      IN_PROGRESS: 'bg-purple-100 text-purple-800',
      IMPLEMENTED: 'bg-gray-100 text-gray-800',
      REJECTED: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      RATE_REDUCTION: 'bg-purple-100 text-indigo-800',
      SUPPLIER_SWITCH: 'bg-pink-100 text-pink-800',
      VOLUME_DISCOUNT: 'bg-violet-100 text-violet-800',
      GEOGRAPHIC_ARBITRAGE: 'bg-orange-100 text-orange-800',
      TERM_RENEGOTIATION: 'bg-purple-100 text-purple-800',
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading && opportunities.length === 0) {
    return <div className="p-8 text-center">Loading opportunities...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Opportunities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalOpportunities}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Potential Savings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(summary.totalSavings)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Average Savings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(summary.totalSavings / (summary.totalOpportunities || 1))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Savings Opportunities</CardTitle>
              <CardDescription>
                Identified cost reduction opportunities based on market benchmarks
              </CardDescription>
            </div>
            <Button onClick={detectOpportunities} disabled={loading}>
              Detect New Opportunities
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="IDENTIFIED">Identified</SelectItem>
                <SelectItem value="UNDER_REVIEW">Under Review</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="IMPLEMENTED">Implemented</SelectItem>
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="RATE_REDUCTION">Rate Reduction</SelectItem>
                <SelectItem value="SUPPLIER_SWITCH">Supplier Switch</SelectItem>
                <SelectItem value="VOLUME_DISCOUNT">Volume Discount</SelectItem>
                <SelectItem value="GEOGRAPHIC_ARBITRAGE">Geographic Arbitrage</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="annualSavings">Savings Amount</SelectItem>
                <SelectItem value="savingsPercentage">Savings %</SelectItem>
                <SelectItem value="createdAt">Date Created</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Opportunities List */}
          <div className="space-y-4">
            {opportunities.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No opportunities found. Click &ldquo;Detect New Opportunities&rdquo; to scan for savings.
              </div>
            ) : (
              opportunities.map((opp) => (
                <Card key={opp.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-lg">{opp.title}</h3>
                          <Badge className={getCategoryColor(opp.category)}>
                            {opp.category.replace(/_/g, ' ')}
                          </Badge>
                          <Badge className={getStatusColor(opp.status)}>
                            {opp.status.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-4">{opp.description}</p>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <div className="text-gray-500">Annual Savings</div>
                            <div className="font-semibold text-green-600">
                              {formatCurrency(opp.annualSavingsPotential)}
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-500">Savings %</div>
                            <div className="font-semibold">
                              {opp.savingsPercentage.toFixed(1)}%
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-500">Effort</div>
                            <div className="font-semibold">{opp.effort}</div>
                          </div>
                          <div>
                            <div className="text-gray-500">Risk</div>
                            <div className="font-semibold">{opp.risk}</div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 ml-4">
                        {opp.status === 'IDENTIFIED' && (
                          <Button
                            size="sm"
                            onClick={() => updateStatus(opp.id, 'UNDER_REVIEW')}
                          >
                            Review
                          </Button>
                        )}
                        {opp.status === 'UNDER_REVIEW' && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => updateStatus(opp.id, 'APPROVED')}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateStatus(opp.id, 'REJECTED')}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                        {opp.status === 'APPROVED' && (
                          <Button
                            size="sm"
                            onClick={() => updateStatus(opp.id, 'IN_PROGRESS')}
                          >
                            Start
                          </Button>
                        )}
                        {opp.status === 'IN_PROGRESS' && (
                          <Button
                            size="sm"
                            onClick={() => updateStatus(opp.id, 'IMPLEMENTED')}
                          >
                            Complete
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
