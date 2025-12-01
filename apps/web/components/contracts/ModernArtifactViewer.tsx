'use client'

import React, { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import {
  FileText,
  DollarSign,
  Shield,
  FileCheck,
  AlertCircle,
  Sparkles,
  Copy,
  Check,
  TrendingUp,
  AlertTriangle,
  Calendar,
  Users,
  Clock,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Scale,
  Award,
  Target
} from 'lucide-react'

interface ModernArtifactViewerProps {
  artifacts: {
    overview?: any
    clauses?: any
    financial?: any
    risk?: any
    compliance?: any
  }
  contractId: string
  initialTab?: string
}

export function ModernArtifactViewer({ artifacts, contractId, initialTab = 'overview' }: ModernArtifactViewerProps) {
  const [activeTab, setActiveTab] = useState(initialTab)
  const [copiedSection, setCopiedSection] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['all']))

  const handleCopy = async (content: string, section: string) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(content, null, 2))
      setCopiedSection(section)
      toast.success('Copied to clipboard')
      setTimeout(() => setCopiedSection(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
      toast.error('Failed to copy to clipboard')
    }
  }

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev)
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId)
      } else {
        newSet.add(sectionId)
      }
      return newSet
    })
  }

  const getAvailableArtifacts = () => {
    const available = []
    if (artifacts.overview) available.push({ key: 'overview', label: 'Overview', icon: FileText, color: 'blue' })
    if (artifacts.clauses) available.push({ key: 'clauses', label: 'Clauses', icon: Scale, color: 'purple' })
    if (artifacts.financial) available.push({ key: 'financial', label: 'Financial', icon: DollarSign, color: 'green' })
    if (artifacts.risk) available.push({ key: 'risk', label: 'Risk', icon: Shield, color: 'red' })
    if (artifacts.compliance) available.push({ key: 'compliance', label: 'Compliance', icon: FileCheck, color: 'indigo' })
    return available
  }

  const availableArtifacts = getAvailableArtifacts()

  if (availableArtifacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6">
        <div className="p-6 bg-gray-100 rounded-full mb-6">
          <AlertCircle className="h-12 w-12 text-gray-400" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">No Artifacts Available</h3>
        <p className="text-gray-600 text-center max-w-md">
          This contract hasn't been processed yet, or artifacts are still being generated.
        </p>
      </div>
    )
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="w-full grid grid-cols-2 md:grid-cols-5 gap-2 bg-gradient-to-r from-gray-50 to-slate-50 p-2 rounded-2xl shadow-inner mb-6">
        {availableArtifacts.map((artifact) => {
          const Icon = artifact.icon
          const colorMap = {
            blue: 'data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-600',
            purple: 'data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-600',
            green: 'data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-emerald-600',
            red: 'data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-orange-600',
            indigo: 'data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-blue-600'
          }
          return (
            <TabsTrigger
              key={artifact.key}
              value={artifact.key}
              className={`${colorMap[artifact.color as keyof typeof colorMap]} data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300 py-3`}
            >
              <Icon className="h-4 w-4 mr-2" />
              {artifact.label}
            </TabsTrigger>
          )
        })}
      </TabsList>

      {/* Overview Tab */}
      {artifacts.overview && (
        <TabsContent value="overview" className="space-y-6">
          <OverviewArtifact data={artifacts.overview} onCopy={handleCopy} copiedSection={copiedSection} />
        </TabsContent>
      )}

      {/* Clauses Tab */}
      {artifacts.clauses && (
        <TabsContent value="clauses" className="space-y-6">
          <ClausesArtifact data={artifacts.clauses} onCopy={handleCopy} copiedSection={copiedSection} expandedSections={expandedSections} toggleSection={toggleSection} />
        </TabsContent>
      )}

      {/* Financial Tab */}
      {artifacts.financial && (
        <TabsContent value="financial" className="space-y-6">
          <FinancialArtifact data={artifacts.financial} onCopy={handleCopy} copiedSection={copiedSection} />
        </TabsContent>
      )}

      {/* Risk Tab */}
      {artifacts.risk && (
        <TabsContent value="risk" className="space-y-6">
          <RiskArtifact data={artifacts.risk} onCopy={handleCopy} copiedSection={copiedSection} expandedSections={expandedSections} toggleSection={toggleSection} />
        </TabsContent>
      )}

      {/* Compliance Tab */}
      {artifacts.compliance && (
        <TabsContent value="compliance" className="space-y-6">
          <ComplianceArtifact data={artifacts.compliance} onCopy={handleCopy} copiedSection={copiedSection} expandedSections={expandedSections} toggleSection={toggleSection} />
        </TabsContent>
      )}
    </Tabs>
  )
}

