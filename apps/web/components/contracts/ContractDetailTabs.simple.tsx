'use client'

import React, { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FileText, DollarSign, Sparkles, Loader2 } from 'lucide-react'
import type { Contract, Artifact } from '@/types/artifacts'

interface ContractDetailTabsProps {
  contract: Contract | null
  artifacts?: Artifact[]
  initialTab?: string
}

export function ContractDetailTabs({ 
  contract, 
  artifacts = [],
  initialTab = 'overview' 
}: ContractDetailTabsProps) {
  const [activeTab, setActiveTab] = useState(initialTab)

  if (!contract) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="w-full">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="financial" className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Financial
          </TabsTrigger>
          <TabsTrigger value="artifacts" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Artifacts
          </TabsTrigger>
          <TabsTrigger value="insights" className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            AI Insights
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Contract Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold">Contract Name</h3>
                  <p className="text-gray-600">{contract.name || 'Untitled Contract'}</p>
                </div>
                <div>
                  <h3 className="font-semibold">Status</h3>
                  <Badge variant={contract.status === 'completed' ? 'default' : 'secondary'}>
                    {contract.status}
                  </Badge>
                </div>
                <div>
                  <h3 className="font-semibold">Supplier</h3>
                  <p className="text-gray-600">{contract.supplier || 'N/A'}</p>
                </div>
                <div>
                  <h3 className="font-semibold">Total Value</h3>
                  <p className="text-gray-600">{contract.totalValue ? `$${contract.totalValue.toLocaleString()}` : 'N/A'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financial" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Financial Information</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Financial analysis will be displayed here when available.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="artifacts" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Generated Artifacts</CardTitle>
            </CardHeader>
            <CardContent>
              {artifacts.length > 0 ? (
                <div className="space-y-4">
                  {artifacts.map((artifact, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <h4 className="font-semibold">{artifact.type || 'Artifact'}</h4>
                      <p className="text-sm text-gray-600">
                        Type: {artifact.type}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600">No artifacts generated yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>AI-Powered Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">AI insights will be displayed here when available.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}