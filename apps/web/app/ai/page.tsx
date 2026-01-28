'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sparkles,
  Brain,
  Network,
  Target,
  TrendingUp,
  Cpu,
  Shield,
  Activity,
  Zap,
  BookOpen,
  Settings,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Lazy load heavy dashboard components
import dynamic from 'next/dynamic';

const AIDecisionAuditDashboard = dynamic(
  () => import('@/components/ai/AIDecisionAuditDashboard').then(mod => ({ default: mod.AIDecisionAuditDashboard })),
  { loading: () => <DashboardSkeleton /> }
);

const KnowledgeGraphVisualization = dynamic(
  () => import('@/components/ai/KnowledgeGraphVisualization').then(mod => ({ default: mod.KnowledgeGraphVisualization })),
  { loading: () => <DashboardSkeleton /> }
);

const ObligationTrackerDashboard = dynamic(
  () => import('@/components/ai/ObligationTrackerDashboard').then(mod => ({ default: mod.ObligationTrackerDashboard })),
  { loading: () => <DashboardSkeleton /> }
);

const PredictiveAnalyticsDashboard = dynamic(
  () => import('@/components/ai/PredictiveAnalyticsDashboard').then(mod => ({ default: mod.PredictiveAnalyticsDashboard })),
  { loading: () => <DashboardSkeleton /> }
);

const ModelRegistryDashboard = dynamic(
  () => import('@/components/ai/ModelRegistryDashboard').then(mod => ({ default: mod.ModelRegistryDashboard })),
  { loading: () => <DashboardSkeleton /> }
);

function DashboardSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-64 bg-muted rounded" />
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-24 bg-muted rounded-lg" />
        ))}
      </div>
      <div className="h-96 bg-muted rounded-lg" />
    </div>
  );
}

// Dashboard Configuration
const AI_DASHBOARDS = [
  {
    id: 'audit',
    title: 'AI Decision Audit',
    description: 'Track AI decisions, governance compliance, and model accountability',
    icon: Shield,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    features: ['Decision Logging', 'Compliance Tracking', 'Risk Flags', 'Usage Analytics'],
  },
  {
    id: 'graph',
    title: 'Knowledge Graph',
    description: 'Visualize entity relationships and contract connections',
    icon: Network,
    color: 'text-violet-600',
    bgColor: 'bg-violet-100',
    features: ['Entity Mapping', 'Relationship Viz', 'Cluster Detection', 'Search & Filter'],
  },
  {
    id: 'obligations',
    title: 'Obligation Tracker',
    description: 'Monitor contractual obligations and compliance deadlines',
    icon: Target,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    features: ['Obligation Extraction', 'Deadline Alerts', 'Compliance Gauge', 'Calendar View'],
  },
  {
    id: 'predictions',
    title: 'Predictive Analytics',
    description: 'AI-powered forecasting for renewals, risks, and opportunities',
    icon: TrendingUp,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
    features: ['Renewal Predictions', 'Risk Forecasting', 'Value Analysis', 'Portfolio Insights'],
  },
  {
    id: 'models',
    title: 'Model Registry',
    description: 'Manage AI models, versions, and A/B experiments',
    icon: Cpu,
    color: 'text-rose-600',
    bgColor: 'bg-rose-100',
    features: ['Model Governance', 'Performance Metrics', 'A/B Testing', 'Version Control'],
  },
];

