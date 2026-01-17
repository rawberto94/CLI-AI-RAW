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
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
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
        <TabsList className="flex flex-wrap gap-1 h-auto p-1">
          <TabsTrigger value="overview" className="gap-2">
            <Sparkles className="w-4 h-4" />
            Overview
          </TabsTrigger>
          {AI_DASHBOARDS.map(dashboard => {
            const Icon = dashboard.icon;
            return (
              <TabsTrigger key={dashboard.id} value={dashboard.id} className="gap-2">
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
            <Card>
              <CardContent className="p-5 text-center">
                <Zap className="w-6 h-6 mx-auto text-amber-500" />
                <p className="text-2xl font-bold mt-2">5</p>
                <p className="text-xs text-muted-foreground">AI Modules</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 text-center">
                <Activity className="w-6 h-6 mx-auto text-green-500" />
                <p className="text-2xl font-bold mt-2">99.8%</p>
                <p className="text-xs text-muted-foreground">Uptime</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 text-center">
                <Brain className="w-6 h-6 mx-auto text-purple-500" />
                <p className="text-2xl font-bold mt-2">125K</p>
                <p className="text-xs text-muted-foreground">AI Requests</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 text-center">
                <Shield className="w-6 h-6 mx-auto text-blue-500" />
                <p className="text-2xl font-bold mt-2">98.7%</p>
                <p className="text-xs text-muted-foreground">Compliance</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 text-center">
                <TrendingUp className="w-6 h-6 mx-auto text-rose-500" />
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
                  className="hover:shadow-lg transition-all cursor-pointer group"
                  onClick={() => setActiveTab(dashboard.id)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start gap-3">
                      <div className={cn('p-3 rounded-xl', dashboard.bgColor)}>
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
                  <CardContent>
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {dashboard.features.map(feature => (
                        <Badge key={feature} variant="secondary" className="text-xs">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                    <Button variant="ghost" className="w-full justify-between group-hover:bg-primary/5">
                      Open Dashboard
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Documentation */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Getting Started with AI Features
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <h4 className="font-medium mb-2">1. Configure Models</h4>
                  <p className="text-sm text-muted-foreground">
                    Set up your preferred AI models in the Model Registry for optimal performance.
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <h4 className="font-medium mb-2">2. Enable Extraction</h4>
                  <p className="text-sm text-muted-foreground">
                    Upload contracts to automatically extract obligations, entities, and insights.
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <h4 className="font-medium mb-2">3. Monitor & Optimize</h4>
                  <p className="text-sm text-muted-foreground">
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
