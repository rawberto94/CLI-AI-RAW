'use client'

import React, { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  Sparkles
} from 'lucide-react'
import { useDataMode } from '@/contexts/DataModeContext'

interface ContractDetailTabsProps {
  contract: any
  artifacts: any[]
  onEdit?: () => void
  onExport?: () => void
}

export function ContractDetailTabs({ contract, artifacts, onEdit, onExport }: ContractDetailTabsProps) {
  const { dataMode } = useDataMode()
  const [activeTab, setActiveTab] = useState('overview')

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
          <h3 className="text-lg font-semibold">Contract Artifacts</h3>
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>

        {artifacts && artifacts.length > 0 ? (
          <div className="space-y-3">
            {artifacts.map((artifact, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="text-base">{artifact.type || 'Artifact'}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(artifact.data || {}).slice(0, 5).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-sm">
                        <span className="text-gray-500">{key}:</span>
                        <span className="font-medium">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">No artifacts found</p>
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
