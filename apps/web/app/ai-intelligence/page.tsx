import React from 'react'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AI Intelligence Platform - Contract Intelligence',
  description: 'Advanced AI-powered contract analysis and insights platform',
}
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { AIBadge } from '@/components/ui/design-system'
import { 
  Brain,
  Zap,
  TrendingUp,
  BarChart3,
  Users,
  Target,
  Sparkles,
  ArrowRight,
  Eye,
  Play,
  Rocket,
  Shield,
  DollarSign,
  Clock,
  Award,
  Lightbulb,
  Activity,
  Database,
  Network,
  Cpu,
  Globe,
  FileText
} from 'lucide-react'
import Link from 'next/link'

// Mock AI intelligence data
const aiData = {
  overview: {
    totalAnalyses: 1247,
    aiAccuracy: 96.8,
    processingSpeed: 2.3,
    costSavingsIdentified: 3800000,
    riskReduction: 87,
    automationLevel: 94
  },
  aiCapabilities: [
    {
      name: 'Contract Analysis',
      description: 'AI-powered extraction and analysis of contract terms, clauses, and obligations',
      accuracy: 96.8,
      speed: '2.3s avg',
      icon: <FileText className="w-6 h-6" />,
      color: 'text-blue-600 bg-blue-50',
      features: ['Clause extraction', 'Risk identification', 'Compliance checking', 'Term analysis']
    },
    {
      name: 'Risk Assessment',
      description: 'Intelligent risk scoring and mitigation recommendations',
      accuracy: 94.2,
      speed: '1.8s avg',
      icon: <Shield className="w-6 h-6" />,
      color: 'text-red-600 bg-red-50',
      features: ['Risk scoring', 'Threat detection', 'Mitigation strategies', 'Predictive analysis']
    },
    {
      name: 'Financial Intelligence',
      description: 'Cost optimization and financial impact analysis',
      accuracy: 92.5,
      speed: '3.1s avg',
      icon: <DollarSign className="w-6 h-6" />,
      color: 'text-green-600 bg-green-50',
      features: ['Cost analysis', 'Savings identification', 'Budget optimization', 'ROI calculation']
    },
    {
      name: 'Compliance Monitoring',
      description: 'Automated regulatory compliance checking and reporting',
      accuracy: 98.1,
      speed: '1.5s avg',
      icon: <Award className="w-6 h-6" />,
      color: 'text-purple-600 bg-purple-50',
      features: ['Regulatory mapping', 'Compliance scoring', 'Gap analysis', 'Audit preparation']
    }
  ],
  aiInsights: [
    {
      type: 'cost_optimization',
      title: 'Rate Card Optimization Opportunity',
      description: 'AI identified $1.8M in potential savings through supplier rate benchmarking',
      impact: '$1.8M Annual Savings',
      confidence: 96,
      action: 'Review rate cards across 89 contracts',
      priority: 'High'
    },
    {
      type: 'risk_mitigation',
      title: 'Auto-Renewal Risk Detection',
      description: 'Found 23 contracts with problematic auto-renewal clauses',
      impact: '$8.7M Risk Exposure',
      confidence: 97,
      action: 'Review and renegotiate terms',
      priority: 'High'
    },
    {
      type: 'compliance',
      title: 'GDPR Compliance Gap',
      description: 'Identified 12 contracts requiring data processing clause updates',
      impact: 'Regulatory Compliance',
      confidence: 94,
      action: 'Update data processing terms',
      priority: 'Medium'
    }
  ],
  aiFeatures: [
    {
      name: 'CTO Executive Dashboard',
      description: 'Executive-level AI insights and strategic recommendations',
      href: '/futuristic-contracts',
      icon: <Rocket className="w-8 h-8" />,
      color: 'bg-gradient-to-r from-blue-600 to-purple-600',
      isNew: true,
      features: ['Executive metrics', 'Strategic insights', 'ROI analysis', 'Risk overview']
    },
    {
      name: 'BPO Revolution',
      description: 'Procurement intelligence and supplier optimization',
      href: '/bpo-demo',
      icon: <TrendingUp className="w-8 h-8" />,
      color: 'bg-gradient-to-r from-green-600 to-blue-600',
      isNew: true,
      features: ['Supplier benchmarking', 'Cost optimization', 'Performance analytics', 'Market intelligence']
    },
    {
      name: 'Cross-Contract Analysis',
      description: 'Relationship discovery and portfolio optimization',
      href: '/cross-contract-analysis',
      icon: <Network className="w-8 h-8" />,
      color: 'bg-gradient-to-r from-purple-600 to-pink-600',
      features: ['Relationship mapping', 'Portfolio analysis', 'Dependency tracking', 'Optimization opportunities']
    }
  ]
}

