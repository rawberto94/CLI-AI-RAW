'use client'

import type { LucideIcon } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'

interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: LucideIcon
  trend?: {
    value: number
    label: string
  }
  color?: 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'gray'
  size?: 'sm' | 'md' | 'lg'
  onClick?: () => void
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = 'blue',
  size = 'md',
  onClick
}: MetricCardProps) {
  const colorStyles = {
    blue: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-600',
      icon: 'text-blue-600',
      gradient: 'from-blue-100 to-blue-50'
    },
    green: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-600',
      icon: 'text-green-600',
      gradient: 'from-green-100 to-green-50'
    },
    orange: {
      bg: 'bg-orange-50',
      border: 'border-orange-200',
      text: 'text-orange-600',
      icon: 'text-orange-600',
      gradient: 'from-orange-100 to-orange-50'
    },
    red: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-600',
      icon: 'text-red-600',
      gradient: 'from-red-100 to-red-50'
    },
    purple: {
      bg: 'bg-purple-50',
      border: 'border-purple-200',
      text: 'text-purple-600',
      icon: 'text-purple-600',
      gradient: 'from-purple-100 to-purple-50'
    },
    gray: {
      bg: 'bg-gray-50',
      border: 'border-gray-200',
      text: 'text-gray-600',
      icon: 'text-gray-600',
      gradient: 'from-gray-100 to-gray-50'
    }
  }

  const sizeStyles = {
    sm: {
      padding: 'p-4',
      valueSize: 'text-2xl',
      titleSize: 'text-xs',
      iconSize: 'w-8 h-8',
      iconContainer: 'w-10 h-10'
    },
    md: {
      padding: 'p-6',
      valueSize: 'text-3xl',
      titleSize: 'text-sm',
      iconSize: 'w-10 h-10',
      iconContainer: 'w-12 h-12'
    },
    lg: {
      padding: 'p-8',
      valueSize: 'text-4xl',
      titleSize: 'text-base',
      iconSize: 'w-12 h-12',
      iconContainer: 'w-16 h-16'
    }
  }

  const styles = colorStyles[color]
  const sizes = sizeStyles[size]

  return (
    <Card
      className={`
        ${styles.bg} ${styles.border} border-2
        shadow-md hover:shadow-lg
        transition-all duration-300
        ${onClick !== undefined ? 'cursor-pointer hover:scale-105' : ''}
        animate-scale-in
      `}
      onClick={onClick}
    >
      <CardContent className={`${sizes.padding} relative overflow-hidden`}>
        {/* Background gradient decoration */}
        <div
          className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${styles.gradient} rounded-full opacity-30 -mr-16 -mt-16`}
        />

        <div className="relative z-10">
          {/* Icon and Title Row */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className={`${sizes.titleSize} font-medium text-gray-700 mb-1`}>
                {title}
              </div>
              {subtitle !== undefined && (
                <div className="text-xs text-gray-500">{subtitle}</div>
              )}
            </div>
            {Icon !== undefined && (
              <div
                className={`
                  ${sizes.iconContainer}
                  bg-gradient-to-br ${styles.gradient}
                  rounded-lg flex items-center justify-center
                  flex-shrink-0 ml-3
                `}
              >
                <Icon className={`${sizes.iconSize} ${styles.icon}`} />
              </div>
            )}
          </div>

          {/* Value */}
          <div className={`${sizes.valueSize} font-bold ${styles.text} mb-2`}>
            {value}
          </div>

          {/* Trend */}
          {trend !== undefined && (
            <div className="flex items-center gap-2">
              <div
                className={`flex items-center gap-1 text-sm font-semibold ${
                  trend.value > 0
                    ? 'text-green-600'
                    : trend.value < 0
                    ? 'text-red-600'
                    : 'text-gray-600'
                }`}
              >
                <span className="text-lg">
                  {trend.value > 0 ? '↑' : trend.value < 0 ? '↓' : '→'}
                </span>
                <span>
                  {trend.value > 0 ? '+' : ''}
                  {trend.value}%
                </span>
              </div>
              <span className="text-xs text-gray-500">{trend.label}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Grid container for metric cards
export function MetricGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
      {children}
    </div>
  )
}

// Compact metric card for dashboards
export function CompactMetricCard({
  label,
  value,
  color = 'blue'
}: {
  label: string
  value: string | number
  color?: 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'gray'
}) {
  const colorStyles = {
    blue: 'bg-blue-50 border-blue-200 text-blue-600',
    green: 'bg-green-50 border-green-200 text-green-600',
    orange: 'bg-orange-50 border-orange-200 text-orange-600',
    red: 'bg-red-50 border-red-200 text-red-600',
    purple: 'bg-purple-50 border-purple-200 text-purple-600',
    gray: 'bg-gray-50 border-gray-200 text-gray-600'
  }

  return (
    <div
      className={`
        ${colorStyles[color]} border-2 rounded-lg p-4
        text-center transition-all duration-200
        hover:shadow-md
      `}
    >
      <div className="text-3xl font-bold mb-1">{value}</div>
      <div className="text-sm font-medium opacity-80">{label}</div>
    </div>
  )
}