// Overview Artifact Component
function OverviewArtifact({ data, onCopy, copiedSection }: any) {
  return (
    <div className="space-y-6">
      <Card className="shadow-lg border-0 bg-gradient-to-br from-blue-50 to-indigo-50">
        <CardContent className="p-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-gray-900">Contract Overview</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCopy(data, 'overview')}
              className="hover:bg-blue-100"
            >
              {copiedSection === 'overview' ? (
                <Check className="h-4 w-4 mr-2 text-green-600" />
              ) : (
                <Copy className="h-4 w-4 mr-2" />
              )}
              {copiedSection === 'overview' ? 'Copied!' : 'Copy'}
            </Button>
          </div>

          {data.summary && (
            <div className="mb-6 p-6 bg-white rounded-xl shadow-sm">
              <h4 className="text-lg font-semibold text-gray-900 mb-3">Executive Summary</h4>
              <p className="text-gray-700 leading-relaxed">{data.summary}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.parties && data.parties.length > 0 && (
              <div className="p-5 bg-white rounded-xl shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="h-5 w-5 text-blue-600" />
                  <h4 className="font-semibold text-gray-900">Parties</h4>
                </div>
                <div className="space-y-3">
                  {data.parties.map((party: any, idx: number) => (
                    <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      <Badge variant="outline" className="mt-0.5">{party.role}</Badge>
                      <div>
                        <p className="font-medium text-gray-900">{party.name}</p>
                        {party.address && <p className="text-sm text-gray-600">{party.address}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="p-5 bg-white rounded-xl shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="h-5 w-5 text-blue-600" />
                <h4 className="font-semibold text-gray-900">Key Dates</h4>
              </div>
              <div className="space-y-3">
                {(data.contractDate || data.startDate) && (
                  <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-600">Start Date:</span>
                    <span className="font-medium text-gray-900">{data.contractDate || data.startDate}</span>
                  </div>
                )}
                {(data.expiryDate || data.endDate) && (
                  <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-600">End Date:</span>
                    <span className="font-medium text-gray-900">{data.expiryDate || data.endDate}</span>
                  </div>
                )}
                {data.effectiveDate && (
                  <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-600">Effective Date:</span>
                    <span className="font-medium text-gray-900">{data.effectiveDate}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {data.keyTerms && data.keyTerms.length > 0 && (
            <div className="mt-6 p-5 bg-white rounded-xl shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Target className="h-5 w-5 text-blue-600" />
                <h4 className="font-semibold text-gray-900">Key Terms</h4>
              </div>
              <div className="flex flex-wrap gap-2">
                {data.keyTerms.map((term: string, idx: number) => (
                  <Badge key={idx} className="bg-blue-100 text-blue-700 hover:bg-blue-200">
                    {term}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Clauses Artifact Component
function ClausesArtifact({ data, onCopy, copiedSection, expandedSections, toggleSection }: any) {
  const clauses = Array.isArray(data) ? data : data.clauses || []
  
  return (
    <div className="space-y-6">
      <Card className="shadow-lg border-0 bg-gradient-to-br from-purple-50 to-pink-50">
        <CardContent className="p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-2xl font-bold text-gray-900">Contract Clauses</h3>
              <p className="text-gray-600 mt-1">{clauses.length} clauses identified</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCopy(data, 'clauses')}
              className="hover:bg-purple-100"
            >
              {copiedSection === 'clauses' ? (
                <Check className="h-4 w-4 mr-2 text-green-600" />
              ) : (
                <Copy className="h-4 w-4 mr-2" />
              )}
              {copiedSection === 'clauses' ? 'Copied!' : 'Copy'}
            </Button>
          </div>

          <div className="space-y-4">
            {clauses.map((clause: any, idx: number) => {
              const isExpanded = expandedSections.has(`clause-${idx}`)
              return (
                <div key={idx} className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <button
                    onClick={() => toggleSection(`clause-${idx}`)}
                    className="w-full p-5 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <Scale className="h-5 w-5 text-purple-600" />
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-gray-900">{clause.title || clause.type || `Clause ${idx + 1}`}</p>
                        {clause.section && (
                          <p className="text-sm text-gray-600">Section: {clause.section}</p>
                        )}
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                  
                  {isExpanded && (
                    <div className="p-5 pt-0 border-t bg-gray-50">
                      <div className="bg-white p-4 rounded-lg">
                        <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                          {clause.content || clause.text || clause.description || 'No content available'}
                        </p>
                      </div>
                      
                      {clause.obligations && clause.obligations.length > 0 && (
                        <div className="mt-4">
                          <h5 className="font-semibold text-gray-900 mb-2">Obligations:</h5>
                          <ul className="list-disc list-inside space-y-1 text-gray-700">
                            {clause.obligations.map((obl: string, i: number) => (
                              <li key={i}>{obl}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Financial Artifact Component
function FinancialArtifact({ data, onCopy, copiedSection }: any) {
  return (
    <div className="space-y-6">
      <Card className="shadow-lg border-0 bg-gradient-to-br from-green-50 to-emerald-50">
        <CardContent className="p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-2xl font-bold text-gray-900">Financial Terms</h3>
              {data.totalValue && (
                <p className="text-3xl font-bold text-green-600 mt-2">
                  {data.currency} {data.totalValue?.toLocaleString()}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCopy(data, 'financial')}
              className="hover:bg-green-100"
            >
              {copiedSection === 'financial' ? (
                <Check className="h-4 w-4 mr-2 text-green-600" />
              ) : (
                <Copy className="h-4 w-4 mr-2" />
              )}
              {copiedSection === 'financial' ? 'Copied!' : 'Copy'}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {data.paymentTerms && (
              <div className="p-5 bg-white rounded-xl shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-5 w-5 text-green-600" />
                  <h4 className="font-semibold text-gray-900">Payment Terms</h4>
                </div>
                <p className="text-gray-700">{data.paymentTerms}</p>
              </div>
            )}

            {data.paymentSchedule && data.paymentSchedule.length > 0 && (
              <div className="p-5 bg-white rounded-xl shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-5 w-5 text-green-600" />
                  <h4 className="font-semibold text-gray-900">Payment Schedule</h4>
                </div>
                <div className="space-y-2">
                  {data.paymentSchedule.map((payment: any, idx: number) => (
                    <div key={idx} className="flex justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-600">{payment.date || `Payment ${idx + 1}`}</span>
                      <span className="font-medium text-gray-900">{payment.amount}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {data.rateCards && data.rateCards.length > 0 && (
            <div className="mt-6 p-5 bg-white rounded-xl shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="h-5 w-5 text-green-600" />
                <h4 className="font-semibold text-gray-900">Rate Cards</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 text-gray-700 font-semibold">Role</th>
                      <th className="text-right p-3 text-gray-700 font-semibold">Rate</th>
                      {data.rateCards[0]?.benchmark && <th className="text-right p-3 text-gray-700 font-semibold">Benchmark</th>}
                      {data.rateCards[0]?.deviation && <th className="text-right p-3 text-gray-700 font-semibold">Deviation</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {data.rateCards.map((rate: any, idx: number) => (
                      <tr key={idx} className="border-b hover:bg-gray-50">
                        <td className="p-3 text-gray-900">{rate.role || rate.name}</td>
                        <td className="p-3 text-right font-medium text-gray-900">{rate.rate}</td>
                        {rate.benchmark && (
                          <td className="p-3 text-right text-gray-600">{rate.benchmark}</td>
                        )}
                        {rate.deviation && (
                          <td className="p-3 text-right">
                            <Badge className={rate.deviation > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}>
                              {rate.deviation > 0 ? '+' : ''}{rate.deviation}%
                            </Badge>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Risk Artifact Component
function RiskArtifact({ data, onCopy, copiedSection, expandedSections, toggleSection }: any) {
  const getRiskColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'low':
        return 'text-green-700 bg-green-100 border-green-300'
      case 'medium':
        return 'text-yellow-700 bg-yellow-100 border-yellow-300'
      case 'high':
        return 'text-red-700 bg-red-100 border-red-300'
      default:
        return 'text-gray-700 bg-gray-100 border-gray-300'
    }
  }

  const getRiskIcon = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'low':
        return CheckCircle2
      case 'medium':
        return MinusCircle
      case 'high':
        return XCircle
      default:
        return AlertCircle
    }
  }

  const RiskIcon = getRiskIcon(data.riskLevel)

  return (
    <div className="space-y-6">
      <Card className="shadow-lg border-0 bg-gradient-to-br from-red-50 to-orange-50">
        <CardContent className="p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-2xl font-bold text-gray-900">Risk Analysis</h3>
              <div className="flex items-center gap-3 mt-3">
                <Badge className={`${getRiskColor(data.riskLevel)} px-4 py-2 text-lg font-semibold border shadow-sm`}>
                  <RiskIcon className="h-5 w-5 mr-2" />
                  {data.riskLevel} Risk
                </Badge>
                {data.riskScore !== undefined && (
                  <span className="text-2xl font-bold text-gray-700">
                    Score: {data.riskScore}/100
                  </span>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCopy(data, 'risk')}
              className="hover:bg-red-100"
            >
              {copiedSection === 'risk' ? (
                <Check className="h-4 w-4 mr-2 text-green-600" />
              ) : (
                <Copy className="h-4 w-4 mr-2" />
              )}
              {copiedSection === 'risk' ? 'Copied!' : 'Copy'}
            </Button>
          </div>

          {data.riskFactors && data.riskFactors.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900 text-lg">Identified Risk Factors</h4>
              {data.riskFactors.map((risk: any, idx: number) => {
                const isExpanded = expandedSections.has(`risk-${idx}`)
                return (
                  <div key={idx} className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <button
                      onClick={() => toggleSection(`risk-${idx}`)}
                      className="w-full p-5 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Badge className={getRiskColor(risk.severity || risk.level)}>
                          {risk.severity || risk.level}
                        </Badge>
                        <p className="font-semibold text-gray-900 text-left">
                          {risk.category || risk.type || `Risk ${idx + 1}`}
                        </p>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                      )}
                    </button>
                    
                    {isExpanded && (
                      <div className="p-5 pt-0 border-t bg-gray-50">
                        <div className="bg-white p-4 rounded-lg">
                          <p className="text-gray-700 leading-relaxed">
                            {risk.description || risk.details || 'No description available'}
                          </p>
                          {risk.mitigation && (
                            <div className="mt-4 p-3 bg-green-50 rounded-lg border-l-4 border-green-500">
                              <p className="text-sm font-semibold text-green-900 mb-1">Mitigation:</p>
                              <p className="text-sm text-green-800">{risk.mitigation}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Compliance Artifact Component
function ComplianceArtifact({ data, onCopy, copiedSection, expandedSections, toggleSection }: any) {
  return (
    <div className="space-y-6">
      <Card className="shadow-lg border-0 bg-gradient-to-br from-indigo-50 to-blue-50">
        <CardContent className="p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-2xl font-bold text-gray-900">Compliance Analysis</h3>
              {data.complianceScore !== undefined && (
                <p className="text-3xl font-bold text-indigo-600 mt-2">
                  {data.complianceScore}% Compliant
                </p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCopy(data, 'compliance')}
              className="hover:bg-indigo-100"
            >
              {copiedSection === 'compliance' ? (
                <Check className="h-4 w-4 mr-2 text-green-600" />
              ) : (
                <Copy className="h-4 w-4 mr-2" />
              )}
              {copiedSection === 'compliance' ? 'Copied!' : 'Copy'}
            </Button>
          </div>

          {data.regulations && data.regulations.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900 text-lg">Applicable Regulations</h4>
              {data.regulations.map((reg: any, idx: number) => {
                const isExpanded = expandedSections.has(`reg-${idx}`)
                const isCompliant = reg.compliant || reg.status === 'compliant'
                
                return (
                  <div key={idx} className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <button
                      onClick={() => toggleSection(`reg-${idx}`)}
                      className="w-full p-5 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isCompliant ? 'bg-green-100' : 'bg-yellow-100'}`}>
                          {isCompliant ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          ) : (
                            <AlertTriangle className="h-5 w-5 text-yellow-600" />
                          )}
                        </div>
                        <div className="text-left">
                          <p className="font-semibold text-gray-900">{reg.name || reg.regulation}</p>
                          <p className="text-sm text-gray-600">{reg.type || 'Regulation'}</p>
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                      )}
                    </button>
                    
                    {isExpanded && (
                      <div className="p-5 pt-0 border-t bg-gray-50">
                        <div className="bg-white p-4 rounded-lg space-y-3">
                          {reg.description && (
                            <p className="text-gray-700 leading-relaxed">{reg.description}</p>
                          )}
                          {reg.requirements && reg.requirements.length > 0 && (
                            <div>
                              <p className="font-semibold text-gray-900 mb-2">Requirements:</p>
                              <ul className="list-disc list-inside space-y-1 text-gray-700">
                                {reg.requirements.map((req: string, i: number) => (
                                  <li key={i}>{req}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {reg.notes && (
                            <div className="p-3 bg-blue-50 rounded-lg">
                              <p className="text-sm text-blue-800">{reg.notes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {data.issues && data.issues.length > 0 && (
            <div className="mt-6 p-5 bg-white rounded-xl shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <h4 className="font-semibold text-gray-900">Compliance Issues</h4>
              </div>
              <div className="space-y-3">
                {data.issues.map((issue: any, idx: number) => (
                  <div key={idx} className="p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded">
                    <p className="font-medium text-yellow-900">{issue.title || `Issue ${idx + 1}`}</p>
                    <p className="text-sm text-yellow-800 mt-1">{issue.description || issue.details}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
