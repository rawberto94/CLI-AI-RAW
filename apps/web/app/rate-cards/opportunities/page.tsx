'use client';

import { useState } from 'react';
import { RateCardBreadcrumbs } from '@/components/rate-cards/RateCardBreadcrumbs';
import { OpportunitiesList } from '@/components/rate-cards/OpportunitiesList';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, AlertTriangle, FileText, Calendar } from 'lucide-react';

export default function OpportunitiesPage() {
  const [clientFilter, setClientFilter] = useState('');
  const [opportunityType, setOpportunityType] = useState<string>('all');

  return (
    <div className="container mx-auto p-6 space-y-6">
      <RateCardBreadcrumbs />
      
      <div>
        <h1 className="text-3xl font-bold">Savings Opportunities</h1>
        <p className="text-muted-foreground">
          Identify, track, and realize cost savings opportunities
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="clientFilter">Filter by Client</Label>
              <Input
                id="clientFilter"
                placeholder="Enter client name..."
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
              />
            </div>
            {clientFilter && (
              <div className="flex items-center pt-8">
                <Badge variant="outline">Client: {clientFilter}</Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Opportunity Types */}
      <Tabs value={opportunityType} onValueChange={setOpportunityType}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">
            All Opportunities
          </TabsTrigger>
          <TabsTrigger value="above-baseline">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Above Baseline
          </TabsTrigger>
          <TabsTrigger value="negotiation-due">
            <TrendingUp className="h-4 w-4 mr-2" />
            Negotiation Due
          </TabsTrigger>
          <TabsTrigger value="msa-renewal">
            <Calendar className="h-4 w-4 mr-2" />
            MSA Renewal
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-6">
          <OpportunitiesList />
        </TabsContent>

        <TabsContent value="above-baseline" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                Above Baseline Opportunities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Rate cards that exceed their baseline thresholds, indicating potential for cost reduction
              </p>
              <OpportunitiesList />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="negotiation-due" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                Negotiation Opportunities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Rates significantly above market median that present negotiation opportunities
              </p>
              <OpportunitiesList />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="msa-renewal" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-purple-600" />
                MSA Renewal Opportunities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Upcoming MSA renewals in the next 90 days that require attention
              </p>
              <OpportunitiesList />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Summary Stats */}
      {clientFilter && (
        <Card>
          <CardHeader>
            <CardTitle>Client-Specific Opportunities - {clientFilter}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-lg bg-orange-50">
                <div className="text-2xl font-bold text-orange-600">12</div>
                <div className="text-sm text-orange-700">Above Baseline</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-blue-50">
                <div className="text-2xl font-bold text-blue-600">8</div>
                <div className="text-sm text-blue-700">Negotiation Due</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-purple-50">
                <div className="text-2xl font-bold text-purple-600">3</div>
                <div className="text-sm text-purple-700">MSA Renewals</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
