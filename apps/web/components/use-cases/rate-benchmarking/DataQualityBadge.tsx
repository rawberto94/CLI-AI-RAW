'use client'

import React from 'react'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, AlertCircle } from 'lucide-react'

interface DataQualityBadgeProps {
  quality: 'sufficient' | 'limited' | 'single-point'
  count: number
}

export function DataQualityBadge({ quality, count }: DataQualityBadgeProps) {
  // Don't show badge for sufficient data
  if (quality === 'sufficient') {
    return null
  }
  
  if (quality === 'single-point') {
    return (
      <Badge 
        className="bg-orange-100 text-orange-800 border-orange-200 ml-2"
        aria-label={`Single data point - only ${count} rate card available`}
      >
        <AlertCircle className="w-3 h-3 mr-1" />
        Single Data Point
      </Badge>
    )
  }
  
  // limited quality
  return (
    <Badge 
      className="bg-yellow-100 text-yellow-800 border-yellow-200 ml-2"
      aria-label={`Limited data - only ${count} rate cards available`}
    >
      <AlertTriangle className="w-3 h-3 mr-1" />
      Limited Data
    </Badge>
  )
}
