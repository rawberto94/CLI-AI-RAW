'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle, XCircle, Save, TrendingUp } from 'lucide-react'
import { NegotiationHistoryService } from '@/lib/negotiation-prep/negotiation-history-service'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface OutcomeRecordingFormProps {
  role: string
  level: string
  location: string
  supplier: string
  initialRate: number
  targetRate: number
  strategyUsed: 'aggressive' | 'moderate' | 'conservative'
  annualVolume: number
  onSuccess?: () => void
  onCancel?: () => void
}

export function OutcomeRecordingForm({
  role,
  level,
  location,
  supplier,
  initialRate,
  targetRate,
  strategyUsed,
  annualVolume,
  onSuccess,
  onCancel
}: OutcomeRecordingFormProps) {
  const [finalRate, setFinalRate] = useState(targetRate)
  const [duration, setDuration] = useState(14)
  const [notes, setNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const achieved = finalRate <= targetRate
  const savingsAchieved = (initialRate - finalRate) * annualVolume
  const savingsPercent = ((initialRate - finalRate) / initialRate) * 100

  const successLevel = (): 'exceeded' | 'met' | 'partial' | 'failed' => {
    if (finalRate < targetRate) return 'exceeded'
    if (finalRate === targetRate) return 'met'
    if (finalRate < initialRate) return 'partial'
    return 'failed'
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      NegotiationHistoryService.recordOutcome({
        role,
        level,
        location,
        supplier,
        initialRate,
        targetRate,
        strategyUsed,
        finalRate,
        achieved,
        successLevel: successLevel(),
        negotiationDate: new Date(),
        duration,
        notes,
        annualVolume
      })

      onSuccess?.()
    } catch (error) {
      console.error('Error recording outcome:', error)
      alert('Failed to record outcome. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          Record Negotiation Outcome
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Summary */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Role:</span>
                <span className="ml-2 font-medium">{role} - {level}</span>
              </div>
              <div>
                <span className="text-gray-600">Supplier:</span>
                <span className="ml-2 font-medium">{supplier}</span>
              </div>
              <div>
                <span className="text-gray-600">Initial Rate:</span>
                <span className="ml-2 font-medium">CHF {initialRate.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-gray-600">Target Rate:</span>
                <span className="ml-2 font-medium">CHF {targetRate.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-gray-600">Strategy:</span>
                <span className="ml-2 font-medium capitalize">{strategyUsed}</span>
              </div>
            </div>
          </div>

          {/* Final Rate Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Final Negotiated Rate (CHF/day)
            </label>
            <input
              type="number"
              value={finalRate}
              onChange={(e) => setFinalRate(Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              min={0}
              step={10}
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter the final rate you agreed upon with the supplier
            </p>
          </div>

          {/* Duration Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Negotiation Duration (days)
            </label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              min={1}
              max={365}
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              How many days did the negotiation take?
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              placeholder="Add any notes about the negotiation process, what worked well, challenges faced, etc."
            />
          </div>

          {/* Outcome Summary */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-lg p-4 ${
              achieved ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'
            }`}
          >
            <div className="flex items-center gap-2 mb-3">
              {achieved ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <XCircle className="w-5 h-5 text-amber-600" />
              )}
              <h4 className={`font-semibold ${achieved ? 'text-green-800' : 'text-amber-800'}`}>
                {achieved ? 'Target Achieved!' : 'Target Not Met'}
              </h4>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-600">Savings Achieved</div>
                <div className={`text-xl font-bold ${savingsAchieved > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  CHF {savingsAchieved.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-gray-600">Savings Percentage</div>
                <div className={`text-xl font-bold ${savingsPercent > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {savingsPercent.toFixed(1)}%
                </div>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="text-sm">
                <span className="text-gray-600">Success Level:</span>
                <span className="ml-2 font-medium capitalize">{successLevel()}</span>
              </div>
            </div>
          </motion.div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={isSaving}
              className="flex-1"
            >
              {isSaving ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Record Outcome
                </>
              )}
            </Button>
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isSaving}
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// Success Rate Display Component
export function SuccessRateDisplay({ 
  strategy, 
  role, 
  level, 
  location 
}: { 
  strategy: 'aggressive' | 'moderate' | 'conservative'
  role: string
  level: string
  location: string
}) {
  const effectiveness = NegotiationHistoryService.analyzeStrategyEffectiveness(role, level, location)
  const strategyData = effectiveness.find(e => e.strategy === strategy)

  if (!strategyData || strategyData.totalAttempts === 0) {
    return null
  }

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 rounded-full text-sm">
      <span className="text-blue-700">
        {strategyData.successRate.toFixed(0)}% success rate in your history
      </span>
      <span className="text-blue-500">
        ({strategyData.successfulAttempts}/{strategyData.totalAttempts})
      </span>
    </div>
  )
}
