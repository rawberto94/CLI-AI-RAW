'use client';

export const dynamic = 'force-dynamic'

import React, { useState, useEffect } from 'react';
import { PageBreadcrumb } from '@/components/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { 
  FileText, 
  DollarSign, 
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  RefreshCw,
  Download,
  Brain
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
    setLoading(true);
    try {
      const tenantId = process.env['NEXT_PUBLIC_TENANT_ID'] || '';
      
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
    } catch {
      // Set empty state on error
      toast.error('Failed to load artifact analytics');
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-purple-50/20">
        <div className="max-w-[1600px] mx-auto py-8">
          <div className="flex items-center justify-center h-64">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-violet-500/20 to-purple-500/20 blur-2xl rounded-full" />
                <div className="relative p-4 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl shadow-lg">
                  <RefreshCw className="h-8 w-8 animate-spin text-white" />
                </div>
              </div>
              <p className="text-slate-600">Loading artifact analytics...</p>
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  const artifactTypes = ['OVERVIEW', 'FINANCIAL', 'CLAUSES', 'RATES', 'COMPLIANCE', 'RISK'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-purple-50/20">
      <div className="max-w-[1600px] mx-auto py-8 space-y-6">
        {/* Breadcrumbs */}
        <div className="mb-2">
          <PageBreadcrumb />
        </div>
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg shadow-violet-500/25">
              <Brain className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
                Artifact Analytics
              </h1>
              <p className="text-slate-600 mt-1">
                Performance metrics and insights for contract artifact generation
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="bg-white/80 backdrop-blur-sm border-white/50 hover:bg-white">
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
            <Button 
              onClick={loadMetrics}
              className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 shadow-lg shadow-violet-500/25"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </motion.div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Artifacts', value: metrics.totalArtifacts.toLocaleString(), iconName: 'FileText', color: 'blue' },
            { label: 'Avg Confidence', value: `${Math.round(metrics.avgConfidence * 100)}%`, iconName: 'CheckCircle2', color: 'green' },
            { label: 'Avg Completeness', value: `${metrics.avgCompleteness}%`, iconName: 'BarChart3', color: 'purple' },
            { label: 'Cost Savings', value: `$${(metrics.costSavingsTotal / 1000000).toFixed(1)}M`, iconName: 'DollarSign', color: 'violet' }
          ].map((item, index) => {
            const IconComponent = item.iconName === 'FileText' ? FileText : item.iconName === 'CheckCircle2' ? CheckCircle2 : item.iconName === 'BarChart3' ? BarChart3 : DollarSign;
            const gradients: Record<string, string> = {
              blue: 'from-violet-500 to-purple-600',
              green: 'from-violet-500 to-violet-600',
              purple: 'from-violet-500 to-purple-600',
              emerald: 'from-violet-500 to-violet-600'
            };
            return (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.02, y: -2 }}
              >
                <Card className="bg-white/90 backdrop-blur-sm border-white/50 shadow-lg hover:shadow-xl transition-all">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-600">{item.label}</p>
                        <p className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
                          {item.value}
                        </p>
                      </div>
                      <div className={`p-3 rounded-xl bg-gradient-to-br ${gradients[item.color]} shadow-lg`}>
                        <IconComponent className="h-6 w-6 text-white" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

      {/* Main Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-white/90 backdrop-blur-sm border border-white/50">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="by-type">By Artifact Type</TabsTrigger>
            <TabsTrigger value="activity">Recent Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Quality Metrics */}
              <Card className="bg-white/90 backdrop-blur-sm border-white/50 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-violet-500" />
                    Quality Metrics
                  </CardTitle>
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
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${metrics.avgConfidence * 100}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="bg-gradient-to-r from-violet-500 to-violet-600 h-2.5 rounded-full"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Average Completeness</span>
                      <span className="font-medium">{metrics.avgCompleteness}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${metrics.avgCompleteness}%` }}
                        transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                        className="bg-gradient-to-r from-violet-500 to-purple-600 h-2.5 rounded-full"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Validation Issues</span>
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-amber-100 rounded-lg">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                        </div>
                        <span className="font-medium">{metrics.validationIssues}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Cost Savings Summary */}
              <Card className="bg-white/90 backdrop-blur-sm border-white/50 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-violet-500" />
                    Cost Savings Impact
                  </CardTitle>
                  <CardDescription>
                    Total savings identified across all contracts
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <motion.div 
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 200 }}
                      className="text-5xl font-bold bg-gradient-to-r from-violet-600 to-violet-600 bg-clip-text text-transparent mb-2"
                    >
                      ${(metrics.costSavingsTotal / 1000000).toFixed(1)}M
                    </motion.div>
                    <div className="text-sm text-slate-600 mb-4">
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
              if (!typeData) return null;
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
                      <div className="p-2 bg-violet-50 rounded-lg">
                        <FileText className="h-4 w-4 text-violet-600" />
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
        </motion.div>
      </div>
    </div>
  );
}
