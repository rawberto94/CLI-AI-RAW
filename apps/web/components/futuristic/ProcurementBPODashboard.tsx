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
  Gauge,
  Factory,
  Truck,
  Package,
  Wrench,
  Headphones,
  Layers,
  Percent,
  Calculator
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface ProcurementMetric {
  id: string;
  title: string;
  value: string | number;
  change: number;
  trend: 'up' | 'down' | 'stable';
  icon: React.ReactNode;
  color: string;
  description: string;
  innovation: string;
  oldSystemComparison: string;
  businessImpact: string;
}

interface ProcurementInsight {
  id: string;
  type: 'cost_reduction' | 'supplier_optimization' | 'risk_mitigation' | 'process_automation' | 'compliance_enhancement';
  title: string;
  description: string;
  impact: string;
  confidence: number;
  timeframe: string;
  roi: number;
  status: 'identified' | 'in_progress' | 'completed';
  category: string;
  innovation: string;
  securityLevel: 'standard' | 'enhanced' | 'enterprise';
  clientBenefit: string;
}

interface SecurityFeature {
  name: string;
  description: string;
  level: 'basic' | 'advanced' | 'enterprise';
  status: 'active' | 'monitoring' | 'secured';
  compliance: string[];
}

export function ProcurementBPODashboard() {
  const [metrics, setMetrics] = useState<ProcurementMetric[]>([]);
  const [insights, setInsights] = useState<ProcurementInsight[]>([]);
  const [securityFeatures, setSecurityFeatures] = useState<SecurityFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInsight, setSelectedInsight] = useState<string | null>(null);
  const [currentExplanation, setCurrentExplanation] = useState<string>('');

  useEffect(() => {
    loadProcurementDashboard();
  }, []);

  const loadProcurementDashboard = async () => {
    // Simulate loading with explanations
    setCurrentExplanation('🔄 Initializing AI-powered procurement intelligence...');
    
    setTimeout(() => {
      setCurrentExplanation('📊 Loading portfolio metrics and supplier data...');
      
      setMetrics([
        {
          id: '1',
          title: 'Supplier Portfolio Value',
          value: '$127.3M',
          change: 18,
          trend: 'up',
          icon: <Building className="w-6 h-6" />,
          color: 'text-blue-600',
          description: 'Total indirect procurement portfolio under AI management',
          innovation: 'AI automatically tracks and analyzes supplier spend across all categories in real-time',
          oldSystemComparison: 'Old: Manual spreadsheet tracking, 30-day delays, 15% data accuracy',
          businessImpact: 'Enables real-time spend visibility and immediate optimization opportunities'
        },
        {
          id: '2',
          title: 'AI Processing Speed',
          value: '1.8s',
          change: -52,
          trend: 'down',
          icon: <Zap className="w-6 h-6" />,
          color: 'text-green-600',
          description: 'Average contract analysis time per supplier agreement',
          innovation: 'GPT-4 powered analysis extracts 247 data points instantly vs manual review',
          oldSystemComparison: 'Old: 6-8 hours per contract, manual review, human error prone',
          businessImpact: '99.7% faster processing = 50x more contracts analyzed daily'
        },
        {
          id: '3',
          title: 'Cost Savings Identified',
          value: '$8.4M',
          change: 234,
          trend: 'up',
          icon: <Target className="w-6 h-6" />,
          color: 'text-green-600',
          description: 'Annual savings identified through AI-powered supplier optimization',
          innovation: 'Cross-supplier benchmarking identifies hidden savings opportunities automatically',
          oldSystemComparison: 'Old: Manual analysis found $2.1M savings over 12 months',
          businessImpact: '300% increase in savings identification for your BPO clients'
        },
        {
          id: '4',
          title: 'Supplier Risk Score',
          value: '12/100',
          change: -67,
          trend: 'down',
          icon: <Shield className="w-6 h-6" />,
          color: 'text-green-600',
          description: 'AI-calculated portfolio risk exposure (lower is better)',
          innovation: 'Predictive risk modeling using 150+ risk factors and market intelligence',
          oldSystemComparison: 'Old: Quarterly risk reviews, reactive approach, 40+ risk score',
          businessImpact: '70% risk reduction protects client operations and reputation'
        },
        {
          id: '5',
          title: 'Compliance Score',
          value: '99.2%',
          change: 23,
          trend: 'up',
          icon: <Award className="w-6 h-6" />,
          color: 'text-blue-600',
          description: 'Automated compliance monitoring across all supplier contracts',
          innovation: 'Real-time regulatory compliance checking against 47 standards',
          oldSystemComparison: 'Old: Annual compliance audits, 78% compliance rate',
          businessImpact: 'Eliminates compliance violations and regulatory penalties'
        },
        {
          id: '6',
          title: 'Client Satisfaction',
          value: '97.8%',
          change: 15,
          trend: 'up',
          icon: <Star className="w-6 h-6" />,
          color: 'text-purple-600',
          description: 'Client satisfaction with AI-enhanced procurement services',
          innovation: 'Proactive insights and recommendations delivered before clients ask',
          oldSystemComparison: 'Old: Reactive service model, 82% satisfaction',
          businessImpact: 'Higher client retention and premium pricing opportunities'
        }
      ]);

      setTimeout(() => {
        setCurrentExplanation('🧠 Analyzing supplier relationships and market intelligence...');
        
        setInsights([
          {
            id: '1',
            type: 'cost_reduction',
            title: 'Multi-Client Supplier Consolidation Opportunity',
            description: 'AI identified 23 suppliers providing similar services across 8 clients. Consolidation could reduce costs by 28% while improving service quality.',
            impact: '$3.2M Annual Savings',
            confidence: 94,
            timeframe: '90-120 days',
            roi: 1580,
            status: 'identified',
            category: 'Strategic Sourcing',
            innovation: 'Cross-client pattern recognition impossible with traditional systems',
            securityLevel: 'enterprise',
            clientBenefit: 'Shared savings model increases your BPO margins while reducing client costs'
          },
          {
            id: '2',
            type: 'supplier_optimization',
            title: 'Dynamic Rate Card Optimization',
            description: 'AI continuously monitors market rates and automatically flags when supplier rates exceed market benchmarks by >15%.',
            impact: '$1.8M Rate Optimization',
            confidence: 91,
            timeframe: '30-45 days',
            roi: 890,
            status: 'in_progress',
            category: 'Rate Management',
            innovation: 'Real-time market intelligence vs annual rate reviews',
            securityLevel: 'enhanced',
            clientBenefit: 'Continuous cost optimization without manual intervention'
          },
          {
            id: '3',
            type: 'process_automation',
            title: 'Intelligent Contract Renewal Management',
            description: 'AI predicts optimal renewal timing and terms based on market conditions, supplier performance, and client needs.',
            impact: '85% Process Automation',
            confidence: 88,
            timeframe: '60 days',
            roi: 450,
            status: 'identified',
            category: 'Contract Lifecycle',
            innovation: 'Predictive renewal optimization vs reactive contract management',
            securityLevel: 'standard',
            clientBenefit: 'Proactive contract management reduces client workload and improves terms'
          },
          {
            id: '4',
            type: 'risk_mitigation',
            title: 'Supplier Financial Health Monitoring',
            description: 'AI monitors supplier financial stability using 200+ data sources, predicting potential disruptions 6 months in advance.',
            impact: '$5.7M Risk Avoidance',
            confidence: 96,
            timeframe: 'Continuous',
            roi: 2340,
            status: 'in_progress',
            category: 'Risk Management',
            innovation: 'Predictive supplier risk vs reactive crisis management',
            securityLevel: 'enterprise',
            clientBenefit: 'Prevents supply chain disruptions and protects client operations'
          },
          {
            id: '5',
            type: 'compliance_enhancement',
            title: 'Automated ESG Compliance Tracking',
            description: 'AI monitors supplier ESG compliance across environmental, social, and governance metrics with real-time scoring.',
            impact: '100% ESG Visibility',
            confidence: 92,
            timeframe: '45 days',
            roi: 320,
            status: 'identified',
            category: 'Sustainability',
            innovation: 'Continuous ESG monitoring vs annual sustainability reports',
            securityLevel: 'enhanced',
            clientBenefit: 'Meets growing client demand for sustainable procurement practices'
          }
        ]);

        setTimeout(() => {
          setCurrentExplanation('🔒 Implementing enterprise-grade security measures...');
          
          setSecurityFeatures([
            {
              name: 'Zero-Trust Architecture',
              description: 'Every access request verified regardless of location or user credentials',
              level: 'enterprise',
              status: 'secured',
              compliance: ['SOC 2 Type II', 'ISO 27001', 'GDPR']
            },
            {
              name: 'End-to-End Encryption',
              description: 'AES-256 encryption for data at rest and in transit with client-specific keys',
              level: 'enterprise',
              status: 'active',
              compliance: ['FIPS 140-2', 'Common Criteria']
            },
            {
              name: 'Multi-Tenant Isolation',
              description: 'Complete data segregation between clients with cryptographic boundaries',
              level: 'enterprise',
              status: 'secured',
              compliance: ['SOC 2', 'HIPAA Ready']
            },
            {
              name: 'AI Model Security',
              description: 'Secure AI processing with data anonymization and model isolation',
              level: 'advanced',
              status: 'monitoring',
              compliance: ['AI Ethics Framework', 'Data Protection']
            },
            {
              name: 'Audit Trail & Compliance',
              description: 'Immutable audit logs with real-time compliance monitoring',
              level: 'enterprise',
              status: 'active',
              compliance: ['SOX', 'GDPR', 'CCPA']
            }
          ]);

          setLoading(false);
          setCurrentExplanation('✅ Procurement intelligence platform ready for demonstration');
        }, 1500);
      }, 2000);
    }, 1000);
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'cost_reduction': return <DollarSign className="w-5 h-5" />;
      case 'supplier_optimization': return <Users className="w-5 h-5" />;
      case 'process_automation': return <Cpu className="w-5 h-5" />;
      case 'risk_mitigation': return <Shield className="w-5 h-5" />;
      case 'compliance_enhancement': return <Award className="w-5 h-5" />;
      default: return <Lightbulb className="w-5 h-5" />;
    }
  };

  const getInsightColor = (type: string) => {
    switch (type) {
      case 'cost_reduction': return 'bg-green-50 border-green-200 text-green-800';
      case 'supplier_optimization': return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'process_automation': return 'bg-purple-50 border-purple-200 text-purple-800';
      case 'risk_mitigation': return 'bg-red-50 border-red-200 text-red-800';
      case 'compliance_enhancement': return 'bg-orange-50 border-orange-200 text-orange-800';
      default: return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getSecurityBadgeColor = (level: string) => {
    switch (level) {
      case 'enterprise': return 'bg-red-100 text-red-800';
      case 'advanced': return 'bg-orange-100 text-orange-800';
      case 'basic': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 text-white overflow-hidden relative">
          <div className="absolute inset-0 bg-black/10"></div>
          <CardContent className="p-8 relative z-10">
            <div className="flex items-center justify-center space-y-4">
              <div className="text-center">
                <Brain className="w-16 h-16 text-white animate-pulse mx-auto mb-6" />
                <h3 className="text-2xl font-bold mb-2">AI Procurement Intelligence Loading...</h3>
                <p className="text-blue-100 mb-6">{currentExplanation}</p>
                <div className="w-96 mx-auto">
                  <Progress value={85} className="h-3 bg-blue-500" />
                  <p className="text-sm text-blue-100 mt-2">Analyzing $127.3M supplier portfolio across 247 contracts</p>
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
      {/* Executive Header */}
      <Card className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 text-white overflow-hidden relative">
        <div className="absolute inset-0 bg-black/10"></div>
        <CardContent className="p-8 relative z-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                <Factory className="w-8 h-8" />
                AI-Powered Procurement BPO Platform
              </h1>
              <p className="text-blue-100 text-lg">
                Revolutionary Indirect Procurement Intelligence for BPO Excellence
              </p>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold mb-1">$127.3M</div>
              <div className="text-blue-100">Portfolio Under Management</div>
              <div className="flex items-center gap-2 mt-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-sm text-green-200">AI Processing Live</span>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-5 h-5" />
                <span className="font-medium">Processing Speed</span>
              </div>
              <div className="text-2xl font-bold">1.8s</div>
              <div className="text-sm text-blue-100">vs 6-8 hours manual</div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-5 h-5" />
                <span className="font-medium">Savings Identified</span>
              </div>
              <div className="text-2xl font-bold">$8.4M</div>
              <div className="text-sm text-blue-100">300% vs traditional methods</div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-5 h-5" />
                <span className="font-medium">Risk Reduction</span>
              </div>
              <div className="text-2xl font-bold">70%</div>
              <div className="text-sm text-blue-100">predictive vs reactive</div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-5 h-5" />
                <span className="font-medium">Client Satisfaction</span>
              </div>
              <div className="text-2xl font-bold">97.8%</div>
              <div className="text-sm text-blue-100">+15% vs traditional BPO</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Innovation Explanation */}
      <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-green-100 rounded-xl">
              <Lightbulb className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Why This Revolutionizes Your BPO Business</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-semibold text-gray-800 mb-2">🚀 Traditional BPO Limitations:</h4>
                  <ul className="space-y-1 text-gray-600">
                    <li>• Manual contract analysis (6-8 hours each)</li>
                    <li>• Reactive supplier management</li>
                    <li>• Quarterly risk assessments</li>
                    <li>• Limited cross-client insights</li>
                    <li>• 78% compliance rates</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-800 mb-2">⚡ AI-Powered BPO Advantages:</h4>
                  <ul className="space-y-1 text-gray-600">
                    <li>• 1.8-second AI analysis (99.7% faster)</li>
                    <li>• Predictive supplier intelligence</li>
                    <li>• Real-time risk monitoring</li>
                    <li>• Cross-client optimization opportunities</li>
                    <li>• 99.2% automated compliance</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics with Innovation Explanations */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {metrics.map((metric) => (
          <Card key={metric.id} className="hover:shadow-xl transition-all duration-300 border-l-4 border-l-blue-500 group">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-xl bg-gray-50 ${metric.color}`}>
                  {metric.icon}
                </div>
                <div className="flex items-center gap-2">
                  {metric.trend === 'up' ? <ChevronUp className="w-4 h-4 text-green-600" /> : <ChevronDown className="w-4 h-4 text-green-600" />}
                  <span className="text-sm font-bold text-green-600">
                    {metric.change > 0 ? '+' : ''}{metric.change}%
                  </span>
                </div>
              </div>
              
              <div className="mb-4">
                <div className="text-3xl font-bold text-gray-900 mb-1">{metric.value}</div>
                <h3 className="font-semibold text-gray-700 mb-2">{metric.title}</h3>
                <p className="text-sm text-gray-600 mb-3">{metric.description}</p>
              </div>
              
              {/* Innovation Explanation - Shows on Hover */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 space-y-2 pt-4 border-t border-gray-100">
                <div className="text-xs">
                  <span className="font-semibold text-blue-600">💡 Innovation:</span>
                  <p className="text-gray-600 mt-1">{metric.innovation}</p>
                </div>
                <div className="text-xs">
                  <span className="font-semibold text-red-600">📊 Old System:</span>
                  <p className="text-gray-600 mt-1">{metric.oldSystemComparison}</p>
                </div>
                <div className="text-xs">
                  <span className="font-semibold text-green-600">💼 Business Impact:</span>
                  <p className="text-gray-600 mt-1">{metric.businessImpact}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Procurement Intelligence Insights */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-6 h-6 text-purple-600" />
              AI-Powered Procurement Intelligence
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge className="bg-purple-100 text-purple-800">Live Analysis</Badge>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export Insights
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {insights.map((insight) => (
              <div
                key={insight.id}
                className={`p-6 rounded-xl border-2 transition-all duration-300 cursor-pointer hover:shadow-lg ${
                  getInsightColor(insight.type)
                } ${selectedInsight === insight.id ? 'ring-2 ring-blue-500 shadow-lg' : ''}`}
                onClick={() => setSelectedInsight(selectedInsight === insight.id ? null : insight.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="p-3 bg-white rounded-xl shadow-sm">
                      {getInsightIcon(insight.type)}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h4 className="text-xl font-bold text-gray-900">{insight.title}</h4>
                        <Badge className="bg-white/80 text-gray-800">
                          {insight.confidence}% confidence
                        </Badge>
                        <Badge className={getSecurityBadgeColor(insight.securityLevel)}>
                          {insight.securityLevel} security
                        </Badge>
                      </div>
                      
                      <p className="text-gray-700 mb-4 text-lg">{insight.description}</p>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                        <div className="flex items-center gap-2">
                          <Target className="w-4 h-4 text-gray-500" />
                          <span className="font-semibold text-gray-900">{insight.impact}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-500" />
                          <span className="text-gray-600">{insight.timeframe}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Briefcase className="w-4 h-4 text-gray-500" />
                          <span className="text-gray-600">{insight.category}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-gray-500" />
                          <span className="text-green-600 font-semibold">{insight.roi}% ROI</span>
                        </div>
                      </div>

                      {/* Innovation Explanation */}
                      <div className="bg-white/50 rounded-lg p-3 mb-3">
                        <div className="flex items-start gap-2">
                          <Sparkles className="w-4 h-4 text-purple-600 mt-0.5" />
                          <div>
                            <span className="font-semibold text-purple-800">Innovation:</span>
                            <p className="text-gray-700 text-sm mt-1">{insight.innovation}</p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-green-50 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                          <Building className="w-4 h-4 text-green-600 mt-0.5" />
                          <div>
                            <span className="font-semibold text-green-800">BPO Business Impact:</span>
                            <p className="text-gray-700 text-sm mt-1">{insight.clientBenefit}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button className="bg-blue-600 hover:bg-blue-700">
                      <Zap className="w-4 h-4 mr-2" />
                      Implement
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Security & Compliance Dashboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-6 h-6 text-red-600" />
            Enterprise Security & Compliance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <h4 className="font-semibold text-red-800 mb-2">🔒 Why Security is Critical for BPO:</h4>
            <p className="text-red-700 text-sm mb-3">
              As a BPO handling multiple clients' procurement data, you're responsible for protecting sensitive supplier information, 
              contract terms, and financial data. A single breach could destroy client trust and your business reputation.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-semibold text-red-800">Traditional BPO Risks:</span>
                <ul className="text-red-700 mt-1 space-y-1">
                  <li>• Shared systems across clients</li>
                  <li>• Manual access controls</li>
                  <li>• Limited audit capabilities</li>
                  <li>• Reactive security measures</li>
                </ul>
              </div>
              <div>
                <span className="font-semibold text-green-800">AI Platform Security:</span>
                <ul className="text-green-700 mt-1 space-y-1">
                  <li>• Complete client data isolation</li>
                  <li>• Automated security monitoring</li>
                  <li>• Immutable audit trails</li>
                  <li>• Proactive threat detection</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {securityFeatures.map((feature, index) => (
              <div key={index} className="bg-gray-50 rounded-xl p-4 border">
                <div className="flex items-center justify-between mb-3">
                  <h5 className="font-semibold text-gray-900">{feature.name}</h5>
                  <div className="flex items-center gap-2">
                    <Badge className={getSecurityBadgeColor(feature.level)}>
                      {feature.level}
                    </Badge>
                    <div className={`w-2 h-2 rounded-full ${
                      feature.status === 'secured' ? 'bg-green-500' :
                      feature.status === 'active' ? 'bg-blue-500' : 'bg-yellow-500'
                    }`}></div>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-3">{feature.description}</p>
                <div className="flex flex-wrap gap-1">
                  {feature.compliance.map((comp, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {comp}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Cross-Client Intelligence Showcase */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="w-6 h-6 text-indigo-600" />
            Cross-Client Intelligence Network
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
            <h4 className="font-semibold text-indigo-800 mb-2">🌐 Revolutionary Cross-Client Insights</h4>
            <p className="text-indigo-700 text-sm mb-3">
              Unlike traditional BPO where each client is managed in isolation, our AI analyzes patterns across your entire client portfolio 
              to identify optimization opportunities that benefit everyone.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-semibold text-indigo-800">Traditional BPO Approach:</span>
                <ul className="text-indigo-700 mt-1 space-y-1">
                  <li>• Each client managed separately</li>
                  <li>• No shared insights or learnings</li>
                  <li>• Duplicate supplier relationships</li>
                  <li>• Limited negotiation power</li>
                </ul>
              </div>
              <div>
                <span className="font-semibold text-green-800">AI-Powered Network Effect:</span>
                <ul className="text-green-700 mt-1 space-y-1">
                  <li>• Portfolio-wide pattern recognition</li>
                  <li>• Shared supplier intelligence</li>
                  <li>• Consolidated negotiation power</li>
                  <li>• Cross-client cost optimization</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-5 h-5 text-blue-600" />
                <h5 className="font-semibold text-blue-800">Client Portfolio</h5>
              </div>
              <div className="text-2xl font-bold text-blue-900 mb-1">47</div>
              <p className="text-sm text-blue-700">Active clients across 12 industries</p>
              <div className="mt-2 text-xs text-blue-600">
                Manufacturing, Tech, Healthcare, Finance
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
              <div className="flex items-center gap-2 mb-3">
                <Building className="w-5 h-5 text-green-600" />
                <h5 className="font-semibold text-green-800">Shared Suppliers</h5>
              </div>
              <div className="text-2xl font-bold text-green-900 mb-1">156</div>
              <p className="text-sm text-green-700">Suppliers serving multiple clients</p>
              <div className="mt-2 text-xs text-green-600">
                23% cost reduction through consolidation
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-lg p-4 border border-purple-200">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-5 h-5 text-purple-600" />
                <h5 className="font-semibold text-purple-800">Optimization Ops</h5>
              </div>
              <div className="text-2xl font-bold text-purple-900 mb-1">$3.2M</div>
              <p className="text-sm text-purple-700">Cross-client savings identified</p>
              <div className="mt-2 text-xs text-purple-600">
                Shared volume discounts & rate optimization
              </div>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-lg p-4 border border-orange-200">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-5 h-5 text-orange-600" />
                <h5 className="font-semibold text-orange-800">Risk Intelligence</h5>
              </div>
              <div className="text-2xl font-bold text-orange-900 mb-1">6 months</div>
              <p className="text-sm text-orange-700">Early risk detection across portfolio</p>
              <div className="mt-2 text-xs text-orange-600">
                Predictive supplier health monitoring
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Real-Time Market Intelligence */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-6 h-6 text-green-600" />
            Real-Time Market Intelligence Engine
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h4 className="font-semibold text-green-800 mb-2">📊 Continuous Market Monitoring</h4>
            <p className="text-green-700 text-sm mb-3">
              Our AI continuously monitors market conditions, supplier performance, and pricing trends across 200+ data sources 
              to provide real-time intelligence that keeps your clients ahead of market changes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-4">
              <h5 className="font-semibold text-gray-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                Market Trends
              </h5>
              <div className="space-y-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Software Development Rates</span>
                    <Badge className="bg-green-100 text-green-800">↑ 8.5%</Badge>
                  </div>
                  <div className="text-xs text-gray-600">Q4 2024 vs Q3 2024</div>
                  <div className="text-xs text-blue-600 mt-1">Recommend rate negotiations before Q1</div>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Cloud Infrastructure</span>
                    <Badge className="bg-red-100 text-red-800">↓ 12.3%</Badge>
                  </div>
                  <div className="text-xs text-gray-600">Market oversupply detected</div>
                  <div className="text-xs text-blue-600 mt-1">Opportunity for 15% cost reduction</div>
                </div>

                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Consulting Services</span>
                    <Badge className="bg-yellow-100 text-yellow-800">→ 2.1%</Badge>
                  </div>
                  <div className="text-xs text-gray-600">Stable market conditions</div>
                  <div className="text-xs text-blue-600 mt-1">Maintain current supplier mix</div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h5 className="font-semibold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
                Risk Alerts
              </h5>
              <div className="space-y-3">
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span className="text-sm font-medium text-red-800">High Risk</span>
                  </div>
                  <div className="text-xs text-red-700 mb-1">TechSupplier Inc. - Financial stress indicators</div>
                  <div className="text-xs text-gray-600">Recommend backup supplier activation</div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <span className="text-sm font-medium text-yellow-800">Medium Risk</span>
                  </div>
                  <div className="text-xs text-yellow-700 mb-1">CloudPro Systems - Capacity constraints</div>
                  <div className="text-xs text-gray-600">Monitor delivery timelines closely</div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm font-medium text-green-800">Opportunity</span>
                  </div>
                  <div className="text-xs text-green-700 mb-1">DataInsights Corp - Expansion capacity</div>
                  <div className="text-xs text-gray-600">Negotiate volume discounts</div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h5 className="font-semibold text-gray-900 flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-purple-600" />
                AI Recommendations
              </h5>
              <div className="space-y-3">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <div className="text-sm font-medium text-purple-800 mb-2">Immediate Action</div>
                  <div className="text-xs text-purple-700 mb-1">Renegotiate 3 software contracts before rate increases</div>
                  <div className="text-xs text-gray-600">Potential savings: $450K annually</div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="text-sm font-medium text-blue-800 mb-2">Strategic Move</div>
                  <div className="text-xs text-blue-700 mb-1">Consolidate cloud suppliers for better rates</div>
                  <div className="text-xs text-gray-600">Estimated impact: 18% cost reduction</div>
                </div>

                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                  <div className="text-sm font-medium text-indigo-800 mb-2">Future Planning</div>
                  <div className="text-xs text-indigo-700 mb-1">Prepare for Q2 consulting rate surge</div>
                  <div className="text-xs text-gray-600">Lock in current rates with extensions</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* BPO Business Model Enhancement */}
      <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
        <CardContent className="p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Rocket className="w-6 h-6 text-purple-600" />
            Transform Your BPO Business Model
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white rounded-lg p-4">
              <h4 className="font-semibold text-purple-800 mb-2">💰 Premium Pricing</h4>
              <p className="text-sm text-gray-600 mb-2">
                Charge 40-60% premium for AI-enhanced services vs traditional BPO
              </p>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>• Real-time insights delivery</li>
                <li>• Predictive risk management</li>
                <li>• Automated compliance monitoring</li>
              </ul>
            </div>
            
            <div className="bg-white rounded-lg p-4">
              <h4 className="font-semibold text-blue-800 mb-2">📈 Scalability</h4>
              <p className="text-sm text-gray-600 mb-2">
                Handle 10x more contracts with same team size through AI automation
              </p>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>• 99.7% faster processing</li>
                <li>• Automated analysis pipeline</li>
                <li>• Cross-client optimization</li>
              </ul>
            </div>
            
            <div className="bg-white rounded-lg p-4">
              <h4 className="font-semibold text-green-800 mb-2">🎯 Differentiation</h4>
              <p className="text-sm text-gray-600 mb-2">
                Become the only BPO offering predictive procurement intelligence
              </p>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>• Market-leading technology</li>
                <li>• Proactive client service</li>
                <li>• Measurable ROI delivery</li>
              </ul>
            </div>
          </div>

          {/* ROI Calculator */}
          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-green-600" />
              BPO ROI Calculator
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h5 className="font-medium text-gray-800 mb-3">Current BPO Operations</h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Contracts processed/month:</span>
                    <span className="font-medium">150</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Processing time per contract:</span>
                    <span className="font-medium">6 hours</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Analyst cost per hour:</span>
                    <span className="font-medium">$75</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Monthly processing cost:</span>
                    <span className="font-medium text-red-600">$67,500</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Error rate:</span>
                    <span className="font-medium text-red-600">15%</span>
                  </div>
                </div>
              </div>

              <div>
                <h5 className="font-medium text-gray-800 mb-3">AI-Enhanced BPO</h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Contracts processed/month:</span>
                    <span className="font-medium text-green-600">1,500</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Processing time per contract:</span>
                    <span className="font-medium text-green-600">1.8 seconds</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">AI processing cost:</span>
                    <span className="font-medium text-green-600">$2 per contract</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Monthly processing cost:</span>
                    <span className="font-medium text-green-600">$3,000</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Error rate:</span>
                    <span className="font-medium text-green-600">0.3%</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h5 className="font-semibold text-green-800 mb-2">Monthly Savings Breakdown</h5>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-green-700">Processing Cost Savings:</span>
                  <div className="font-bold text-green-800">$64,500/month</div>
                </div>
                <div>
                  <span className="text-green-700">10x Volume Capacity:</span>
                  <div className="font-bold text-green-800">$450,000 revenue potential</div>
                </div>
                <div>
                  <span className="text-green-700">Error Reduction Value:</span>
                  <div className="font-bold text-green-800">$125,000 risk avoidance</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Implementation Roadmap */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-6 h-6 text-blue-600" />
            Implementation Roadmap
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
                <div className="w-0.5 h-16 bg-blue-200 mt-2"></div>
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 mb-2">Phase 1: Pilot Program (30 days)</h4>
                <p className="text-gray-600 text-sm mb-3">
                  Deploy AI platform for 1-2 key clients to demonstrate value and establish success metrics
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h5 className="font-medium text-gray-800 mb-1">Deliverables:</h5>
                    <ul className="text-xs text-gray-600 space-y-1">
                      <li>• Platform setup and configuration</li>
                      <li>• Team training and onboarding</li>
                      <li>• Initial contract processing</li>
                      <li>• Performance baseline establishment</li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-medium text-gray-800 mb-1">Success Metrics:</h5>
                    <ul className="text-xs text-gray-600 space-y-1">
                      <li>• 95%+ processing accuracy</li>
                      <li>• 50x speed improvement</li>
                      <li>• Client satisfaction &gt;90%</li>
                      <li>• Measurable cost savings</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
                <div className="w-0.5 h-16 bg-green-200 mt-2"></div>
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 mb-2">Phase 2: Full Deployment (60 days)</h4>
                <p className="text-gray-600 text-sm mb-3">
                  Scale platform across entire client portfolio with advanced features and optimization
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h5 className="font-medium text-gray-800 mb-1">Deliverables:</h5>
                    <ul className="text-xs text-gray-600 space-y-1">
                      <li>• All clients onboarded</li>
                      <li>• Cross-client optimization active</li>
                      <li>• Advanced analytics enabled</li>
                      <li>• Automated reporting setup</li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-medium text-gray-800 mb-1">Expected Outcomes:</h5>
                    <ul className="text-xs text-gray-600 space-y-1">
                      <li>• 10x processing capacity</li>
                      <li>• $500K+ monthly savings</li>
                      <li>• 99%+ compliance rate</li>
                      <li>• Premium service pricing</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 mb-2">Phase 3: Market Leadership (90 days)</h4>
                <p className="text-gray-600 text-sm mb-3">
                  Establish market differentiation and capture premium positioning in AI-powered BPO services
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h5 className="font-medium text-gray-800 mb-1">Strategic Initiatives:</h5>
                    <ul className="text-xs text-gray-600 space-y-1">
                      <li>• Launch premium AI service tiers</li>
                      <li>• Develop competitive positioning</li>
                      <li>• Create thought leadership content</li>
                      <li>• Target enterprise prospects</li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-medium text-gray-800 mb-1">Business Impact:</h5>
                    <ul className="text-xs text-gray-600 space-y-1">
                      <li>• 40-60% premium pricing</li>
                      <li>• Market leadership position</li>
                      <li>• Competitive differentiation</li>
                      <li>• Accelerated growth trajectory</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}