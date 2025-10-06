'use client'

import React from 'react'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react'
import type { RoleRate } from '@/lib/use-cases/enhanced-rate-benchmarking-data'
import {
  calculateConfidenceScore,
  generateDataQualityWarnings,
  getConfidenceBadgeColor,
  getConfidenceLabel,
  formatFreshnessIndicator,
  type DataQualityWarning
} from '@/lib/use-cases/data-quality'

interface DataQualityIndicatorProps {
  role: RoleRate
  showDetails?: boolean
  compact?: boolean
}

export function DataQualityIndicator({ role, showDetails = false, compact = false }: DataQualityIndicatorProps) {
  const confidence = calculateConfidenceScore(role)
  const warnings = generateDataQualityWarnings(role, confidence)
  const freshness = formatFreshnessIndicator(role.lastUpdated)
  
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Badge className={getConfidenceBadgeColor(confidence.overall)}>
          {getConfidenceLabel(confidence.overall)} Confidence
        </Badge>
        {warnings.length > 0 && (
          <AlertCircle className="w-4 h-4 text-yellow-600" title={`${warnings.length} warnings`} />
        )}
      </div>
    )
  }
  
  return (
    <div className="space-y-3">
      {/* Confidence Score */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Confidence Level:</span>
        <Badge className={getConfidenceBadgeColor(confidence.overall)}>
          {getConfidenceLabel(confidence.overall)} ({(confidence.overall * 100).toFixed(0)}%)
        </Badge>
      </div>
      
      {showDetails && (
        <>
          {/* Detailed Scores */}
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Sample Size:</span>
              <span className="font-medium">{(confidence.sampleSize * 100).toFixed(0)}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Data Freshness:</span>
              <span className={`font-medium ${freshness.color}`}>
                {(confidence.freshness * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Geographic Coverage:</span>
              <span className="font-medium">{(confidence.coverage * 100).toFixed(0)}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Role Mapping:</span>
              <span className="font-medium">{(confidence.mapping * 100).toFixed(0)}%</span>
            </div>
          </div>
          
          {/* Freshness Indicator */}
          <div className="pt-2 border-t">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-gray-500" />
              <span className={`text-xs ${freshness.color}`}>
                {freshness.text}
              </span>
            </div>
          </div>
        </>
      )}
      
      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="pt-2 border-t space-y-2">
          {warnings.map((warning, idx) => (
            <WarningItem key={idx} warning={warning} />
          ))}
        </div>
      )}
    </div>
  )
}

function WarningItem({ warning }: { warning: DataQualityWarning }) {
  const getIcon = () => {
    switch (warning.severity) {
      case 'high':
        return <AlertCircle className="w-4 h-4 text-red-600" />
      case 'medium':
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />
      case 'low':
        return <Info className="w-4 h-4 text-blue-600" />
    }
  }
  
  const getColor = () => {
    switch (warning.severity) {
      case 'high':
        return 'bg-red-50 border-red-200 text-red-800'
      case 'medium':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800'
      case 'low':
        return 'bg-blue-50 border-blue-200 text-blue-800'
    }
  }
  
  return (
    <div className={`p-2 rounded border ${getColor()}`}>
      <div className="flex items-start gap-2">
        {getIcon()}
        <div className="flex-1 text-xs">
          <div className="font-semibold mb-1">{warning.message}</div>
          <div className="text-gray-700">{warning.suggestion}</div>
        </div>
      </div>
    </div>
  )
}

// Aggregate confidence display for multiple roles
interface AggregateConfidenceProps {
  roles: RoleRate[]
}

export function AggregateConfidenceDisplay({ roles }: AggregateConfidenceProps) {
  const confidenceScores = roles.map(role => calculateConfidenceScore(role).overall)
  const average = confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length
  
  const distribution = {
    high: confidenceScores.filter(s => s >= 0.8).length,
    medium: confidenceScores.filter(s => s >= 0.6 && s < 0.8).length,
    low: confidenceScores.filter(s => s < 0.6).length
  }
  
  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle className="w-5 h-5 text-blue-600" />
        <h4 className="font-semibold text-gray-900">Data Quality Summary</h4>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-3">
        <div>
          <div className="text-sm text-gray-600">Average Confidence</div>
          <div className="text-2xl font-bold text-gray-900">
            {(average * 100).toFixed(0)}%
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-600">Roles Analyzed</div>
          <div className="text-2xl font-bold text-gray-900">
            {roles.length}
          </div>
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">High Confidence:</span>
          <Badge className="bg-green-100 text-green-700">
            {distribution.high} roles
          </Badge>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Medium Confidence:</span>
          <Badge className="bg-yellow-100 text-yellow-700">
            {distribution.medium} roles
          </Badge>
        </div>
        {distribution.low > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Low Confidence:</span>
            <Badge className="bg-red-100 text-red-700">
              {distribution.low} roles
            </Badge>
          </div>
        )}
      </div>
    </div>
  )
}
