'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface OpportunityDetailsProps {
  opportunityId: string;
}

export function OpportunityDetails({ opportunityId }: OpportunityDetailsProps) {
  const [opportunity, setOpportunity] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actualSavings, setActualSavings] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    fetchOpportunityDetails();
  }, [opportunityId]);

  const fetchOpportunityDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/rate-cards/opportunities/${opportunityId}`);
      const data = await response.json();

      if (data.success) {
        setOpportunity(data.opportunity);
      }
    } catch (error) {
      console.error('Error fetching opportunity details:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (status: string) => {
    try {
      const response = await fetch(`/api/rate-cards/opportunities/${opportunityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes }),
      });

      if (response.ok) {
        await fetchOpportunityDetails();
        setNotes('');
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const trackSavings = async () => {
    if (!actualSavings) return;

    try {
      const response = await fetch(`/api/rate-cards/opportunities/${opportunityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actualSavings: parseFloat(actualSavings) }),
      });

      if (response.ok) {
        await fetchOpportunityDetails();
        setActualSavings('');
      }
    } catch (error) {
      console.error('Error tracking savings:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return <div className="p-8 text-center">Loading opportunity details...</div>;
  }

  if (!opportunity) {
    return <div className="p-8 text-center">Opportunity not found</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl">{opportunity.title}</CardTitle>
              <CardDescription className="mt-2">{opportunity.description}</CardDescription>
            </div>
            <div className="flex gap-2">
              <Badge className="text-sm">{opportunity.category.replace(/_/g, ' ')}</Badge>
              <Badge className="text-sm">{opportunity.status.replace(/_/g, ' ')}</Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Financial Impact */}
      <Card>
        <CardHeader>
          <CardTitle>Financial Impact</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="text-sm text-gray-500 mb-1">Current Annual Cost</div>
              <div className="text-2xl font-bold">
                {formatCurrency(opportunity.currentAnnualCost)}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">Projected Annual Cost</div>
              <div className="text-2xl font-bold">
                {formatCurrency(opportunity.projectedAnnualCost)}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">Annual Savings</div>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(opportunity.annualSavingsPotential)}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                {opportunity.savingsPercentage.toFixed(1)}% reduction
              </div>
            </div>
          </div>

          {opportunity.actualSavings && (
            <div className="mt-6 p-4 bg-green-50 rounded-lg">
              <div className="text-sm text-gray-600">Actual Savings Realized</div>
              <div className="text-xl font-bold text-green-700">
                {formatCurrency(opportunity.actualSavings)}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assessment */}
      <Card>
        <CardHeader>
          <CardTitle>Assessment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="text-sm text-gray-500 mb-1">Effort Level</div>
              <Badge variant="outline" className="text-base">
                {opportunity.effort}
              </Badge>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">Risk Level</div>
              <Badge variant="outline" className="text-base">
                {opportunity.risk}
              </Badge>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">Confidence</div>
              <div className="text-lg font-semibold">
                {(opportunity.confidence * 100).toFixed(0)}%
              </div>
            </div>
          </div>

          {opportunity.implementationTime && (
            <div className="mt-4">
              <div className="text-sm text-gray-500 mb-1">Implementation Timeline</div>
              <div className="text-base">{opportunity.implementationTime}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recommended Action */}
      <Card>
        <CardHeader>
          <CardTitle>Recommended Action</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-base">{opportunity.recommendedAction}</p>
        </CardContent>
      </Card>

      {/* Alternative Suppliers */}
      {opportunity.alternativeSuppliers && opportunity.alternativeSuppliers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Alternative Suppliers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {opportunity.alternativeSuppliers.map((alt: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-semibold">{alt.supplierName || alt.name}</div>
                    <div className="text-sm text-gray-600">{alt.country}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{formatCurrency(alt.rate)}/day</div>
                    <div className="text-sm text-green-600">
                      Save {formatCurrency(alt.savings)}/day
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Negotiation Points */}
      {opportunity.negotiationPoints && opportunity.negotiationPoints.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Negotiation Points</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {opportunity.negotiationPoints.map((point: any, idx: number) => (
                <div key={idx} className="p-3 border-l-4 border-blue-500 bg-blue-50">
                  <div className="font-semibold">{point.point}</div>
                  <div className="text-sm text-gray-600 mt-1">{point.data}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rate Card Details */}
      {opportunity.rateCardEntry && (
        <Card>
          <CardHeader>
            <CardTitle>Rate Card Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-500">Supplier</div>
                <div className="font-semibold">{opportunity.rateCardEntry.supplierName}</div>
              </div>
              <div>
                <div className="text-gray-500">Role</div>
                <div className="font-semibold">{opportunity.rateCardEntry.roleStandardized}</div>
              </div>
              <div>
                <div className="text-gray-500">Seniority</div>
                <div className="font-semibold">{opportunity.rateCardEntry.seniority}</div>
              </div>
              <div>
                <div className="text-gray-500">Location</div>
                <div className="font-semibold">{opportunity.rateCardEntry.country}</div>
              </div>
              <div>
                <div className="text-gray-500">Current Rate</div>
                <div className="font-semibold">
                  {formatCurrency(opportunity.rateCardEntry.dailyRateUSD)}/day
                </div>
              </div>
              <div>
                <div className="text-gray-500">Market Percentile</div>
                <div className="font-semibold">{opportunity.rateCardEntry.percentileRank}th</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Workflow Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Workflow Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this opportunity..."
              className="mt-1"
            />
          </div>

          <div className="flex gap-2">
            {opportunity.status === 'IDENTIFIED' && (
              <Button onClick={() => updateStatus('UNDER_REVIEW')}>
                Move to Review
              </Button>
            )}
            {opportunity.status === 'UNDER_REVIEW' && (
              <>
                <Button onClick={() => updateStatus('APPROVED')}>Approve</Button>
                <Button variant="outline" onClick={() => updateStatus('REJECTED')}>
                  Reject
                </Button>
              </>
            )}
            {opportunity.status === 'APPROVED' && (
              <Button onClick={() => updateStatus('IN_PROGRESS')}>Start Implementation</Button>
            )}
            {opportunity.status === 'IN_PROGRESS' && (
              <>
                <div className="flex gap-2 items-end flex-1">
                  <div className="flex-1">
                    <Label htmlFor="actualSavings">Actual Savings Realized</Label>
                    <Input
                      id="actualSavings"
                      type="number"
                      value={actualSavings}
                      onChange={(e) => setActualSavings(e.target.value)}
                      placeholder="Enter amount"
                      className="mt-1"
                    />
                  </div>
                  <Button onClick={trackSavings}>Mark as Implemented</Button>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
