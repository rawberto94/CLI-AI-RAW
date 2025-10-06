import React from 'react'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Cross-Contract Analysis - Contract Intelligence',
  description: 'AI-powered relationship discovery and portfolio optimization across contracts',
}
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AIBadge } from '@/components/ui/design-system'
import { 
  Network,
  Brain,
  Users,
  FileText,
  Shield,
  Target,
  ArrowRight,
  Eye,
  Download,
  Filter,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  Link as LinkIcon,
  GitBranch,
  Layers
} from 'lucide-react'

// Mock cross-contract analysis data
const crossContractData = {
  overview: {
    totalRelationships: 1847,
    contractsAnalyzed: 1247,
    dependencyChains: 89,
    riskClusters: 23,
    optimizationOpportunities: 156
  },
  relationshipTypes: [
    {
      type: 'Supplier Dependencies',
      count: 456,
      description: 'Contracts with shared suppliers or service dependencies',
      riskLevel: 'Medium',
      examples: ['TechCorp MSA → Multiple SOWs', 'CloudServices → Infrastructure Dependencies']
    },
    {
      type: 'Financial Relationships',
      count: 234,
      description: 'Contracts with financial interdependencies or shared budgets',
      riskLevel: 'High',
      examples: ['Master Agreement → Payment Terms', 'Volume Discounts → Multiple Contracts']
    },
    {
      type: 'Compliance Chains',
      count: 189,
      description: 'Contracts sharing compliance requirements or certifications',
      riskLevel: 'Low',
      examples: ['GDPR Requirements → Data Processing', 'SOX Controls → Financial Services']
    },
    {
      type: 'Renewal Clusters',
      count: 167,
      description: 'Contracts with coordinated renewal dates or terms',
      riskLevel: 'Medium',
      examples: ['Annual Renewals → Q4 Cluster', 'Multi-year Agreements → Staggered Terms']
    }
  ],
  keyInsights: [
    {
      id: '1',
      type: 'dependency_risk',
      title: 'Critical Supplier Dependency Chain',
      description: 'TechCorp failure would impact 23 downstream contracts worth $12.4M',
      impact: '$12.4M at Risk',
      confidence: 94,
      affectedContracts: 23,
      recommendation: 'Diversify supplier base and establish backup agreements',
      priority: 'High'
    },
    {
      id: '2',
      type: 'optimization',
      title: 'Volume Discount Consolidation',
      description: 'Consolidating 15 separate contracts could unlock $890K in volume discounts',
      impact: '$890K Annual Savings',
      confidence: 87,
      affectedContracts: 15,
      recommendation: 'Negotiate consolidated pricing with key suppliers',
      priority: 'High'
    },
    {
      id: '3',
      type: 'compliance',
      title: 'Compliance Standardization Opportunity',
      description: '34 contracts could benefit from standardized compliance clauses',
      impact: '65% Faster Reviews',
      confidence: 91,
      affectedContracts: 34,
      recommendation: 'Implement standard compliance template across portfolio',
      priority: 'Medium'
    }
  ],
  networkAnalysis: {
    centralNodes: [
      {
        name: 'TechCorp Master Agreement',
        connections: 23,
        influence: 'High',
        type: 'Supplier Hub',
        riskScore: 78
      },
      {
        name: 'CloudServices Infrastructure',
        connections: 18,
        influence: 'High',
        type: 'Service Hub',
        riskScore: 45
      },
      {
        name: 'DataPro Analytics Platform',
        connections: 12,
        influence: 'Medium',
        type: 'Technology Hub',
        riskScore: 34
      }
    ],
    clusters: [
      {
        name: 'Software Development Cluster',
        contracts: 89,
        totalValue: 18500000,
        avgRisk: 34,
        keySuppliers: ['TechCorp', 'DevSolutions', 'CodeCraft']
      },
      {
        name: 'Infrastructure Services Cluster',
        contracts: 67,
        totalValue: 12300000,
        avgRisk: 28,
        keySuppliers: ['CloudServices', 'InfraTech', 'NetworkPro']
      },
      {
        name: 'Consulting Services Cluster',
        contracts: 45,
        totalValue: 8900000,
        avgRisk: 42,
        keySuppliers: ['ConsultingPro', 'StrategyPartners', 'BusinessExperts']
      }
    ]
  },
  riskScenarios: [
    {
      scenario: 'Major Supplier Failure',
      probability: 'Low (5%)',
      impact: '$24.7M',
      affectedContracts: 67,
      mitigationCost: '$450K',
      description: 'Primary supplier becomes unavailable'
    },
    {
      scenario: 'Compliance Violation Cascade',
      probability: 'Medium (15%)',
      impact: '$3.2M',
      affectedContracts: 34,
      mitigationCost: '$120K',
      description: 'Single compliance failure affects related contracts'
    },
    {
      scenario: 'Renewal Date Collision',
      probability: 'High (35%)',
      impact: '$1.8M',
      affectedContracts: 23,
      mitigationCost: '$80K',
      description: 'Multiple critical contracts expire simultaneously'
    }
  ]
}

