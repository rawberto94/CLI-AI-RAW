'use client'

import React, { useState, useEffect } from 'react'
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
  Loader2,
  Copy,
  Check,
  Keyboard,
  History as HistoryIcon
} from 'lucide-react'
import { useDataMode } from '@/contexts/DataModeContext'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/toast-provider'
import type { Contract, Artifact, OverviewData, ClausesData, FinancialData, RiskData, ComplianceData } from '@/types/artifacts'
import { logError, logUserAction, logPerformance } from '@/lib/logger'
import { EnhancedArtifactViewer } from '@/components/contracts/EnhancedArtifactViewer'
import { useKeyboardShortcuts, type KeyboardShortcut } from '@/hooks/useKeyboardShortcuts'
import { KeyboardShortcutsHelp } from '@/components/contracts/KeyboardShortcutsHelp'
import { ArtifactEditor } from '@/components/contracts/ArtifactEditor'
import { EnhancedMetadataEditor } from '@/components/contracts/EnhancedMetadataEditor'
import { ArtifactHistory } from '@/components/contracts/ArtifactHistory'

// Type guards for artifact data
const isOverviewData = (data: unknown): data is OverviewData => {
  return typeof data === 'object' && data !== null && ('summary' in data || 'parties' in data)
}

const isClausesData = (data: unknown): data is ClausesData => {
  return typeof data === 'object' && data !== null && 'clauses' in data
}

const isFinancialData = (data: unknown): data is FinancialData => {
  return typeof data === 'object' && data !== null && ('totalValue' in data || 'financial' in data)
}

const isRiskData = (data: unknown): data is RiskData => {
  return typeof data === 'object' && data !== null && 'risks' in data
}

const isComplianceData = (data: unknown): data is ComplianceData => {
  return typeof data === 'object' && data !== null && ('compliance' in data || ('summary' in data && typeof (data as any).compliance !== 'undefined'))
}

interface ContractDetailTabsProps {
  contract: Contract | null
  artifacts: Artifact[]
  initialTab?: string
  onEdit?: () => void
  onExport?: () => void
}

