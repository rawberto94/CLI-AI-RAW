'use client'

import React from 'react'
import { motion } from 'framer-motion'

interface AnimatedProgressBarProps {
  value: number // 0-100
  label: string
  color?: string
  backgroundColor?: string
  duration?: number
  showPercentage?: boolean
  height?: string
  className?: string
}

const getColorClasses = (color?: string) => {
  switch (color) {
    case 'green':
      return 'bg-green-500'
    case 'red':
      return 'bg-red-500'
    case 'yellow':
      return 'bg-yellow-500'
    case 'blue':
      return 'bg-blue-500'
    case 'purple':
      return 'bg-purple-500'
    default:
      return color || 'bg-blue-500'
  }
}

const getBackgroundColorClasses = (backgroundColor?: string) => {
  return backgroundColor || 'bg-gray-200'
}

export function AnimatedProgressBar({
  value,
  label,
  color,
  backgroundColor,
  duration = 1.5,
  showPercentage = true,
  height = 'h-2',
  className = ''
}: AnimatedProgressBarProps) {
  // Clamp value between 0 and 100
  const clampedValue = Math.min(Math.max(value, 0), 100)

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Label and Value */}
      <div className="flex justify-between items-center text-sm">
        <span className="font-medium text-gray-700">{label}</span>
        {showPercentage && (
          <motion.span
            className="text-gray-600 font-semibold"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: duration * 0.5 }}
          >
            {clampedValue.toFixed(0)}%
          </motion.span>
        )}
      </div>

      {/* Progress Bar Container */}
      <div className={`${height} ${getBackgroundColorClasses(backgroundColor)} rounded-full overflow-hidden`}>
        <motion.div
          className={`${height} ${getColorClasses(color)} rounded-full`}
          initial={{ width: 0 }}
          animate={{ width: `${clampedValue}%` }}
          transition={{
            duration,
            ease: 'easeOut'
          }}
        />
      </div>
    </div>
  )
}

// Preset variants for common use cases
export function MarketPositionBar({ percentile }: { percentile: number }) {
  // Determine color based on position (lower is better for rates)
  const getColor = () => {
    if (percentile < 25) return 'green' // Excellent - below 25th percentile
    if (percentile < 50) return 'blue' // Good - below median
    if (percentile < 75) return 'yellow' // Fair - above median
    return 'red' // Expensive - top 25%
  }

  const getLabel = () => {
    if (percentile < 25) return 'Excellent Position'
    if (percentile < 50) return 'Good Position'
    if (percentile < 75) return 'Fair Position'
    return 'Expensive Position'
  }

  return (
    <AnimatedProgressBar
      value={percentile}
      label={getLabel()}
      color={getColor()}
      duration={1.5}
    />
  )
}

export function SavingsPotentialBar({ savingsPercent }: { savingsPercent: number }) {
  return (
    <AnimatedProgressBar
      value={savingsPercent}
      label="Savings Potential"
      color="green"
      duration={1.8}
    />
  )
}

export function ConfidenceBar({ confidence }: { confidence: number }) {
  const getColor = () => {
    if (confidence >= 80) return 'green'
    if (confidence >= 60) return 'blue'
    if (confidence >= 40) return 'yellow'
    return 'red'
  }

  return (
    <AnimatedProgressBar
      value={confidence}
      label="Recommendation Confidence"
      color={getColor()}
      duration={1.2}
    />
  )
}
