'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Calculator,
  Calendar,
  Shield,
  Search,
  TrendingUp,
  Target,
  Users,
  Building,
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  FileText,
  Zap,
  Brain,
  Eye,
  Lightbulb,
  Award,
  ArrowRight,
  Play,
  Sparkles,
  Database,
  Network,
  RefreshCw
} from 'lucide-react'

interface UseCase {
  id: string
  title: string
  icon: React.ComponentType<{ className?: string }>
  category: 'quick-wins' | 'scalable' | 'differentiating' | 'client-facing'
  problem: string
  solution: string
  value: string
  timeToValue: string
  savingsRange: string
  complexity: 'Low' | 'Medium' | 'High'
  roi: string
  demoData: {
    beforeMetrics: { label: string; value: string; color: string }[]
    afterMetrics: { label: string; value: string; color: string }[]
    keyInsights: string[]
    implementationSteps: string[]
  }
}

const useCases: UseCase[] = [
  {
    id: 'rate-benchmarking',
    title: 'Rate Card Benchmarking (Professional Services MVP)',
    icon: Calculator,
    category: 'quick-wins',
    problem: 'Analysts manually compare Deloitte vs PwC vs EY SOWs in Excel, taking 40+ hours per analysis with outdated benchmarks.',
    solution: 'AI auto-extracts & normalizes daily rates per role → benchmarks vs historical contracts & real-time market median.',
    value: 'Immediate visibility into overpricing → "Client X pays 12% above market for Senior Managers."',
    timeToValue: '2 weeks',
    savingsRange: '8-15% on professional services spend',
    complexity: 'Low',
    roi: '450%',
    demoData: {
      beforeMetrics: [
        { label: 'Analysis Time', value: '40 hours', color: 'text-red-600' },
        { label: 'Data Accuracy', value: '65%', color: 'text-red-600' },
        { label: 'Benchmark Coverage', value: '3 suppliers', color: 'text-red-600' },
        { label: 'Savings Identified', value: '3-5%', color: 'text-red-600' }
      ],
      afterMetrics: [
        { label: 'Analysis Time', value: '2 minutes', color: 'text-green-600' },
        { label: 'Data Accuracy', value: '94%', color: 'text-green-600' },
        { label: 'Benchmark Coverage', value: '50+ suppliers', color: 'text-green-600' },
        { label: 'Savings Identified', value: '12-18%', color: 'text-green-600' }
      ],
      keyInsights: [
        'Senior Consultant rates 12% above market median ($175 vs $156)',
        'Project Manager rates competitive but trending upward',
        'Developer rates 8% below market - good value retention',
        'Annual savings opportunity: $156K on this contract alone'
      ],
      implementationSteps: [
        'Upload existing rate cards and SOWs',
        'AI extracts and normalizes all rates by role/level',
        'Real-time benchmarking against market database',
        'Generate negotiation-ready insights and recommendations'
      ]
    }
  },
  {
    id: 'renewal-radar',
    title: 'Contract Renewal Radar',
    icon: Calendar,
    category: 'quick-wins',
    problem: 'Renewals often flagged late → clients get stuck with automatic extensions at poor terms, missing 15-25% savings opportunities.',
    solution: 'AI-powered end-date dashboard + proactive alerts + pre-built negotiation packs (benchmarks, clauses, market intelligence).',
    value: 'Proactive renegotiation → guaranteed savings and improved client retention through strategic advisory.',
    timeToValue: '1 week',
    savingsRange: '15-25% on renewed contracts',
    complexity: 'Low',
    roi: '680%',
    demoData: {
      beforeMetrics: [
        { label: 'Renewals Missed', value: '35%', color: 'text-red-600' },
        { label: 'Auto-Extensions', value: '60%', color: 'text-red-600' },
        { label: 'Prep Time', value: '2-3 weeks', color: 'text-red-600' },
        { label: 'Negotiation Success', value: '40%', color: 'text-red-600' }
      ],
      afterMetrics: [
        { label: 'Renewals Captured', value: '95%', color: 'text-green-600' },
        { label: 'Proactive Negotiations', value: '90%', color: 'text-green-600' },
        { label: 'Prep Time', value: '2 hours', color: 'text-green-600' },
        { label: 'Negotiation Success', value: '78%', color: 'text-green-600' }
      ],
      keyInsights: [
        '23 contracts expiring in next 90 days worth $4.2M',
        '8 high-risk auto-renewals identified with poor terms',
        'Average 18% savings achieved on proactive renewals',
        'Client satisfaction increased 34% with strategic advisory'
      ],
      implementationSteps: [
        'Import contract database with key dates',
        'Set up automated renewal alerts (90/60/30 days)',
        'Generate negotiation packs with benchmarks',
        'Track renewal outcomes and savings achieved'
      ]
    }
  },
  {
    id: 'compliance-health',
    title: 'Compliance Health Check',
    icon: Shield,
    category: 'scalable',
    problem: 'Reviewing GDPR, liability, payment terms = manual, slow, inconsistent. Compliance gaps create 5-15% cost exposure.',
    solution: 'AI scans contracts for required clauses, marks present/weak/missing with risk scoring and remediation recommendations.',
    value: 'Faster compliance audits, reduced regulatory risk, standardized contract quality across all categories.',
    timeToValue: '3 weeks',
    savingsRange: '5-12% risk mitigation value',
    complexity: 'Medium',
    roi: '320%',
    demoData: {
      beforeMetrics: [
        { label: 'Audit Time', value: '5 days', color: 'text-red-600' },
        { label: 'Coverage', value: '25%', color: 'text-red-600' },
        { label: 'Compliance Score', value: '67%', color: 'text-red-600' },
        { label: 'Risk Exposure', value: 'High', color: 'text-red-600' }
      ],
      afterMetrics: [
        { label: 'Audit Time', value: '2 hours', color: 'text-green-600' },
        { label: 'Coverage', value: '100%', color: 'text-green-600' },
        { label: 'Compliance Score', value: '92%', color: 'text-green-600' },
        { label: 'Risk Exposure', value: 'Low', color: 'text-green-600' }
      ],
      keyInsights: [
        'GDPR clauses missing in 34% of data processing contracts',
        'Liability caps insufficient in 12 high-value agreements',
        'Payment terms non-standard in 67% of supplier contracts',
        'Estimated risk reduction value: $890K annually'
      ],
      implementationSteps: [
        'Define compliance requirements by contract type',
        'AI scans entire contract portfolio',
        'Generate compliance scorecards and gap analysis',
        'Prioritize remediation by risk and value impact'
      ]
    }
  },
  {
    id: 'cross-contract-insights',
    title: 'Cross-Contract Intelligence',
    icon: Search,
    category: 'differentiating',
    problem: 'Hard to see supplier exposure across categories and clients. No visibility into bundling opportunities or relationship leverage.',
    solution: 'Natural-language queries: "Show all contracts with Deloitte across all clients" + "Which EY contracts have notice periods > 60 days?"',
    value: 'Smarter bundling & sourcing strategies across the Chain IQ network. Unique cross-client insights (anonymized).',
    timeToValue: '4 weeks',
    savingsRange: '10-20% through strategic bundling',
    complexity: 'Medium',
    roi: '540%',
    demoData: {
      beforeMetrics: [
        { label: 'Supplier Visibility', value: '15%', color: 'text-red-600' },
        { label: 'Bundling Opportunities', value: '2-3 per year', color: 'text-red-600' },
        { label: 'Cross-Client Insights', value: 'None', color: 'text-red-600' },
        { label: 'Negotiation Leverage', value: 'Low', color: 'text-red-600' }
      ],
      afterMetrics: [
        { label: 'Supplier Visibility', value: '100%', color: 'text-green-600' },
        { label: 'Bundling Opportunities', value: '15+ per quarter', color: 'text-green-600' },
        { label: 'Cross-Client Insights', value: 'Real-time', color: 'text-green-600' },
        { label: 'Negotiation Leverage', value: 'High', color: 'text-green-600' }
      ],
      keyInsights: [
        'Deloitte contracts across 8 clients worth $12.4M total',
        '23 suppliers have >60 day notice periods (renegotiation opportunity)',
        'Cross-client bundling potential: $2.1M additional savings',
        'Market intelligence: EY rates trending 8% above Big 4 average'
      ],
      implementationSteps: [
        'Aggregate contracts across all Chain IQ clients',
        'Build supplier relationship mapping',
        'Enable natural language query interface',
        'Generate strategic bundling recommendations'
      ]
    }
  },
  {
    id: 'savings-pipeline',
    title: 'Savings Pipeline Tracker',
    icon: TrendingUp,
    category: 'client-facing',
    problem: 'Savings opportunities identified manually, no consistent tracking. Hard to prove value to clients with auditable pipeline.',
    solution: 'Every rate outlier, renewal risk, or compliance gap → logged as a savings initiative with € impact and probability.',
    value: 'Quantifiable, auditable savings pipeline → proof of value for clients. Transparent ROI tracking and reporting.',
    timeToValue: '2 weeks',
    savingsRange: '20-35% pipeline visibility increase',
    complexity: 'Low',
    roi: '750%',
    demoData: {
      beforeMetrics: [
        { label: 'Savings Visibility', value: '30%', color: 'text-red-600' },
        { label: 'Tracking Accuracy', value: '45%', color: 'text-red-600' },
        { label: 'Client Reporting', value: 'Quarterly', color: 'text-red-600' },
        { label: 'Value Proof', value: 'Anecdotal', color: 'text-red-600' }
      ],
      afterMetrics: [
        { label: 'Savings Visibility', value: '95%', color: 'text-green-600' },
        { label: 'Tracking Accuracy', value: '92%', color: 'text-green-600' },
        { label: 'Client Reporting', value: 'Real-time', color: 'text-green-600' },
        { label: 'Value Proof', value: 'Auditable', color: 'text-green-600' }
      ],
      keyInsights: [
        'Current pipeline: $3.2M in identified savings opportunities',
        '67% probability-weighted value: $2.1M expected savings',
        'Top opportunity: Professional services rate optimization ($890K)',
        'Client ROI: 8.4x on Chain IQ engagement fees'
      ],
      implementationSteps: [
        'Automatically identify savings opportunities',
        'Assign probability and impact scores',
        'Track initiative progress and outcomes',
        'Generate client-facing value reports'
      ]
    }
  },
  {
    id: 'sievo-integration',
    title: 'Category Spend + Contract Overlay (Sievo Integration)',
    icon: BarChart3,
    category: 'differentiating',
    problem: 'Spend analytics are disconnected from contract terms. No clear "where to act" guidance for category managers.',
    solution: 'Combine Sievo spend data with contract benchmarks → highlight categories overspending vs peers with contract-level insights.',
    value: 'Clear "where to act" guidance for category managers. Spend analytics enhanced with contract intelligence.',
    timeToValue: '6 weeks',
    savingsRange: '12-22% through integrated insights',
    complexity: 'High',
    roi: '420%',
    demoData: {
      beforeMetrics: [
        { label: 'Spend Visibility', value: '80%', color: 'text-yellow-600' },
        { label: 'Contract Context', value: '20%', color: 'text-red-600' },
        { label: 'Action Clarity', value: '35%', color: 'text-red-600' },
        { label: 'Category Optimization', value: '40%', color: 'text-red-600' }
      ],
      afterMetrics: [
        { label: 'Spend Visibility', value: '100%', color: 'text-green-600' },
        { label: 'Contract Context', value: '95%', color: 'text-green-600' },
        { label: 'Action Clarity', value: '90%', color: 'text-green-600' },
        { label: 'Category Optimization', value: '85%', color: 'text-green-600' }
      ],
      keyInsights: [
        'Professional Services: $4.2M spend, 15% above peer benchmark',
        'IT Services: Contract terms driving 23% cost premium',
        'Facilities: Spend aligned but contract risks identified',
        'Total optimization opportunity: $1.8M across categories'
      ],
      implementationSteps: [
        'Integrate Sievo spend data with contract database',
        'Map spend categories to contract terms',
        'Benchmark spend vs contract performance',
        'Generate category-specific action plans'
      ]
    }
  },
  {
    id: 'supplier-snapshots',
    title: 'Supplier Snapshot Packs',
    icon: Users,
    category: 'client-facing',
    problem: 'Creating negotiation packs takes days/weeks. Category managers walk into supplier meetings unprepared.',
    solution: 'One-click Supplier Snapshot = rate benchmarks, clause variances, SLA risks, market intelligence, negotiation recommendations.',
    value: 'Category managers walk into supplier meetings with data-driven insights. Professional negotiation preparation in minutes.',
    timeToValue: '1 week',
    savingsRange: '8-18% improved negotiation outcomes',
    complexity: 'Low',
    roi: '590%',
    demoData: {
      beforeMetrics: [
        { label: 'Prep Time', value: '2-3 weeks', color: 'text-red-600' },
        { label: 'Data Quality', value: '60%', color: 'text-red-600' },
        { label: 'Negotiation Success', value: '45%', color: 'text-red-600' },
        { label: 'Supplier Insights', value: 'Limited', color: 'text-red-600' }
      ],
      afterMetrics: [
        { label: 'Prep Time', value: '15 minutes', color: 'text-green-600' },
        { label: 'Data Quality', value: '94%', color: 'text-green-600' },
        { label: 'Negotiation Success', value: '73%', color: 'text-green-600' },
        { label: 'Supplier Insights', value: 'Comprehensive', color: 'text-green-600' }
      ],
      keyInsights: [
        'Deloitte: Rates 12% above market, strong delivery record',
        'Payment terms: 45 days vs industry standard 30 days',
        'SLA performance: 94% vs 98% peer average',
        'Negotiation leverage: High volume, multiple contracts'
      ],
      implementationSteps: [
        'Select supplier for snapshot generation',
        'AI aggregates all contract data and benchmarks',
        'Generate comprehensive negotiation pack',
        'Export ready-to-use presentation materials'
      ]
    }
  }
]

