'use client'

import React, { useState } from 'react'
import UseCaseHero from '@/components/use-cases/shared/UseCaseHero'
import BeforeAfterComparison from '@/components/use-cases/shared/BeforeAfterComparison'
import UseCaseCTA from '@/components/use-cases/shared/UseCaseCTA'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { TrendingUp, DollarSign, Target, BarChart3, CheckCircle2, Clock } from 'lucide-react'
import { mockSavingsPipelineData } from '@/lib/use-cases/savings-pipeline-data'

export default function SavingsPipelinePage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Realized': return 'bg-green-500'
      case 'In Negotiation': return 'bg-blue-500'
      case 'In Progress': return 'bg-purple-500'
      case 'Analysis': return 'bg-yellow-500'
      case 'Identified': return 'bg-gray-500'
      default: return 'bg-gray-400'
    }
  }

  const filteredOpportunities = selectedCategory
    ? mockSavingsPipelineData.opportunities.filter(opp => opp.category === selectedCategory)
    : mockSavingsPipelineData.opportunities

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <UseCaseHero
          title="Savings Pipeline Tracker"
          description="Track every dollar of savings from identification to realization. Real-time visibility into your value delivery."
          icon={TrendingUp}
          category="client-facing"
          metrics={{
            roi: '8.4x',
            savings: '$2.56M pipeline',
            timeToValue: '2 weeks',
            complexity: 'Low'
          }}
        />

        <BeforeAfterComparison
          before={[
            { label: 'Tracking', value: 'Spreadsheets', color: 'red' },
            { label: 'Visibility', value: 'Monthly reports', color: 'yellow' },
            { label: 'Accuracy', value: '±30%', color: 'red' },
            { label: 'Client reporting', value: '8 hours/month', color: 'yellow' }
          ]}
          after={[
            { label: 'Tracking', value: 'Real-time dashboard', color: 'green' },
            { label: 'Visibility', value: 'Live updates', color: 'green' },
            { label: 'Accuracy', value: '±5%', color: 'green' },
            { label: 'Client reporting', value: '15 minutes/month', color: 'green' }
          ]}
          highlights={[
            'Increased savings realization by 23%',
            'Reduced reporting time by 95%',
            'Improved client satisfaction scores by 34%'
          ]}
        />

        {/* Pipeline Overview */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Savings Funnel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="text-center p-6 bg-blue-50 rounded-lg">
                <div className="text-4xl font-bold text-blue-600 mb-2">
                  ${(mockSavingsPipelineData.summary.identified / 1000000).toFixed(1)}M
                </div>
                <div className="text-sm text-gray-600 mb-1">Identified</div>
                <div className="text-xs text-gray-500">{mockSavingsPipelineData.summary.totalOpportunities} opportunities</div>
              </div>
              <div className="text-center p-6 bg-purple-50 rounded-lg">
                <div className="text-4xl font-bold text-purple-600 mb-2">
                  ${(mockSavingsPipelineData.summary.inProgress / 1000000).toFixed(1)}M
                </div>
                <div className="text-sm text-gray-600 mb-1">In Progress</div>
                <div className="text-xs text-gray-500">
                  ${(mockSavingsPipelineData.summary.expectedValue / 1000000).toFixed(1)}M expected
                </div>
              </div>
              <div className="text-center p-6 bg-green-50 rounded-lg">
                <div className="text-4xl font-bold text-green-600 mb-2">
                  ${(mockSavingsPipelineData.summary.realized / 1000000).toFixed(2)}M
                </div>
                <div className="text-sm text-gray-600 mb-1">Realized</div>
                <div className="text-xs text-gray-500">
                  {((mockSavingsPipelineData.summary.realized / mockSavingsPipelineData.summary.identified) * 100).toFixed(0)}% conversion
                </div>
              </div>
            </div>

            {/* Visual Funnel */}
            <div className="space-y-2">
              <div className="relative">
                <div className="h-12 bg-blue-500 rounded-lg flex items-center justify-between px-4 text-white">
                  <span className="font-medium">Identified</span>
                  <span className="font-bold">${(mockSavingsPipelineData.summary.identified / 1000000).toFixed(1)}M</span>
                </div>
              </div>
              <div className="relative" style={{ width: '75%', marginLeft: '12.5%' }}>
                <div className="h-12 bg-purple-500 rounded-lg flex items-center justify-between px-4 text-white">
                  <span className="font-medium">In Progress</span>
                  <span className="font-bold">${(mockSavingsPipelineData.summary.inProgress / 1000000).toFixed(1)}M</span>
                </div>
              </div>
              <div className="relative" style={{ width: '50%', marginLeft: '25%' }}>
                <div className="h-12 bg-green-500 rounded-lg flex items-center justify-between px-4 text-white">
                  <span className="font-medium">Realized</span>
                  <span className="font-bold">${(mockSavingsPipelineData.summary.realized / 1000000).toFixed(2)}M</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Category Breakdown */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Category Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {mockSavingsPipelineData.categoryBreakdown.map((cat) => (
                <div
                  key={cat.category}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedCategory === cat.category
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedCategory(selectedCategory === cat.category ? null : cat.category)}
                >
                  <div className="text-2xl font-bold text-gray-900 mb-1">
                    ${(cat.value / 1000).toFixed(0)}K
                  </div>
                  <div className="text-sm text-gray-600 mb-2">{cat.category}</div>
                  <div className="text-xs text-gray-500">{cat.opportunities} opportunities</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Opportunities List */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>
              {selectedCategory ? `${selectedCategory} Opportunities` : 'All Opportunities'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredOpportunities.map((opp) => (
                <div key={opp.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold">{opp.title}</h4>
                        <Badge className={getStatusColor(opp.status)}>
                          {opp.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-600 mb-2">
                        Owner: {opp.owner} | Target: {opp.targetDate}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">
                        ${(opp.value / 1000).toFixed(0)}K
                      </div>
                      <div className="text-sm text-gray-600">
                        {opp.probability}% confidence
                      </div>
                      <div className="text-xs text-gray-500">
                        EV: ${(opp.expectedValue / 1000).toFixed(0)}K
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Progress</span>
                      <span className="font-medium">{opp.progress}%</span>
                    </div>
                    <Progress value={opp.progress} />
                  </div>

                  <div>
                    <div className="text-sm font-medium mb-2">Next Steps:</div>
                    <div className="space-y-1">
                      {opp.nextSteps.map((step, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                          <CheckCircle2 className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                          <span>{step}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Timeline Chart */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Savings Trajectory
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockSavingsPipelineData.timeline.map((period) => (
                <div key={period.month}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium">{period.month}</span>
                    <span className="text-gray-600">
                      Realized: ${(period.realized / 1000).toFixed(0)}K
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="h-8 bg-blue-200 rounded" style={{ width: `${(period.identified / mockSavingsPipelineData.summary.identified) * 100}%` }} />
                    <div className="h-8 bg-purple-200 rounded" style={{ width: `${(period.inProgress / mockSavingsPipelineData.summary.identified) * 100}%` }} />
                    <div className="h-8 bg-green-500 rounded" style={{ width: `${(period.realized / mockSavingsPipelineData.summary.identified) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ROI Calculator */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Client ROI
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-3xl font-bold text-gray-900">
                  {mockSavingsPipelineData.clientROI.roi}x
                </div>
                <div className="text-sm text-gray-600">ROI</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-3xl font-bold text-green-600">
                  ${(mockSavingsPipelineData.clientROI.realizedSavings / 1000).toFixed(0)}K
                </div>
                <div className="text-sm text-gray-600">Realized</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-3xl font-bold text-blue-600">
                  ${(mockSavingsPipelineData.clientROI.projectedAnnualSavings / 1000000).toFixed(1)}M
                </div>
                <div className="text-sm text-gray-600">Projected Annual</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-3xl font-bold text-purple-600">
                  {mockSavingsPipelineData.clientROI.paybackPeriod}
                </div>
                <div className="text-sm text-gray-600">Months Payback</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <UseCaseCTA
          primaryAction={{
            label: 'Start Pilot',
            onClick: () => console.log('Start pilot')
          }}
          secondaryAction={{
            label: 'Schedule Demo',
            onClick: () => console.log('Schedule demo')
          }}
          downloadAction={{
            label: 'Download Report',
            onClick: () => console.log('Download report')
          }}
        />
      </div>
    </div>
  )
}