export function ContractDetailTabs({ contract, artifacts, initialTab, onEdit, onExport }: ContractDetailTabsProps) {
  const { dataMode } = useDataMode()
  const router = useRouter()
  const toast = useToast()
  const [activeTab, setActiveTab] = useState(initialTab || 'overview')
  const [analyzing, setAnalyzing] = useState(false)
  const [copiedArtifactId, setCopiedArtifactId] = useState<string | null>(null)
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false)
  const [editingArtifactId, setEditingArtifactId] = useState<string | null>(null)
  const [editingArtifact, setEditingArtifact] = useState<Artifact | null>(null)
  const [showMetadataEditor, setShowMetadataEditor] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [historyArtifact, setHistoryArtifact] = useState<{ id: string; type: string } | null>(null)
  const [rateCards, setRateCards] = useState<any[]>([]);
  const [loadingRateCards, setLoadingRateCards] = useState(false);

  // Extract overview data from artifacts to populate missing contract fields
  const overviewArtifact = artifacts?.find(a => a.type === 'overview');
  const overviewData = overviewArtifact?.data as any;
  
  // Merge contract data with overview artifact data
  const enrichedContract = {
    ...contract,
    startDate: contract?.startDate || overviewData?.contractDate || overviewData?.effectiveDate || 'N/A',
    endDate: contract?.endDate || overviewData?.expiryDate || overviewData?.endDate || 'N/A',
    totalValue: contract?.totalValue || overviewData?.totalValue || overviewData?.contractValue || 0,
    supplier: contract?.supplier || overviewData?.parties?.find((p: any) => p.role === 'Supplier' || p.role === 'Vendor')?.name || 'N/A',
  };

  // Define tab order for navigation
  const tabs = ['overview', 'artifacts', 'export'];

  // Fetch rate cards when Financial tab is active
  useEffect(() => {
    if (activeTab === 'financial' && contract?.id && dataMode === 'real') {
      const fetchRateCards = async () => {
        setLoadingRateCards(true)
        try {
          const response = await fetch(`/api/rate-cards?contractId=${contract.id}&tenantId=demo`)
          if (response.ok) {
            const data = await response.json()
            console.log('Rate cards response:', { 
              entries: data.entries?.length, 
              data: data.data?.length,
              total: data.total,
              originalTotal: data.originalTotal 
            })
            setRateCards(data.entries || data.data || [])
          } else {
            console.error('Failed to fetch rate cards:', response.status, response.statusText)
          }
        } catch (error) {
          console.error('Failed to fetch rate cards:', error)
        } finally {
          setLoadingRateCards(false)
        }
      }
      fetchRateCards()
    }
  }, [activeTab, contract?.id, dataMode]);

  const handleAnalyzeWithAI = async () => {
    setAnalyzing(true);
    const startTime = performance.now();
    
    try {
      logUserAction('contract-analyze-start', undefined, { contractId: contract?.id });
      
      const response = await fetch(`/api/contracts/${contract?.id}/artifacts/regenerate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const duration = performance.now() - startTime;
        logPerformance('contract-analysis-request', duration, { contractId: contract?.id });
        
        toast.success('Analysis Started', 'AI is regenerating artifacts for the contract. This may take a few moments.');
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Analysis failed');
      }
    } catch (error) {
      logError('Contract analysis failed', error, { contractId: contract?.id });
      toast.error('Analysis Failed', error instanceof Error ? error.message : 'Unable to analyze contract. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  }

  const handleCopyArtifact = async (artifactType: string, artifactData: unknown) => {
    try {
      const jsonString = JSON.stringify(artifactData, null, 2);
      await navigator.clipboard.writeText(jsonString);
      
      logUserAction('artifact-copy', undefined, { artifactType, contractId: contract?.id });
      
      setCopiedArtifactId(artifactType)
      toast.success('Copied to Clipboard', `${artifactType.toUpperCase()} artifact data copied successfully.`)
      
      // Reset copied state after 2 seconds
      setTimeout(() => setCopiedArtifactId(null), 2000)
    } catch (error) {
      logError('Artifact copy failed', error, { artifactType })
      toast.error('Copy Failed', 'Failed to copy artifact data to clipboard.')
    }
  }
  
  const handleNextTab = () => {
    const currentIndex = tabs.indexOf(activeTab)
    const nextIndex = (currentIndex + 1) % tabs.length
    const nextTab = tabs[nextIndex]
    if (nextTab) {
      setActiveTab(nextTab)
      logUserAction('tab-navigation', undefined, { from: activeTab, to: nextTab, method: 'keyboard' })
    }
  }

  const handlePrevTab = () => {
    const currentIndex = tabs.indexOf(activeTab)
    const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length
    const prevTab = tabs[prevIndex]
    if (prevTab) {
      setActiveTab(prevTab)
      logUserAction('tab-navigation', undefined, { from: activeTab, to: prevTab, method: 'keyboard' })
    }
  }

  const handleCopyCurrentArtifact = () => {
    if (artifacts && artifacts.length > 0) {
      const firstArtifact = artifacts[0]
      if (firstArtifact) {
        handleCopyArtifact(firstArtifact.type || 'unknown', firstArtifact.data)
      }
    }
  }

  const handleEditArtifact = (artifact: Artifact) => {
    setEditingArtifact(artifact)
    setEditingArtifactId(artifact.id || null)
    logUserAction('artifact-edit-start', undefined, { artifactType: artifact.type, contractId: contract?.id })
  }

  const handleSaveArtifact = async (updatedArtifact: Artifact) => {
    try {
      // The ArtifactEditor component handles the API call internally
      // After successful save, refresh the page or update local state
      toast.success('Artifact Updated', 'Changes have been saved successfully.')
      setEditingArtifactId(null)
      setEditingArtifact(null)
      
      // Reload the page to get fresh data
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } catch (error) {
      logError('Artifact save failed', error, { artifactId: updatedArtifact.id })
      toast.error('Save Failed', 'Unable to save artifact changes.')
    }
  }

  const handleCancelEdit = () => {
    setEditingArtifactId(null)
    setEditingArtifact(null)
  }

  const handleViewHistory = (artifact: Artifact) => {
    if (artifact.id) {
      setHistoryArtifact({ id: artifact.id, type: artifact.type })
      setShowHistory(true)
      logUserAction('artifact-history-view', undefined, { artifactType: artifact.type, contractId: contract?.id })
    } else {
      toast.error('History Unavailable', 'This artifact does not have a database ID.')
    }
  }

  // Keyboard shortcuts configuration
  const shortcuts: KeyboardShortcut[] = [
    {
      key: 'k',
      ctrl: true,
      description: 'Analyze with AI',
      action: handleAnalyzeWithAI,
      category: 'Actions',
      enabled: !analyzing
    },
    {
      key: 'c',
      ctrl: true,
      description: 'Copy first artifact',
      action: handleCopyCurrentArtifact,
      category: 'Actions',
      enabled: artifacts && artifacts.length > 0
    },
    {
      key: 'ArrowRight',
      ctrl: true,
      description: 'Next tab',
      action: handleNextTab,
      category: 'Navigation'
    },
    {
      key: 'ArrowLeft',
      ctrl: true,
      description: 'Previous tab',
      action: handlePrevTab,
      category: 'Navigation'
    },
    {
      key: '?',
      description: 'Toggle shortcuts help',
      action: () => setShowShortcutsHelp(prev => !prev),
      category: 'Help'
    },
    {
      key: 'Escape',
      description: 'Close dialogs',
      action: () => setShowShortcutsHelp(false),
      category: 'Help',
      enabled: showShortcutsHelp
    }
  ]

  // Enable keyboard shortcuts
  useKeyboardShortcuts({ shortcuts })

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
    <>
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
        <div className="flex justify-end mb-4">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowMetadataEditor(!showMetadataEditor)}
          >
            <Edit className="h-4 w-4 mr-2" />
            {showMetadataEditor ? 'Cancel' : 'Edit Metadata'}
          </Button>
        </div>

        {showMetadataEditor && contract && (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>Edit Contract Metadata</CardTitle>
            </CardHeader>
            <CardContent>
              <EnhancedMetadataEditor
                contractId={contract.id}
                tenantId="demo-tenant"
                initialMetadata={{
                  tags: [],
                  customFields: {}
                }}
                onSave={() => {
                  toast.success('Metadata Updated', 'Contract metadata has been saved.')
                  setShowMetadataEditor(false)
                  setTimeout(() => window.location.reload(), 1000)
                }}
              />
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-500">Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-2xl font-bold">{enrichedContract?.status || 'completed'}</span>
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
                  ${enrichedContract?.totalValue?.toLocaleString() || '0'}
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
                <p className="font-medium">{enrichedContract?.id || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Supplier</p>
                <p className="font-medium">{enrichedContract?.supplier || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Start Date</p>
                <p className="font-medium">{enrichedContract?.startDate || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">End Date</p>
                <p className="font-medium">{enrichedContract?.endDate || 'N/A'}</p>
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
              variant="outline"
              size="sm"
              onClick={() => setShowShortcutsHelp(true)}
              className="gap-2"
            >
              <Keyboard className="h-4 w-4" />
              Shortcuts
            </Button>
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
          <div className="grid gap-6 max-w-6xl">
            {artifacts.map((artifact, index) => {
              const artifactType = artifact.type?.toLowerCase() || 'unknown'
              const artifactData = artifact.data || {}
              
              return (
                <Card key={index} className="overflow-hidden hover:shadow-lg transition-all duration-300 border-2">
                  <CardHeader className="bg-gradient-to-r from-gray-50 via-white to-gray-50 dark:from-gray-800 dark:via-gray-850 dark:to-gray-800 border-b-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-white dark:bg-gray-900 shadow-md">
                          {getArtifactIcon(artifactType)}
                        </div>
                        <div>
                          <CardTitle className="text-2xl font-bold capitalize tracking-tight">
                            {artifactType}
                          </CardTitle>
                          {artifact.confidence && (
                            <CardDescription className="text-sm mt-1.5 font-medium">
                              Confidence: <span className="text-green-600 dark:text-green-400 font-bold">
                                {(artifact.confidence * 100).toFixed(0)}%
                              </span>
                            </CardDescription>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {artifact.model && (
                          <Badge variant="outline" className="text-xs font-mono px-3 py-1">
                            {artifact.model}
                          </Badge>
                        )}
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleEditArtifact(artifact)}
                          className="gap-2"
                          aria-label={`Edit ${artifactType} artifact`}
                        >
                          <Edit className="h-4 w-4" />
                          Edit
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleViewHistory(artifact)}
                          className="gap-2"
                          aria-label={`View ${artifactType} edit history`}
                          disabled={!artifact.id}
                        >
                          <HistoryIcon className="h-4 w-4" />
                          History
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleCopyArtifact(artifactType, artifactData)}
                          className="gap-2"
                          aria-label={`Copy ${artifactType} artifact data`}
                        >
                          {copiedArtifactId === artifactType ? (
                            <>
                              <Check className="h-4 w-4 text-green-600" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4" />
                              Copy
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-8 pb-6 px-8">
                    <EnhancedArtifactViewer
                      type={artifactType}
                      data={artifactData}
                      confidence={artifact.confidence}
                      onExport={() => handleCopyArtifact(artifactType, artifactData)}
                    />
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
              {loadingRateCards ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading rate cards...
                </div>
              ) : rateCards.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600 mb-3">
                    {rateCards.length} rate card{rateCards.length !== 1 ? 's' : ''} extracted from this contract
                  </p>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium text-gray-700">Role</th>
                          <th className="px-4 py-2 text-left font-medium text-gray-700">Seniority</th>
                          <th className="px-4 py-2 text-right font-medium text-gray-700">Daily Rate</th>
                          <th className="px-4 py-2 text-left font-medium text-gray-700">Supplier</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rateCards.map((card, idx) => (
                          <tr key={card.id || idx} className="border-t hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900">{card.roleStandardized || card.roleOriginal}</div>
                              {card.roleOriginal !== card.roleStandardized && (
                                <div className="text-xs text-gray-500">Original: {card.roleOriginal}</div>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant={
                                card.seniority === 'SENIOR' ? 'default' :
                                card.seniority === 'PRINCIPAL' ? 'secondary' : 'outline'
                              }>
                                {card.seniority}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-right font-medium">
                              {card.currency} {card.dailyRate?.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-gray-600">
                              {card.supplierName || 'N/A'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  {dataMode === 'real' ? 'No rate cards found for this contract' : 'Sample rate cards displayed'}
                </p>
              )}
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

    {/* Keyboard Shortcuts Help Dialog */}
    <KeyboardShortcutsHelp
      open={showShortcutsHelp}
      onOpenChange={setShowShortcutsHelp}
      shortcuts={shortcuts}
    />

    {/* Artifact Editor Dialog */}
    {editingArtifact && contract && (
      <ArtifactEditor
        artifact={editingArtifact}
        contractId={contract.id}
        onSave={handleSaveArtifact}
        onCancel={handleCancelEdit}
      />
    )}

    {/* Artifact History Dialog */}
    {showHistory && historyArtifact && contract && (
      <ArtifactHistory
        open={showHistory}
        onOpenChange={setShowHistory}
        contractId={contract.id}
        artifactId={historyArtifact.id || ''}
        artifactType={historyArtifact.type}
      />
    )}
    </>
  );
}
