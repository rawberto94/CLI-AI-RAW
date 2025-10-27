'use client'

import React, { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  FileText,
  DollarSign,
  Clock,
  Download,
  Eye,
  Edit,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Sparkles,
  Brain,
  Shield,
  FileCheck,
  AlertTriangle,
  Loader2
} from 'lucide-react'
import { useDataMode } from '@/contexts/DataModeContext'
import { useRouter } from 'next/navigation'

interface ContractDetailTabsProps {
  contract: any
  artifacts: any[]
  onEdit?: () => void
  onExport?: () => void
}

export function ContractDetailTabs({ contract, artifacts, onEdit, onExport }: ContractDetailTabsProps) {
  const { dataMode } = useDataMode()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('overview')
  const [analyzing, setAnalyzing] = useState(false)

  const handleAnalyzeWithAI = async () => {
    setAnalyzing(true)
    try {
      const response = await fetch(`/api/contracts/${contract?.id}/retry`, {
        method: 'POST'
      })
      if (response.ok) {
        setTimeout(() => {
          window.location.reload()
        }, 2000)
      }
    } catch (error) {
      console.error('Analysis failed:', error)
    } finally {
      setAnalyzing(false)
    }
  }

  const getArtifactIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'overview':
        return <FileText className="h-5 w-5 text-blue-600" />
      case 'clauses':
        return <FileCheck className="h-5 w-5 text-purple-600" />
      case 'financial':
        return <DollarSign className="h-5 w-5 text-green-600" />
      case 'risk':
        return <AlertTriangle className="h-5 w-5 text-red-600" />
      case 'compliance':
        return <Shield className="h-5 w-5 text-indigo-600" />
      default:
        return <FileText className="h-5 w-5 text-gray-600" />
    }
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-5">
        <TabsTrigger value="overview" className="gap-2">
          <Eye className="h-4 w-4" />
          <span className="hidden sm:inline">Overview</span>
        </TabsTrigger>
        <TabsTrigger value="artifacts" className="gap-2">
          <FileText className="h-4 w-4" />
          <span className="hidden sm:inline">Artifacts</span>
          <Badge variant="secondary" className="ml-1">{artifacts?.length || 0}</Badge>
        </TabsTrigger>
        <TabsTrigger value="financial" className="gap-2">
          <DollarSign className="h-4 w-4" />
          <span className="hidden sm:inline">Financial</span>
        </TabsTrigger>
        <TabsTrigger value="timeline" className="gap-2">
          <Clock className="h-4 w-4" />
          <span className="hidden sm:inline">Timeline</span>
        </TabsTrigger>
        <TabsTrigger value="insights" className="gap-2">
          <Sparkles className="h-4 w-4" />
          <span className="hidden sm:inline">AI Insights</span>
        </TabsTrigger>
      </TabsList>

      {/* Overview Tab */}
      <TabsContent value="overview" className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-500">Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-2xl font-bold">{contract?.status || 'Active'}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-500">Total Value</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-blue-600" />
                <span className="text-2xl font-bold">
                  ${contract?.totalValue?.toLocaleString() || '0'}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-500">Artifacts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-purple-600" />
                <span className="text-2xl font-bold">{artifacts?.length || 0}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Contract Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Contract ID</p>
                <p className="font-medium">{contract?.id || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Supplier</p>
                <p className="font-medium">{contract?.supplier || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Start Date</p>
                <p className="font-medium">{contract?.startDate || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">End Date</p>
                <p className="font-medium">{contract?.endDate || 'N/A'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Artifacts Tab */}
      <TabsContent value="artifacts" className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Contract Artifacts</h3>
            <p className="text-sm text-muted-foreground">AI-extracted insights and analysis</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="default" 
              size="sm" 
              onClick={handleAnalyzeWithAI}
              disabled={analyzing}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              {analyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4 mr-2" />
                  Analyze with AI
                </>
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
        </div>

        {artifacts && artifacts.length > 0 ? (
          <div className="grid gap-4">
            {artifacts.map((artifact, index) => {
              const artifactType = artifact.type?.toLowerCase() || 'unknown'
              const artifactData = artifact.data || {}
              
              return (
                <Card key={index} className="overflow-hidden hover:shadow-md transition-shadow">
                  <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getArtifactIcon(artifactType)}
                        <div>
                          <CardTitle className="text-lg capitalize">{artifactType}</CardTitle>
                          {artifact.confidence && (
                            <CardDescription className="text-xs mt-1">
                              Confidence: {(artifact.confidence * 100).toFixed(0)}%
                            </CardDescription>
                          )}
                        </div>
                      </div>
                      {artifact.model && (
                        <Badge variant="outline" className="text-xs">
                          {artifact.model}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      {artifactType === 'overview' && (
                        <div className="space-y-3">
                          {artifactData.summary && (
                            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                              <h4 className="font-semibold text-sm text-blue-900 dark:text-blue-100 mb-2">Summary</h4>
                              <p className="text-sm text-blue-800 dark:text-blue-200">{artifactData.summary}</p>
                            </div>
                          )}
                          {artifactData.parties && artifactData.parties.length > 0 && (
                            <div>
                              <h4 className="font-semibold text-sm mb-2">Parties</h4>
                              <div className="grid grid-cols-2 gap-2">
                                {artifactData.parties.map((party: any, i: number) => (
                                  <div key={i} className="p-3 bg-gray-50 dark:bg-gray-800 rounded border">
                                    <p className="font-medium">{party.name}</p>
                                    <p className="text-xs text-muted-foreground capitalize">{party.role}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {artifactData.contractType && (
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-xs text-muted-foreground">Contract Type</p>
                                <p className="font-medium">{artifactData.contractType}</p>
                              </div>
                              {artifactData.totalValue && (
                                <div>
                                  <p className="text-xs text-muted-foreground">Total Value</p>
                                  <p className="font-medium">${artifactData.totalValue.toLocaleString()}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {artifactType === 'clauses' && (
                        <div className="space-y-2">
                          {artifactData.clauses && artifactData.clauses.length > 0 ? (
                            artifactData.clauses.map((clause: any, i: number) => (
                              <div key={i} className="p-4 bg-gray-50 dark:bg-gray-800 rounded border hover:border-purple-300 transition-colors">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <div className="flex-1">
                                    <h4 className="font-semibold text-sm mb-1">{clause.name || clause.category || 'Clause'}</h4>
                                  </div>
                                  {clause.relevance && (
                                    <Badge variant="outline" className="text-xs">
                                      {Math.round(clause.relevance * 100)}% relevant
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">{clause.excerpt || clause.text || 'No description available'}</p>
                                {clause.location && (
                                  <p className="text-xs text-muted-foreground mt-2">Section: {clause.location}</p>
                                )}
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-muted-foreground">No clauses extracted</p>
                          )}
                        </div>
                      )}

                      {artifactType === 'financial' && (
                        <div className="space-y-3">
                          {(() => {
                            const finData = artifactData.financial || artifactData;
                            return (
                              <>
                                <div className="grid grid-cols-2 gap-4">
                                  {finData.totalValue && (
                                    <div className="p-4 bg-green-50 dark:bg-green-950 rounded border border-green-200 dark:border-green-800">
                                      <p className="text-xs text-green-600 dark:text-green-400 mb-1">Total Value</p>
                                      <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                                        ${finData.totalValue.toLocaleString()}
                                      </p>
                                    </div>
                                  )}
                                  {finData.currency && (
                                    <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded border border-blue-200 dark:border-blue-800">
                                      <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">Currency</p>
                                      <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{finData.currency}</p>
                                    </div>
                                  )}
                                </div>
                                
                                {finData.paymentTerms && finData.paymentTerms.length > 0 && (
                                  <div className="p-4 bg-purple-50 dark:bg-purple-950 rounded border border-purple-200 dark:border-purple-800">
                                    <h4 className="font-semibold text-sm mb-2 text-purple-900 dark:text-purple-100">Payment Terms</h4>
                                    <ul className="space-y-1">
                                      {finData.paymentTerms.map((term: string, i: number) => (
                                        <li key={i} className="text-sm text-purple-800 dark:text-purple-200">• {term}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                
                                {finData.paymentSchedule && finData.paymentSchedule.length > 0 && (
                                  <div>
                                    <h4 className="font-semibold text-sm mb-2">Payment Schedule</h4>
                                    <div className="space-y-2">
                                      {finData.paymentSchedule.map((payment: any, i: number) => (
                                        <div key={i} className="p-3 bg-gray-50 dark:bg-gray-800 rounded border flex justify-between items-center">
                                          <span className="font-medium">{payment.milestone}</span>
                                          <span className="text-green-600 dark:text-green-400 font-bold">
                                            ${payment.amount.toLocaleString()}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                
                                {finData.rateCards && finData.rateCards.length > 0 && (
                                  <div>
                                    <h4 className="font-semibold text-sm mb-2">Rate Cards</h4>
                                    <div className="space-y-2">
                                      {finData.rateCards.map((card: any, i: number) => (
                                        <div key={i} className="p-3 bg-gray-50 dark:bg-gray-800 rounded border flex justify-between">
                                          <span className="font-medium">{card.role || card.title}</span>
                                          <span className="text-green-600 font-bold">${card.rate}/hr</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      )}

                      {artifactType === 'risk' && (
                        <div className="space-y-2">
                          {artifactData.risks && artifactData.risks.length > 0 ? (
                            artifactData.risks.map((risk: any, i: number) => (
                              <div key={i} className={`p-4 rounded border ${
                                risk.severity?.toLowerCase() === 'high' ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800' :
                                risk.severity?.toLowerCase() === 'medium' ? 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800' :
                                'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                              }`}>
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <h4 className="font-semibold text-sm">{risk.title || risk.category || 'Risk'}</h4>
                                  <Badge variant={risk.severity?.toLowerCase() === 'high' ? 'destructive' : 'secondary'} className="text-xs capitalize">
                                    {risk.severity}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground mb-2">{risk.rationale || risk.description}</p>
                                {risk.mitigation && (
                                  <div className="mt-2 pt-2 border-t border-dashed">
                                    <p className="text-xs font-semibold text-muted-foreground mb-1">Mitigation:</p>
                                    <p className="text-xs text-muted-foreground">{risk.mitigation}</p>
                                  </div>
                                )}
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-muted-foreground">No risks identified</p>
                          )}
                        </div>
                      )}

                      {artifactType === 'compliance' && (
                        <div className="space-y-3">
                          {artifactData.summary && (
                            <div className="p-4 bg-indigo-50 dark:bg-indigo-950 rounded-lg border border-indigo-200 dark:border-indigo-800">
                              <h4 className="font-semibold text-sm text-indigo-900 dark:text-indigo-100 mb-2">Summary</h4>
                              <p className="text-sm text-indigo-800 dark:text-indigo-200">{artifactData.summary}</p>
                            </div>
                          )}
                          {artifactData.compliance && artifactData.compliance.length > 0 && (
                            <div className="space-y-2">
                              {artifactData.compliance.map((item: any, i: number) => (
                                <div key={i} className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded border">
                                  {item.present ? (
                                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                                  ) : (
                                    <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                                  )}
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <p className="font-semibold text-sm">{item.standard || item.requirement}</p>
                                      <Badge variant={item.present ? 'default' : 'secondary'} className="text-xs">
                                        {item.present ? 'Compliant' : 'Not Found'}
                                      </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground mb-1">{item.notes || item.details}</p>
                                    {item.excerpt && (
                                      <p className="text-xs italic text-muted-foreground mt-2 pl-3 border-l-2">"{item.excerpt}"</p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Artifacts Generated</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Click the button below to analyze this contract with AI and generate insights
              </p>
              <Button 
                onClick={handleAnalyzeWithAI}
                disabled={analyzing}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing Contract...
                  </>
                ) : (
                  <>
                    <Brain className="h-4 w-4 mr-2" />
                    Analyze with AI
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      {/* Financial Tab */}
      <TabsContent value="financial" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Financial Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-600 mb-1">Total Contract Value</p>
                <p className="text-2xl font-bold text-blue-900">
                  ${contract?.totalValue?.toLocaleString() || '0'}
                </p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-green-600 mb-1">Potential Savings</p>
                <p className="text-2xl font-bold text-green-900">
                  ${contract?.potentialSavings?.toLocaleString() || '0'}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Rate Cards</h4>
              <p className="text-sm text-gray-500">
                {dataMode === 'real' ? 'Loading rate cards...' : 'Sample rate cards displayed'}
              </p>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Timeline Tab */}
      <TabsContent value="timeline" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Version History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3].map((version) => (
                <div key={version} className="flex items-start gap-4 pb-4 border-b last:border-0">
                  <div className="p-2 bg-blue-100 rounded-full">
                    <Clock className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Version {version}</p>
                    <p className="text-sm text-gray-500">
                      {dataMode === 'real' ? 'Loading...' : `Updated ${version} days ago`}
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* AI Insights Tab */}
      <TabsContent value="insights" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              AI-Powered Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start gap-3">
                <TrendingUp className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium text-green-900">Savings Opportunity</p>
                  <p className="text-sm text-green-700 mt-1">
                    Potential 15% cost reduction identified in rate cards
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-900">Renewal Alert</p>
                  <p className="text-sm text-yellow-700 mt-1">
                    Contract expires in 90 days - consider renegotiation
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-900">Compliance Status</p>
                  <p className="text-sm text-blue-700 mt-1">
                    All required clauses present and up to date
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
