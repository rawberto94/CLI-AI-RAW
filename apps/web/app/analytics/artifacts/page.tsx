'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FileText, 
  DollarSign, 
  TrendingUp, 
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  RefreshCw,
  Download
} from 'lucide-react';

interface ArtifactMetrics {
  totalArtifacts: number;
  avgConfidence: number;
  avgCompleteness: number;
  validationIssues: number;
  costSavingsTotal: number;
  byType: Record<string, {
    count: number;
    avgConfidence: number;
    avgCompleteness: number;
    issues: number;
  }>;
  recentActivity: Array<{
    id: string;
    contractName: string;
    artifactType: string;
    confidence: number;
    completeness: number;
    createdAt: string;
  }>;
}

export default function ArtifactsAnalyticsPage() {
  const [metrics, setMetrics] = useState<ArtifactMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      // Get tenant ID from environment or session
      const tenantId = process.env.NEXT_PUBLIC_TENANT_ID || 'default-tenant';
      
      const response = await fetch(`/api/analytics/artifacts?tenantId=${tenantId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch artifact metrics');
      }
      
      const result = await response.json();
      
      if (result.success && result.data) {
        setMetrics(result.data);
      } else {
        // Fallback to empty state
        setMetrics({
          totalArtifacts: 0,
          avgConfidence: 0,
          avgCompleteness: 0,
          validationIssues: 0,
          costSavingsTotal: 0,
          byType: {
            OVERVIEW: { count: 0, avgConfidence: 0, avgCompleteness: 0, issues: 0 },
            FINANCIAL: { count: 0, avgConfidence: 0, avgCompleteness: 0, issues: 0 },
            CLAUSES: { count: 0, avgConfidence: 0, avgCompleteness: 0, issues: 0 },
            RATES: { count: 0, avgConfidence: 0, avgCompleteness: 0, issues: 0 },
            COMPLIANCE: { count: 0, avgConfidence: 0, avgCompleteness: 0, issues: 0 },
            RISK: { count: 0, avgConfidence: 0, avgCompleteness: 0, issues: 0 }
          },
          recentActivity: []
        });
      }
    } catch (error) {
      console.error('Failed to load metrics:', error);
      // Set empty state on error
      setMetrics({
        totalArtifacts: 0,
        avgConfidence: 0,
        avgCompleteness: 0,
        validationIssues: 0,
        costSavingsTotal: 0,
        byType: {
          OVERVIEW: { count: 0, avgConfidence: 0, avgCompleteness: 0, issues: 0 },
          FINANCIAL: { count: 0, avgConfidence: 0, avgCompleteness: 0, issues: 0 },
          CLAUSES: { count: 0, avgConfidence: 0, avgCompleteness: 0, issues: 0 },
          RATES: { count: 0, avgConfidence: 0, avgCompleteness: 0, issues: 0 },
          COMPLIANCE: { count: 0, avgConfidence: 0, avgCompleteness: 0, issues: 0 },
          RISK: { count: 0, avgConfidence: 0, avgCompleteness: 0, issues: 0 }
        },
        recentActivity: []
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  const artifactTypes = ['OVERVIEW', 'FINANCIAL', 'CLAUSES', 'RATES', 'COMPLIANCE', 'RISK'];

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Artifact Analytics</h1>
          <p className="text-gray-600 mt-2">
            Performance metrics and insights for contract artifact generation
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
          <Button onClick={loadMetrics}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Artifacts</p>
                <p className="text-2xl font-bold">{metrics.totalArtifacts.toLocaleString()}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Confidence</p>
                <p className="text-2xl font-bold">{Math.round(metrics.avgConfidence * 100)}%</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Completeness</p>
                <p className="text-2xl font-bold">{metrics.avgCompleteness}%</p>
              </div>
              <BarChart3 className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Cost Savings</p>
                <p className="text-2xl font-bold text-green-600">
                  ${(metrics.costSavingsTotal / 1000000).toFixed(1)}M
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="by-type">By Artifact Type</TabsTrigger>
          <TabsTrigger value="activity">Recent Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quality Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Quality Metrics</CardTitle>
                <CardDescription>
                  Overall artifact generation quality
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Average Confidence</span>
                    <span className="font-medium">{Math.round(metrics.avgConfidence * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full" 
                      style={{ width: `${metrics.avgConfidence * 100}%` }}
                    ></div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Average Completeness</span>
                    <span className="font-medium">{metrics.avgCompleteness}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full" 
                      style={{ width: `${metrics.avgCompleteness}%` }}
                    ></div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Validation Issues</span>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      <span className="font-medium">{metrics.validationIssues}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cost Savings Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Cost Savings Impact</CardTitle>
                <CardDescription>
                  Total savings identified across all contracts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <div className="text-4xl font-bold text-green-600 mb-2">
                    ${(metrics.costSavingsTotal / 1000000).toFixed(1)}M
                  </div>
                  <div className="text-sm text-gray-600 mb-4">
                    Total potential savings identified
                  </div>
                  <Badge className="bg-green-100 text-green-800">
                    Across {metrics.totalArtifacts} artifacts
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="by-type" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {artifactTypes.map((type) => {
              const typeData = metrics.byType[type];
              return (
                <Card key={type}>
                  <CardHeader>
                    <CardTitle className="text-lg">{type}</CardTitle>
                    <CardDescription>
                      {typeData.count} artifacts generated
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Confidence</span>
                      <Badge className={`${
                        typeData.avgConfidence >= 0.8 ? 'bg-green-100 text-green-800' :
                        typeData.avgConfidence >= 0.6 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {Math.round(typeData.avgConfidence * 100)}%
                      </Badge>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Completeness</span>
                      <Badge className={`${
                        typeData.avgCompleteness >= 80 ? 'bg-green-100 text-green-800' :
                        typeData.avgCompleteness >= 60 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {typeData.avgCompleteness}%
                      </Badge>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Issues</span>
                      <div className="flex items-center gap-1">
                        {typeData.issues > 0 && <AlertTriangle className="h-3 w-3 text-yellow-500" />}
                        <span className="text-sm font-medium">{typeData.issues}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Latest artifact generations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {metrics.recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between p-4 border rounded-lg hover:shadow-sm transition-shadow">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-blue-50 rounded-lg">
                        <FileText className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <div className="font-medium">{activity.contractName}</div>
                        <div className="text-sm text-gray-600">
                          {activity.artifactType} • {new Date(activity.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm font-medium">
                          {Math.round(activity.confidence * 100)}% confidence
                        </div>
                        <div className="text-sm text-gray-600">
                          {activity.completeness}% complete
                        </div>
                      </div>
                      <Badge className={`${
                        activity.confidence >= 0.8 ? 'bg-green-100 text-green-800' :
                        activity.confidence >= 0.6 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {activity.confidence >= 0.8 ? 'High' :
                         activity.confidence >= 0.6 ? 'Medium' : 'Low'}
                      </Badge>
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
