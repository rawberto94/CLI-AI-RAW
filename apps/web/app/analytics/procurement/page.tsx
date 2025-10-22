'use client';

export const dynamic = 'force-dynamic'

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Users,
  Handshake,
  DollarSign,
  Calendar,
  TrendingUp,
  ArrowRight,
  BarChart3,
  Target,
  AlertCircle
} from 'lucide-react';

export default function ProcurementAnalyticsHub() {
  const analyticsModules = [
    {
      id: 'suppliers',
      title: 'Supplier Analytics',
      description: 'Comprehensive supplier performance and relationship analytics',
      icon: Users,
      color: 'from-green-500 to-blue-600',
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
      icon: Handshake,
      color: 'from-purple-500 to-pink-600',
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
      icon: DollarSign,
      color: 'from-emerald-500 to-teal-600',
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
      icon: Calendar,
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
      icon: BarChart3,
      color: 'from-blue-500 to-indigo-600',
      route: '/analytics/rate-intelligence',
      features: [
        'Market benchmarks',
        'Rate trends',
        'Geographic analysis',
        'Competitive insights'
      ],
      status: 'active'
    }
  ];

  const quickStats = [
    {
      label: 'Active Suppliers',
      value: '127',
      change: '+12%',
      trend: 'up'
    },
    {
      label: 'Savings Pipeline',
      value: '$2.4M',
      change: '+18%',
      trend: 'up'
    },
    {
      label: 'Upcoming Renewals',
      value: '23',
      change: '5 urgent',
      trend: 'neutral'
    },
    {
      label: 'Avg Supplier Score',
      value: '87%',
      change: '+3%',
      trend: 'up'
    }
  ];

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold text-gray-900">
          Procurement Intelligence
        </h1>
        <p className="text-lg text-gray-600">
          Comprehensive analytics and insights for strategic procurement decisions
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {quickStats.map((stat, index) => (
          <Card key={index}>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-bold">{stat.value}</p>
                  <span className={`text-sm font-medium ${
                    stat.trend === 'up' ? 'text-green-600' :
                    stat.trend === 'down' ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    {stat.change}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Analytics Modules */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Analytics Modules</h2>
          <Badge variant="outline" className="text-sm">
            {analyticsModules.filter(m => m.status === 'active').length} Active
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {analyticsModules.map((module) => {
            const Icon = module.icon;
            return (
              <Card key={module.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 bg-gradient-to-br ${module.color} rounded-lg`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <Badge variant="default" className="bg-green-500">
                      {module.status}
                    </Badge>
                  </div>
                  <CardTitle className="text-xl">{module.title}</CardTitle>
                  <CardDescription className="text-sm">
                    {module.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {module.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
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
            );
          })}
        </div>
      </div>

      {/* Getting Started */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Getting Started
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-700">
            Each analytics module provides comprehensive insights into different aspects of your procurement operations. 
            Use the data mode toggle to switch between real and mock data for testing and demonstrations.
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
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-sm font-medium">API Services</span>
              </div>
              <Badge variant="outline" className="bg-green-50 text-green-700">
                Operational
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-sm font-medium">Mock Data</span>
              </div>
              <Badge variant="outline" className="bg-green-50 text-green-700">
                Available
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-yellow-500" />
                <span className="text-sm font-medium">Real Data</span>
              </div>
              <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                Pending
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-sm font-medium">Data Providers</span>
              </div>
              <Badge variant="outline" className="bg-green-50 text-green-700">
                5/5 Active
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