export default function AIIntelligencePage() {
  const getInsightColor = (type: string) => {
    switch (type) {
      case 'cost_optimization': return 'border-green-200 bg-green-50'
      case 'risk_mitigation': return 'border-red-200 bg-red-50'
      case 'compliance': return 'border-blue-200 bg-blue-50'
      default: return 'border-gray-200 bg-gray-50'
    }
  }

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'cost_optimization': return <DollarSign className="w-5 h-5 text-green-600" />
      case 'risk_mitigation': return <Shield className="w-5 h-5 text-red-600" />
      case 'compliance': return <Award className="w-5 h-5 text-blue-600" />
      default: return <Lightbulb className="w-5 h-5 text-gray-600" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Brain className="w-8 h-8 text-blue-600" />
            AI Intelligence Platform
          </h1>
          <p className="text-gray-600 mt-1">Advanced AI-powered contract analysis and insights</p>
        </div>
        <div className="flex items-center gap-3">
          <AIBadge>AI Powered</AIBadge>
          <Button>
            <Play className="w-4 h-4 mr-2" />
            Watch Demo
          </Button>
        </div>
      </div>

      {/* AI Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">AI Accuracy</p>
                <p className="text-3xl font-bold text-gray-900">{aiData.overview.aiAccuracy}%</p>
                <p className="text-sm text-gray-600 mt-1">vs expert review</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-xl">
                <Brain className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Processing Speed</p>
                <p className="text-3xl font-bold text-gray-900">{aiData.overview.processingSpeed}s</p>
                <p className="text-sm text-gray-600 mt-1">avg analysis time</p>
              </div>
              <div className="p-3 bg-green-50 rounded-xl">
                <Zap className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Cost Savings</p>
                <p className="text-3xl font-bold text-gray-900">
                  ${(aiData.overview.costSavingsIdentified / 1000000).toFixed(1)}M
                </p>
                <p className="text-sm text-gray-600 mt-1">identified YTD</p>
              </div>
              <div className="p-3 bg-purple-50 rounded-xl">
                <Target className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Capabilities */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="w-6 h-6 text-blue-600" />
            AI Capabilities
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {aiData.aiCapabilities.map((capability, index) => (
              <div key={index} className={`p-6 rounded-xl border-2 ${capability.color.replace('text-', 'border-').replace('bg-', 'border-').replace('-600', '-200').replace('-50', '-50')}`}>
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-xl ${capability.color}`}>
                    {capability.icon}
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900">{capability.accuracy}%</div>
                    <div className="text-sm text-gray-600">Accuracy</div>
                  </div>
                </div>
                
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{capability.name}</h3>
                <p className="text-gray-600 mb-4">{capability.description}</p>
                
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-gray-600">Processing Speed:</span>
                  <span className="text-sm font-medium text-gray-900">{capability.speed}</span>
                </div>
                
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700">Key Features:</h4>
                  <div className="flex flex-wrap gap-2">
                    {capability.features.map((feature, featureIndex) => (
                      <Badge key={featureIndex} variant="secondary" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* AI Feature Showcase */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-yellow-500" />
            AI-Powered Features
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {aiData.aiFeatures.map((feature, index) => (
              <Link key={index} href={feature.href}>
                <Card className="hover:shadow-xl transition-all duration-300 cursor-pointer border-2 hover:border-blue-300 h-full">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className={`p-4 rounded-xl text-white ${feature.color}`}>
                        {feature.icon}
                      </div>
                      {(feature.isNew ?? false) && (
                        <Badge className="bg-yellow-100 text-yellow-800">
                          New
                        </Badge>
                      )}
                    </div>
                    
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.name}</h3>
                    <p className="text-gray-600 mb-4">{feature.description}</p>
                    
                    <div className="space-y-2 mb-4">
                      {feature.features.map((feat, featIndex) => (
                        <div key={featIndex} className="flex items-center gap-2 text-sm text-gray-600">
                          <ArrowRight className="w-3 h-3 text-blue-600" />
                          {feat}
                        </div>
                      ))}
                    </div>
                    
                    <div className="flex items-center text-blue-600 font-medium">
                      Explore Feature <ArrowRight className="w-4 h-4 ml-1" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* AI Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="w-6 h-6 text-yellow-500" />
            Latest AI Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {aiData.aiInsights.map((insight, index) => (
              <div key={index} className={`p-6 rounded-xl border-2 ${getInsightColor(insight.type)}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="p-3 bg-white rounded-xl shadow-sm">
                      {getInsightIcon(insight.type)}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-lg font-semibold text-gray-900">{insight.title}</h4>
                        <Badge className="bg-white/80 text-gray-800">
                          {insight.confidence}% confidence
                        </Badge>
                        <Badge className={insight.priority === 'High' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}>
                          {insight.priority} Priority
                        </Badge>
                      </div>
                      
                      <p className="text-gray-700 mb-3">{insight.description}</p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Target className="w-4 h-4 text-gray-500" />
                          <span className="font-medium text-gray-900">{insight.impact}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Activity className="w-4 h-4 text-gray-500" />
                          <span className="text-gray-600">{insight.action}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button size="sm">
                      <Eye className="w-4 h-4 mr-2" />
                      View Details
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* AI Performance Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-6 h-6 text-blue-600" />
              AI Performance Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Contracts Analyzed</span>
                <span className="font-semibold text-gray-900">{aiData.overview.totalAnalyses.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Risk Reduction</span>
                <span className="font-semibold text-green-600">{aiData.overview.riskReduction}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Automation Level</span>
                <span className="font-semibold text-blue-600">{aiData.overview.automationLevel}%</span>
              </div>
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Overall AI Efficiency</span>
                  <span className="text-sm font-medium text-gray-900">96%</span>
                </div>
                <Progress value={96} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-6 h-6 text-green-600" />
              AI Impact Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600 mb-1">
                  ${(aiData.overview.costSavingsIdentified / 1000000).toFixed(1)}M
                </div>
                <div className="text-sm text-gray-600">Total Cost Savings Identified</div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="text-lg font-bold text-blue-600">2.3s</div>
                  <div className="text-xs text-gray-600">Avg Processing</div>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg">
                  <div className="text-lg font-bold text-purple-600">87%</div>
                  <div className="text-xs text-gray-600">Risk Reduction</div>
                </div>
              </div>
              
              <div className="pt-4 border-t text-center">
                <p className="text-sm text-gray-600">
                  AI has processed <strong>{aiData.overview.totalAnalyses.toLocaleString()}</strong> contracts with 
                  <strong> {aiData.overview.aiAccuracy}%</strong> accuracy
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}