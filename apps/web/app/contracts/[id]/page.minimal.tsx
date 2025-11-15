'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'
import type { Contract } from '@/types/artifacts'

export default function ContractDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [contract, setContract] = useState<Contract | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Simple mock data loading
    const loadContract = () => {
      setTimeout(() => {
        setContract({
          id: params.id as string,
          name: 'Statement of Work Corporate (repaired)',
          status: 'completed',
          supplier: 'Corporate Services Ltd',
          totalValue: 150000,
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        })
        setLoading(false)
      }, 1000)
    }

    loadContract()
  }, [params.id])

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span className="ml-2">Loading contract...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center text-red-600">
          <p>Error loading contract: {error}</p>
        </div>
      </div>
    )
  }

  if (!contract) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <p>Contract not found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/contracts">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Contracts
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{contract.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={contract.status === 'completed' ? 'default' : 'secondary'}>
                {contract.status}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Simple Contract Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Contract Information</h2>
          <div className="space-y-2">
            <div>
              <span className="font-medium">Contract ID:</span>
              <span className="ml-2 text-gray-600">{contract.id}</span>
            </div>
            <div>
              <span className="font-medium">Supplier:</span>
              <span className="ml-2 text-gray-600">{contract.supplier || 'N/A'}</span>
            </div>
            <div>
              <span className="font-medium">Total Value:</span>
              <span className="ml-2 text-gray-600">
                {contract.totalValue ? `$${contract.totalValue.toLocaleString()}` : 'N/A'}
              </span>
            </div>
            <div>
              <span className="font-medium">Start Date:</span>
              <span className="ml-2 text-gray-600">{contract.startDate || 'N/A'}</span>
            </div>
            <div>
              <span className="font-medium">End Date:</span>
              <span className="ml-2 text-gray-600">{contract.endDate || 'N/A'}</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Quick Actions</h2>
          <div className="space-y-2">
            <Button variant="outline" className="w-full justify-start">
              View Full Analysis
            </Button>
            <Button variant="outline" className="w-full justify-start">
              Export Contract
            </Button>
            <Button variant="outline" className="w-full justify-start">
              Edit Details
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}