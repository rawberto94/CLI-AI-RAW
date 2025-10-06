'use client'

import { motion } from 'framer-motion'
import { Brain, AlertTriangle, CheckCircle, TrendingUp, Shield } from 'lucide-react'
import { fadeIn, staggerContainer } from '@/lib/contracts/animations'
import { cn } from '@/lib/utils'

export interface AIInsight {
  id: string
  type: 'risk' | 'opportunity' | 'compliance' | 'recommendation'
  title: string
  description: string
  severity: 'high' | 'medium' | 'low'
  confidence: number
}

export interface AnalysisTabProps {
  insights: AIInsight[]
  riskScore: number
  complianceScore: number
  className?: string
}

export function AnalysisTab({ insights, riskScore, complianceScore, className }: AnalysisTabProps) {
  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className={cn('space-y-6', className)}>
      <motion.div variants={fadeIn} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ScoreCard title="Risk Score" score={riskScore} icon={AlertTriangle} type="risk" />
        <ScoreCard title="Compliance Score" score={complianceScore} icon={Shield} type="compliance" />
      </motion.div>

      <motion.div variants={fadeIn}>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Brain className="w-5 h-5" />
          AI Insights
        </h3>
        <div className="space-y-3">
          {insights.map(insight => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}

function ScoreCard({ title, score, icon: Icon, type }: any) {
  const getColor = () => {
    if (type === 'risk') {
      if (score >= 80) return 'text-red-600 bg-red-50'
      if (score >= 50) return 'text-yellow-600 bg-yellow-50'
      return 'text-green-600 bg-green-50'
    }
    if (score >= 80) return 'text-green-600 bg-green-50'
    if (score >= 60) return 'text-yellow-600 bg-yellow-50'
    return 'text-red-600 bg-red-50'
  }

  return (
    <div className="bg-white rounded-xl border p-6">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold">{title}</h4>
        <Icon className="w-5 h-5 text-gray-400" />
      </div>
      <div className={cn('text-4xl font-bold', getColor().split(' ')[0])}>{score}</div>
      <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
        <motion.div className={cn('h-2 rounded-full', getColor().split(' ')[1])} initial={{ width: 0 }} animate={{ width: `${score}%` }} />
      </div>
    </div>
  )
}

function InsightCard({ insight }: { insight: AIInsight }) {
  const getIcon = () => {
    switch (insight.type) {
      case 'risk': return <AlertTriangle className="w-5 h-5 text-red-600" />
      case 'opportunity': return <TrendingUp className="w-5 h-5 text-green-600" />
      case 'compliance': return <Shield className="w-5 h-5 text-blue-600" />
      default: return <CheckCircle className="w-5 h-5 text-gray-600" />
    }
  }

  return (
    <div className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        {getIcon()}
        <div className="flex-1">
          <h4 className="font-medium mb-1">{insight.title}</h4>
          <p className="text-sm text-gray-600">{insight.description}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className={cn('text-xs px-2 py-1 rounded', 
              insight.severity === 'high' ? 'bg-red-100 text-red-700' :
              insight.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
            )}>
              {insight.severity}
            </span>
            <span className="text-xs text-gray-500">{insight.confidence}% confidence</span>
          </div>
        </div>
      </div>
    </div>
  )
}
