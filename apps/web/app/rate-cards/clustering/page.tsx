'use client';

/**
 * Rate Card Clustering Page
 * 
 * Displays clustering analysis results and consolidation opportunities
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ClusterVisualization } from '@/components/rate-cards/ClusterVisualization';
import { Loader2, Play, RefreshCw, Boxes } from 'lucide-react';
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
  const response = await fetch('/api/rate-cards/clusters', {
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-pink-50/20 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-violet-500/20 to-pink-500/20 blur-2xl rounded-full" />
            <div className="relative p-4 bg-gradient-to-br from-violet-500 to-pink-600 rounded-2xl shadow-lg">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
          </div>
          <p className="text-slate-600">Loading clustering analysis...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-pink-50/20">
      <div className="container mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-4"
            >
              <div className="p-3 bg-gradient-to-br from-violet-500 to-pink-600 rounded-xl shadow-lg shadow-violet-500/25">
                <Boxes className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
                  Rate Card Clustering
                </h1>
                <p className="text-slate-600 mt-1">
                  Identify consolidation opportunities and cost savings through intelligent clustering
                </p>
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="flex gap-2"
            >
              <Button
                variant="outline"
                onClick={() => refetch()}
                disabled={isLoading || clusterMutation.isPending}
                className="bg-white/80 backdrop-blur-sm border-white/50 hover:bg-white hover:shadow-lg transition-all"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button
                onClick={() => clusterMutation.mutate()}
                disabled={clusterMutation.isPending}
                className="bg-gradient-to-r from-violet-500 to-pink-600 hover:from-violet-600 hover:to-pink-700 shadow-lg shadow-violet-500/25"
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
            </motion.div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="mb-6 border-red-200 bg-red-50/80 backdrop-blur-sm">
              <CardContent className="py-4">
                <p className="text-red-800">{error}</p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Summary Stats */}
        {summary && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="mb-6 bg-white/90 backdrop-blur-sm border-white/50 shadow-lg">
              <CardHeader>
                <CardTitle className="bg-gradient-to-r from-violet-600 to-pink-600 bg-clip-text text-transparent">
                  Clustering Summary
                </CardTitle>
                <CardDescription>
                  Overview of identified opportunities and potential savings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <motion.div 
                    whileHover={{ scale: 1.05 }}
                    className="p-4 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl"
                  >
                    <div className="text-sm text-slate-500 font-medium">Total Clusters</div>
                    <div className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-pink-600 bg-clip-text text-transparent">
                      {summary.totalClusters}
                    </div>
                  </motion.div>
                  <motion.div 
                    whileHover={{ scale: 1.05 }}
                    className="p-4 bg-gradient-to-br from-violet-50 to-purple-100 rounded-xl"
                  >
                    <div className="text-sm text-slate-500 font-medium">Total Opportunities</div>
                    <div className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                      {summary.totalOpportunities}
                    </div>
                  </motion.div>
                  <motion.div 
                    whileHover={{ scale: 1.05 }}
                    className="p-4 bg-gradient-to-br from-violet-50 to-violet-100 rounded-xl"
                  >
                    <div className="text-sm text-slate-500 font-medium">Consolidation Savings</div>
                    <div className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-violet-600 bg-clip-text text-transparent">
                      ${Math.round(summary.totalConsolidationSavings).toLocaleString()}
                    </div>
                  </motion.div>
                  <motion.div 
                    whileHover={{ scale: 1.05 }}
                    className="p-4 bg-gradient-to-br from-amber-50 to-orange-100 rounded-xl"
                  >
                    <div className="text-sm text-slate-500 font-medium">Arbitrage Savings</div>
                    <div className="text-2xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                      ${Math.round(summary.totalArbitrageSavings).toLocaleString()}
                    </div>
                  </motion.div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Cluster Visualization */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <ClusterVisualization
            clusters={clusters}
            consolidationOpportunities={consolidationOpportunities}
            arbitrageOpportunities={arbitrageOpportunities}
            onClusterClick={handleClusterClick}
          />
        </motion.div>

        {/* Getting Started */}
        {clusters.length === 0 && !isLoading && !clusterMutation.isPending && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="mt-6 bg-white/90 backdrop-blur-sm border-white/50 shadow-lg">
              <CardHeader>
                <CardTitle className="bg-gradient-to-r from-violet-600 to-pink-600 bg-clip-text text-transparent">
                  Get Started with Clustering
                </CardTitle>
                <CardDescription>
                  Clustering analysis helps you identify consolidation opportunities and cost savings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-slate-600">
                    The clustering algorithm will:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-sm text-slate-600">
                    <li>Group similar rate cards based on role, geography, and rate</li>
                    <li>Identify supplier consolidation opportunities</li>
                    <li>Detect geographic arbitrage opportunities</li>
                    <li>Calculate potential cost savings</li>
                    <li>Assess implementation risk and complexity</li>
                  </ul>
                  <Button 
                    onClick={() => clusterMutation.mutate()} 
                    className="mt-4 bg-gradient-to-r from-violet-500 to-pink-600 hover:from-violet-600 hover:to-pink-700 shadow-lg shadow-violet-500/25"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Run Your First Clustering Analysis
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}
