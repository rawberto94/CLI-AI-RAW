'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BeforeAfterProps } from '@/lib/use-cases/types'
import { XCircle, CheckCircle, ArrowRight } from 'lucide-react'

const colorClasses = {
  red: 'text-red-600',
  yellow: 'text-yellow-600',
  green: 'text-green-600',
  blue: 'text-blue-600',
  purple: 'text-purple-600',
  orange: 'text-orange-600'
}

export default function BeforeAfterComparison({
  before,
  after,
  highlights
}: BeforeAfterProps) {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-3">
          The Transformation
        </h2>
        <p className="text-lg text-gray-600">
          See the dramatic difference AI makes in contract analysis
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Before AI */}
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="bg-red-100">
            <CardTitle className="flex items-center gap-2 text-red-800">
              <XCircle className="w-6 h-6" />
              Before AI Implementation
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {before.map((metric, index) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-gray-700 font-medium">{metric.label}:</span>
                  <span className={`text-xl font-bold ${colorClasses[metric.color]}`}>
                    {metric.value}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* After AI */}
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="bg-green-100">
            <CardTitle className="flex items-center gap-2 text-green-800">
              <CheckCircle className="w-6 h-6" />
              After AI Implementation
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {after.map((metric, index) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-gray-700 font-medium">{metric.label}:</span>
                  <span className={`text-xl font-bold ${colorClasses[metric.color]}`}>
                    {metric.value}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Highlights */}
      {highlights && highlights.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 border border-blue-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ArrowRight className="w-5 h-5 text-blue-600" />
            Key Improvements
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {highlights.map((highlight, index) => (
              <div key={index} className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">{highlight}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}