"use client";

import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  DollarSign,
  Users,
  Shield,
  BarChart3,
  Activity,
  Zap
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface DashboardMetrics {
  totalContracts: number;
  totalValue: number;
  riskDistribution: {
    high: number;
    medium: number;
    low: number;
  };
  complianceScore: number;
  processingQueue: number;
  recentActivity: Array<{
    id: string;
    type: 'upload' | 'analysis' | 'risk' | 'compliance';
    contract: string;
    timestamp: string;
    status: 'completed' | 'processing' | 'failed';
  }>;
}

export function EnhancedContractDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalContracts: 0,
    totalValue: 0,
    riskDistribution: { high: 0, medium: 0, low: 0 },
    complianceScore: 0,
    processingQueue: 0,
    recentActivity: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading dashboard metrics
    const loadMetrics = async () => {
      // In real implementation, fetch from API
      setTimeout(() => {
        setMetrics({
          totalContracts: 247,
          totalValue: 12500000,
          riskDistribution: { high: 23, medium: 89, low: 135 },
          complianceScore: 87,
          processingQueue: 5,
          recentActivity: [
            {
              id: '1',
              type: 'analysis',
              contract: 'MSA-TechCorp-2024.pdf',
              timestamp: '2 minutes ago',
              status: 'completed'
            },
            {
              id: '2', 
              type: 'upload',
              contract: 'SOW-DataAnalytics-Q1.pdf',
              timestamp: '5 minutes ago',
              status: 'processing'
            },
            {
              id: '3',
              type: 'risk',
              contract: 'NDA-Supplier-ABC.pdf', 
              timestamp: '12 minutes ago',
              status: 'completed'
            }
          ]
        });
        setLoading(false);
      }, 1000);
    };

    loadMetrics();
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getRiskColor = (level: 'high' | 'medium' | 'low') => {
    switch (level) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'upload': return <FileText className="w-4 h-4" />;
      case 'analysis': return <BarChart3 className="w-4 h-4" />;
      case 'risk': return <AlertTriangle className="w-4 h-4" />;
      case 'compliance': return <Shield className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50';
      case 'processing': return 'text-blue-600 bg-blue-50';
      case 'failed': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Contracts</p>
                <p className="text-3xl font-bold text-gray-900">{metrics.totalContracts}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-full">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm text-green-600">
              <TrendingUp className="w-4 h-4 mr-1" />
              +12% from last month
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Portfolio Value</p>
                <p className="text-3xl font-bold text-gray-900">{formatCurrency(metrics.totalValue)}</p>
              </div>
              <div className="p-3 bg-green-50 rounded-full">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm text-green-600">
              <TrendingUp className="w-4 h-4 mr-1" />
              +8% from last quarter
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Compliance Score</p>
                <p className="text-3xl font-bold text-gray-900">{metrics.complianceScore}%</p>
              </div>
              <div className="p-3 bg-purple-50 rounded-full">
                <Shield className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <div className="mt-4">
              <Progress value={metrics.complianceScore} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Processing Queue</p>
                <p className="text-3xl font-bold text-gray-900">{metrics.processingQueue}</p>
              </div>
              <div className="p-3 bg-orange-50 rounded-full">
                <Zap className="w-6 h-6 text-orange-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm text-blue-600">
              <Clock className="w-4 h-4 mr-1" />
              ~15 min remaining
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risk Distribution and Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              Risk Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(metrics.riskDistribution).map(([level, count]) => {
                const total = Object.values(metrics.riskDistribution).reduce((a, b) => a + b, 0);
                const percentage = total > 0 ? (count / total) * 100 : 0;
                
                return (
                  <div key={level} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${getRiskColor(level as any)}`}></div>
                      <span className="capitalize font-medium">{level} Risk</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${getRiskColor(level as any)}`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium w-8 text-right">{count}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metrics.recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className="p-2 bg-white rounded-full shadow-sm">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {activity.contract}
                    </p>
                    <p className="text-xs text-gray-500">{activity.timestamp}</p>
                  </div>
                  <Badge className={`text-xs ${getStatusColor(activity.status)}`}>
                    {activity.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button className="p-4 text-left rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group">
              <FileText className="w-8 h-8 text-blue-600 mb-2 group-hover:scale-110 transition-transform" />
              <h3 className="font-medium text-gray-900">Upload Contract</h3>
              <p className="text-sm text-gray-500">Add new contract for analysis</p>
            </button>
            
            <button className="p-4 text-left rounded-lg border border-gray-200 hover:border-green-300 hover:bg-green-50 transition-colors group">
              <BarChart3 className="w-8 h-8 text-green-600 mb-2 group-hover:scale-110 transition-transform" />
              <h3 className="font-medium text-gray-900">View Analytics</h3>
              <p className="text-sm text-gray-500">Explore contract insights</p>
            </button>
            
            <button className="p-4 text-left rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-colors group">
              <Users className="w-8 h-8 text-purple-600 mb-2 group-hover:scale-110 transition-transform" />
              <h3 className="font-medium text-gray-900">Compare Contracts</h3>
              <p className="text-sm text-gray-500">AI-powered comparison</p>
            </button>
            
            <button className="p-4 text-left rounded-lg border border-gray-200 hover:border-orange-300 hover:bg-orange-50 transition-colors group">
              <AlertTriangle className="w-8 h-8 text-orange-600 mb-2 group-hover:scale-110 transition-transform" />
              <h3 className="font-medium text-gray-900">Risk Alerts</h3>
              <p className="text-sm text-gray-500">Review high-risk items</p>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}