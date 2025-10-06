'use client'

import React from 'react'
import Link from 'next/link'
import {
  DollarSign,
  Calendar,
  Shield,
  Network,
  TrendingUp,
  Database,
  FileText,
  ArrowRight
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const useCases = [
  {
    id: 'rate-benchmarking',
    title: 'Rate Card Benchmarking',
    description: 'Upload rate cards, benchmark against market data, identify savings opportunities instantly.',
    icon: DollarSign,
    category: 'quick-wins',
    categoryLabel: 'Quick Wins',
    metrics: {
      roi: '15x',
      savings: '$186K/contract',
      timeToValue: '1 week'
    },
    color: 'from-green-500 to-emerald-600'
  },
  {
    id: 'renewal-radar',
    title: 'Contract Renewal Radar',
    description: 'Never miss a renewal deadline. Proactive alerts and negotiation-ready materials.',
    icon: Calendar,
    category: 'quick-wins',
    categoryLabel: 'Quick Wins',
    metrics: {
      roi: '12x',
      savings: '$890K/year',
      timeToValue: '1 week'
    },
    color: 'from-blue-500 to-cyan-600'
  },
  {
    id: 'compliance-check',
    title: 'Compliance Health Check',
    description: 'Instant compliance scanning across GDPR, CCPA, SOX. Identify gaps in minutes.',
    icon: Shield,
    category: 'scalable',
    categoryLabel: 'Scalable',
    metrics: {
      roi: '20x',
      savings: '$890K risk avoided',
      timeToValue: '1 day'
    },
    color: 'from-blue-500 to-indigo-600'
  },
  {
    id: 'cross-contract-intelligence',
    title: 'Cross-Contract Intelligence',
    description: 'Ask questions across your portfolio. Discover relationships and bundling opportunities.',
    icon: Network,
    category: 'differentiating',
    categoryLabel: 'Differentiating',
    metrics: {
      roi: '15x',
      savings: '$2.1M bundling',
      timeToValue: '3 weeks'
    },
    color: 'from-purple-500 to-pink-600'
  },
  {
    id: 'savings-pipeline',
    title: 'Savings Pipeline Tracker',
    description: 'Track every dollar from identification to realization. Real-time client reporting.',
    icon: TrendingUp,
    category: 'client-facing',
    categoryLabel: 'Client-Facing',
    metrics: {
      roi: '8.4x',
      savings: '$2.56M pipeline',
      timeToValue: '2 weeks'
    },
    color: 'from-green-500 to-teal-600'
  },
  {
    id: 'sievo-integration',
    title: 'Sievo Integration',
    description: 'Connect spend data with contracts. Identify variances and enforce compliance.',
    icon: Database,
    category: 'scalable',
    categoryLabel: 'Scalable',
    metrics: {
      roi: '18x',
      savings: '$1.03M/year',
      timeToValue: '2 weeks'
    },
    color: 'from-teal-500 to-cyan-600'
  },
  {
    id: 'supplier-snapshots',
    title: 'Supplier Snapshot Packs',
    description: 'Comprehensive supplier intelligence for negotiations. Generated in minutes.',
    icon: FileText,
    category: 'client-facing',
    categoryLabel: 'Client-Facing',
    metrics: {
      roi: '25x',
      savings: '$186K/supplier',
      timeToValue: '1 hour'
    },
    color: 'from-orange-500 to-red-600'
  }
]

export default function UseCasesIndexPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Chain IQ Use Cases
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Explore 7 powerful use cases that deliver measurable ROI and transform procurement operations.
            Each use case is production-ready with real functionality.
          </p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <div className="text-center p-6 bg-white rounded-lg shadow-sm">
            <div className="text-4xl font-bold text-blue-600 mb-2">7</div>
            <div className="text-sm text-gray-600">Use Cases</div>
          </div>
          <div className="text-center p-6 bg-white rounded-lg shadow-sm">
            <div className="text-4xl font-bold text-green-600 mb-2">$7.8M</div>
            <div className="text-sm text-gray-600">Total Savings Potential</div>
          </div>
          <div className="text-center p-6 bg-white rounded-lg shadow-sm">
            <div className="text-4xl font-bold text-purple-600 mb-2">16x</div>
            <div className="text-sm text-gray-600">Average ROI</div>
          </div>
          <div className="text-center p-6 bg-white rounded-lg shadow-sm">
            <div className="text-4xl font-bold text-orange-600 mb-2">1-3 weeks</div>
            <div className="text-sm text-gray-600">Avg Time to Value</div>
          </div>
        </div>

        {/* Use Cases Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {useCases.map((useCase) => {
            const Icon = useCase.icon
            return (
              <Link key={useCase.id} href={`/use-cases/${useCase.id}`}>
                <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer group">
                  <CardHeader>
                    <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${useCase.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <Badge className="mb-2 w-fit">{useCase.categoryLabel}</Badge>
                    <CardTitle className="text-xl mb-2">{useCase.title}</CardTitle>
                    <p className="text-sm text-gray-600">{useCase.description}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">ROI:</span>
                        <span className="font-semibold">{useCase.metrics.roi}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Savings:</span>
                        <span className="font-semibold text-green-600">{useCase.metrics.savings}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Time to Value:</span>
                        <span className="font-semibold">{useCase.metrics.timeToValue}</span>
                      </div>
                    </div>
                    <Button className="w-full group-hover:bg-blue-600 transition-colors">
                      Explore Use Case
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>

        {/* CTA Section */}
        <div className="text-center p-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg text-white">
          <h2 className="text-3xl font-bold mb-4">Ready to Transform Your Procurement?</h2>
          <p className="text-lg mb-6 opacity-90">
            Start with a pilot program and see results in weeks, not months.
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" variant="secondary">
              Schedule Demo
            </Button>
            <Button size="lg" variant="outline" className="bg-white text-blue-600 hover:bg-gray-100">
              Download Overview
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