export default function CrossContractAnalysisPage() {
  const getRiskColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200'
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'low': return 'text-green-600 bg-green-50 border-green-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'dependency_risk': return <AlertTriangle className="w-5 h-5 text-red-600" />
      case 'optimization': return <Target className="w-5 h-5 text-green-600" />
      case 'compliance': return <Shield className="w-5 h-5 text-blue-600" />
      default: return <Brain className="w-5 h-5 text-gray-600" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Network className="w-8 h-8 text-purple-600" />
            Cross-Contract Analysis
          </h1>
          <p className="text-gray-600 mt-1">AI-powered relationship discovery and portfolio optimization</p>
        </div>
        <div className="flex items-center gap-3">
          <AIBadge>AI Powered</AIBadge>
          <Button variant="outline" size="sm">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
          <Button variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export Analysis
          </Button>
        </div>
      </div>

      {/* Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Relationships</p>
                <p className="text-3xl font-bold text-gray-900">{crossContractData.overview.totalRelationships.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-purple-50 rounded-xl">
                <Network className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Contracts Analyzed</p>
                <p className="text-3xl font-bold text-gray-900">{crossContractData.overview.contractsAnalyzed.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-xl">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Dependency Chains</p>
                <p className="text-3xl font-bold text-gray-900">{crossContractData.overview.dependencyChains}</p>
              </div>
              <div className="p-3 bg-green-50 rounded-xl">
                <GitBranch className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Risk Clusters</p>
                <p className="text-3xl font-bold text-gray-900">{crossContractData.overview.riskClusters}</p>
              </div>
              <div className="p-3 bg-red-50 rounded-xl">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Opportunities</p>
                <p className="text-3xl font-bold text-gray-900">{crossContractData.overview.optimizationOpportunities}</p>
              </div>
              <div className="p-3 bg-yellow-50 rounded-xl">
                <Target className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Key Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-yellow-500" />
            AI-Discovered Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {crossContractData.keyInsights.map((insight) => (
              <div key={insight.id} className="p-6 bg-gray-50 rounded-xl border-2 border-gray-200 hover:border-blue-300 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="p-3 bg-white rounded-xl shadow-sm">
                      {getInsightIcon(insight.type)}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-xl font-semibold text-gray-900">{insight.title}</h4>
                        <Badge className="bg-white/80 text-gray-800">
                          {insight.confidence}% confidence
                        </Badge>
                        <Badge className={insight.priority === 'High' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}>
                          {insight.priority} Priority
                        </Badge>
                      </div>
                      
                      <p className="text-gray-700 mb-4">{insight.description}</p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-4">
                        <div className="flex items-center gap-2">
                          <Target className="w-4 h-4 text-gray-500" />
                          <span className="font-medium text-gray-900">{insight.impact}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-gray-500" />
                          <span className="text-gray-600">{insight.affectedContracts} contracts</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Brain className="w-4 h-4 text-gray-500" />
                          <span className="text-gray-600">AI Analysis</span>
                        </div>
                      </div>
                      
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm font-medium text-blue-800 mb-1">Recommendation:</p>
                        <p className="text-sm text-blue-700">{insight.recommendation}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button size="sm">
                      <Eye className="w-4 h-4 mr-2" />
                      Analyze
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Relationship Types */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="w-6 h-6 text-blue-600" />
            Relationship Types Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {crossContractData.relationshipTypes.map((relationship, index) => (
              <div key={index} className={`p-6 rounded-xl border-2 ${getRiskColor(relationship.riskLevel)}`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">{relationship.type}</h3>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900">{relationship.count}</div>
                    <Badge className={getRiskColor(relationship.riskLevel)}>
                      {relationship.riskLevel} Risk
                    </Badge>
                  </div>
                </div>
                
                <p className="text-gray-600 mb-4">{relationship.description}</p>
                
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Examples:</h4>
                  <ul className="space-y-1">
                    {relationship.examples.map((example, exampleIndex) => (
                      <li key={exampleIndex} className="text-sm text-gray-600 flex items-start gap-2">
                        <ArrowRight className="w-3 h-3 mt-0.5 text-blue-600 flex-shrink-0" />
                        {example}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Network Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="w-6 h-6 text-purple-600" />
              Central Network Nodes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {crossContractData.networkAnalysis.centralNodes.map((node, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-900">{node.name}</h4>
                    <Badge variant="outline">{node.type}</Badge>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="text-center">
                      <div className="text-lg font-bold text-blue-600">{node.connections}</div>
                      <div className="text-gray-600">Connections</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-purple-600">{node.influence}</div>
                      <div className="text-gray-600">Influence</div>
                    </div>
                    <div className="text-center">
                      <div className={`text-lg font-bold ${node.riskScore > 50 ? 'text-red-600' : 'text-green-600'}`}>
                        {node.riskScore}
                      </div>
                      <div className="text-gray-600">Risk Score</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-6 h-6 text-green-600" />
              Contract Clusters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {crossContractData.networkAnalysis.clusters.map((cluster, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-3">{cluster.name}</h4>
                  
                  <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                    <div className="text-center">
                      <div className="text-lg font-bold text-blue-600">{cluster.contracts}</div>
                      <div className="text-gray-600">Contracts</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-green-600">
                        ${(cluster.totalValue / 1000000).toFixed(1)}M
                      </div>
                      <div className="text-gray-600">Total Value</div>
                    </div>
                    <div className="text-center">
                      <div className={`text-lg font-bold ${cluster.avgRisk > 40 ? 'text-red-600' : 'text-green-600'}`}>
                        {cluster.avgRisk}
                      </div>
                      <div className="text-gray-600">Avg Risk</div>
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Key Suppliers:</p>
                    <div className="flex flex-wrap gap-1">
                      {cluster.keySuppliers.map((supplier, supplierIndex) => (
                        <Badge key={supplierIndex} variant="secondary" className="text-xs">
                          {supplier}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risk Scenarios */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-red-600" />
            Risk Scenario Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {crossContractData.riskScenarios.map((scenario, index) => (
              <div key={index} className="p-6 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">{scenario.scenario}</h4>
                    <p className="text-gray-600 mb-3">{scenario.description}</p>
                  </div>
                  <Badge className="bg-red-100 text-red-800">
                    {scenario.probability}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                  <div className="text-center p-3 bg-white rounded-lg">
                    <div className="text-lg font-bold text-red-600">{scenario.impact}</div>
                    <div className="text-gray-600">Potential Impact</div>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg">
                    <div className="text-lg font-bold text-blue-600">{scenario.affectedContracts}</div>
                    <div className="text-gray-600">Affected Contracts</div>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg">
                    <div className="text-lg font-bold text-green-600">{scenario.mitigationCost}</div>
                    <div className="text-gray-600">Mitigation Cost</div>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg">
                    <Button size="sm" className="w-full">
                      <Shield className="w-4 h-4 mr-2" />
                      Mitigate
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}