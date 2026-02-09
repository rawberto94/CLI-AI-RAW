'use client';

/**
 * AI Insights Dashboard
 * Centralized view of all autonomous agent activity and recommendations
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import {
  Brain,
  Sparkles,
  TrendingUp,
  Shield,
  Activity,
  Zap,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import { OpportunitiesDashboard } from '@/components/agents/OpportunitiesDashboard';

interface DashboardStats {
  totalEvents: number;
  activeRecommendations: number;
  totalOpportunityValue: number;
  healthyContracts: number;
  atRiskContracts: number;
  avgHealthScore: number;
  learningRecords: number;
}

const fetchAgentStats = async (): Promise<DashboardStats> => {
  const response = await fetch('/api/agents/dashboard-stats');
  if (!response.ok) throw new Error('Failed to fetch stats');
  return response.json();
};

const fetchOpportunities = async () => {
  const tenantId = 'current-tenant'; // Get from auth context
  const response = await fetch(`/api/agents/opportunities?tenantId=${tenantId}`);
  if (!response.ok) throw new Error('Failed to fetch opportunities');
  return response.json();
};

export default function AIInsightsDashboard() {
  const [activeTab, setActiveTab] = useState('overview');

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['agent-stats'],
    queryFn: fetchAgentStats,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: opportunitiesData, isLoading: opportunitiesLoading } = useQuery({
    queryKey: ['opportunities'],
    queryFn: fetchOpportunities,
    refetchInterval: 60000, // Refresh every minute
  });

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.4 }
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 text-white shadow-lg">
                <Brain className="h-6 w-6" />
              </div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                AI Insights
              </h1>
              <Badge className="bg-gradient-to-r from-violet-500 to-pink-500 text-white border-0">
                Powered by Autonomous Agents
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Real-time insights and recommendations from 9 autonomous AI agents
            </p>
          </div>
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Data
          </Button>
        </motion.div>

        {/* Stats Overview */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <motion.div variants={itemVariants}>
            <Card className="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 border-violet-200/60">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-violet-600 dark:text-violet-400 mb-1">
                      Active Recommendations
                    </p>
                    <p className="text-3xl font-bold text-slate-900 dark:text-white">
                      {statsLoading ? '...' : stats?.activeRecommendations || 0}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-violet-100 dark:bg-violet-900/50">
                    <Sparkles className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card className="bg-gradient-to-br from-violet-50 to-violet-50 dark:from-violet-950/30 dark:to-violet-950/30 border-green-200/60">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-600 dark:text-green-400 mb-1">
                      Potential Savings
                    </p>
                    <p className="text-3xl font-bold text-slate-900 dark:text-white">
                      {statsLoading ? '...' : `$${(stats?.totalOpportunityValue || 0).toLocaleString()}`}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-green-100 dark:bg-green-900/50">
                    <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card className="bg-gradient-to-br from-violet-50 to-pink-50 dark:from-violet-950/30 dark:to-pink-950/30 border-violet-200/60">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-violet-600 dark:text-violet-400 mb-1">
                      Avg Health Score
                    </p>
                    <p className="text-3xl font-bold text-slate-900 dark:text-white">
                      {statsLoading ? '...' : `${stats?.avgHealthScore || 0}/100`}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-violet-100 dark:bg-violet-900/50">
                    <Activity className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/30 dark:to-red-950/30 border-orange-200/60">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-orange-600 dark:text-orange-400 mb-1">
                      At-Risk Contracts
                    </p>
                    <p className="text-3xl font-bold text-slate-900 dark:text-white">
                      {statsLoading ? '...' : stats?.atRiskContracts || 0}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-orange-100 dark:bg-orange-900/50">
                    <AlertTriangle className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="opportunities">
              Opportunities
              {opportunitiesData?.count > 0 && (
                <Badge variant="secondary" className="ml-2 px-2 py-0">
                  {opportunitiesData.count}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="health">Health Monitoring</TabsTrigger>
            <TabsTrigger value="agents">Agent Activity</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Quick Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-yellow-500" />
                    Agent Performance
                  </CardTitle>
                  <CardDescription>
                    Autonomous agent activity over the last 30 days
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Total Events</span>
                      <span className="text-lg font-bold">{stats?.totalEvents || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Learning Records</span>
                      <span className="text-lg font-bold">{stats?.learningRecords || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Healthy Contracts</span>
                      <span className="text-lg font-bold text-green-600">
                        {stats?.healthyContracts || 0}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Active Agents */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-violet-500" />
                    Active Agents
                  </CardTitle>
                  <CardDescription>
                    9 autonomous agents monitoring your contracts
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { name: 'Proactive Validation', status: 'active', icon: Shield },
                      { name: 'Smart Gap Filling', status: 'active', icon: Sparkles },
                      { name: 'Health Monitor', status: 'active', icon: Activity },
                      { name: 'Opportunity Discovery', status: 'active', icon: DollarSign },
                    ].map((agent, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <agent.icon className="h-4 w-4 text-violet-600" />
                          <span className="text-sm font-medium">{agent.name}</span>
                        </div>
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" className="w-full" asChild>
                      <Link href="/agents/all">View All 9 Agents</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Opportunities Tab */}
          <TabsContent value="opportunities">
            {opportunitiesLoading ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Loading opportunities...</p>
                </CardContent>
              </Card>
            ) : (
              <OpportunitiesDashboard 
                opportunities={opportunitiesData?.opportunities || []}
                onAccept={() => {}}
                onDismiss={() => {}}
              />
            )}
          </TabsContent>

          {/* Health Monitoring Tab */}
          <TabsContent value="health">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-violet-500" />
                  Contract Health Monitoring
                </CardTitle>
                <CardDescription>
                  Continuous health assessment across your portfolio
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">
                    Select a contract to view detailed health assessment
                  </p>
                  <Button asChild>
                    <Link href="/contracts">Browse Contracts</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Agent Activity Tab */}
          <TabsContent value="agents">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-violet-500" />
                  Recent Agent Activity
                </CardTitle>
                <CardDescription>
                  Real-time feed of agent actions and recommendations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">
                    Select a contract to view agent activity
                  </p>
                  <Button asChild>
                    <Link href="/contracts">Browse Contracts</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
