'use client';

/**
 * Rate Card Clustering Page
 * 
 * Displays clustering analysis results and consolidation opportunities
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ClusterVisualization } from '@/components/rate-cards/ClusterVisualization';
import { Loader2, Play, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const fetchClusters = async () => {
  const tenantId = 'default-tenant';
  const response = await fetch(`/api/rate-cards/clusters?tenantId=${tenantId}`);
  if (!response.ok) throw new Error('Failed to load clusters');
  return response.json();
};

const runClusteringAnalysis = async () => {
  const tenantId = 'default-tenant';
  const response = await fetch('/api/rate-cards/cluster', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantId }),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to run clustering');
  }
  return response.json();
};

export default function ClusteringPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { 
    data, 
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['rate-card-clusters'],
    queryFn: fetchClusters,
    staleTime: 60 * 1000,
  });

  const clusterMutation = useMutation({
    mutationFn: runClusteringAnalysis,
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['rate-card-clusters'] });
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const clusters = data?.clusters || [];
  const consolidationOpportunities = data?.consolidationOpportunities || [];
  const arbitrageOpportunities = data?.arbitrageOpportunities || [];
  const summary = data?.summary;

  const handleClusterClick = (clusterId: string) => {
    router.push(`/rate-cards/clustering/${clusterId}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Rate Card Clustering</h1>
            <p className="text-gray-600 mt-2">
              Identify consolidation opportunities and cost savings through intelligent clustering
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => refetch()}
              disabled={isLoading || clusterMutation.isPending}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button
              onClick={() => clusterMutation.mutate()}
              disabled={clusterMutation.isPending}
            >
              {clusterMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Clustering...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Run Clustering
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="py-4">
            <p className="text-red-800">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      {summary && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Clustering Summary</CardTitle>
            <CardDescription>
              Overview of identified opportunities and potential savings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <div className="text-sm text-gray-500">Total Clusters</div>
                <div className="text-2xl font-bold">{summary.totalClusters}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Total Opportunities</div>
                <div className="text-2xl font-bold">{summary.totalOpportunities}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Consolidation Savings</div>
                <div className="text-2xl font-bold text-green-600">
                  ${Math.round(summary.totalConsolidationSavings).toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Arbitrage Savings</div>
                <div className="text-2xl font-bold text-green-600">
                  ${Math.round(summary.totalArbitrageSavings).toLocaleString()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cluster Visualization */}
      <ClusterVisualization
        clusters={clusters}
        consolidationOpportunities={consolidationOpportunities}
        arbitrageOpportunities={arbitrageOpportunities}
        onClusterClick={handleClusterClick}
      />

      {/* Getting Started */}
      {clusters.length === 0 && !isLoading && !clusterMutation.isPending && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Get Started with Clustering</CardTitle>
            <CardDescription>
              Clustering analysis helps you identify consolidation opportunities and cost savings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                The clustering algorithm will:
              </p>
              <ul className="list-disc list-inside space-y-2 text-sm text-gray-600">
                <li>Group similar rate cards based on role, geography, and rate</li>
                <li>Identify supplier consolidation opportunities</li>
                <li>Detect geographic arbitrage opportunities</li>
                <li>Calculate potential cost savings</li>
                <li>Assess implementation risk and complexity</li>
              </ul>
              <Button onClick={() => clusterMutation.mutate()} className="mt-4">
                <Play className="w-4 h-4 mr-2" />
                Run Your First Clustering Analysis
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
