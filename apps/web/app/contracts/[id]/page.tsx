'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useDataMode } from '@/contexts/DataModeContext'
import { ContractDetailTabs } from '@/components/contracts/ContractDetailTabs'
import { ExportMenu } from '@/components/contracts/ExportMenu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import Link from 'next/link'

export default function ContractDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { dataMode, isRealData } = useDataMode()
  const [contract, setContract] = useState<any>(null)
  const [artifacts, setArtifacts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadContract()
  }, [params.id, dataMode])

  const loadContract = async () => {
    setLoading(true)
    try {
      if (isRealData) {
        // Load real data
        const response = await fetch(`/api/contracts/${params.id}`, {
          headers: { 'x-data-mode': dataMode }
        })
        const data = await response.json()
        
        // Set contract data
        setContract({
          id: data.id,
          name: data.filename,
          status: data.status,
          supplier: data.extractedData?.overview?.parties?.find((p: any) => p.role === 'provider')?.name || 'N/A',
          totalValue: data.extractedData?.financial?.totalValue || 0,
          potentialSavings: 0,
          startDate: data.extractedData?.overview?.startDate || 'N/A',
          endDate: data.extractedData?.overview?.endDate || 'N/A'
        })
        
        // Transform extracted data into artifacts array
        const artifactsArray = []
        if (data.extractedData?.overview) {
          artifactsArray.push({
            type: 'overview',
            data: data.extractedData.overview,
            confidence: data.extractedData.overview.confidence || 0.95,
            model: data.extractedData.overview.model
          })
        }
        if (data.extractedData?.clauses) {
          artifactsArray.push({
            type: 'clauses',
            data: data.extractedData.clauses,
            confidence: data.extractedData.clauses.confidence || 0.88,
            model: data.extractedData.clauses.model
          })
        }
        if (data.extractedData?.financial) {
          artifactsArray.push({
            type: 'financial',
            data: data.extractedData.financial,
            confidence: data.extractedData.financial.confidence || 0.85,
            model: data.extractedData.financial.model
          })
        }
        if (data.extractedData?.risk) {
          artifactsArray.push({
            type: 'risk',
            data: data.extractedData.risk,
            confidence: data.extractedData.risk.confidence || 0.87,
            model: data.extractedData.risk.model
          })
        }
        if (data.extractedData?.compliance) {
          artifactsArray.push({
            type: 'compliance',
            data: data.extractedData.compliance,
            confidence: data.extractedData.compliance.confidence || 0.83,
            model: data.extractedData.compliance.model
          })
        }
        
        setArtifacts(artifactsArray)
      } else {
        // Mock/AI data
        setContract({
          id: params.id,
          name: `Contract ${params.id}`,
          status: 'Active',
          supplier: 'Acme Corp',
          totalValue: 1250000,
          potentialSavings: 187500,
          startDate: '2024-01-01',
          endDate: '2025-12-31'
        })
        setArtifacts([
          { type: 'Rate Card', data: { role: 'Developer', rate: 150, currency: 'USD' } },
          { type: 'Terms', data: { paymentTerms: 'Net 30', renewalNotice: '90 days' } }
        ])
      }
    } catch (error) {
      console.error('Failed to load contract:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/contracts">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{contract?.name || 'Contract'}</h1>
            <p className="text-gray-500 mt-1">
              Contract ID: {params.id}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={contract?.status === 'Active' ? 'default' : 'secondary'}>
            {contract?.status || 'Unknown'}
          </Badge>
          <Button variant="outline" size="sm" onClick={loadContract}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <ExportMenu contractId={params.id as string} contractName={contract?.name} />
        </div>
      </div>

      {/* Tabs */}
      <ContractDetailTabs
        contract={contract}
        artifacts={artifacts}
        onEdit={() => router.push(`/contracts/${params.id}/edit`)}
        onExport={() => {}}
      />
    </div>
  )
}
