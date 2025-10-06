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
  Eye,
  BarChart3,
  PieChart,
  Activity,
  Rocket,
  Globe,
  Lock,
  Database,
  Cpu,
  Network,
  TrendingDown,
  Award,
  FileText,
  Search,
  MessageSquare,
  Settings,
  Download,
  Share,
  Filter,
  RefreshCw,
  Play,
  Pause,
  ChevronUp,
  ChevronDown,
  Star,
  Lightbulb,
  Briefcase,
  Building,
  CreditCard,
  Timer,
  Gauge
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface ExecutiveMetric {
  id: string;
  title: string;
  value: string | number;
  change: number;
  trend: 'up' | 'down' | 'stable';
  icon: React.ReactNode;
  color: string;
  description: string;
  benchmark?: string;
  target?: string;
  priority: 'high' | 'medium' | 'low';
}

interface BusinessInsight {
  id: string;
  type: 'cost_savings' | 'risk_mitigation' | 'efficiency' | 'compliance' | 'revenue' | 'rate_optimization' | 'supplier_benchmarking';
  title: string;
  description: string;
  impact: string;
  confidence: number;
  timeframe: string;
  roi: number;
  status: 'identified' | 'in_progress' | 'completed';
  relatedContracts: number;
  rateCardData?: RateCardData;
  benchmarkData?: SupplierBenchmark[];
}

interface RateCardData {
  supplier: string;
  services: {
    name: string;
    currentRate: number;
    marketRate: number;
    savings: number;
    unit: string;
  }[];
  totalSavings: number;
}

interface SupplierBenchmark {
  supplier: string;
  category: string;
  avgRate: number;
  marketPosition: 'below' | 'at' | 'above';
  percentile: number;
  contracts: number;
}

interface SystemMetric {
  name: string;
  value: number;
  status: 'excellent' | 'good' | 'warning' | 'critical';
  description: string;
}

