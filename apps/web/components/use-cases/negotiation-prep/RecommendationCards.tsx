'use client'

import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus, Target, DollarSign } from 'lucide-react'
import type { RecommendationStrategy } from '@/lib/negotiation-prep/ai-recommendation-engine'

interface RecommendationCardsProps {
  strategies: RecommendationStrategy[]
  onSelectStrategy?: (strategy: RecommendationStrategy) => void
  selectedApproach?: string
}

export function RecommendationCards({ 
  strategies, 
  onSelectStrategy,
  selectedApproach 
}: RecommendationCardsProps) {
  if (strategies.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      <h4 className="font-semibold text-gray-900">Alternative Strategies</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {strategies.map((strategy, index) => (
          <StrategyCard
            key={index}
            strategy={strategy}
            isSelected={strategy.approach === selectedApproach}
            onSelect={() => onSelectStrategy?.(strategy)}
          />
        ))}
      </div>
    </div>
  )
}

interface StrategyCardProps {
  strategy: RecommendationStrategy
  isSelected: boolean
  onSelect: () => void
}

function StrategyCard({ strategy, isSelected, onSelect }: StrategyCardProps) {
  const getApproachIcon = () => {
    switch (strategy.approach) {
      case 'aggressive':
        return <TrendingDown className="w-5 h-5" />
      case 'conservative':
        return <TrendingUp className="w-5 h-5" />
      default:
        return <Minus className="w-5 h-5" />
    }
  }

  const getApproachColor = () => {
    switch (strategy.approach) {
      case 'aggressive':
        return 'from-red-50 to-orange-50 border-red-200'
      case 'conservative':
        return 'from-green-50 to-emerald-50 border-green-200'
      default:
        return 'from-blue-50 to-cyan-50 border-blue-200'
    }
  }

  const getApproachTextColor = () => {
    switch (strategy.approach) {
      case 'aggressive':
        return 'text-red-700'
      case 'conservative':
        return 'text-green-700'
      default:
        return 'text-blue-700'
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
      onClick={onSelect}
      className={`
        bg-gradient-to-br ${getApproachColor()}
        border rounded-lg p-5 cursor-pointer
        transition-all duration-200
        ${isSelected ? 'ring-2 ring-blue-500 shadow-lg' : 'hover:shadow-md'}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`${getApproachTextColor()}`}>
            {getApproachIcon()}
          </div>
          <h5 className={`font-semibold capitalize ${getApproachTextColor()}`}>
            {strategy.approach}
          </h5>
        </div>
        <ConfidenceBadge confidence={strategy.confidence} />
      </div>

      {/* Target Rate */}
      <div className="bg-white rounded-lg p-3 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600">Target Rate</span>
          </div>
          <span className="text-lg font-bold text-gray-900">
            CHF {strategy.targetRate.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Expected Savings */}
      <div className="bg-white rounded-lg p-3 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-green-600" />
            <span className="text-sm text-gray-600">Expected Savings</span>
          </div>
          <span className="text-lg font-bold text-green-600">
            CHF {strategy.expectedSavings.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Reasoning */}
      {strategy.reasoning.length > 0 && (
        <div className="mb-3">
          <h6 className="text-xs font-medium text-gray-700 mb-2">Key Points</h6>
          <ul className="space-y-1">
            {strategy.reasoning.slice(0, 2).map((reason, index) => (
              <li key={index} className="text-xs text-gray-600 flex items-start gap-1">
                <span className="text-gray-400 mt-0.5">•</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Risk/Opportunity Summary */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-amber-50 rounded px-2 py-1">
          <span className="text-amber-700 font-medium">
            {strategy.risks.length} Risk{strategy.risks.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="bg-emerald-50 rounded px-2 py-1">
          <span className="text-emerald-700 font-medium">
            {strategy.opportunities.length} Opportunity{strategy.opportunities.length !== 1 ? 'ies' : 'y'}
          </span>
        </div>
      </div>

      {isSelected && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-3 text-xs text-blue-600 font-medium text-center"
        >
          ✓ Selected Strategy
        </motion.div>
      )}
    </motion.div>
  )
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const getColor = () => {
    if (confidence >= 80) return 'bg-green-100 text-green-700'
    if (confidence >= 60) return 'bg-blue-100 text-blue-700'
    return 'bg-amber-100 text-amber-700'
  }

  return (
    <div className={`px-2 py-1 rounded text-xs font-semibold ${getColor()}`}>
      {confidence}%
    </div>
  )
}

// Strategy Overview Card - Shows high-level comparison
export function StrategyOverviewCard({ strategy }: { strategy: RecommendationStrategy }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold text-lg capitalize">{strategy.approach} Strategy</h4>
        <ConfidenceBadge confidence={strategy.confidence} />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-sm text-gray-600 mb-1">Target Rate</div>
          <div className="text-2xl font-bold text-gray-900">
            CHF {strategy.targetRate.toLocaleString()}
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-600 mb-1">Expected Savings</div>
          <div className="text-2xl font-bold text-green-600">
            CHF {strategy.expectedSavings.toLocaleString()}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <h5 className="text-sm font-medium text-gray-700 mb-2">Reasoning</h5>
          <ul className="space-y-1">
            {strategy.reasoning.map((reason, index) => (
              <li key={index} className="text-sm text-gray-600 flex items-start gap-2">
                <span className="text-blue-500">•</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

// Risk Assessment Card
export function RiskAssessmentCard({ risks }: { risks: string[] }) {
  if (risks.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <h4 className="font-semibold text-green-800 mb-2">Low Risk Strategy</h4>
        <p className="text-sm text-green-700">
          This approach has minimal identified risks and is likely to be well-received.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-4">
        <TrendingDown className="w-5 h-5 text-amber-600" />
        <h4 className="font-semibold text-amber-800">Risk Assessment</h4>
      </div>
      <ul className="space-y-2">
        {risks.map((risk, index) => (
          <li key={index} className="text-sm text-amber-700 flex items-start gap-2">
            <span className="text-amber-500 mt-1">⚠</span>
            <span>{risk}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 pt-4 border-t border-amber-200">
        <p className="text-xs text-amber-600">
          Consider these risks when planning your negotiation approach
        </p>
      </div>
    </div>
  )
}

// Opportunity Highlights Card
export function OpportunityHighlightsCard({ opportunities }: { opportunities: string[] }) {
  if (opportunities.length === 0) {
    return null
  }

  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-5 h-5 text-emerald-600" />
        <h4 className="font-semibold text-emerald-800">Key Opportunities</h4>
      </div>
      <ul className="space-y-2">
        {opportunities.map((opportunity, index) => (
          <li key={index} className="text-sm text-emerald-700 flex items-start gap-2">
            <span className="text-emerald-500 mt-1">✓</span>
            <span>{opportunity}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 pt-4 border-t border-emerald-200">
        <p className="text-xs text-emerald-600">
          Leverage these opportunities to strengthen your negotiation position
        </p>
      </div>
    </div>
  )
}

// Expected Outcome Visualization
export function ExpectedOutcomeCard({ strategy }: { strategy: RecommendationStrategy }) {
  const savingsPercent = (strategy.expectedSavings / (strategy.targetRate * 250)) * 100

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
      <h4 className="font-semibold text-gray-900 mb-4">Expected Outcome</h4>
      
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Success Probability</span>
            <span className="text-sm font-semibold text-gray-900">{strategy.confidence}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${strategy.confidence}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="bg-blue-600 h-2 rounded-full"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-lg p-3">
            <div className="text-xs text-gray-600 mb-1">Target Rate</div>
            <div className="text-lg font-bold text-gray-900">
              CHF {strategy.targetRate.toLocaleString()}
            </div>
          </div>
          <div className="bg-white rounded-lg p-3">
            <div className="text-xs text-gray-600 mb-1">Annual Savings</div>
            <div className="text-lg font-bold text-green-600">
              CHF {strategy.expectedSavings.toLocaleString()}
            </div>
          </div>
        </div>

        {savingsPercent > 0 && (
          <div className="bg-white rounded-lg p-3">
            <div className="text-xs text-gray-600 mb-1">Potential Savings</div>
            <div className="text-2xl font-bold text-green-600">
              {savingsPercent.toFixed(1)}%
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
