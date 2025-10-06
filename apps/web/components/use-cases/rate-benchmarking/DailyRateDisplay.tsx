'use client'

import { Info } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import {
  formatCHF,
  formatDailyRate,
  formatOriginalRate,
  type Currency,
  type RatePeriod
} from '@/lib/use-cases/rate-normalizer'

interface DailyRateDisplayProps {
  dailyRateCHF: number
  originalRate?: number
  originalPeriod?: RatePeriod
  originalCurrency?: Currency
  exchangeRate?: number
  exchangeRateDate?: Date
  mode?: 'compact' | 'detailed' | 'full'
  showConversionInfo?: boolean
  className?: string
}

export function DailyRateDisplay({
  dailyRateCHF,
  originalRate,
  originalPeriod,
  originalCurrency,
  exchangeRate,
  exchangeRateDate,
  mode = 'detailed',
  showConversionInfo = true,
  className = ''
}: DailyRateDisplayProps) {
  const hasOriginalRate = originalRate !== undefined && 
                          originalPeriod !== undefined && 
                          originalCurrency !== undefined

  const isConverted = hasOriginalRate && 
                      (originalPeriod !== 'daily' || originalCurrency !== 'CHF')

  if (mode === 'compact') {
    return (
      <div className={`font-semibold text-gray-900 ${className}`}>
        {formatCHF(dailyRateCHF)}
      </div>
    )
  }

  if (mode === 'detailed') {
    return (
      <div className={`${className}`}>
        <div className="font-semibold text-gray-900 text-lg">
          {formatDailyRate(dailyRateCHF)}
        </div>
        {hasOriginalRate && isConverted && (
          <div className="text-sm text-gray-500 mt-0.5">
            {formatOriginalRate(originalRate, originalPeriod, originalCurrency)}
          </div>
        )}
      </div>
    )
  }

  // Full mode with conversion details
  return (
    <div className={`${className}`}>
      <div className="flex items-center gap-2">
        <div className="font-semibold text-gray-900 text-lg">
          {formatDailyRate(dailyRateCHF)}
        </div>
        {isConverted && showConversionInfo && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Badge variant="outline" className="text-xs bg-blue-50 border-blue-200 text-blue-700">
                  <Info className="w-3 h-3 mr-1" />
                  Converted
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <div className="space-y-2">
                  <div>
                    <div className="font-semibold text-xs text-gray-500 uppercase">Original Rate</div>
                    <div className="text-sm">
                      {formatOriginalRate(originalRate!, originalPeriod!, originalCurrency!)}
                    </div>
                  </div>
                  {originalPeriod !== 'daily' && (
                    <div>
                      <div className="font-semibold text-xs text-gray-500 uppercase">Period Conversion</div>
                      <div className="text-sm">
                        {originalPeriod === 'hourly' && '× 8 hours/day'}
                        {originalPeriod === 'monthly' && '÷ 21.67 working days/month'}
                        {originalPeriod === 'annual' && '÷ 260 working days/year'}
                      </div>
                    </div>
                  )}
                  {originalCurrency !== 'CHF' && exchangeRate && (
                    <div>
                      <div className="font-semibold text-xs text-gray-500 uppercase">Currency Conversion</div>
                      <div className="text-sm">
                        1 {originalCurrency} = {exchangeRate.toFixed(4)} CHF
                      </div>
                      {exchangeRateDate && (
                        <div className="text-xs text-gray-500">
                          Rate as of {exchangeRateDate.toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      {hasOriginalRate && isConverted && (
        <div className="text-sm text-gray-500 mt-1">
          Original: {formatOriginalRate(originalRate, originalPeriod, originalCurrency)}
        </div>
      )}
    </div>
  )
}

// Utility component for displaying rate comparisons
interface RateComparisonProps {
  currentRate: number
  benchmarkRate: number
  showSavings?: boolean
  fteCount?: number
  className?: string
}

export function RateComparison({
  currentRate,
  benchmarkRate,
  showSavings = true,
  fteCount = 1,
  className = ''
}: RateComparisonProps) {
  const difference = currentRate - benchmarkRate
  const percentDiff = ((difference / benchmarkRate) * 100)
  const isAbove = difference > 0
  const isSignificant = Math.abs(percentDiff) > 5

  const annualSavings = isAbove ? difference * 260 * fteCount : 0

  return (
    <div className={`${className}`}>
      <div className="flex items-center gap-3">
        <div>
          <div className="text-xs text-gray-500 uppercase font-semibold">Your Rate</div>
          <div className="font-semibold text-gray-900">{formatCHF(currentRate)}</div>
        </div>
        <div className="text-2xl text-gray-300">→</div>
        <div>
          <div className="text-xs text-gray-500 uppercase font-semibold">Market Median</div>
          <div className="font-semibold text-gray-900">{formatCHF(benchmarkRate)}</div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Badge
          className={`${
            isAbove
              ? isSignificant
                ? 'bg-red-100 text-red-800 border-red-200'
                : 'bg-orange-100 text-orange-800 border-orange-200'
              : 'bg-green-100 text-green-800 border-green-200'
          } border`}
          variant="outline"
        >
          {isAbove ? '+' : ''}{percentDiff.toFixed(1)}%
        </Badge>
        <span className="text-sm text-gray-600">
          {formatCHF(Math.abs(difference))} {isAbove ? 'above' : 'below'} market
        </span>
      </div>

      {showSavings && isAbove && annualSavings > 0 && (
        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="text-xs text-green-700 font-semibold uppercase">Potential Annual Savings</div>
          <div className="text-lg font-bold text-green-800">
            {formatCHF(annualSavings)}
          </div>
          {fteCount > 1 && (
            <div className="text-xs text-green-600 mt-1">
              Based on {fteCount} FTEs
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Utility component for competitive band badge
interface CompetitiveBandBadgeProps {
  band: 'highly-competitive' | 'market-rate' | 'above-market' | 'premium'
  size?: 'sm' | 'md' | 'lg'
}

export function CompetitiveBandBadge({ band, size = 'md' }: CompetitiveBandBadgeProps) {
  const config = {
    'highly-competitive': {
      label: 'Highly Competitive',
      className: 'bg-green-100 text-green-800 border-green-200'
    },
    'market-rate': {
      label: 'Market Rate',
      className: 'bg-blue-100 text-blue-800 border-blue-200'
    },
    'above-market': {
      label: 'Above Market',
      className: 'bg-orange-100 text-orange-800 border-orange-200'
    },
    'premium': {
      label: 'Premium',
      className: 'bg-red-100 text-red-800 border-red-200'
    }
  }

  const { label, className } = config[band]
  const sizeClass = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5'
  }[size]

  return (
    <Badge className={`${className} border ${sizeClass}`} variant="outline">
      {label}
    </Badge>
  )
}