export function CTODemoDashboard() {
  const [executiveMetrics, setExecutiveMetrics] = useState<ExecutiveMetric[]>([]);
  const [businessInsights, setBusinessInsights] = useState<BusinessInsight[]>([]);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [realTimeUpdates, setRealTimeUpdates] = useState(true);
  const [selectedInsight, setSelectedInsight] = useState<string | null>(null);

  useEffect(() => {
    // Load real CTO-level data from API
    const loadCTODashboard = async () => {
      try {
        // Fetch portfolio metrics
        const metricsResponse = await fetch('/api/portfolio-metrics');
        const metricsData = await metricsResponse.json();
        
        // Fetch business insights
        const insightsResponse = await fetch('/api/business-insights');
        const insightsData = await insightsResponse.json();
        
        // Fetch rate cards for additional metrics
        const rateCardsResponse = await fetch('/api/rate-cards');
        const rateCardsData = await rateCardsResponse.json();
        
        // Fetch supplier benchmarks
        const benchmarksResponse = await fetch('/api/supplier-benchmarks');
        const benchmarksData = await benchmarksResponse.json();

        if (metricsData.success) {
          const metrics = metricsData.data;
          setExecutiveMetrics([
            {
              id: '1',
              title: 'Total Contract Value',
              value: `$${(metrics.totalValue / 1000000).toFixed(1)}M`,
              change: 23,
              trend: 'up',
              icon: <DollarSign className="w-6 h-6" />,
              color: 'text-green-600',
              description: 'Total portfolio value under management',
              benchmark: 'Industry: $32M',
              target: '$50M by Q4',
              priority: 'high'
            },
            {
              id: '2',
              title: 'AI Processing Speed',
              value: `${metrics.avgProcessingTime}s`,
              change: -45,
              trend: 'down',
              icon: <Cpu className="w-6 h-6" />,
              color: 'text-blue-600',
              description: 'Average contract analysis time',
              benchmark: 'Manual: 4-6 hours',
              target: '<2s',
              priority: 'high'
            },
            {
              id: '3',
              title: 'Risk Reduction',
              value: `${metrics.riskReduction}%`,
              change: 34,
              trend: 'up',
              icon: <Shield className="w-6 h-6" />,
              color: 'text-purple-600',
              description: 'Risk exposure reduction vs manual review',
              benchmark: 'Industry: 65%',
              target: '90%',
              priority: 'high'
            },
            {
              id: '4',
              title: 'Cost Savings YTD',
              value: `$${(metrics.costSavingsYTD / 1000000).toFixed(1)}M`,
              change: 156,
              trend: 'up',
              icon: <Target className="w-6 h-6" />,
              color: 'text-green-600',
              description: 'Identified cost optimization opportunities',
              benchmark: 'Target: $2.5M',
              target: '$5M by EOY',
              priority: 'high'
            },
            {
              id: '5',
              title: 'Compliance Score',
              value: `${metrics.complianceScore.toFixed(1)}%`,
              change: 12,
              trend: 'up',
              icon: <Award className="w-6 h-6" />,
              color: 'text-blue-600',
              description: 'Regulatory compliance across all contracts',
              benchmark: 'Industry: 78%',
              target: '99%',
              priority: 'medium'
            },
            {
              id: '6',
              title: 'Processing Throughput',
              value: metrics.totalContracts.toString(),
              change: 89,
              trend: 'up',
              icon: <Activity className="w-6 h-6" />,
              color: 'text-orange-600',
              description: 'Contracts processed this month',
              benchmark: 'Manual: 150/month',
              target: '1,500/month',
              priority: 'medium'
            }
          ]);
        }

        if (insightsData.success && rateCardsData.success && benchmarksData.success) {
          // Process insights with real rate card and benchmark data
          const insights = insightsData.data.map((insight: any) => ({
            ...insight,
            rateCardData: rateCardsData.data.find((rc: any) => insight.relatedContracts.includes(rc.contractId)),
            benchmarkData: benchmarksData.data
          }));

          setBusinessInsights(insights);
        } else {
          // Fallback to mock data
          setBusinessInsights([
          {
            id: '1',
            type: 'rate_optimization',
            title: 'Rate Card Optimization Across Suppliers',
            description: 'AI extracted and analyzed 247 rate cards, identifying $1.8M in savings through cross-supplier benchmarking',
            impact: '$1.8M Annual Savings',
            confidence: 96,
            timeframe: '45-60 days',
            roi: 890,
            status: 'identified',
            relatedContracts: 89,
            rateCardData: {
              supplier: 'TechServices Inc.',
              services: [
                { name: 'Senior Developer', currentRate: 175, marketRate: 150, savings: 25, unit: '/hour' },
                { name: 'DevOps Engineer', currentRate: 165, marketRate: 140, savings: 25, unit: '/hour' },
                { name: 'Project Manager', currentRate: 145, marketRate: 125, savings: 20, unit: '/hour' },
                { name: 'QA Engineer', currentRate: 125, marketRate: 110, savings: 15, unit: '/hour' }
              ],
              totalSavings: 85
            },
            benchmarkData: [
              { supplier: 'TechServices Inc.', category: 'Software Development', avgRate: 152.5, marketPosition: 'above', percentile: 78, contracts: 23 },
              { supplier: 'CloudSolutions LLC', category: 'Infrastructure', avgRate: 135.0, marketPosition: 'at', percentile: 52, contracts: 18 },
              { supplier: 'DataPro Systems', category: 'Analytics', avgRate: 142.0, marketPosition: 'below', percentile: 35, contracts: 15 }
            ]
          },
          {
            id: '2',
            type: 'supplier_benchmarking',
            title: 'Cross-Supplier Rate Benchmarking',
            description: 'Comprehensive analysis of 156 suppliers reveals significant rate disparities and consolidation opportunities',
            impact: '$3.2M Optimization Potential',
            confidence: 93,
            timeframe: '90 days',
            roi: 1250,
            status: 'identified',
            relatedContracts: 156,
            benchmarkData: [
              { supplier: 'Premium Tech Corp', category: 'Software Development', avgRate: 185.0, marketPosition: 'above', percentile: 89, contracts: 12 },
              { supplier: 'Efficient Solutions', category: 'Software Development', avgRate: 125.0, marketPosition: 'below', percentile: 25, contracts: 34 },
              { supplier: 'Market Leaders Inc', category: 'Consulting', avgRate: 275.0, marketPosition: 'above', percentile: 92, contracts: 8 },
              { supplier: 'Value Partners', category: 'Consulting', avgRate: 195.0, marketPosition: 'at', percentile: 48, contracts: 28 }
            ]
          },
          {
            id: '3',
            type: 'cost_savings',
            title: 'Payment Terms Optimization',
            description: 'Renegotiating payment terms with top 15 suppliers could improve cash flow by $2.4M annually',
            impact: '$2.4M Annual Savings',
            confidence: 94,
            timeframe: '60-90 days',
            roi: 1200,
            status: 'identified',
            relatedContracts: 47
          },
          {
            id: '4',
            type: 'risk_mitigation',
            title: 'Auto-Renewal Risk Prevention',
            description: 'AI identified 23 high-value contracts with problematic auto-renewal clauses',
            impact: '$8.7M Risk Exposure',
            confidence: 97,
            timeframe: '30 days',
            roi: 850,
            status: 'in_progress',
            relatedContracts: 23
          },
          {
            id: '5',
            type: 'efficiency',
            title: 'Template Standardization',
            description: 'Standardizing contract templates could reduce legal review time by 65%',
            impact: '65% Time Reduction',
            confidence: 89,
            timeframe: '45 days',
            roi: 340,
            status: 'identified',
            relatedContracts: 156
          }
          ]);
        }

        setSystemMetrics([
          { name: 'System Uptime', value: 99.97, status: 'excellent', description: '99.97% uptime this quarter' },
          { name: 'AI Accuracy', value: 96.8, status: 'excellent', description: '96.8% analysis accuracy vs expert review' },
          { name: 'Processing Speed', value: 94.2, status: 'excellent', description: '94.2% faster than manual processing' },
          { name: 'User Satisfaction', value: 92.5, status: 'excellent', description: '92.5% user satisfaction score' },
          { name: 'Security Score', value: 98.1, status: 'excellent', description: '98.1% security compliance score' },
          { name: 'Cost Efficiency', value: 87.3, status: 'good', description: '87.3% cost reduction vs traditional methods' }
        ]);

        setLoading(false);
      } catch (error) {
        console.error('Error loading dashboard data:', error);
        setLoading(false);
      }
    };

    loadCTODashboard();
  }, [selectedTimeframe]);

  const getInsightTypeIcon = (type: string) => {
    switch (type) {
      case 'cost_savings': return <DollarSign className="w-5 h-5" />;
      case 'risk_mitigation': return <Shield className="w-5 h-5" />;
      case 'efficiency': return <Zap className="w-5 h-5" />;
      case 'compliance': return <Award className="w-5 h-5" />;
      case 'revenue': return <TrendingUp className="w-5 h-5" />;
      case 'rate_optimization': return <BarChart3 className="w-5 h-5" />;
      case 'supplier_benchmarking': return <Users className="w-5 h-5" />;
      default: return <Lightbulb className="w-5 h-5" />;
    }
  };

  const getInsightTypeColor = (type: string) => {
    switch (type) {
      case 'cost_savings': return 'bg-green-50 border-green-200 text-green-800';
      case 'risk_mitigation': return 'bg-red-50 border-red-200 text-red-800';
      case 'efficiency': return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'compliance': return 'bg-purple-50 border-purple-200 text-purple-800';
      case 'revenue': return 'bg-orange-50 border-orange-200 text-orange-800';
      case 'rate_optimization': return 'bg-indigo-50 border-indigo-200 text-indigo-800';
      case 'supplier_benchmarking': return 'bg-cyan-50 border-cyan-200 text-cyan-800';
      default: return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'text-green-600';
      case 'good': return 'text-blue-600';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getTrendIcon = (trend: string, change: number) => {
    if (trend === 'up') return <ChevronUp className={`w-4 h-4 ${change > 0 ? 'text-green-600' : 'text-red-600'}`} />;
    if (trend === 'down') return <ChevronDown className={`w-4 h-4 ${change < 0 ? 'text-green-600' : 'text-red-600'}`} />;
    return <div className="w-4 h-4 bg-gray-400 rounded-full"></div>;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
          <CardContent className="p-8">
            <div className="flex items-center justify-center space-y-4">
              <div className="text-center">
                <Brain className="w-16 h-16 text-white animate-pulse mx-auto mb-6" />
                <h3 className="text-2xl font-bold mb-2">AI is preparing your executive dashboard...</h3>
                <p className="text-blue-100 mb-6">Analyzing 1,247 contracts and generating business insights</p>
                <div className="w-96 mx-auto">
                  <Progress value={85} className="h-3 bg-blue-500" />
                  <p className="text-sm text-blue-100 mt-2">Processing real-time data and predictive analytics</p>
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
      {/* Executive Summary Header */}
      <Card className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 text-white overflow-hidden relative">
        <div className="absolute inset-0 bg-black/10"></div>
        <CardContent className="p-8 relative z-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                <Brain className="w-8 h-8" />
                Contract Intelligence Platform
              </h1>
              <p className="text-blue-100 text-lg">
                AI-Powered Contract Management & Risk Intelligence
              </p>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold mb-1">1,247</div>
              <div className="text-blue-100">Contracts Analyzed</div>
              <div className="flex items-center gap-2 mt-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-sm text-green-200">Live Processing</span>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Rocket className="w-5 h-5" />
                <span className="font-medium">Processing Speed</span>
              </div>
              <div className="text-2xl font-bold">2.3s</div>
              <div className="text-sm text-blue-100">vs 4-6 hours manual</div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-5 h-5" />
                <span className="font-medium">Cost Savings</span>
              </div>
              <div className="text-2xl font-bold">$3.8M</div>
              <div className="text-sm text-blue-100">identified this year</div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-5 h-5" />
                <span className="font-medium">Risk Reduction</span>
              </div>
              <div className="text-2xl font-bold">87%</div>
              <div className="text-sm text-blue-100">vs manual review</div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Award className="w-5 h-5" />
                <span className="font-medium">Compliance</span>
              </div>
              <div className="text-2xl font-bold">98.7%</div>
              <div className="text-sm text-blue-100">regulatory compliance</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Executive Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {executiveMetrics.map((metric) => (
          <Card key={metric.id} className="hover:shadow-xl transition-all duration-300 border-l-4 border-l-blue-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-xl bg-gray-50 ${metric.color}`}>
                  {metric.icon}
                </div>
                <div className="flex items-center gap-2">
                  {getTrendIcon(metric.trend, metric.change)}
                  <span className={`text-sm font-bold ${
                    metric.change > 0 ? 'text-green-600' : metric.change < 0 ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    {metric.change > 0 ? '+' : ''}{metric.change}%
                  </span>
                  <Badge className={metric.priority === 'high' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}>
                    {metric.priority}
                  </Badge>
                </div>
              </div>
              
              <div className="mb-4">
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  {metric.value}
                </div>
                <h3 className="font-semibold text-gray-700 mb-2">{metric.title}</h3>
                <p className="text-sm text-gray-600">{metric.description}</p>
              </div>
              
              {metric.benchmark && (
                <div className="space-y-2 pt-4 border-t border-gray-100">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Benchmark:</span>
                    <span className="font-medium text-gray-700">{metric.benchmark}</span>
                  </div>
                  {metric.target && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Target:</span>
                      <span className="font-medium text-blue-600">{metric.target}</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Business Insights */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="w-6 h-6 text-yellow-500" />
              Strategic Business Insights
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export Report
              </Button>
              <Button variant="outline" size="sm">
                <Share className="w-4 h-4 mr-2" />
                Share
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {businessInsights.map((insight) => (
              <div
                key={insight.id}
                className={`p-6 rounded-xl border-2 transition-all duration-300 cursor-pointer hover:shadow-lg ${
                  getInsightTypeColor(insight.type)
                } ${selectedInsight === insight.id ? 'ring-2 ring-blue-500 shadow-lg' : ''}`}
                onClick={() => setSelectedInsight(selectedInsight === insight.id ? null : insight.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="p-3 bg-white rounded-xl shadow-sm">
                      {getInsightTypeIcon(insight.type)}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h4 className="text-xl font-bold text-gray-900">{insight.title}</h4>
                        <Badge className="bg-white/80 text-gray-800">
                          {insight.confidence}% confidence
                        </Badge>
                        <Badge className={
                          insight.status === 'completed' ? 'bg-green-100 text-green-800' :
                          insight.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }>
                          {insight.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      
                      <p className="text-gray-700 mb-4 text-lg">{insight.description}</p>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Target className="w-4 h-4 text-gray-500" />
                          <span className="font-semibold text-gray-900">{insight.impact}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-500" />
                          <span className="text-gray-600">{insight.timeframe}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-gray-500" />
                          <span className="text-gray-600">{insight.relatedContracts} contracts</span>
                        </div>
                        {insight.roi > 0 && (
                          <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-gray-500" />
                            <span className="text-green-600 font-semibold">{insight.roi}% ROI</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button className="bg-blue-600 hover:bg-blue-700">
                      <Zap className="w-4 h-4 mr-2" />
                      Take Action
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                {selectedInsight === insight.id && (
                  <div className="mt-6 pt-6 border-t border-white/50">
                    {/* Rate Card Data */}
                    {insight.rateCardData && (
                      <div className="mb-6">
                        <h5 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                          <BarChart3 className="w-5 h-5" />
                          Rate Card Analysis - {insight.rateCardData.supplier}
                        </h5>
                        <div className="bg-white rounded-lg p-4 border">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {insight.rateCardData.services.map((service, idx) => (
                              <div key={idx} className="bg-gray-50 rounded-lg p-3">
                                <h6 className="font-medium text-gray-900 mb-2">{service.name}</h6>
                                <div className="space-y-1 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Current:</span>
                                    <span className="font-semibold">${service.currentRate}{service.unit}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Market:</span>
                                    <span className="font-semibold text-blue-600">${service.marketRate}{service.unit}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Savings:</span>
                                    <span className="font-semibold text-green-600">${service.savings}{service.unit}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="mt-4 p-3 bg-green-50 rounded-lg">
                            <div className="flex justify-between items-center">
                              <span className="font-semibold text-green-800">Total Hourly Savings:</span>
                              <span className="text-xl font-bold text-green-600">${insight.rateCardData.totalSavings}/hour</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Supplier Benchmarking */}
                    {insight.benchmarkData && (
                      <div className="mb-6">
                        <h5 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                          <Users className="w-5 h-5" />
                          Supplier Benchmarking Analysis
                        </h5>
                        <div className="bg-white rounded-lg p-4 border">
                          <div className="space-y-3">
                            {insight.benchmarkData.map((benchmark, idx) => (
                              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div className="flex-1">
                                  <h6 className="font-medium text-gray-900">{benchmark.supplier}</h6>
                                  <p className="text-sm text-gray-600">{benchmark.category} • {benchmark.contracts} contracts</p>
                                </div>
                                <div className="text-center mx-4">
                                  <div className="text-lg font-bold text-gray-900">${benchmark.avgRate}/hr</div>
                                  <div className="text-xs text-gray-500">Average Rate</div>
                                </div>
                                <div className="text-center mx-4">
                                  <div className={`text-lg font-bold ${
                                    benchmark.marketPosition === 'above' ? 'text-red-600' :
                                    benchmark.marketPosition === 'below' ? 'text-green-600' : 'text-blue-600'
                                  }`}>
                                    {benchmark.percentile}th
                                  </div>
                                  <div className="text-xs text-gray-500">Percentile</div>
                                </div>
                                <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                                  benchmark.marketPosition === 'above' ? 'bg-red-100 text-red-800' :
                                  benchmark.marketPosition === 'below' ? 'bg-green-100 text-green-800' :
                                  'bg-blue-100 text-blue-800'
                                }`}>
                                  {benchmark.marketPosition === 'above' ? 'Above Market' :
                                   benchmark.marketPosition === 'below' ? 'Below Market' : 'At Market'}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h5 className="font-semibold text-gray-900 mb-3">Implementation Plan</h5>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span>AI analysis completed</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="w-4 h-4 text-blue-600" />
                            <span>Stakeholder review in progress</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Circle className="w-4 h-4 text-gray-400" />
                            <span>Implementation planning</span>
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <h5 className="font-semibold text-gray-900 mb-3">Expected Outcomes</h5>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Financial Impact:</span>
                            <span className="font-semibold text-green-600">{insight.impact}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Implementation Time:</span>
                            <span className="font-semibold">{insight.timeframe}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Risk Level:</span>
                            <span className="font-semibold text-green-600">Low</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* System Performance Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="w-6 h-6 text-blue-600" />
            System Performance & Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {systemMetrics.map((metric, index) => (
              <div key={index} className="bg-gray-50 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-gray-900">{metric.name}</h4>
                  <Badge className={
                    metric.status === 'excellent' ? 'bg-green-100 text-green-800' :
                    metric.status === 'good' ? 'bg-blue-100 text-blue-800' :
                    metric.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }>
                    {metric.status}
                  </Badge>
                </div>
                
                <div className="mb-4">
                  <div className={`text-3xl font-bold mb-2 ${getStatusColor(metric.status)}`}>
                    {metric.value}%
                  </div>
                  <Progress value={metric.value} className="h-2 mb-2" />
                </div>
                
                <p className="text-sm text-gray-600">{metric.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions for CTO */}
      <Card>
        <CardHeader>
          <CardTitle>Executive Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Button className="h-auto p-6 flex-col items-start bg-gradient-to-br from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 text-green-800 border-green-200">
              <DollarSign className="w-8 h-8 mb-3" />
              <div className="text-left">
                <div className="font-bold text-lg">$3.8M</div>
                <div className="text-sm">Cost Savings Pipeline</div>
                <div className="text-xs opacity-75 mt-1">Review opportunities</div>
              </div>
            </Button>
            
            <Button className="h-auto p-6 flex-col items-start bg-gradient-to-br from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 text-blue-800 border-blue-200">
              <Shield className="w-8 h-8 mb-3" />
              <div className="text-left">
                <div className="font-bold text-lg">87%</div>
                <div className="text-sm">Risk Reduction</div>
                <div className="text-xs opacity-75 mt-1">View risk dashboard</div>
              </div>
            </Button>
            
            <Button className="h-auto p-6 flex-col items-start bg-gradient-to-br from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200 text-purple-800 border-purple-200">
              <Brain className="w-8 h-8 mb-3" />
              <div className="text-left">
                <div className="font-bold text-lg">AI Report</div>
                <div className="text-sm">Executive Summary</div>
                <div className="text-xs opacity-75 mt-1">Generate full report</div>
              </div>
            </Button>
            
            <Button className="h-auto p-6 flex-col items-start bg-gradient-to-br from-orange-50 to-orange-100 hover:from-orange-100 hover:to-orange-200 text-orange-800 border-orange-200">
              <Rocket className="w-8 h-8 mb-3" />
              <div className="text-left">
                <div className="font-bold text-lg">Scale Plan</div>
                <div className="text-sm">Enterprise Roadmap</div>
                <div className="text-xs opacity-75 mt-1">View scaling strategy</div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper component for circle icon
function Circle({ className }: { className?: string }) {
  return <div className={`w-4 h-4 rounded-full border-2 ${className}`}></div>;
}