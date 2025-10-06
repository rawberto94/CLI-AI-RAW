'use client'

import React, { useState } from 'react'
import UseCaseHero from '@/components/use-cases/shared/UseCaseHero'
import BeforeAfterComparison from '@/components/use-cases/shared/BeforeAfterComparison'
import UseCaseCTA from '@/components/use-cases/shared/UseCaseCTA'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Network, Search, TrendingUp, Users, DollarSign, Lightbulb } from 'lucide-react'
import { mockCrossContractData, queryExamples } from '@/lib/use-cases/cross-contract-data'

export default function CrossContractIntelligencePage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any>(null)

  const handleQuery = (q: string) => {
    setQuery(q)
    // Simulate query results
    setResults({
      query: q,
      contracts: 8,
      insights: ['Found 8 contracts with Deloitte', 'Total value: $3.2M', 'Average rate: $165/hr']
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <UseCaseHero
          title="Cross-Contract Intelligence"
          description="Ask questions across your entire contract portfolio. Discover hidden relationships, bundling opportunities, and strategic insights."
          icon={Network}
          category="differentiating"
          metrics={{
            roi: '15x',
            savings: '$2.1M bundling',
            timeToValue: '3 weeks',
            complexity: 'Medium'
          }}
        />

        <BeforeAfterComparison
          before={[
            { label: 'Analysis', value: 'Manual review', color: 'red' },
            { label: 'Time to insight', value: '2-3 weeks', color: 'red' },
            { label: 'Coverage', value: '10-20 contracts', color: 'yellow' },
            { label: 'Relationships', value: 'Undiscovered', color: 'red' }
          ]}
          after={[
            { label: 'Analysis', value: 'AI-powered', color: 'green' },
            { label: 'Time to insight', value: 'Seconds', color: 'green' },
            { label: 'Coverage', value: 'All contracts', color: 'green' },
            { label: 'Relationships', value: 'Mapped & visualized', color: 'green' }
          ]}
          highlights={[
            'Discovered $2.1M in consolidation opportunities',
            'Reduced analysis time by 98%',
            'Identified 23 hidden supplier relationships'
          ]}
        />

        {/* Natural Language Query */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Ask Anything About Your Contracts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g., Show all contracts with Deloitte"
                className="w-full p-3 border rounded-lg"
                onKeyPress={(e) => e.key === 'Enter' && handleQuery(query)}
              />
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {queryExamples.map((example) => (
                <Button
                  key={example}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuery(example)}
                >
                  {example}
                </Button>
              ))}
            </div>
            {results && (
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="font-semibold mb-2">Results for: "{results.query}"</div>
                <div className="space-y-1">
                  {results.insights.map((insight: string, idx: number) => (
                    <div key={idx} className="text-sm text-gray-700">• {insight}</div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Portfolio Overview */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Portfolio Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-3xl font-bold text-blue-600">{mockCrossContractData.portfolioOverview.totalContracts}</div>
                <div className="text-sm text-gray-600">Contracts</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-3xl font-bold text-green-600">
                  ${(mockCrossContractData.portfolioOverview.totalValue / 1000000).toFixed(1)}M
                </div>
                <div className="text-sm text-gray-600">Total Value</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-3xl font-bold text-purple-600">{mockCrossContractData.portfolioOverview.suppliers}</div>
                <div className="text-sm text-gray-600">Suppliers</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-3xl font-bold text-orange-600">{mockCrossContractData.portfolioOverview.categories}</div>
                <div className="text-sm text-gray-600">Categories</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-3xl font-bold text-gray-900">
                  ${(mockCrossContractData.portfolioOverview.averageContractValue / 1000).toFixed(0)}K
                </div>
                <div className="text-sm text-gray-600">Avg Value</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Supplier Analysis */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Supplier Concentration Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockCrossContractData.supplierAnalysis.map((supplier) => (
                <div key={supplier.supplier} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-lg">{supplier.supplier}</h4>
                      <div className="text-sm text-gray-600">
                        {supplier.contracts} contracts • {supplier.categories.join(', ')}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900">
                        ${(supplier.totalValue / 1000000).toFixed(1)}M
                      </div>
                      <Badge className={supplier.leverage === 'High' ? 'bg-green-500' : 'bg-yellow-500'}>
                        {supplier.leverage} Leverage
                      </Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-gray-600">Current Rate</div>
                      <div className="font-semibold">${supplier.averageRate}/hr</div>
                    </div>
                    <div>
                      <div className="text-gray-600">Market Rate</div>
                      <div className="font-semibold">${supplier.marketRate}/hr</div>
                    </div>
                    <div>
                      <div className="text-gray-600">Opportunity</div>
                      <div className="font-semibold text-green-600">
                        ${(supplier.consolidationOpportunity / 1000).toFixed(0)}K
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Bundling Opportunities */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Consolidation & Bundling Opportunities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockCrossContractData.bundlingOpportunities.map((opp, idx) => (
                <div key={idx} className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <Badge className="mb-2">{opp.type}</Badge>
                      <h4 className="font-semibold mb-1">{opp.description}</h4>
                      <div className="text-sm text-gray-600">
                        {opp.contracts} contracts • ${(opp.currentValue / 1000000).toFixed(1)}M total value
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">
                        ${(opp.potentialSavings / 1000).toFixed(0)}K
                      </div>
                      <div className="text-sm text-gray-600">{opp.savingsPercentage}% savings</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm mt-3">
                    <span className="text-gray-600">Implementation: {opp.implementation}</span>
                    <span className="text-gray-600">Confidence: {opp.confidence}%</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Market Intelligence */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5" />
              Market Intelligence & Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-3">Industry Trends</h4>
                <div className="space-y-2">
                  {mockCrossContractData.marketIntelligence.industryTrends.map((trend, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm">
                      <TrendingUp className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                      <span>{trend}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-3">Competitive Insights</h4>
                <div className="space-y-2">
                  {mockCrossContractData.marketIntelligence.competitiveInsights.map((insight, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm">
                      <Users className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                      <span>{insight}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-6">
              <h4 className="font-semibold mb-3">Strategic Recommendations</h4>
              <div className="space-y-2">
                {mockCrossContractData.marketIntelligence.recommendations.map((rec, idx) => (
                  <div key={idx} className="p-3 bg-blue-50 rounded-lg text-sm">
                    {idx + 1}. {rec}
                  </div>
                ))}
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
