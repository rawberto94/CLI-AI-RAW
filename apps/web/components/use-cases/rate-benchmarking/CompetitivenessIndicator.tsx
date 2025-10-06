'use client'

import React from 'react'
import { Badge } from '@/components/ui/badge'
import { TrendingDown, CheckCircle, TrendingUp, AlertCircle } from 'lucide-react'

interface CompetitivenessIndicatorProps {
  rating: 'best-value' | 'competitive' | 'above-market' | 'premium'
  variance: number
}

export function CompetitivenessIndicator({ rating, variance }: CompetitivenessIndicatorProps) {
  const config = {
    'best-value': {
      label: 'Best Value',
      className: 'bg-blue-100 text-blue-800 border-blue-200',
      Icon: TrendingDown
    },
    'competitive': {
      label: 'Competitive',
      className: 'bg-green-100 text-green-800 border-green-200',
      Icon: CheckCircle
    },
    'above-market': {
      label: 'Above Market',
      className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      Icon: TrendingUp
    },
    'premium': {
      label: 'Premium',
      className: 'bg-red-100 text-red-800 border-red-200',
      Icon: AlertCircle
    }
  }[rating]
  
  const { label, className, Icon } = config
  const varianceText = variance > 0 ? `+${variance.toFixed(1)}%` : `${variance.toFixed(1)}%`
  
  return (
    <div className="flex items-center gap-2">
      <Badge className={className}>
        <Icon className="w-3 h-3 mr-1" />
        {label}
      </Badge>
      <span className="text-sm text-gray-600">{varianceText}</span>
    </div>
  )
}
