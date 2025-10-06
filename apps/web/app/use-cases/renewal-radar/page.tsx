'use client'

import React, { useState } from 'react'
import UseCaseHero from '@/components/use-cases/shared/UseCaseHero'
import BeforeAfterComparison from '@/components/use-cases/shared/BeforeAfterComparison'
import UseCaseCTA from '@/components/use-cases/shared/UseCaseCTA'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Calendar, AlertTriangle, TrendingUp, Clock, DollarSign, CheckCircle2 } from 'lucide-react'
import { mockRenewalData, renewalTimeline } from '@/lib/use-cases/renewal-radar-data'

export default function RenewalRadarPage() {
  const [selectedContract, setSelectedContract] = useState(mockRenewalData.upcomingRenewals[0])

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'High': return 'bg-red-500'
      case 'Medium': return 'bg-yellow-500'
      case 'Low': return 'bg-green-500'
      default: return 'bg-gray-500'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <UseCaseHero
          title="Contract Renewal Radar"
          description="Never miss a renewal deadline. Proactive alerts, market intelligence, and negotiation-ready materials."
          icon={Calendar}
          category="quick-wins"
          metrics={{
            roi: '12x',
            savings: '$890K/year',
            timeToValue: '1 week',
            complexity: 'Low'
          }}
        />

        <BeforeAfterComparison
          before={[
            { label: 'Manual tracking', value: 'Spreadsheets', color: 'red' },
            { label: 'Missed deadlines', value: '23% of contracts', color: 'red' },
            { label: 'Auto-renewals', value: 'Unnoticed', color: 'red' },
            { label: 'Prep time', value: '2-3 weeks', color: 'yellow' }
          ]}
          after={[
            { label: 'Automated alerts', value: '90/60/30 days', color: 'green' },
            { label: 'Missed deadlines', value: '0%', color: 'green' },
            { label: 'Auto-renewals', value: 'Flagged early', color: 'green' },
            { label: 'Prep time', value: '2-3 days', color: 'green' }
          ]}
          highlights={[
            'Prevented $890K in unwanted auto-renewals',
            'Reduced contract management time by 75%',
            'Improved negotiation outcomes by 18%'
          ]}
        />

        {/* Dashboard */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Renewal Dashboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-3xl font-bold text-red-600">{mockRenewalData.upcomingRenewals.length}</div>
                <div className="text-sm text-gray-600">Upcoming Renewals</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-3xl font-bold text-orange-600">${(mockRenewalData.totalAtRisk / 1000000).toFixed(1)}M</div>
                <div className="text-sm text-gray-600">Total at Risk</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-3xl font-bold text-green-600">{mockRenewalData.averageSavings}%</div>
                <div className="text-sm text-gray-600">Avg Savings</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-3xl font-bold text-blue-600">{mockRenewalData.alerts.length}</div>
                <div className="text-sm text-gray-600">Active Alerts</div>
              </div>
            </div>

            {/* Alerts */}
            <div className="space-y-3 mb-8">
              <h3 className="font-semibold text-lg mb-4">Active Alerts</h3>
              {mockRenewalData.alerts.map((alert, idx) => (
                <div key={idx} className={`p-4 rounded-lg border-l-4 ${
                  alert.type === 'Critical' ? 'bg-red-50 border-red-500' :
                  alert.type === 'High' ? 'bg-orange-50 border-orange-500' :
                  'bg-yellow-50 border-yellow-500'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4" />
                        <Badge variant={alert.type === 'Critical' ? 'destructive' : 'default'}>
                          {alert.type}
                        </Badge>
                      </div>
                      <p className="font-medium mb-1">{alert.message}</p>
                      <p className="text-sm text-gray-600">{alert.action}</p>
                    </div>
                    <div className="text-sm text-gray-500">Due: {alert.deadline}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Contracts List */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg mb-4">Upcoming Renewals</h3>
              {mockRenewalData.upcomingRenewals.map((contract) => (
                <div
                  key={contract.id}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedContract.id === contract.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedContract(contract)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="font-semibold">{contract.contract}</h4>
                      <p className="text-sm text-gray-600">{contract.supplier}</p>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg">${(contract.value / 1000).toFixed(0)}K</div>
                      <div className="text-sm text-gray-600">{contract.daysRemaining} days</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <Badge className={getRiskColor(contract.riskLevel)}>
                      {contract.riskLevel} Risk
                    </Badge>
                    {contract.autoRenewal && (
                      <Badge variant="outline" className="border-orange-500 text-orange-600">
                        Auto-Renewal
                      </Badge>
                    )}
                    <span className="text-green-600 font-medium">
                      ${(contract.savingsOpportunity / 1000).toFixed(0)}K savings opportunity
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Negotiation Pack */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Negotiation Pack: {selectedContract.contract}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <h4 className="font-semibold mb-3">Rate Benchmarking</h4>
                <div className="space-y-2">
                  {Object.entries(mockRenewalData.negotiationPack.benchmarkData).map(([role, data]) => (
                    <div key={role} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <span className="text-sm capitalize">{role.replace(/([A-Z])/g, ' $1').trim()}</span>
                      <div className="text-right">
                        <span className="text-sm font-medium">${data.current}</span>
                        <span className="text-xs text-gray-500 ml-2">vs ${data.market}</span>
                        <span className={`text-xs ml-2 ${data.variance > 5 ? 'text-red-600' : 'text-green-600'}`}>
                          {data.variance > 0 ? '+' : ''}{data.variance.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3">Performance Metrics</h4>
                <div className="space-y-3">
                  {Object.entries(mockRenewalData.negotiationPack.performanceMetrics).map(([metric, value]) => (
                    <div key={metric}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="capitalize">{metric.replace(/([A-Z])/g, ' $1').trim()}</span>
                        <span className="font-medium">{value}{typeof value === 'number' && value <= 5 ? '/5' : '%'}</span>
                      </div>
                      <Progress value={typeof value === 'number' && value <= 5 ? value * 20 : value} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-3">Negotiation Recommendations</h4>
              <div className="space-y-2">
                {mockRenewalData.negotiationPack.recommendations.map((rec, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-3 bg-green-50 rounded-lg">
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Renewal Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {renewalTimeline.map((item) => (
                <div key={item.week} className="flex items-center gap-4">
                  <div className="w-16 text-center">
                    <div className="text-sm font-medium">Week {item.week}</div>
                  </div>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    item.status === 'completed' ? 'bg-green-500' :
                    item.status === 'in-progress' ? 'bg-blue-500' :
                    'bg-gray-300'
                  }`}>
                    {item.status === 'completed' && <CheckCircle2 className="w-5 h-5 text-white" />}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{item.milestone}</div>
                    <Badge variant="outline" className="mt-1">
                      {item.status.replace('-', ' ')}
                    </Badge>
                  </div>
                </div>
              ))}
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