export default function AICommandCenterPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const tenantId = 'demo-tenant';

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5">
              <Brain className="w-8 h-8 text-primary" />
            </div>
            AI Command Center
          </h1>
          <p className="text-muted-foreground mt-1">
            Enterprise AI capabilities for contract intelligence
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Activity className="w-3 h-3 text-green-500" />
            All Systems Operational
          </Badge>
          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            Configure
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1.5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 shadow-lg shadow-slate-200/30 dark:shadow-slate-900/30 rounded-xl">
          <TabsTrigger 
            value="overview" 
            className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:via-violet-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-primary/30 rounded-lg transition-all duration-200"
          >
            <Sparkles className="w-4 h-4" />
            Overview
          </TabsTrigger>
          {AI_DASHBOARDS.map(dashboard => {
            const Icon = dashboard.icon;
            return (
              <TabsTrigger 
                key={dashboard.id} 
                value={dashboard.id} 
                className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:via-violet-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-primary/30 rounded-lg transition-all duration-200"
              >
                <Icon className="w-4 h-4" />
                <span className="hidden md:inline">{dashboard.title}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-5">
            <Card className="group relative overflow-hidden bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border-white/50 dark:border-slate-700/50 shadow-lg hover:shadow-xl hover:shadow-amber-200/30 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <CardContent className="p-5 text-center relative">
                <div className="inline-flex p-2.5 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-lg shadow-amber-500/30 group-hover:scale-110 transition-transform duration-300">
                  <Zap className="w-6 h-6" />
                </div>
                <p className="text-2xl font-bold mt-2">5</p>
                <p className="text-xs text-muted-foreground">AI Modules</p>
              </CardContent>
            </Card>
            <Card className="group relative overflow-hidden bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border-white/50 dark:border-slate-700/50 shadow-lg hover:shadow-xl hover:shadow-green-200/30 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <CardContent className="p-5 text-center relative">
                <div className="inline-flex p-2.5 rounded-xl bg-gradient-to-br from-violet-400 to-violet-600 text-white shadow-lg shadow-green-500/30 group-hover:scale-110 transition-transform duration-300">
                  <Activity className="w-6 h-6" />
                </div>
                <p className="text-2xl font-bold mt-2">99.8%</p>
                <p className="text-xs text-muted-foreground">Uptime</p>
              </CardContent>
            </Card>
            <Card className="group relative overflow-hidden bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border-white/50 dark:border-slate-700/50 shadow-lg hover:shadow-xl hover:shadow-purple-200/30 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <CardContent className="p-5 text-center relative">
                <div className="inline-flex p-2.5 rounded-xl bg-gradient-to-br from-purple-400 to-violet-600 text-white shadow-lg shadow-purple-500/30 group-hover:scale-110 transition-transform duration-300">
                  <Brain className="w-6 h-6" />
                </div>
                <p className="text-2xl font-bold mt-2">125K</p>
                <p className="text-xs text-muted-foreground">AI Requests</p>
              </CardContent>
            </Card>
            <Card className="group relative overflow-hidden bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border-white/50 dark:border-slate-700/50 shadow-lg hover:shadow-xl hover:shadow-violet-200/30 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <CardContent className="p-5 text-center relative">
                <div className="inline-flex p-2.5 rounded-xl bg-gradient-to-br from-violet-400 to-purple-600 text-white shadow-lg shadow-violet-500/30 group-hover:scale-110 transition-transform duration-300">
                  <Shield className="w-6 h-6" />
                </div>
                <p className="text-2xl font-bold mt-2">98.7%</p>
                <p className="text-xs text-muted-foreground">Compliance</p>
              </CardContent>
            </Card>
            <Card className="group relative overflow-hidden bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border-white/50 dark:border-slate-700/50 shadow-lg hover:shadow-xl hover:shadow-rose-200/30 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <CardContent className="p-5 text-center relative">
                <div className="inline-flex p-2.5 rounded-xl bg-gradient-to-br from-rose-400 to-pink-600 text-white shadow-lg shadow-rose-500/30 group-hover:scale-110 transition-transform duration-300">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <p className="text-2xl font-bold mt-2">94%</p>
                <p className="text-xs text-muted-foreground">Accuracy</p>
              </CardContent>
            </Card>
          </div>

          {/* Dashboard Cards */}
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {AI_DASHBOARDS.map(dashboard => {
              const Icon = dashboard.icon;
              return (
                <Card 
                  key={dashboard.id}
                  className="group relative overflow-hidden bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border-white/50 dark:border-slate-700/50 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300 cursor-pointer hover:-translate-y-1"
                  onClick={() => setActiveTab(dashboard.id)}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <CardHeader className="pb-2 relative">
                    <div className="flex items-start gap-3">
                      <div className={cn('p-3 rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300', dashboard.bgColor)}>
                        <Icon className={cn('w-6 h-6', dashboard.color)} />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-lg group-hover:text-primary transition-colors">
                          {dashboard.title}
                        </CardTitle>
                        <CardDescription className="text-sm mt-1">
                          {dashboard.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="relative">
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {dashboard.features.map(feature => (
                        <Badge key={feature} variant="secondary" className="text-xs bg-slate-100/80 dark:bg-slate-800/80">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                    <Button variant="ghost" className="w-full justify-between group-hover:bg-primary/10 transition-colors">
                      Open Dashboard
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Documentation */}
          <Card className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border-white/50 dark:border-slate-700/50 shadow-lg overflow-hidden">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800/50 dark:to-slate-900/50">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-md">
                  <BookOpen className="w-4 h-4" />
                </div>
                Getting Started with AI Features
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="group p-5 rounded-xl bg-gradient-to-br from-violet-50 to-purple-50/50 dark:from-violet-950/30 dark:to-purple-950/30 border border-violet-100/50 dark:border-violet-800/30 hover:shadow-lg hover:shadow-violet-200/30 transition-all duration-300">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 text-white shadow-md group-hover:scale-110 transition-transform">
                      <Cpu className="w-4 h-4" />
                    </div>
                    <h4 className="font-semibold text-violet-900 dark:text-violet-100">1. Configure Models</h4>
                  </div>
                  <p className="text-sm text-violet-700/80 dark:text-violet-300/80">
                    Set up your preferred AI models in the Model Registry for optimal performance.
                  </p>
                </div>
                <div className="group p-5 rounded-xl bg-gradient-to-br from-purple-50 to-violet-50/50 dark:from-purple-950/30 dark:to-violet-950/30 border border-purple-100/50 dark:border-purple-800/30 hover:shadow-lg hover:shadow-purple-200/30 transition-all duration-300">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-violet-500 text-white shadow-md group-hover:scale-110 transition-transform">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <h4 className="font-semibold text-purple-900 dark:text-purple-100">2. Enable Extraction</h4>
                  </div>
                  <p className="text-sm text-purple-700/80 dark:text-purple-300/80">
                    Upload contracts to automatically extract obligations, entities, and insights.
                  </p>
                </div>
                <div className="group p-5 rounded-xl bg-gradient-to-br from-violet-50 to-purple-50/50 dark:from-violet-950/30 dark:to-purple-950/30 border border-violet-100/50 dark:border-violet-800/30 hover:shadow-lg hover:shadow-violet-200/30 transition-all duration-300">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 text-white shadow-md group-hover:scale-110 transition-transform">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <h4 className="font-semibold text-violet-900 dark:text-violet-100">3. Monitor & Optimize</h4>
                  </div>
                  <p className="text-sm text-violet-700/80 dark:text-violet-300/80">
                    Use the Decision Audit dashboard to track AI performance and compliance.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Individual Dashboard Tabs */}
        <TabsContent value="audit">
          <AIDecisionAuditDashboard tenantId={tenantId} />
        </TabsContent>

        <TabsContent value="graph">
          <KnowledgeGraphVisualization tenantId={tenantId} contractId="demo-contract" />
        </TabsContent>

        <TabsContent value="obligations">
          <ObligationTrackerDashboard tenantId={tenantId} />
        </TabsContent>

        <TabsContent value="predictions">
          <PredictiveAnalyticsDashboard tenantId={tenantId} />
        </TabsContent>

        <TabsContent value="models">
          <ModelRegistryDashboard tenantId={tenantId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
