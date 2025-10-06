'use client'

import React from 'react'
import { Badge } from '@/components/ui/badge'
import { UseCaseHeroProps } from '@/lib/use-cases/types'
import { ArrowLeft, Clock, DollarSign, TrendingUp } from 'lucide-react'
import Link from 'next/link'

const categoryColors = {
  'quick-wins': 'from-green-600 to-green-700',
  'scalable': 'from-blue-600 to-blue-700',
  'differentiating': 'from-purple-600 to-purple-700',
  'client-facing': 'from-orange-600 to-orange-700'
}

const categoryLabels = {
  'quick-wins': 'Quick Wins',
  'scalable': 'Scalable',
  'differentiating': 'Differentiating',
  'client-facing': 'Client-Facing'
}

export default function UseCaseHero({
  title,
  description,
  icon: Icon,
  category,
  metrics
}: UseCaseHeroProps) {
  return (
    <div className={`bg-gradient-to-r ${categoryColors[category]} text-white py-16 px-6`}>
      <div className="max-w-7xl mx-auto">
        {/* Back Navigation */}
        <Link 
          href="/pilot-demo" 
          className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Use Cases
        </Link>

        {/* Hero Content */}
        <div className="flex items-start gap-6 mb-8">
          <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-sm">
            <Icon className="w-12 h-12" />
          </div>
          <div className="flex-1">
            <Badge className="bg-white/20 text-white mb-3">
              {categoryLabels[category]}
            </Badge>
            <h1 className="text-4xl font-bold mb-3">{title}</h1>
            <p className="text-xl text-white/90">{description}</p>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-white/80" />
              <span className="text-sm text-white/80">ROI</span>
            </div>
            <div className="text-3xl font-bold">{metrics.roi}</div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-white/80" />
              <span className="text-sm text-white/80">Savings Range</span>
            </div>
            <div className="text-3xl font-bold">{metrics.savings}</div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-white/80" />
              <span className="text-sm text-white/80">Time to Value</span>
            </div>
            <div className="text-3xl font-bold">{metrics.timeToValue}</div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm text-white/80">Complexity</span>
            </div>
            <div className="text-3xl font-bold">{metrics.complexity}</div>
          </div>
        </div>
      </div>
    </div>
  )
}