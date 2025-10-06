'use client'

import React, { useState } from 'react'
import UseCaseHero from '@/components/use-cases/shared/UseCaseHero'
import BeforeAfterComparison from '@/components/use-cases/shared/BeforeAfterComparison'
import UseCaseCTA from '@/components/use-cases/shared/UseCaseCTA'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Database, TrendingUp, AlertCircle, CheckCircle2, BarChart3 } from 'lucide-react'
import { mockSievoData, integrationSteps } from '@/lib/use-cases/sievo-data'

export default function SievoIntegrationPage() {
  const [currentStep, setCurrentStep] = useState(0)
  const [integrated, setIntegrated] = useState(false)

  const runIntegration = () => {
    setCurrentStep(0)
    const interval = setInterval(() => {
      setCurrentStep(prev => {
        if (prev >= integrationSteps.length - 1) {
          clearInterval(interval)
          setIntegrated(true)
          return prev
        }
        return prev + 1
      })
    }, 1500)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-blue-50">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <UseCaseHero
          title="Sievo Integration"
          description="Connect spend data with contract intelligence. Identify variances, enforce compliance, and optimize category spend."
          icon={Database}
          category="scalable"
          metrics={{
            roi: '18x',
            savings: '$1.03M/year',
            timeToValue: '2 weeks',
            complexity: 'Medium'
          }}
        />

        <BeforeAfterComparison
          before={[
            { label: 'Data silos', value: 'Disconnected', color: 'red' },
            { label: 'Variance detection', value: 'Manual', color: 'yellow' },
            { label: 'Analysis time', value: '1-2 weeks', color: 'red' },
            { label: 'Coverage', value: '20% of spend', color: 'yellow' }
          ]}
          after={[
            { label: 'Data silos', value: 'Unified view', color: 'green' },
            { label: 'Variance detection', value: 'Automated', color: 'green' },
            { label: 'Analysis time', value: 'Real-time', color: 'green' },
            { label: 'Coverage', value: '100% of spend', color: 'green' }
          ]}
          highlights={[
            'Discovered $1.03M in spend-contract variances',
            'Reduced analysis time by 95%',
            'Improved contract compliance by 42%'
          ]}
        />

        {/* Integration Demo */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Sievo Integration Demo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!integrated ? (
              <div>
                <div className="text-center mb-6">
                  <Button onClick={runIntegration} size="lg" disabled={currentStep > 0}>
                    {currentStep > 0 ? 'Integrating...' : 'Start Integration'}
                  </Button>
                </div>
                <div className="space-y-3">
                  {integrationSteps.map((step, idx) => (
                    <div key={idx} className={`p-4 rounded-lg border-2 ${
                      idx < currentStep ? 'border-green-500 bg-green-50' :
                      idx === currentStep ? 'border-blue-500 bg-blue-50' :
                      'border-gray-200'
                    }`}>
                      <div className="flex items-center gap-3">
                        {idx < currentStep ? (
                          <CheckCircle2 className="w-6 h-6 text-green-600" />
                        ) : idx === currentStep ? (
                          <div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <div className="w-6 h-6 rounded-full border-2 border-gray-300" />
                        )}
                        <div className="flex-1">
                          <div className="font-semibold">{step.title}</div>
                          <div className="text-sm text-gray-600">{step.description}</div>
                        </div>
                        <div className="text-sm text-gray-500">{step.duration}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center p-6 bg-green-50 rounded-lg">
                <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-green-600 mb-2">Integration Complete!</h3>
                <p className="text-gray-600">Spend data successfully synced with contract intelligence</p>
              </div>
            )}
          </CardContent>
        </Card>

        {integrated && (
          <>
            {/* Spend vs Contract Coverage */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Spend vs Contract Coverage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-6 mb-6">
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-3xl font-bold text-green-600">
                      ${(mockSievoData.spendVsContract.aligned / 1000000).toFixed(1)}M
                    </div>
                    <div className="text-sm text-gray-600">Aligned Spend</div>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <div className="text-3xl font-bold text-red-600">
                      ${(mockSievoData.spendVsContract.unaligned / 1000000).toFixed(1)}M
                    </div>
                    <div className="text-sm text-gray-600">Unaligned Spend</div>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-3xl font-bold text-blue-600">
                      {mockSievoData.spendVsContract.coverage.toFixed(1)}%
                    </div>
                    <div className="text-sm text-gray-600">Coverage</div>
                  </div>
                </div>
                <Progress value={mockSievoData.spendVsContract.coverage} />
              </CardContent>
            </Card>

            {/* Category Analysis */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Category Spend Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockSievoData.categories.map((cat) => (
                    <div key={cat.name} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-lg">{cat.name}</h4>
                          <div className="text-sm text-gray-600">
                            {cat.suppliers} suppliers • {cat.transactions} transactions
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-gray-900">
                            ${(cat.spend / 1000000).toFixed(1)}M
                          </div>
                          {cat.variance > 0 && (
                            <Badge variant="destructive">
                              +{cat.variance.toFixed(1)}% variance
                            </Badge>
                          )}
                        </div>
                      </div>
                      {cat.contractedRate && cat.actualRate && (
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <div className="text-gray-600">Contracted</div>
                            <div className="font-semibold">${cat.contractedRate}/hr</div>
                          </div>
                          <div>
                            <div className="text-gray-600">Actual</div>
                            <div className="font-semibold text-red-600">${cat.actualRate}/hr</div>
                          </div>
                          <div>
                            <div className="text-gray-600">Opportunity</div>
                            <div className="font-semibold text-green-600">
                              ${(cat.opportunity / 1000).toFixed(0)}K
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Top Priorities */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Top Optimization Priorities
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockSievoData.topPriorities.map((priority) => (
                    <div key={priority.priority} className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold flex-shrink-0">
                          {priority.priority}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold mb-1">{priority.category}</h4>
                          <p className="text-sm text-gray-700 mb-2">{priority.issue}</p>
                          <div className="text-sm">
                            <span className="font-medium">Action: </span>
                            <span className="text-gray-700">{priority.action}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-green-600">
                            ${(priority.savings / 1000).toFixed(0)}K
                          </div>
                          <div className="text-sm text-gray-600">Savings</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Supplier Spend */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Top Supplier Spend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {mockSievoData.supplierSpend.map((supplier) => (
                    <div key={supplier.supplier} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-semibold">{supplier.supplier}</div>
                        <div className="text-sm text-gray-600">{supplier.contracts} contracts</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg">
                          ${(supplier.spend / 1000000).toFixed(1)}M
                        </div>
                        {supplier.variance > 0 && (
                          <div className="text-sm text-red-600">+{supplier.variance.toFixed(1)}% variance</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}

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
