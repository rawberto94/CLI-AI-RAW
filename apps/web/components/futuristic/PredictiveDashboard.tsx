"use client";

import React, { useState, useEffect } from 'react';
import { 
  Brain, 
  TrendingUp, 
  AlertTriangle, 
  DollarSign, 
  Calendar, 
  Users, 
  Zap, 
  Target, 
  Clock, 
  Shield,
  Sparkles,
  ArrowRight,
  Bell,
  CheckCircle,
  XCircle,
  Eye
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface PredictiveInsight {
  id: string;
  type: 'opportunity' | 'risk' | 'trend' | 'recommendation' | 'alert';
  title: string;
  description: string;
  confidence: number;
  impact: 'low' | 'medium' | 'high' | 'critical';
  timeframe: string;
  actionable: boolean;
  relatedContracts: string[];
  estimatedValue?: number;
  dueDate?: string;
}

interface PersonalizedMetric {
  id: string;
  title: string;
  value: number | string;
  change: number;
  trend: 'up' | 'down' | 'stable';
  icon: React.ReactNode;
  color: string;
  description: string;
  drillDown?: string;
}

export function PredictiveDashboard() {
  const [insights, setInsights] = useState<PredictiveInsight[]>([]);
  const [metrics, setMetrics] = useState<PersonalizedMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInsight, setSelectedInsight] = useState<string | null>(null);
  const [userRole] = useState<'legal' | 'finance' | 'procurement' | 'executive'>('executive');

  useEffect(() => {
    // Simulate loading personalized insights and metrics
    const loadDashboardData = async () => {
      setTimeout(() => {
        setInsights([
          {
            id: '1',
            type: 'opportunity',
            title: 'Potential Cost Savings Identified',
            description: 'AI analysis suggests renegotiating payment terms with 3 suppliers could save $240K annually',
            confidence: 0.87,
            impact: 'high',
            timeframe: 'Next 30 days',
            actionable: true,
            relatedContracts: ['MSA-TechCorp', 'Agreement-DataSys', 'Contract-CloudPro'],
            estimatedValue: 240000
          },
          {
            id: '2',
            type: 'risk',
            title: 'Contract Renewal Risk',
            description: '5 high-value contracts expire in Q2 without auto-renewal clauses',
            confidence: 0.95,
            impact: 'critical',
            timeframe: 'Next 60 days',
            actionable: true,
            relatedContracts: ['MSA-Enterprise', 'SLA-Critical'],
            dueDate: '2024-05-15'
          },
          {
            id: '3',
            type: 'trend',
            title: 'Payment Terms Trend',
            description: 'Average payment terms increasing by 12% across new contracts',
            confidence: 0.92,
            impact: 'medium',
            timeframe: 'Last 90 days',
            actionable: false,
            relatedContracts: []
          },
          {
            id: '4',
            type: 'recommendation',
            title: 'Template Standardization',
            description: 'Standardizing liability clauses could reduce legal review time by 40%',
            confidence: 0.78,
            impact: 'medium',
            timeframe: 'Implementation: 2-3 weeks',
            actionable: true,
            relatedContracts: []
          },
          {
            id: '5',
            type: 'alert',
            title: 'Compliance Gap Detected',
            description: '3 contracts missing required GDPR clauses for EU operations',
            confidence: 0.99,
            impact: 'high',
            timeframe: 'Immediate action required',
            actionable: true,
            relatedContracts: ['EU-DataProcessor', 'GDPR-Services'],
            dueDate: '2024-04-01'
          }
        ]);

        setMetrics([
          {
            id: '1',
            title: 'Portfolio Health',
            value: '87%',
            change: 5,
            trend: 'up',
            icon: <Shield className="w-5 h-5" />,
            color: 'text-green-600',
            description: 'Overall contract portfolio health score',
            drillDown: 'View health breakdown'
          },
          {
            id: '2',
            title: 'Risk Exposure',
            value: '$2.4M',
            change: -12,
            trend: 'down',
            icon: <AlertTriangle className="w-5 h-5" />,
            color: 'text-red-600',
            description: 'Total financial risk exposure',
            drillDown: 'View risk details'
          },
          {
            id: '3',
            title: 'Renewal Pipeline',
            value: 23,
            change: 8,
            trend: 'up',
            icon: <Calendar className="w-5 h-5" />,
            color: 'text-blue-600',
            description: 'Contracts requiring renewal attention',
            drillDown: 'View renewal calendar'
          },
          {
            id: '4',
            title: 'Cost Optimization',
            value: '$450K',
            change: 15,
            trend: 'up',
            icon: <DollarSign className="w-5 h-5" />,
            color: 'text-green-600',
            description: 'Identified savings opportunities',
            drillDown: 'View optimization plan'
          }
        ]);

        setLoading(false);
      }, 1500);
    };

    loadDashboardData();
  }, []);

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'opportunity': return <Target className="w-5 h-5" />;
      case 'risk': return <AlertTriangle className="w-5 h-5" />;
      case 'trend': return <TrendingUp className="w-5 h-5" />;
      case 'recommendation': return <Brain className="w-5 h-5" />;
      case 'alert': return <Bell className="w-5 h-5" />;
      default: return <Sparkles className="w-5 h-5" />;
    }
  };

  const getInsightColor = (type: string, impact: string) => {
    if (type === 'alert' || impact === 'critical') return 'border-red-200 bg-red-50';
    if (type === 'opportunity') return 'border-green-200 bg-green-50';
    if (type === 'risk') return 'border-orange-200 bg-orange-50';
    if (type === 'recommendation') return 'border-purple-200 bg-purple-50';
    return 'border-blue-200 bg-blue-50';
  };

  const getImpactBadgeColor = (impact: string) => {
    switch (impact) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTrendIcon = (trend: string, change: number) => {
    if (trend === 'up') return <TrendingUp className={`w-4 h-4 ${change > 0 ? 'text-green-600' : 'text-red-600'}`} />;
    if (trend === 'down') return <TrendingUp className={`w-4 h-4 rotate-180 ${change < 0 ? 'text-green-600' : 'text-red-600'}`} />;
    return <div className="w-4 h-4 bg-gray-400 rounded-full"></div>;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center space-y-4">
              <div className="text-center">
                <Brain className="w-12 h-12 text-blue-600 animate-pulse mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900">AI is analyzing your contracts...</h3>
                <p className="text-gray-500">Generating personalized insights and predictions</p>
                <div className="mt-4 w-64 mx-auto">
                  <Progress value={75} className="h-2" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Personalized Greeting */}
      <Card className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">Good morning! 👋</h2>
              <p className="text-blue-100">
                I've analyzed your contract portfolio and found {insights.filter(i => i.actionable).length} actionable insights for you.
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">{insights.length}</div>
              <div className="text-blue-100 text-sm">AI Insights</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric) => (
          <Card key={metric.id} className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg bg-gray-50 ${metric.color}`}>
                  {metric.icon}
                </div>
                <div className="flex items-center gap-1">
                  {getTrendIcon(metric.trend, metric.change)}
                  <span className={`text-sm font-medium ${
                    metric.change > 0 ? 'text-green-600' : metric.change < 0 ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    {metric.change > 0 ? '+' : ''}{metric.change}%
                  </span>
                </div>
              </div>
              
              <div className="mb-2">
                <div className="text-2xl font-bold text-gray-900 mb-1">
                  {metric.value}
                </div>
                <h3 className="font-medium text-gray-700">{metric.title}</h3>
              </div>
              
              <p className="text-sm text-gray-500 mb-3">{metric.description}</p>
              
              {metric.drillDown && (
                <button className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                  {metric.drillDown}
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* AI Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            Personalized AI Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {insights.map((insight) => (
              <div
                key={insight.id}
                className={`p-4 rounded-lg border-2 transition-all duration-200 cursor-pointer ${
                  getInsightColor(insight.type, insight.impact)
                } ${selectedInsight === insight.id ? 'ring-2 ring-blue-500' : ''}`}
                onClick={() => setSelectedInsight(selectedInsight === insight.id ? null : insight.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      {getInsightIcon(insight.type)}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-gray-900">{insight.title}</h4>
                        <Badge className={getImpactBadgeColor(insight.impact)}>
                          {insight.impact}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {Math.round(insight.confidence * 100)}% confidence
                        </Badge>
                      </div>
                      
                      <p className="text-gray-700 mb-3">{insight.description}</p>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {insight.timeframe}
                        </span>
                        {insight.relatedContracts.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {insight.relatedContracts.length} contracts
                          </span>
                        )}
                        {insight.estimatedValue && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            ${(insight.estimatedValue / 1000).toFixed(0)}K impact
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {insight.actionable && (
                      <Button size="sm" className="bg-purple-600 hover:bg-purple-700">
                        <Zap className="w-4 h-4 mr-2" />
                        Take Action
                      </Button>
                    )}
                    <Button variant="ghost" size="sm">
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                {selectedInsight === insight.id && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h5 className="font-medium text-gray-900 mb-2">Confidence Breakdown</h5>
                        <Progress value={insight.confidence * 100} className="h-2 mb-2" />
                        <p className="text-sm text-gray-600">
                          Based on analysis of {insight.relatedContracts.length || 'multiple'} contracts and historical patterns
                        </p>
                      </div>
                      
                      {insight.relatedContracts.length > 0 && (
                        <div>
                          <h5 className="font-medium text-gray-900 mb-2">Related Contracts</h5>
                          <div className="space-y-1">
                            {insight.relatedContracts.slice(0, 3).map((contract, index) => (
                              <div key={index} className="text-sm text-blue-600 hover:text-blue-700 cursor-pointer">
                                {contract}
                              </div>
                            ))}
                            {insight.relatedContracts.length > 3 && (
                              <div className="text-sm text-gray-500">
                                +{insight.relatedContracts.length - 3} more contracts
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {insight.actionable && (
                      <div className="mt-4 flex items-center gap-2">
                        <Button size="sm" variant="outline">
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Mark as Reviewed
                        </Button>
                        <Button size="sm" variant="outline">
                          <XCircle className="w-4 h-4 mr-2" />
                          Dismiss
                        </Button>
                        <Button size="sm" variant="outline">
                          <Calendar className="w-4 h-4 mr-2" />
                          Schedule Review
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Recommended Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button className="h-auto p-4 flex-col items-start bg-green-50 hover:bg-green-100 text-green-800 border-green-200">
              <Target className="w-6 h-6 mb-2" />
              <div className="text-left">
                <div className="font-medium">Review Cost Savings</div>
                <div className="text-sm opacity-75">$240K potential savings identified</div>
              </div>
            </Button>
            
            <Button className="h-auto p-4 flex-col items-start bg-orange-50 hover:bg-orange-100 text-orange-800 border-orange-200">
              <Calendar className="w-6 h-6 mb-2" />
              <div className="text-left">
                <div className="font-medium">Schedule Renewals</div>
                <div className="text-sm opacity-75">5 contracts need attention</div>
              </div>
            </Button>
            
            <Button className="h-auto p-4 flex-col items-start bg-purple-50 hover:bg-purple-100 text-purple-800 border-purple-200">
              <Brain className="w-6 h-6 mb-2" />
              <div className="text-left">
                <div className="font-medium">AI Analysis Report</div>
                <div className="text-sm opacity-75">Generate comprehensive insights</div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}