'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface EnhancedCardProps {
  children: React.ReactNode
  title?: string
  subtitle?: string
  className?: string
  variant?: 'default' | 'gradient' | 'glass' | 'elevated' | 'interactive'
  hover?: boolean
  glow?: boolean
}

export function EnhancedCard({ 
  children, 
  title,
  subtitle,
  className, 
  variant = 'default',
  hover = false,
  glow = false 
}: EnhancedCardProps) {
  const baseClasses = "transition-all duration-300 ease-in-out"
  
  const variantClasses = {
    default: "bg-white border border-gray-200",
    gradient: "bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/50 border border-blue-100/50 backdrop-blur-sm",
    glass: "bg-white/80 backdrop-blur-md border border-white/20 shadow-xl",
    elevated: "bg-white border-0 shadow-2xl shadow-blue-500/10",
    interactive: "bg-white border border-gray-200 cursor-pointer transform-gpu"
  }
  
  const hoverClasses = hover ? {
    default: "hover:shadow-lg hover:border-blue-300",
    gradient: "hover:shadow-xl hover:shadow-blue-500/20 hover:scale-[1.02]",
    glass: "hover:bg-white/90 hover:shadow-2xl",
    elevated: "hover:shadow-3xl hover:shadow-blue-500/20 hover:-translate-y-1",
    interactive: "hover:shadow-xl hover:border-blue-400 hover:scale-[1.02] active:scale-[0.98]"
  }[variant] : ""
  
  const glowClasses = glow ? "shadow-lg shadow-blue-500/25 ring-1 ring-blue-500/20" : ""

  return (
    <Card className={cn(
      baseClasses,
      variantClasses[variant],
      hoverClasses,
      glowClasses,
      className
    )}>
      {(title || subtitle) && (
        <CardHeader>
          {title && <CardTitle>{title}</CardTitle>}
          {subtitle && <p className="text-sm text-gray-600">{subtitle}</p>}
        </CardHeader>
      )}
      <CardContent className={title || subtitle ? "" : "p-6"}>
        {children}
      </CardContent>
    </Card>
  )
}

interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: React.ReactNode
  trend?: {
    value: number
    label: string
    positive?: boolean
  }
  color?: 'blue' | 'green' | 'red' | 'purple' | 'orange' | 'gray'
  size?: 'sm' | 'md' | 'lg'
}

export function MetricCard({ 
  title, 
  value, 
  subtitle, 
  icon, 
  trend, 
  color = 'blue',
  size = 'md' 
}: MetricCardProps) {
  const colorClasses = {
    blue: "from-blue-50 to-blue-100 border-blue-200 text-blue-900",
    green: "from-green-50 to-green-100 border-green-200 text-green-900",
    red: "from-red-50 to-red-100 border-red-200 text-red-900",
    purple: "from-purple-50 to-purple-100 border-purple-200 text-purple-900",
    orange: "from-orange-50 to-orange-100 border-orange-200 text-orange-900",
    gray: "from-gray-50 to-gray-100 border-gray-200 text-gray-900"
  }
  
  const iconColorClasses = {
    blue: "text-blue-600",
    green: "text-green-600", 
    red: "text-red-600",
    purple: "text-purple-600",
    orange: "text-orange-600",
    gray: "text-gray-600"
  }
  
  const sizeClasses = {
    sm: "p-4",
    md: "p-6", 
    lg: "p-8"
  }
  
  const valueSizeClasses = {
    sm: "text-xl",
    md: "text-2xl",
    lg: "text-3xl"
  }

  return (
    <EnhancedCard 
      variant="gradient" 
      hover 
      className={`bg-gradient-to-br ${colorClasses[color]} ${sizeClasses[size]}`}
    >
      <CardContent className="p-0">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium opacity-80 mb-1">{title}</p>
            <p className={`${valueSizeClasses[size]} font-bold mb-1`}>
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
            {subtitle && (
              <p className="text-xs opacity-70">{subtitle}</p>
            )}
            {trend && (
              <div className="flex items-center gap-1 mt-2">
                <span className={`text-xs font-medium ${
                  trend.positive !== false ? 'text-green-600' : 'text-red-600'
                }`}>
                  {trend.positive !== false ? '+' : ''}{trend.value}%
                </span>
                <span className="text-xs opacity-70">{trend.label}</span>
              </div>
            )}
          </div>
          {icon && (
            <div className={`${iconColorClasses[color]} opacity-80`}>
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </EnhancedCard>
  )
}