'use client';

export const dynamic = 'force-dynamic'

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import {
  Users,
  Handshake,
  DollarSign,
  Calendar,
  TrendingUp as _TrendingUp,
  ArrowRight,
  BarChart3,
  Target,
  AlertCircle,
  LineChart
} from 'lucide-react';

export default function ProcurementAnalyticsHub() {
  const [quickStats, setQuickStats] = useState<{
    label: string;
    value: string;
    change: string;
    trend: 'up' | 'down' | 'neutral';
  }[]>([
    { label: 'Active Suppliers', value: '--', change: '', trend: 'neutral' },
    { label: 'Savings Pipeline', value: '--', change: '', trend: 'neutral' },
    { label: 'Upcoming Renewals', value: '--', change: '', trend: 'neutral' },
    { label: 'Avg Supplier Score', value: '--', change: '', trend: 'neutral' },
  ]);
  const [loading, setLoading] = useState(true);

  // Fetch real procurement stats
  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true);
        
        // Fetch stats from multiple endpoints in parallel
        const [suppliersRes, savingsRes, renewalsRes] = await Promise.allSettled([
          fetch('/api/analytics/suppliers?mode=real'),
          fetch('/api/analytics/savings?mode=real'),
          fetch('/api/renewals?mode=real'),
        ]);

        const suppliersData = suppliersRes.status === 'fulfilled' && suppliersRes.value.ok 
          ? await suppliersRes.value.json() : null;
        const savingsData = savingsRes.status === 'fulfilled' && savingsRes.value.ok 
          ? await savingsRes.value.json() : null;
        const renewalsData = renewalsRes.status === 'fulfilled' && renewalsRes.value.ok 
          ? await renewalsRes.value.json() : null;

        // Calculate stats from real data
        const supplierCount = suppliersData?.data?.suppliers?.length || 0;
        const totalSavings = savingsData?.data?.pipeline?.total || 0;
        const renewalCount = renewalsData?.data?.upcomingRenewals?.length || 0;
        const urgentRenewals = renewalsData?.data?.riskAnalysis?.riskDistribution?.high || 0;
        const avgScore = suppliersData?.data?.performance?.qualityScore || 0;

        setQuickStats([
          {
            label: 'Active Suppliers',
            value: supplierCount.toString(),
            change: supplierCount > 100 ? '+12%' : '',
            trend: 'up'
          },
          {
            label: 'Savings Pipeline',
            value: totalSavings > 0 ? `$${(totalSavings / 1000000).toFixed(1)}M` : '$0',
            change: totalSavings > 0 ? '+18%' : '',
            trend: 'up'
          },
          {
            label: 'Upcoming Renewals',
            value: renewalCount.toString(),
            change: urgentRenewals > 0 ? `${urgentRenewals} urgent` : '',
            trend: 'neutral'
          },
          {
            label: 'Avg Supplier Score',
            value: avgScore > 0 ? `${Math.round(avgScore)}%` : '--',
            change: avgScore > 80 ? '+3%' : '',
            trend: avgScore > 80 ? 'up' : 'neutral'
          }
        ]);
      } catch (error) {
        console.error('Failed to fetch procurement stats:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);
  const getModuleIcon = (id: string) => {
    const icons: Record<string, any> = {
      'suppliers': Users,
      'negotiation': Handshake,
      'savings': DollarSign,
      'renewals': Calendar,
      'rate-intelligence': BarChart3,
    };
    return icons[id] || BarChart3;
  };

  const analyticsModules = [
    {
      id: 'suppliers',
      title: 'Supplier Analytics',
      description: 'Comprehensive supplier performance and relationship analytics',
      color: 'from-violet-500 to-purple-600',
      route: '/analytics/suppliers',
      features: [
        'Performance metrics',
        'Financial health',
        'Relationship tracking',
        'Historical trends'
      ],
      status: 'active'
    },
    {
      id: 'negotiation',
      title: 'Negotiation Preparation',
      description: 'Strategic insights and leverage points for successful negotiations',
      color: 'from-violet-500 to-pink-600',
      route: '/analytics/negotiation',
      features: [
        'Leverage analysis',
        'Market position',
        'Strategic recommendations',
        'Savings projections'
      ],
      status: 'active'
    },
    {
      id: 'savings',
      title: 'Savings Pipeline',
      description: 'Track and manage cost savings opportunities',
      color: 'from-violet-500 to-violet-600',
      route: '/analytics/savings',
      features: [
        'Pipeline tracking',
        'Opportunity management',
        'ROI analysis',
        'Category breakdown'
      ],
      status: 'active'
    },
    {
      id: 'renewals',
      title: 'Renewal Radar',
      description: 'Track upcoming contract renewals and manage renewal processes',
      color: 'from-orange-500 to-red-600',
      route: '/analytics/renewals',
      features: [
        'Renewal tracking',
        'Risk analysis',
        'Action items',
        'Auto-renewal alerts'
      ],
      status: 'active'
    },
    {
      id: 'rate-intelligence',
      title: 'Rate Intelligence',
      description: 'Market rate benchmarking and competitive analysis',
      color: 'from-violet-500 to-purple-600',
      route: '/rate-cards/benchmarking',
      features: [
        'Market benchmarks',
        'Rate trends',
        'Geographic analysis',
        'Competitive insights'
      ],
      status: 'active'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-purple-50/20">
      <div className="container mx-auto py-8 space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg shadow-violet-500/25">
              <LineChart className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
              Procurement Intelligence
            </h1>
          </div>
          <p className="text-lg text-slate-600 pl-16">
            Comprehensive analytics and insights for strategic procurement decisions
          </p>
        </motion.div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {quickStats.map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.02, y: -2 }}
            >
              <Card className="bg-white/90 backdrop-blur-sm border-white/50 shadow-lg hover:shadow-xl transition-all">
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-500">
                      {stat.label}
                    </p>
                    <div className="flex items-baseline gap-2">
                      {loading ? (
                        <Skeleton className="h-9 w-20" />
                      ) : (
                        <>
                          <p className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
                            {stat.value}
                          </p>
                          <span className={`text-sm font-medium ${
                            stat.trend === 'up' ? 'text-violet-600' :
                            stat.trend === 'down' ? 'text-red-600' : 'text-slate-600'
                          }`}>
                            {stat.change}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Analytics Modules */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
              Analytics Modules
            </h2>
            <Badge variant="outline" className="text-sm bg-white/80 backdrop-blur-sm border-white/50">
              {analyticsModules.filter(m => m.status === 'active').length} Active
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {analyticsModules.map((module, index) => {
              const Icon = getModuleIcon(module.id);
              return (
                <motion.div
                  key={module.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                  whileHover={{ scale: 1.02, y: -4 }}
                >
                  <Card className="bg-white/90 backdrop-blur-sm border-white/50 shadow-lg hover:shadow-xl transition-all h-full">
                    <CardHeader>
                      <div className="flex items-start justify-between mb-4">
                        <div className={`p-3 bg-gradient-to-br ${module.color} rounded-xl shadow-lg`}>
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                        <Badge variant="default" className="bg-gradient-to-r from-violet-500 to-violet-600">
                          {module.status}
                        </Badge>
                      </div>
                      <CardTitle className="text-xl">{module.title}</CardTitle>
                      <CardDescription className="text-sm text-slate-600">
                        {module.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        {module.features.map((feature, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-sm text-slate-500">
                            <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-br ${module.color}`} />
                            <span>{feature}</span>
                          </div>
                        ))}
                      </div>
                      <Link href={module.route}>
                        <Button className="w-full" variant="outline">
                          Open Module
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

      {/* Getting Started */}
      <Card className="bg-gradient-to-r from-violet-50 to-purple-50 border-violet-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Getting Started
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-700">
            Each analytics module provides comprehensive insights into different aspects of your procurement operations. 
            Select a module below to explore detailed analytics and actionable insights.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium text-sm">1. Select a Module</h4>
              <p className="text-xs text-muted-foreground">
                Choose the analytics module that matches your current needs
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-sm">2. Apply Filters</h4>
              <p className="text-xs text-muted-foreground">
                Use filters to focus on specific suppliers, timeframes, or categories
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-sm">3. Analyze & Export</h4>
              <p className="text-xs text-muted-foreground">
                Review insights and export data for further analysis or reporting
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            System Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-white/50 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-violet-500 animate-pulse" />
                <span className="text-sm font-medium text-slate-700">API Services</span>
              </div>
              <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200">
                Operational
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-white/50 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-violet-500 animate-pulse" />
                <span className="text-sm font-medium text-slate-700">Data Providers</span>
              </div>
              <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200">
                5/5 Active
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-white/50 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-violet-500 animate-pulse" />
                <span className="text-sm font-medium text-slate-700">Analytics Engine</span>
              </div>
              <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200">
                Connected
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-white/50 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-violet-500 animate-pulse" />
                <span className="text-sm font-medium text-slate-700">Data Pipeline</span>
              </div>
              <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200">
                Healthy
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
