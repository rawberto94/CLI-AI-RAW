'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Shield,
  AlertTriangle,
  CheckCircle2,
  Info,
  TrendingUp,
  FileWarning,
  Scale,
  DollarSign,
  Lock,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface RiskCategory {
  id: string
  name: string
  score: number // 0-100
  level: 'low' | 'medium' | 'high' | 'critical'
  issues: RiskIssue[]
  description: string
  icon: React.ElementType
}

interface RiskIssue {
  id: string
  title: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  clauseReference?: string
  clauseText?: string
  recommendation: string
  impact: string
}

interface MissingClause {
  id: string
  name: string
  importance: 'required' | 'recommended' | 'optional'
  description: string
  industry: string
}

interface RiskAnalysisPanelProps {
  contractId: string
  overallRiskScore?: number
  riskLevel?: string
  categories?: RiskCategory[]
  missingClauses?: MissingClause[]
  complianceScore?: number
  onViewClause?: (clauseId: string) => void
}

export function RiskAnalysisPanel({
  contractId,
  overallRiskScore = 0,
  riskLevel = 'Unknown',
  categories = [],
  missingClauses = [],
  complianceScore = 0,
  onViewClause,
}: RiskAnalysisPanelProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null)

  const getRiskColor = (score: number) => {
    if (score >= 75) return { color: 'red', gradient: 'from-red-500 to-pink-500', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-300' }
    if (score >= 50) return { color: 'orange', gradient: 'from-orange-500 to-yellow-500', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-300' }
    if (score >= 25) return { color: 'yellow', gradient: 'from-yellow-500 to-amber-500', bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-300' }
    return { color: 'green', gradient: 'from-green-500 to-emerald-500', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-300' }
  }

  const getSeverityConfig = (severity: string) => {
    switch (severity) {
      case 'critical':
        return { color: 'bg-red-500', label: 'Critical', icon: XCircle, badgeClass: 'bg-red-100 text-red-700 border-red-300' }
      case 'high':
        return { color: 'bg-orange-500', label: 'High', icon: AlertTriangle, badgeClass: 'bg-orange-100 text-orange-700 border-orange-300' }
      case 'medium':
        return { color: 'bg-yellow-500', label: 'Medium', icon: AlertCircle, badgeClass: 'bg-yellow-100 text-yellow-700 border-yellow-300' }
      case 'low':
        return { color: 'bg-blue-500', label: 'Low', icon: Info, badgeClass: 'bg-blue-100 text-blue-700 border-blue-300' }
      default:
        return { color: 'bg-gray-500', label: 'Unknown', icon: Info, badgeClass: 'bg-gray-100 text-gray-700 border-gray-300' }
    }
  }

  const getRiskLevelConfig = (level: string) => {
    switch (level.toLowerCase()) {
      case 'critical':
        return { icon: XCircle, color: 'text-red-600', bg: 'bg-red-100' }
      case 'high':
        return { icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-100' }
      case 'medium':
        return { icon: AlertCircle, color: 'text-yellow-600', bg: 'bg-yellow-100' }
      case 'low':
        return { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100' }
      default:
        return { icon: Shield, color: 'text-gray-600', bg: 'bg-gray-100' }
    }
  }

  const overallRiskConfig = getRiskColor(overallRiskScore)
  const riskLevelConfig = getRiskLevelConfig(riskLevel)
  const RiskLevelIcon = riskLevelConfig.icon

  const complianceConfig = getRiskColor(100 - complianceScore) // Inverted (higher compliance = lower risk)

  return (
    <div className="space-y-6">
      {/* Overall Risk Score Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Risk Score */}
        <div className="group relative">
          <div className={`absolute -inset-0.5 bg-gradient-to-r ${overallRiskConfig.gradient} rounded-2xl opacity-75 group-hover:opacity-100 transition-opacity blur`}></div>
          <Card className="relative bg-white shadow-2xl border-0">
            <CardContent className="p-8">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <p className="text-sm font-medium text-gray-600 uppercase tracking-wide mb-2">Overall Risk Score</p>
                  <div className="flex items-center gap-3">
                    <div className={`p-4 ${riskLevelConfig.bg} rounded-xl`}>
                      <RiskLevelIcon className={`h-8 w-8 ${riskLevelConfig.color}`} />
                    </div>
                    <div>
                      <p className="text-5xl font-bold text-gray-900">{overallRiskScore}</p>
                      <p className={`text-lg font-semibold ${overallRiskConfig.text} capitalize`}>{riskLevel} Risk</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Risk Level</span>
                  <span className="font-semibold text-gray-900">{overallRiskScore}/100</span>
                </div>
                <Progress value={overallRiskScore} className="h-3" />
                <p className="text-xs text-gray-500 mt-2">
                  {overallRiskScore < 25 ? 'Low risk - standard contract terms' :
                   overallRiskScore < 50 ? 'Moderate risk - review recommended' :
                   overallRiskScore < 75 ? 'High risk - careful review required' :
                   'Critical risk - immediate attention needed'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Compliance Score */}
        <div className="group relative">
          <div className={`absolute -inset-0.5 bg-gradient-to-r ${complianceConfig.gradient} rounded-2xl opacity-75 group-hover:opacity-100 transition-opacity blur`}></div>
          <Card className="relative bg-white shadow-2xl border-0">
            <CardContent className="p-8">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <p className="text-sm font-medium text-gray-600 uppercase tracking-wide mb-2">Compliance Score</p>
                  <div className="flex items-center gap-3">
                    <div className="p-4 bg-blue-100 rounded-xl">
                      <Scale className="h-8 w-8 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-5xl font-bold text-gray-900">{complianceScore}</p>
                      <p className="text-lg font-semibold text-blue-600">Compliant</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Compliance Level</span>
                  <span className="font-semibold text-gray-900">{complianceScore}%</span>
                </div>
                <Progress value={complianceScore} className="h-3" />
                <p className="text-xs text-gray-500 mt-2">
                  {complianceScore >= 90 ? 'Excellent compliance with standards' :
                   complianceScore >= 75 ? 'Good compliance - minor gaps' :
                   complianceScore >= 60 ? 'Adequate compliance - improvements needed' :
                   'Below standards - significant gaps'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Risk Categories Breakdown */}
      <Card className="shadow-2xl border-0">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
              Risk Category Breakdown
            </CardTitle>
            <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 shadow-md">
              <Sparkles className="h-4 w-4 mr-2" />
              AI-Analyzed
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            {categories.length === 0 ? (
              <div className="text-center py-12">
                <Shield className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 text-lg">No risk analysis available yet</p>
                <p className="text-gray-500 text-sm mt-2">AI analysis will appear here once processing is complete</p>
              </div>
            ) : (
              categories.map((category) => {
                const categoryRiskConfig = getRiskColor(category.score)
                const CategoryIcon = category.icon
                const isExpanded = expandedCategory === category.id
                
                return (
                  <div key={category.id} className={cn(
                    'rounded-xl border-2 transition-all',
                    categoryRiskConfig.border,
                    categoryRiskConfig.bg
                  )}>
                    <div 
                      className="p-6 cursor-pointer hover:opacity-80"
                      onClick={() => setExpandedCategory(isExpanded ? null : category.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4 flex-1">
                          <div className={`p-3 bg-gradient-to-br ${categoryRiskConfig.gradient} rounded-xl shadow-lg`}>
                            <CategoryIcon className="h-6 w-6 text-white" />
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-lg font-bold text-gray-900">{category.name}</h3>
                              <Badge className={getSeverityConfig(category.level).badgeClass}>
                                {getSeverityConfig(category.level).label}
                              </Badge>
                              {category.issues.length > 0 && (
                                <Badge variant="outline" className="bg-white">
                                  {category.issues.length} {category.issues.length === 1 ? 'Issue' : 'Issues'}
                                </Badge>
                              )}
                            </div>
                            
                            <p className="text-sm text-gray-700 mb-3">{category.description}</p>
                            
                            <div className="flex items-center gap-4">
                              <div className="flex-1">
                                <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                                  <span>Risk Score</span>
                                  <span className="font-semibold">{category.score}/100</span>
                                </div>
                                <Progress value={category.score} className="h-2" />
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <Button variant="ghost" size="sm">
                          {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                        </Button>
                      </div>
                    </div>

                    {/* Expanded Issues */}
                    {isExpanded && category.issues.length > 0 && (
                      <div className="px-6 pb-6 space-y-3 border-t border-gray-200">
                        {category.issues.map((issue) => {
                          const issueConfig = getSeverityConfig(issue.severity)
                          const IssueIcon = issueConfig.icon
                          const isIssueExpanded = expandedIssue === issue.id
                          
                          return (
                            <div key={issue.id} className="mt-3 bg-white rounded-lg border-2 border-gray-200 overflow-hidden">
                              <div 
                                className="p-4 cursor-pointer hover:bg-gray-50"
                                onClick={() => setExpandedIssue(isIssueExpanded ? null : issue.id)}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex items-start gap-3 flex-1">
                                    <div className={cn('p-2 rounded-lg', issueConfig.color.replace('bg-', 'bg-').replace('500', '100'))}>
                                      <IssueIcon className={`h-4 w-4 ${issueConfig.color.replace('bg-', 'text-')}`} />
                                    </div>
                                    
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <h4 className="font-semibold text-gray-900">{issue.title}</h4>
                                        <Badge className={cn(issueConfig.badgeClass, "text-xs")}>
                                          {issueConfig.label}
                                        </Badge>
                                      </div>
                                      <p className="text-sm text-gray-600">{issue.description}</p>
                                      
                                      {issue.clauseReference && (
                                        <Button
                                          variant="link"
                                          size="sm"
                                          className="p-0 h-auto text-blue-600 mt-2"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            onViewClause?.(issue.clauseReference!)
                                          }}
                                        >
                                          <Eye className="h-3 w-3 mr-1" />
                                          View clause in contract
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <Button variant="ghost" size="sm">
                                    {isIssueExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                  </Button>
                                </div>
                              </div>

                              {/* Expanded Issue Details */}
                              {isIssueExpanded && (
                                <div className="px-4 pb-4 space-y-3 bg-gray-50">
                                  {issue.clauseText && (
                                    <div>
                                      <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Clause Text</p>
                                      <div className="p-3 bg-white rounded-lg border border-gray-200">
                                        <p className="text-sm text-gray-800 italic">&ldquo;{issue.clauseText}&rdquo;</p>
                                      </div>
                                    </div>
                                  )}
                                  
                                  <div>
                                    <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Impact</p>
                                    <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                                      <p className="text-sm text-red-800">{issue.impact}</p>
                                    </div>
                                  </div>
                                  
                                  <div>
                                    <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Recommendation</p>
                                    <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                                      <p className="text-sm text-green-800">{issue.recommendation}</p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Missing Clauses */}
      {missingClauses.length > 0 && (
        <Card className="shadow-2xl border-0 bg-gradient-to-br from-yellow-50 to-orange-50">
          <CardHeader className="border-b border-yellow-200">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <FileWarning className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <CardTitle className="text-2xl text-yellow-900">Missing or Incomplete Clauses</CardTitle>
                <p className="text-sm text-yellow-700 mt-1">Important clauses that may need to be added</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-3">
              {missingClauses.map((clause) => {
                const importanceConfig = {
                  required: { color: 'bg-red-100 text-red-700 border-red-300', label: 'Required', icon: XCircle },
                  recommended: { color: 'bg-yellow-100 text-yellow-700 border-yellow-300', label: 'Recommended', icon: AlertTriangle },
                  optional: { color: 'bg-blue-100 text-blue-700 border-blue-300', label: 'Optional', icon: Info },
                }[clause.importance]
                
                const ImportanceIcon = importanceConfig.icon
                
                return (
                  <div key={clause.id} className="p-4 bg-white rounded-xl border-2 border-yellow-200">
                    <div className="flex items-start gap-3">
                      <div className={cn('p-2 rounded-lg', importanceConfig.color.split(' ')[0])}>
                        <ImportanceIcon className={`h-5 w-5 ${importanceConfig.color.split(' ')[1]}`} />
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-gray-900">{clause.name}</h4>
                          <Badge className={importanceConfig.color}>
                            {importanceConfig.label}
                          </Badge>
                          {clause.industry && (
                            <Badge variant="outline" className="bg-white text-xs">
                              {clause.industry}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-700">{clause.description}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <Card className="shadow-xl border-0 bg-gradient-to-br from-blue-50 to-indigo-50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-blue-900">Risk Analysis Report</h3>
                <p className="text-sm text-blue-700">Download detailed risk assessment and recommendations</p>
              </div>
            </div>
            <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg">
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
