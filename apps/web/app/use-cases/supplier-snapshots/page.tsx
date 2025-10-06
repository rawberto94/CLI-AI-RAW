'use client'

import React, { useState } from 'react'
import UseCaseHero from '@/components/use-cases/shared/UseCaseHero'
import BeforeAfterComparison from '@/components/use-cases/shared/BeforeAfterComparison'
import UseCaseCTA from '@/components/use-cases/shared/UseCaseCTA'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { FileText, Download, TrendingUp, DollarSign, Target, Users } from 'lucide-react'
import { mockSupplierData, snapshotSections } from '@/lib/use-cases/supplier-snapshot-data'

export default function SupplierSnapshotsPage() {
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [progress, setProgress] = useState(0)

  const generateSnapshot = () => {
    setGenerating(true)
    setProgress(0)
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval)
          setGenerating(false)
          setGenerated(true)
          return 100
        }
        return prev + 20
      })
    }, 500)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-purple-50">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <UseCaseHero
          title="Supplier Snapshot Packs"
          description="Instant, comprehensive supplier intelligence. Everything you need for negotiations in one click."
          icon={FileText}
          category="client-facing"
          metrics={{
            roi: '25x',
            savings: '$186K per supplier',
            timeToValue: '1 hour',
            complexity: 'Low'
          }}
        />

        <BeforeAfterComparison
          before={[
            { label: 'Prep time', value: '2-3 weeks', color: 'red' },
            { label: 'Data gathering', value: 'Manual', color: 'yellow' },
            { label: 'Completeness', value: '60-70%', color: 'yellow' },
            { label: 'Cost per pack', value: '$8,000', color: 'red' }
          ]}
          after={[
            { label: 'Prep time', value: '5 minutes', color: 'green' },
            { label: 'Data gathering', value: 'Automated', color: 'green' },
            { label: 'Completeness', value: '95%+', color: 'green' },
            { label: 'Cost per pack', value: '$50', color: 'green' }
          ]}
          highlights={[
            'Reduced negotiation prep time by 99%',
            'Improved negotiation outcomes by 23%',
            'Generated 47 supplier packs in first month'
          ]}
        />

        {/* Snapshot Generator */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Generate Supplier Snapshot
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center mb-6">
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Select Supplier</label>
                <select className="w-full max-w-md p-2 border rounded-lg">
                  <option>{mockSupplierData.supplier}</option>
                  <option>Accenture</option>
                  <option>KPMG</option>
                  <option>PwC</option>
                </select>
              </div>
              <Button onClick={generateSnapshot} size="lg" disabled={generating || generated}>
                {generating ? 'Generating...' : generated ? 'Generated!' : 'Generate Snapshot Pack'}
              </Button>
            </div>
            {generating && (
              <div className="mb-4">
                <Progress value={progress} />
                <div className="text-center text-sm text-gray-600 mt-2">
                  {progress}% complete
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {generated && (
          <>
            {/* Executive Summary */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Executive Summary: {mockSupplierData.supplier}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-3xl font-bold text-blue-600">{mockSupplierData.contracts}</div>
                    <div className="text-sm text-gray-600">Active Contracts</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-3xl font-bold text-green-600">
                      ${(mockSupplierData.totalValue / 1000000).toFixed(1)}M
                    </div>
                    <div className="text-sm text-gray-600">Total Value</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-3xl font-bold text-purple-600">
                      {mockSupplierData.snapshot.leverage.level}
                    </div>
                    <div className="text-sm text-gray-600">Negotiation Leverage</div>
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <div className="text-3xl font-bold text-orange-600">
                      {mockSupplierData.snapshot.spend.growth.toFixed(1)}%
                    </div>
                    <div className="text-sm text-gray-600">YoY Growth</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Rate Analysis */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Rate Benchmarking Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-lg">Overall Rate Variance</div>
                      <div className="text-sm text-gray-600">Current vs Market Median</div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-red-600">
                        +{mockSupplierData.snapshot.rateAnalysis.variance.toFixed(1)}%
                      </div>
                      <div className="text-sm text-gray-600">Above Market</div>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  {mockSupplierData.snapshot.rateAnalysis.roles.map((role) => (
                    <div key={role.role} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium">{role.role}</div>
                      </div>
                      <div className="flex items-center gap-6 text-sm">
                        <div>
                          <span className="text-gray-600">Current: </span>
                          <span className="font-semibold">${role.current}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Market: </span>
                          <span className="font-semibold">${role.market}</span>
                        </div>
                        <Badge variant={role.variance > 5 ? 'destructive' : 'secondary'}>
                          +{role.variance.toFixed(1)}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Performance Metrics */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Performance Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  {Object.entries(mockSupplierData.snapshot.performance).map(([metric, value]) => (
                    <div key={metric}>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="capitalize">{metric.replace(/([A-Z])/g, ' $1').trim()}</span>
                        <span className="font-semibold">{value}{typeof value === 'number' && value <= 5 ? '/5' : '%'}</span>
                      </div>
                      <Progress value={typeof value === 'number' && value <= 5 ? value * 20 : value} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Contract Terms */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Current Contract Terms</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {Object.entries(mockSupplierData.snapshot.terms).map(([term, value]) => (
                    <div key={term} className="p-4 bg-gray-50 rounded-lg">
                      <div className="text-sm text-gray-600 mb-1 capitalize">
                        {term.replace(/([A-Z])/g, ' $1').trim()}
                      </div>
                      <div className="font-semibold">{value.toString()}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Negotiation Strategy */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Negotiation Talking Points
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockSupplierData.negotiationTalkingPoints.map((point, idx) => (
                    <div key={idx} className="p-4 border-l-4 border-blue-500 bg-blue-50 rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <Badge className="mb-2">{point.category}</Badge>
                          <h4 className="font-semibold mb-2">{point.point}</h4>
                          <div className="text-sm space-y-1">
                            <div><span className="font-medium">Data: </span>{point.data}</div>
                            <div><span className="font-medium">Target: </span>{point.target}</div>
                            <div><span className="font-medium">Leverage: </span>{point.leverage}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recommendations */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Strategic Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {mockSupplierData.recommendations.map((rec, idx) => (
                    <div key={idx} className="flex items-start gap-2 p-3 bg-green-50 rounded-lg">
                      <div className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                        {idx + 1}
                      </div>
                      <span className="text-sm">{rec}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Alternative Suppliers */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Alternative Suppliers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {mockSupplierData.alternativeSuppliers.map((alt) => (
                    <div key={alt.name} className="p-4 border rounded-lg">
                      <h4 className="font-semibold text-lg mb-2">{alt.name}</h4>
                      <div className="text-2xl font-bold text-green-600 mb-3">
                        ${alt.averageRate}/hr
                      </div>
                      <div className="mb-3">
                        <div className="text-sm font-medium mb-1">Strengths:</div>
                        <div className="space-y-1">
                          {alt.strengths.map((s, idx) => (
                            <div key={idx} className="text-sm text-green-600">✓ {s}</div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-medium mb-1">Weaknesses:</div>
                        <div className="space-y-1">
                          {alt.weaknesses.map((w, idx) => (
                            <div key={idx} className="text-sm text-gray-600">• {w}</div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Export Options */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="w-5 h-5" />
                  Export Snapshot Pack
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button className="w-full">
                    <Download className="w-4 h-4 mr-2" />
                    Download PDF
                  </Button>
                  <Button className="w-full" variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    Download PowerPoint
                  </Button>
                  <Button className="w-full" variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    Download Excel
                  </Button>
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
