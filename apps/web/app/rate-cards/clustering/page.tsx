'use client';

/**
 * Rate Card Clustering Page
 * 
 * Displays clustering analysis results and consolidation opportunities
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ClusterVisualization } from '@/components/rate-cards/ClusterVisualization';
import { Loader2, Play, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ClusteringPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [clustering, setClustering] = useState(false);
  const [clusters, setClusters] = useState<any[]>([]);
  const [consolidationOpportunities, setConsolidationOpportunities] = useState<any[]>([]);
  const [arbitrageOpportunities, setArbitrageOpportunities] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Load existing clusters
  useEffect(() => {
    loadClusters();
  }, []);

  const loadClusters = async () => {
    setLoading(true);
    setError(null);

    try {
      const tenantId = 'default-tenant'; // Replace with actual tenant ID
      const response = await fetch(`/api/rate-cards/clusters?tenantId=${tenantId}`);

      if (!response.ok) {
        throw new Error('Failed to load clusters');
      }

      const data = await response.json();
      setClusters(data.clusters || []);
      setConsolidationOpportunities(data.consolidationOpportunities || []);
      setArbitrageOpportunities(data.arbitrageOpportunities || []);
      setSummary(data.summary);
    } catch (err: any) {
      setError(err.message);
      console.error('Error loading clusters:', err);
    } finally {
      setLoading(false);
    }
  };

  const runClustering = async () => {
    setClustering(true);
    setError(null);

    try {
      const tenantId = 'default-tenant'; // Replace with actual tenant ID
      const response = await fetch('/api/rate-cards/cluster', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenantId,
          // Optional parameters
          // k: 5,
          // maxIterations: 100,
          // convergenceThreshold: 0.001,
          // minClusterSize: 3,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to run clustering');
      }

      const data = await response.json();
      
      // Reload clusters to get the latest data
      await loadClusters();
    } catch (err: any) {
      setError(err.message);
      console.error('Error running clustering:', err);
    } finally {
      setClustering(false);
    }
  };

  const handleClusterClick = (clusterId: string) => {
    router.push(`/rate-cards/clustering/${clusterId}`);
  };

  if (loading) {
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
              onClick={loadClusters}
              disabled={loading || clustering}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button
              onClick={runClustering}
              disabled={clustering}
            >
              {clustering ? (
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
      {clusters.length === 0 && !loading && !clustering && (
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
              <Button onClick={runClustering} className="mt-4">
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
