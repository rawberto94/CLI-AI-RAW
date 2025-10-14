'use client'

import React from 'react'
import { TrendingUp, TrendingDown, Minus, ArrowUp, ArrowDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TrendIndicatorProps {
  value: number
  label?: string
  size?: 'sm' | 'md' | 'lg'
  showIcon?: boolean
  className?: string
}

export function TrendIndicator({ 
  value, 
  label, 
  size = 'md',
  showIcon = true,
  className 
}: TrendIndicatorProps) {
  const isPositive = value > 0
  const isNeutral = value === 0
  
  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm', 
    lg: 'text-base'
  }
  
  const iconSizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  }
  
  const colorClasses = isNeutral 
    ? 'text-gray-600' 
    : isPositive 
      ? 'text-green-600' 
      : 'text-red-600'
  
  const Icon = isNeutral ? Minus : isPositive ? TrendingUp : TrendingDown
  
  return (
    <div className={cn(
      "flex items-center gap-1",
      colorClasses,
      sizeClasses[size],
      className
    )}>
      {showIcon && <Icon className={iconSizeClasses[size]} />}
      <span className="font-medium">
        {isPositive && '+'}
        {Math.abs(value).toFixed(1)}%
      </span>
      {label && <span className="text-gray-500">({label})</span>}
    </div>
  )
}

interface CircularProgressProps {
  value: number
  max?: number
  size?: number
  strokeWidth?: number
  color?: string
  backgroundColor?: string
  showValue?: boolean
  label?: string
  className?: string
}

export function CircularProgress({
  value,
  max = 100,
  size = 120,
  strokeWidth = 8,
  color = '#3B82F6',
  backgroundColor = '#E5E7EB',
  showValue = true,
  label,
  className
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const percentage = Math.min((value / max) * 100, 100)
  const strokeDashoffset = circumference - (percentage / 100) * circumference
  
  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {showValue && (
          <span className="text-2xl font-bold text-gray-900">
            {Math.round(percentage)}%
          </span>
        )}
        {label && (
          <span className="text-xs text-gray-600 text-center mt-1">
            {label}
          </span>
        )}
      </div>
    </div>
  )
}

interface MiniChartProps {
  data: number[]
  color?: string
  height?: number
  className?: string
}

export function MiniChart({ 
  data, 
  color = '#3B82F6', 
  height = 40,
  className 
}: MiniChartProps) {
  if (data.length === 0) return null
  
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * 100
    const y = ((max - value) / range) * 100
    return `${x},${y}`
  }).join(' ')
  
  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="overflow-visible"
      >
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          className="drop-shadow-sm"
        />
        {/* Gradient fill */}
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon
          points={`0,100 ${points} 100,100`}
          fill="url(#gradient)"
        />
      </svg>
    </div>
  )
}

interface ScoreGaugeProps {
  score: number
  max?: number
  label?: string
  size?: 'sm' | 'md' | 'lg'
  colorScheme?: 'risk' | 'opportunity' | 'performance'
  className?: string
}

export function ScoreGauge({
  score,
  max = 100,
  label,
  size = 'md',
  colorScheme = 'performance',
  className
}: ScoreGaugeProps) {
  const percentage = Math.min((score / max) * 100, 100)
  
  const sizeConfig = {
    sm: { size: 80, strokeWidth: 6, textSize: 'text-lg' },
    md: { size: 100, strokeWidth: 8, textSize: 'text-xl' },
    lg: { size: 120, strokeWidth: 10, textSize: 'text-2xl' }
  }
  
  const colorConfig = {
    risk: {
      low: '#10B981',    // Green
      medium: '#F59E0B', // Yellow  
      high: '#EF4444'    // Red
    },
    opportunity: {
      low: '#6B7280',    // Gray
      medium: '#3B82F6', // Blue
      high: '#10B981'    // Green
    },
    performance: {
      low: '#EF4444',    // Red
      medium: '#F59E0B', // Yellow
      high: '#10B981'    // Green
    }
  }
  
  const getColor = () => {
    const colors = colorConfig[colorScheme]
    if (percentage >= 80) return colors.high
    if (percentage >= 50) return colors.medium
    return colors.low
  }
  
  const config = sizeConfig[size]
  const color = getColor()
  
  return (
    <div className={cn("flex flex-col items-center", className)}>
      <CircularProgress
        value={score}
        max={max}
        size={config.size}
        strokeWidth={config.strokeWidth}
        color={color}
        showValue={false}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-bold text-gray-900 ${config.textSize}`}>
          {Math.round(score)}
        </span>
        {label && (
          <span className="text-xs text-gray-600 text-center mt-1">
            {label}
          </span>
        )}
      </div>
    </div>
  )
}

interface DataPointProps {
  label: string
  value: string | number
  change?: number
  icon?: React.ReactNode
  color?: 'blue' | 'green' | 'red' | 'purple' | 'orange'
  size?: 'sm' | 'md' | 'lg'
}

export function DataPoint({ 
  label, 
  value, 
  change, 
  icon, 
  color = 'blue',
  size = 'md' 
}: DataPointProps) {
  const colorClasses = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    red: 'text-red-600', 
    purple: 'text-purple-600',
    orange: 'text-orange-600'
  }
  
  const sizeClasses = {
    sm: { value: 'text-lg', label: 'text-xs', icon: 'w-4 h-4' },
    md: { value: 'text-xl', label: 'text-sm', icon: 'w-5 h-5' },
    lg: { value: 'text-2xl', label: 'text-base', icon: 'w-6 h-6' }
  }
  
  const config = sizeClasses[size]
  
  return (
    <div className="flex items-center gap-3">
      {icon && (
        <div className={cn(colorClasses[color], config.icon)}>
          {icon}
        </div>
      )}
      <div className="flex-1">
        <div className={cn("font-bold text-gray-900", config.value)}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("text-gray-600", config.label)}>
            {label}
          </span>
          {change !== undefined && (
            <TrendIndicator value={change} size="sm" />
          )}
        </div>
      </div>
    </div>
  )
}