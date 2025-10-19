'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Target
} from 'lucide-react';

interface FinancialDataVisualizationProps {
  financialData: any;
  savingsOpportunities?: any;
}

export function FinancialDataVisualization({ 
  financialData, 
  savingsOpportunities 
}: FinancialDataVisualizationProps) {
  const totalValue = financialData?.totalValue || 0;
  const currency = financialData?.currency || 'USD';
  const paymentTerms = financialData?.paymentTerms || 'Net 30';
  
  const totalSavings = savingsOpportunities?.totalPotentialSavings || 0;
  const quickWins = savingsOpportunities?.summary?.quickWins || [];
  const strategicInitiatives = savingsOpportunities?.summary?.strategicInitiatives || [];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Contract Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currency} {totalValue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {paymentTerms}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Potential Savings</CardTitle>
            <TrendingDown className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {currency} {totalSavings.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {((totalSavings / totalValue) * 100).toFixed(1)}% of contract value
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quick Wins</CardTitle>
            <Target className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{quickWins.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Immediate opportunities
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Strategic Initiatives</CardTitle>
            <Clock className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{strategicInitiatives.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Long-term opportunities
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="savings">Savings</TabsTrigger>
          <TabsTrigger value="rates">Rate Cards</TabsTrigger>
          <TabsTrigger value="terms">Payment Terms</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Financial Overview</CardTitle>
              <CardDescription>Key financial metrics and breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {financialData?.costBreakdown?.map((item: any, index: number) => (
                  <div key={index} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{item.category}</p>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{currency} {item.amount.toLocaleString()}</p>
                      <p className="text-sm text-muted-foreground">
                        {((item.amount / totalValue) * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="savings" className="space-y-4">
          {quickWins.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-blue-600" />
                  Quick Wins (0-30 days)
                </CardTitle>
                <CardDescription>
                  Low-effort, high-impact opportunities
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {quickWins.map((opp: any) => (
                  <SavingsOpportunityCard key={opp.id} opportunity={opp} currency={currency} />
                ))}
              </CardContent>
            </Card>
          )}

          {strategicInitiatives.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-purple-600" />
                  Strategic Initiatives (3-6 months)
                </CardTitle>
                <CardDescription>
                  Higher-effort, strategic opportunities
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {strategicInitiatives.map((opp: any) => (
                  <SavingsOpportunityCard key={opp.id} opportunity={opp} currency={currency} />
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="rates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Rate Card Analysis</CardTitle>
              <CardDescription>Benchmarking and market comparison</CardDescription>
            </CardHeader>
            <CardContent>
              {savingsOpportunities?.opportunities
                ?.filter((opp: any) => opp.category === 'rate-optimization')
                .map((opp: any) => (
                  <RateCardOpportunityCard 
                    key={opp.id} 
                    opportunity={opp} 
                    currency={currency} 
                  />
                ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="terms" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payment Terms Analysis</CardTitle>
              <CardDescription>Optimization opportunities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Current Terms</p>
                    <p className="text-sm text-muted-foreground">{paymentTerms}</p>
                  </div>
                  <Badge variant="outline">{paymentTerms}</Badge>
                </div>

                {savingsOpportunities?.opportunities
                  ?.filter((opp: any) => opp.category === 'payment-terms')
                  .map((opp: any) => (
                    <div key={opp.id} className="p-4 border rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">{opp.title}</h4>
                        <Badge className="bg-green-100 text-green-800">
                          Save {currency} {opp.savings.amount.toLocaleString()}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{opp.description}</p>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="outline">{opp.implementation.effort} effort</Badge>
                        <Badge variant="outline">{opp.implementation.timeline}</Badge>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SavingsOpportunityCard({ opportunity, currency }: any) {
  const getEffortColor = (effort: string) => {
    switch (effort) {
      case 'low': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-4 border rounded-lg space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4 className="font-medium text-lg">{opportunity.title}</h4>
          <p className="text-sm text-muted-foreground mt-1">{opportunity.description}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-green-600">
            {currency} {opportunity.savings.amount.toLocaleString()}
          </p>
          <p className="text-sm text-muted-foreground">
            {opportunity.savings.percentage.toFixed(1)}% savings
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <Badge className={getEffortColor(opportunity.implementation.effort)}>
          {opportunity.implementation.effort} effort
        </Badge>
        <Badge variant="outline">{opportunity.implementation.timeline}</Badge>
        <Badge variant="outline">{opportunity.savings.confidence}% confidence</Badge>
      </div>

      <div className="space-y-1">
        <p className="text-sm font-medium">Implementation Steps:</p>
        <ol className="text-sm text-muted-foreground space-y-1 ml-4">
          {opportunity.implementation.steps.map((step: string, index: number) => (
            <li key={index}>{index + 1}. {step}</li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function RateCardOpportunityCard({ opportunity, currency }: any) {
  const intelligence = opportunity.rateCardIntelligence;
  
  if (!intelligence) return null;

  return (
    <div className="p-4 border rounded-lg space-y-3 mb-4">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-medium text-lg">{intelligence.role}</h4>
          <p className="text-sm text-muted-foreground">Market Position: {intelligence.marketPosition}</p>
        </div>
        <Badge className="bg-green-100 text-green-800">
          Save {currency} {opportunity.savings.amount.toLocaleString()}/year
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-muted-foreground">Current Rate</p>
          <p className="font-bold text-lg">{currency} {intelligence.currentRate}/hr</p>
        </div>
        <div>
          <p className="text-muted-foreground">Benchmark (P75)</p>
          <p className="font-bold text-lg text-blue-600">{currency} {intelligence.benchmarkRate.toFixed(2)}/hr</p>
        </div>
        <div>
          <p className="text-muted-foreground">Variance</p>
          <p className="font-bold text-lg text-red-600">+{opportunity.savings.percentage.toFixed(1)}%</p>
        </div>
      </div>

      <div className="pt-2 border-t">
        <p className="text-sm font-medium mb-2">Negotiation Strategy:</p>
        <p className="text-sm text-muted-foreground">
          Present market data showing current rate is at {intelligence.marketPosition}. 
          Propose adjustment to ${intelligence.benchmarkRate.toFixed(2)}/hr (P75 benchmark) 
          as fair market rate.
        </p>
      </div>
    </div>
  );
}
