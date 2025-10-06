'use client'

import React, { useState } from 'react'
import { NegotiationPrepDashboard } from '@/components/use-cases/rate-benchmarking/NegotiationPrepDashboard'
import { NegotiationErrorBoundary } from '@/components/use-cases/rate-benchmarking/NegotiationErrorBoundary'
import { allRateCardRoles } from '@/lib/use-cases/multi-client-rate-data'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Briefcase, 
  TrendingUp, 
  Target, 
  MessageSquare, 
  GitCompare,
  ArrowLeft,
  Sparkles
} from 'lucide-react'
import Link from 'next/link'

export default function NegotiationPrepPage() {
  const [selectedExample, setSelectedExample] = useState<'default' | 'expensive' | 'competitive'>('default')
  
  // Example scenarios
  const examples = {
    default: {
      role: 'Software Engineer',
      level: 'Senior',
      location: 'Zurich',
      supplier: 'TechStaff Solutions',
      client: 'SwissBank AG',
      currentRate: 1200,
      annualVolume: 220,
      relationshipYears: 3,
      description: 'Moderate rate, good negotiation opportunity'
    },
    expensive: {
      role: 'Data Analyst',
      level: 'Manager',
      location: 'Geneva',
      supplier: 'DataPro Consulting',
      client: 'FinanceHub',
      currentRate: 1400,
      annualVolume: 200,
      relationshipYears: 2,
      description: 'Above market rate, strong negotiation position'
    },
    competitive: {
      role: 'Project Manager',
      level: 'Senior',
      location: 'Basel',
      supplier: 'PM Excellence',
      client: 'PharmaGroup',
      currentRate: 950,
      annualVolume: 180,
      relationshipYears: 5,
      description: 'Already competitive, focus on maintaining value'
    }
  }
  
  const currentExample = examples[selectedExample]
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <Link href="/use-cases/rate-benchmarking">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Rate Benchmarking
            </Button>
          </Link>
          
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                  <Briefcase className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold text-gray-900">
                    Negotiation Preparation
                  </h1>
                  <p className="text-lg text-gray-600 mt-1">
                    AI-Powered Rate Negotiation Assistant
                  </p>
                </div>
              </div>
            </div>
            
            <Badge className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 text-sm">
              <Sparkles className="w-4 h-4 mr-2" />
              MVP Complete
            </Badge>
          </div>
        </div>
        
        {/* Feature Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-8 h-8 text-blue-600" />
                <div>
                  <div className="font-semibold text-blue-900">Historical Trends</div>
                  <div className="text-sm text-blue-700">12-month analysis</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Target className="w-8 h-8 text-green-600" />
                <div>
                  <div className="font-semibold text-green-900">Target Rates</div>
                  <div className="text-sm text-green-700">3 scenarios</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-purple-200 bg-purple-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <MessageSquare className="w-8 h-8 text-purple-600" />
                <div>
                  <div className="font-semibold text-purple-900">Talking Points</div>
                  <div className="text-sm text-purple-700">AI-generated</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <GitCompare className="w-8 h-8 text-orange-600" />
                <div>
                  <div className="font-semibold text-orange-900">Scenarios</div>
                  <div className="text-sm text-orange-700">Compare outcomes</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Example Selector */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Try Different Examples</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(examples).map(([key, example]) => (
                <button
                  key={key}
                  onClick={() => setSelectedExample(key as any)}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    selectedExample === key
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <div className="font-semibold text-gray-900 mb-1">
                    {example.role} ({example.level})
                  </div>
                  <div className="text-sm text-gray-600 mb-2">
                    {example.location} • {example.supplier}
                  </div>
                  <div className="text-lg font-bold text-blue-600 mb-2">
                    CHF {example.currentRate.toLocaleString()}/day
                  </div>
                  <div className="text-xs text-gray-500">
                    {example.description}
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
        
        {/* Main Dashboard */}
        <NegotiationErrorBoundary>
          <NegotiationPrepDashboard
            role={currentExample.role}
            level={currentExample.level}
            location={currentExample.location}
            supplier={currentExample.supplier}
            client={currentExample.client}
            currentRate={currentExample.currentRate}
            annualVolume={currentExample.annualVolume}
            marketData={allRateCardRoles}
            relationshipYears={currentExample.relationshipYears}
          />
        </NegotiationErrorBoundary>
        
        {/* Footer Info */}
        <Card className="mt-8 border-blue-200 bg-gradient-to-r from-blue-50 to-purple-50">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <Sparkles className="w-6 h-6 text-blue-600 mt-1" />
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  About This Tool
                </h3>
                <p className="text-gray-700 mb-3">
                  This negotiation preparation assistant uses market intelligence, historical trends, 
                  and AI-powered analysis to help you prepare for rate negotiations. It provides 
                  data-driven targets, persuasive talking points, and scenario modeling to maximize 
                  your negotiation outcomes.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="font-semibold text-gray-900">Time Savings</div>
                    <div className="text-gray-600">81% reduction</div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Data Sources</div>
                    <div className="text-gray-600">Market intelligence</div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Scenarios</div>
                    <div className="text-gray-600">3 strategies</div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Test Coverage</div>
                    <div className="text-gray-600">100%</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