const categoryColors = {
  'quick-wins': 'bg-green-100 text-green-800 border-green-200',
  'scalable': 'bg-violet-100 text-violet-800 border-violet-200',
  'differentiating': 'bg-purple-100 text-purple-800 border-purple-200',
  'client-facing': 'bg-orange-100 text-orange-800 border-orange-200'
}

const categoryLabels = {
  'quick-wins': 'Quick Wins',
  'scalable': 'Scalable',
  'differentiating': 'Differentiating',
  'client-facing': 'Client-Facing'
}

export default function UseCasesSection() {
  const [selectedUseCase, setSelectedUseCase] = useState<UseCase | null>(null)
  const [activeDemo, setActiveDemo] = useState<string | null>(null)

  const runDemo = (useCaseId: string) => {
    setActiveDemo(useCaseId)
    setTimeout(() => setActiveDemo(null), 3000) // Demo runs for 3 seconds
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          🚀 Use Cases for Chain IQ to Start Building
        </h2>
        <p className="text-lg text-gray-600 max-w-4xl mx-auto">
          Tangible use cases that Chain IQ management will understand immediately, 
          linked to savings, efficiency, and competitive differentiation.
        </p>
      </div>

      {/* Category Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Object.entries(categoryLabels).map(([key, label]) => {
          const count = useCases.filter(uc => uc.category === key).length
          return (
            <Card key={key} className={`border-2 ${categoryColors[key as keyof typeof categoryColors]}`}>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold">{count}</div>
                <div className="text-sm font-medium">{label}</div>
                <div className="text-xs mt-1">Use Cases</div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Use Cases Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {useCases.map((useCase) => (
          <Card key={useCase.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-violet-100 rounded-lg">
                    <useCase.icon className="w-6 h-6 text-violet-600" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg leading-tight">{useCase.title}</CardTitle>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge className={categoryColors[useCase.category]}>
                        {categoryLabels[useCase.category]}
                      </Badge>
                      <Badge variant="outline">{useCase.complexity} Complexity</Badge>
                      <Badge variant="outline">{useCase.timeToValue}</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Problem/Solution */}
              <div className="space-y-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <span className="font-medium text-red-700">Problem Today:</span>
                  </div>
                  <p className="text-sm text-gray-600 pl-6">{useCase.problem}</p>
                </div>
                
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Brain className="w-4 h-4 text-violet-500" />
                    <span className="font-medium text-violet-700">AI CLM Solution:</span>
                  </div>
                  <p className="text-sm text-gray-600 pl-6">{useCase.solution}</p>
                </div>
                
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Target className="w-4 h-4 text-green-500" />
                    <span className="font-medium text-green-700">Value:</span>
                  </div>
                  <p className="text-sm text-gray-600 pl-6">{useCase.value}</p>
                </div>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded-lg">
                <div className="text-center">
                  <div className="text-lg font-bold text-green-600">{useCase.savingsRange}</div>
                  <div className="text-xs text-gray-600">Savings Range</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-violet-600">{useCase.roi}</div>
                  <div className="text-xs text-gray-600">ROI</div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setSelectedUseCase(useCase)}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Details
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => runDemo(useCase.id)}
                  disabled={activeDemo === useCase.id}
                >
                  {activeDemo === useCase.id ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Run Demo
                    </>
                  )}
                </Button>
              </div>

              {/* Demo Results */}
              {activeDemo === useCase.id && (
                <div className="mt-4 p-4 bg-violet-50 border border-violet-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-5 h-5 text-violet-600" />
                    <span className="font-medium text-violet-800">Demo Running: {useCase.title}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm font-medium text-red-700 mb-2">Before AI:</div>
                      {useCase.demoData.beforeMetrics.slice(0, 2).map((metric, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span>{metric.label}:</span>
                          <span className={metric.color}>{metric.value}</span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-green-700 mb-2">After AI:</div>
                      {useCase.demoData.afterMetrics.slice(0, 2).map((metric, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span>{metric.label}:</span>
                          <span className={metric.color}>{metric.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detailed Use Case Modal/Expanded View */}
      {selectedUseCase && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <selectedUseCase.icon className="w-8 h-8 text-violet-600" />
                  <h3 className="text-2xl font-bold">{selectedUseCase.title}</h3>
                </div>
                <Button variant="outline" onClick={() => setSelectedUseCase(null)}>
                  ✕
                </Button>
              </div>

              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="demo">Before/After</TabsTrigger>
                  <TabsTrigger value="insights">Key Insights</TabsTrigger>
                  <TabsTrigger value="implementation">Implementation</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-6">
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card>
                        <CardContent className="p-4 text-center">
                          <DollarSign className="w-8 h-8 text-green-600 mx-auto mb-2" />
                          <div className="text-xl font-bold text-green-600">{selectedUseCase.savingsRange}</div>
                          <div className="text-sm text-gray-600">Savings Range</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4 text-center">
                          <Clock className="w-8 h-8 text-violet-600 mx-auto mb-2" />
                          <div className="text-xl font-bold text-violet-600">{selectedUseCase.timeToValue}</div>
                          <div className="text-sm text-gray-600">Time to Value</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4 text-center">
                          <TrendingUp className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                          <div className="text-xl font-bold text-purple-600">{selectedUseCase.roi}</div>
                          <div className="text-sm text-gray-600">ROI</div>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="space-y-4">
                      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                        <h4 className="font-semibold text-red-800 mb-2">Problem Today:</h4>
                        <p className="text-red-700">{selectedUseCase.problem}</p>
                      </div>
                      
                      <div className="p-4 bg-violet-50 border border-violet-200 rounded-lg">
                        <h4 className="font-semibold text-violet-800 mb-2">AI CLM Solution:</h4>
                        <p className="text-violet-700">{selectedUseCase.solution}</p>
                      </div>
                      
                      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <h4 className="font-semibold text-green-800 mb-2">Value Delivered:</h4>
                        <p className="text-green-700">{selectedUseCase.value}</p>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="demo" className="mt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="border-red-200">
                      <CardHeader className="bg-red-50">
                        <CardTitle className="text-red-800">Before AI Implementation</CardTitle>
                      </CardHeader>
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          {selectedUseCase.demoData.beforeMetrics.map((metric, idx) => (
                            <div key={idx} className="flex justify-between items-center">
                              <span className="text-sm">{metric.label}:</span>
                              <span className={`font-semibold ${metric.color}`}>{metric.value}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-green-200">
                      <CardHeader className="bg-green-50">
                        <CardTitle className="text-green-800">After AI Implementation</CardTitle>
                      </CardHeader>
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          {selectedUseCase.demoData.afterMetrics.map((metric, idx) => (
                            <div key={idx} className="flex justify-between items-center">
                              <span className="text-sm">{metric.label}:</span>
                              <span className={`font-semibold ${metric.color}`}>{metric.value}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="insights" className="mt-6">
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold">Key Insights & Findings:</h4>
                    {selectedUseCase.demoData.keyInsights.map((insight, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 bg-violet-50 rounded-lg">
                        <Lightbulb className="w-5 h-5 text-violet-600 mt-0.5" />
                        <span className="text-violet-800">{insight}</span>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="implementation" className="mt-6">
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold">Implementation Steps:</h4>
                    {selectedUseCase.demoData.implementationSteps.map((step, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="w-6 h-6 bg-violet-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                          {idx + 1}
                        </div>
                        <span className="text-gray-800">{step}</span>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      )}

      {/* Summary Section */}
      <Card className="bg-gradient-to-r from-violet-50 to-purple-50 border-violet-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-6 h-6 text-violet-600" />
            Why These Use Cases Work as Starting Points
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <div className="font-semibold text-green-800">Quick wins:</div>
                  <div className="text-sm text-green-700">Rate benchmarking + renewal alerts = immediate measurable € impact.</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-violet-600 mt-0.5" />
                <div>
                  <div className="font-semibold text-violet-800">Scalable:</div>
                  <div className="text-sm text-violet-700">Compliance checks & snapshots apply across all categories.</div>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-purple-600 mt-0.5" />
                <div>
                  <div className="font-semibold text-purple-800">Differentiating:</div>
                  <div className="text-sm text-purple-700">Cross-client insights (with anonymization) are unique to Chain IQ&apos;s BPO model.</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-orange-600 mt-0.5" />
                <div>
                  <div className="font-semibold text-orange-800">Client-facing potential:</div>
                  <div className="text-sm text-orange-700">These outputs can be turned into value reports for clients → upsell opportunities.</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}