'use client'

import { motion } from 'framer-motion'
import { Brain, TrendingUp, AlertTriangle, Target, Lightbulb, Clock } from 'lucide-react'
import type { AIRecommendation } from '@/lib/negotiation-prep/ai-recommendation-engine'

interface AIRecommendationPanelProps {
  recommendation: AIRecommendation | null
  loading?: boolean
  error?: string
}

export function AIRecommendationPanel({ 
  recommendation, 
  loading = false,
  error 
}: AIRecommendationPanelProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-5 h-5 text-blue-600 animate-pulse" />
          <h3 className="text-lg font-semibold">AI Strategy Recommendation</h3>
        </div>
        <div className="animate-pulse space-y-3">
          <div className="h-24 bg-gray-200 rounded-lg"></div>
          <div className="h-16 bg-gray-200 rounded-lg"></div>
          <div className="h-16 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-red-800">
          <AlertTriangle className="w-5 h-5" />
          <p className="font-medium">Unable to generate recommendation</p>
        </div>
        <p className="text-sm text-red-600 mt-1">{error}</p>
      </div>
    )
  }

  if (!recommendation) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <Brain className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600">Configure your negotiation parameters to receive AI-powered recommendations</p>
      </div>
    )
  }

  const { primaryStrategy, marketInsights, negotiationTiming, leveragePoints } = recommendation

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold">AI Strategy Recommendation</h3>
        </div>
        <ConfidenceMeter confidence={primaryStrategy.confidence} />
      </div>

      {/* Primary Strategy Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6"
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-5 h-5 text-blue-600" />
              <h4 className="font-semibold text-lg capitalize">{primaryStrategy.approach} Approach</h4>
            </div>
            <p className="text-sm text-gray-600">Recommended negotiation strategy</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-600">
              CHF {primaryStrategy.targetRate.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Target Rate</div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Expected Savings</span>
            <span className="text-xl font-bold text-green-600">
              CHF {primaryStrategy.expectedSavings.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Reasoning */}
        <div className="space-y-2">
          <h5 className="font-medium text-sm text-gray-700 flex items-center gap-2">
            <Lightbulb className="w-4 h-4" />
            Why This Strategy
          </h5>
          <ul className="space-y-1">
            {primaryStrategy.reasoning.map((reason, index) => (
              <motion.li
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="text-sm text-gray-700 flex items-start gap-2"
              >
                <span className="text-blue-500 mt-1">•</span>
                <span>{reason}</span>
              </motion.li>
            ))}
          </ul>
        </div>
      </motion.div>

      {/* Timing Indicator */}
      {negotiationTiming.optimal && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-green-50 border border-green-200 rounded-lg p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-green-600" />
            <h5 className="font-medium text-sm text-green-800">Optimal Timing</h5>
          </div>
          <p className="text-sm text-green-700">{negotiationTiming.reasoning}</p>
        </motion.div>
      )}

      {/* Risks & Opportunities Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Risks */}
        {primaryStrategy.risks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-amber-50 border border-amber-200 rounded-lg p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <h5 className="font-medium text-sm text-amber-800">Risks to Consider</h5>
            </div>
            <ul className="space-y-2">
              {primaryStrategy.risks.map((risk, index) => (
                <li key={index} className="text-sm text-amber-700 flex items-start gap-2">
                  <span className="text-amber-500 mt-1">⚠</span>
                  <span>{risk}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}

        {/* Opportunities */}
        {primaryStrategy.opportunities.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-emerald-50 border border-emerald-200 rounded-lg p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <h5 className="font-medium text-sm text-emerald-800">Opportunities</h5>
            </div>
            <ul className="space-y-2">
              {primaryStrategy.opportunities.map((opportunity, index) => (
                <li key={index} className="text-sm text-emerald-700 flex items-start gap-2">
                  <span className="text-emerald-500 mt-1">✓</span>
                  <span>{opportunity}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </div>

      {/* Tactics */}
      {primaryStrategy.tactics.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white border border-gray-200 rounded-lg p-4"
        >
          <h5 className="font-medium text-sm text-gray-700 mb-3">Recommended Tactics</h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {primaryStrategy.tactics.map((tactic, index) => (
              <div
                key={index}
                className="text-sm text-gray-700 bg-gray-50 rounded px-3 py-2 flex items-start gap-2"
              >
                <span className="text-blue-500 mt-0.5">→</span>
                <span>{tactic}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Leverage Points */}
      {leveragePoints.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-purple-50 border border-purple-200 rounded-lg p-4"
        >
          <h5 className="font-medium text-sm text-purple-800 mb-3">Your Leverage Points</h5>
          <div className="flex flex-wrap gap-2">
            {leveragePoints.map((point, index) => (
              <span
                key={index}
                className="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-full"
              >
                {point}
              </span>
            ))}
          </div>
        </motion.div>
      )}

      {/* Market Insights */}
      {marketInsights.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-gray-50 border border-gray-200 rounded-lg p-4"
        >
          <h5 className="font-medium text-sm text-gray-700 mb-3">Market Insights</h5>
          <ul className="space-y-1">
            {marketInsights.map((insight, index) => (
              <li key={index} className="text-sm text-gray-600 flex items-start gap-2">
                <span className="text-gray-400 mt-1">•</span>
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      )}
    </div>
  )
}

function ConfidenceMeter({ confidence }: { confidence: number }) {
  const getColor = () => {
    if (confidence >= 80) return 'text-green-600 bg-green-100'
    if (confidence >= 60) return 'text-blue-600 bg-blue-100'
    return 'text-amber-600 bg-amber-100'
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-600">Confidence</span>
      <div className={`px-3 py-1 rounded-full font-semibold text-sm ${getColor()}`}>
        {confidence}%
      </div>
    </div>
  )
}
