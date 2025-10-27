'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FileText, 
  TrendingDown, 
  Users, 
  AlertTriangle, 
  Download,
  Loader2,
  Target,
  MessageSquare,
  Building2
} from 'lucide-react';
import type { NegotiationBrief } from '@/packages/data-orchestration/src/services/negotiation-assistant.service';

interface NegotiationAssistantProps {
  rateCardId: string;
}

export function NegotiationAssistant({ rateCardId }: NegotiationAssistantProps) {
  const [brief, setBrief] = useState<NegotiationBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    loadNegotiationBrief();
  }, [rateCardId]);

  const loadNegotiationBrief = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/rate-cards/${rateCardId}/negotiation-brief`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to load negotiation brief');
      }

      setBrief(result.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadBrief = async () => {
    try {
      setDownloading(true);
      
      const response = await fetch(`/api/rate-cards/${rateCardId}/negotiation-brief/export`);
      const blob = await response.blob();
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `negotiation-brief-${rateCardId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error downloading brief:', err);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
            <p>{error}</p>
            <Button onClick={loadNegotiationBrief} className="mt-4">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!brief) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Negotiation Assistant</h2>
          <p className="text-muted-foreground">
            AI-powered negotiation recommendations and market insights
          </p>
        </div>
        <Button onClick={handleDownloadBrief} disabled={downloading}>
          {downloading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Download Brief
        </Button>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="targets">Target Rates</TabsTrigger>
          <TabsTrigger value="talking-points">Talking Points</TabsTrigger>
          <TabsTrigger value="alternatives">Alternatives</TabsTrigger>
          <TabsTrigger value="strategy">Strategy</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {/* Current Situation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Current Situation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Supplier</p>
                  <p className="font-semibold">{brief.currentSituation.supplierName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Current Rate</p>
                  <p className="font-semibold text-2xl">
                    ${brief.currentSituation.currentRate.toLocaleString()}/day
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Role</p>
                  <p className="font-semibold">
                    {brief.currentSituation.roleStandardized} ({brief.currentSituation.seniority})
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Location</p>
                  <p className="font-semibold">{brief.currentSituation.country}</p>
                </div>
                {brief.currentSituation.volumeCommitted && (
                  <div>
                    <p className="text-sm text-muted-foreground">Volume Committed</p>
                    <p className="font-semibold">{brief.currentSituation.volumeCommitted} days/year</p>
                  </div>
                )}
                {brief.currentSituation.contractExpiry && (
                  <div>
                    <p className="text-sm text-muted-foreground">Contract Expiry</p>
                    <p className="font-semibold">
                      {new Date(brief.currentSituation.contractExpiry).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Market Position */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5" />
                Market Position
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Position</p>
                  <p className="font-semibold text-lg">{brief.marketPosition.position}</p>
                </div>
                <Badge variant={brief.marketPosition.percentileRank >= 75 ? 'destructive' : 'secondary'}>
                  {brief.marketPosition.percentileRank}th Percentile
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                <div>
                  <p className="text-sm text-muted-foreground">P25</p>
                  <p className="font-semibold">${brief.marketPosition.marketP25.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Median</p>
                  <p className="font-semibold">${brief.marketPosition.marketMedian.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">P75</p>
                  <p className="font-semibold">${brief.marketPosition.marketP75.toLocaleString()}</p>
                </div>
              </div>

              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground">Cohort Size</p>
                <p className="font-semibold">{brief.marketPosition.cohortSize} comparable rates</p>
              </div>
            </CardContent>
          </Card>

          {/* Leverage Points */}
          <Card>
            <CardHeader>
              <CardTitle>Leverage Points</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {brief.leverage.map((point, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                    <Badge variant={
                      point.strength === 'high' ? 'default' : 
                      point.strength === 'medium' ? 'secondary' : 
                      'outline'
                    }>
                      {point.strength}
                    </Badge>
                    <div className="flex-1">
                      <p className="text-sm">{point.point}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Category: {point.category}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Target Rates Tab */}
        <TabsContent value="targets" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Recommended Target Rates
              </CardTitle>
              <CardDescription>
                Data-driven rate targets based on market analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4">
                {/* Aggressive Target */}
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">Aggressive Target</h4>
                    <Badge variant="destructive">Stretch Goal</Badge>
                  </div>
                  <p className="text-3xl font-bold text-green-600">
                    ${brief.targetRates.aggressive.toLocaleString()}/day
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Savings: ${(brief.currentSituation.currentRate - brief.targetRates.aggressive).toLocaleString()}/day
                    ({(((brief.currentSituation.currentRate - brief.targetRates.aggressive) / brief.currentSituation.currentRate) * 100).toFixed(1)}%)
                  </p>
                </div>

                {/* Realistic Target */}
                <div className="p-4 border-2 border-primary rounded-lg bg-primary/5">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">Realistic Target</h4>
                    <Badge>Recommended</Badge>
                  </div>
                  <p className="text-3xl font-bold text-blue-600">
                    ${brief.targetRates.realistic.toLocaleString()}/day
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Savings: ${(brief.currentSituation.currentRate - brief.targetRates.realistic).toLocaleString()}/day
                    ({(((brief.currentSituation.currentRate - brief.targetRates.realistic) / brief.currentSituation.currentRate) * 100).toFixed(1)}%)
                  </p>
                </div>

                {/* Fallback Target */}
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">Fallback Target</h4>
                    <Badge variant="secondary">Minimum</Badge>
                  </div>
                  <p className="text-3xl font-bold text-orange-600">
                    ${brief.targetRates.fallback.toLocaleString()}/day
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Savings: ${(brief.currentSituation.currentRate - brief.targetRates.fallback).toLocaleString()}/day
                    ({(((brief.currentSituation.currentRate - brief.targetRates.fallback) / brief.currentSituation.currentRate) * 100).toFixed(1)}%)
                  </p>
                </div>
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-semibold mb-2">Justification</h4>
                <p className="text-sm">{brief.targetRates.justification}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Talking Points Tab */}
        <TabsContent value="talking-points" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Negotiation Talking Points
              </CardTitle>
              <CardDescription>
                Data-backed points to support your negotiation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {brief.talkingPoints
                  .sort((a, b) => a.priority - b.priority)
                  .map((point, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold">{point.point}</h4>
                        <Badge variant="outline">Priority {point.priority}</Badge>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div>
                          <p className="text-muted-foreground font-medium">Supporting Data:</p>
                          <p>{point.supportingData}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground font-medium">Impact:</p>
                          <p className="text-green-600">{point.impact}</p>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alternatives Tab */}
        <TabsContent value="alternatives" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Alternative Suppliers
              </CardTitle>
              <CardDescription>
                Competitive options available in the market
              </CardDescription>
            </CardHeader>
            <CardContent>
              {brief.alternatives.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No alternative suppliers found with lower rates
                </p>
              ) : (
                <div className="space-y-4">
                  {brief.alternatives.map((alt, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-lg">{alt.supplierName}</h4>
                          <p className="text-sm text-muted-foreground">{alt.country}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-green-600">
                            ${alt.dailyRate.toLocaleString()}/day
                          </p>
                          <Badge variant="default">
                            Save {alt.savingsPercent.toFixed(1)}%
                          </Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="font-medium text-green-600 mb-1">Pros</p>
                          <ul className="list-disc list-inside space-y-1">
                            {alt.pros.map((pro, i) => (
                              <li key={i}>{pro}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="font-medium text-orange-600 mb-1">Cons</p>
                          <ul className="list-disc list-inside space-y-1">
                            {alt.cons.map((con, i) => (
                              <li key={i}>{con}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t">
                        <p className="text-sm text-muted-foreground">
                          Potential annual savings: ${(alt.savingsAmount * (brief.currentSituation.volumeCommitted || 200)).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Strategy Tab */}
        <TabsContent value="strategy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recommended Strategy</CardTitle>
              <CardDescription>
                AI-generated negotiation approach based on your situation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none">
                <p className="text-base leading-relaxed">{brief.recommendedStrategy}</p>
              </div>
            </CardContent>
          </Card>

          {/* Risks */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Risk Assessment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {brief.risks.map((risk, index) => (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold">{risk.risk}</h4>
                      <Badge variant={
                        risk.severity === 'high' ? 'destructive' :
                        risk.severity === 'medium' ? 'default' :
                        'secondary'
                      }>
                        {risk.severity} severity
                      </Badge>
                    </div>
                    <div className="text-sm">
                      <p className="text-muted-foreground font-medium">Mitigation:</p>
                      <p>{risk.mitigation}</p>
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
