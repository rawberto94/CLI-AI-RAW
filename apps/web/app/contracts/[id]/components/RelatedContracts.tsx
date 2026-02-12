'use client'

import React, { memo, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { getTenantId } from '@/lib/tenant';
import { formatCurrency, formatDate } from '@/lib/design-tokens'
import Link from 'next/link'
import {
  FileText,
  ChevronRight,
  Users,
  Calendar,
  DollarSign,
  ArrowRight,
  RefreshCw,
  Layers,
} from 'lucide-react'

interface RelatedContract {
  id: string
  filename: string
  status: string
  contractType?: string
  clientName?: string
  totalValue?: number
  currency?: string
  expirationDate?: string
  similarity?: number // 0-100 score
  relationshipType: 'similar' | 'same-client' | 'same-category' | 'amendment' | 'renewal'
}

interface RelatedContractsProps {
  contractId: string
  clientName?: string
  categoryId?: string
  className?: string
}

const relationshipLabels: Record<string, { label: string; color: string }> = {
  'similar': { label: 'Similar Terms', color: 'bg-violet-100 text-violet-700' },
  'same-client': { label: 'Same Client', color: 'bg-violet-100 text-violet-700' },
  'same-category': { label: 'Same Category', color: 'bg-slate-100 text-slate-700' },
  'amendment': { label: 'Amendment', color: 'bg-amber-100 text-amber-700' },
  'renewal': { label: 'Renewal', color: 'bg-violet-100 text-violet-700' },
}

const ContractCard = memo(function ContractCard({ contract }: { contract: RelatedContract }) {
  const relationship = relationshipLabels[contract.relationshipType] || relationshipLabels.similar
  
  return (
    <Link href={`/contracts/${contract.id}`}>
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="p-3 rounded-lg border border-slate-200 hover:border-slate-300 hover:shadow-sm bg-white transition-all cursor-pointer group"
      >
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center shrink-0">
            <FileText className="h-4 w-4 text-violet-600" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-medium text-slate-800 truncate group-hover:text-violet-600 transition-colors">
                {contract.filename}
              </p>
              <ChevronRight className="h-4 w-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </div>
            
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              <Badge className={cn("text-[10px] font-medium border-0", relationship.color)}>
                {relationship.label}
              </Badge>
              {contract.similarity && contract.similarity >= 70 && (
                <Badge variant="outline" className="text-[10px] border-slate-200">
                  {contract.similarity}% match
                </Badge>
              )}
            </div>
            
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
              {contract.clientName && (
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  <span className="truncate max-w-[100px]">{contract.clientName}</span>
                </span>
              )}
              {contract.totalValue && (
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  {formatCurrency(contract.totalValue, contract.currency || 'USD')}
                </span>
              )}
              {contract.expirationDate && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(contract.expirationDate)}
                </span>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  )
})

const LoadingSkeleton = memo(function LoadingSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="p-3 rounded-lg border border-slate-200">
          <div className="flex items-start gap-3">
            <Skeleton className="w-9 h-9 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
})

export const RelatedContracts = memo(function RelatedContracts({
  contractId,
  clientName,
  categoryId,
  className,
}: RelatedContractsProps) {
  const [contracts, setContracts] = useState<RelatedContract[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const fetchRelated = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (clientName) params.append('clientName', clientName)
      if (categoryId) params.append('categoryId', categoryId)
      
      const response = await fetch(`/api/contracts/${contractId}/related?${params}`, {
        headers: { 'x-tenant-id': getTenantId() }
      })
      
      if (!response.ok) throw new Error('Failed to fetch')
      
      const raw = await response.json()
      const data = raw.data ?? raw
      const list = Array.isArray(data.contracts) ? data.contracts : Array.isArray(data) ? data : []
      setContracts(list)
    } catch (_err) {
      setError('Unable to load related contracts')
      // Fallback to empty for graceful degradation
      setContracts([])
    } finally {
      setLoading(false)
    }
  }
  
  useEffect(() => {
    fetchRelated()
  }, [contractId, clientName, categoryId])
  
  // Don't render if no related contracts and not loading
  if (!loading && contracts.length === 0 && !error) {
    return null
  }
  
  return (
    <Card className={cn("border-slate-200", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Layers className="h-4 w-4 text-violet-500" />
            Related Contracts
            {contracts.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full">
                {contracts.length}
              </span>
            )}
          </CardTitle>
          {!loading && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={fetchRelated}
              className="h-7 w-7 text-slate-400 hover:text-slate-600"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <LoadingSkeleton />
        ) : error ? (
          <div className="text-center py-4">
            <p className="text-sm text-slate-500">{error}</p>
            <Button variant="ghost" size="sm" onClick={fetchRelated} className="mt-2">
              Try again
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {contracts.slice(0, 5).map((contract, idx) => (
                <motion.div
                  key={contract.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <ContractCard contract={contract} />
                </motion.div>
              ))}
            </AnimatePresence>
            
            {contracts.length > 5 && (
              <Link href={`/contracts?relatedTo=${contractId}`}>
                <Button variant="ghost" size="sm" className="w-full text-xs text-slate-500 hover:text-slate-700">
                  View all {contracts.length} related contracts
                  <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Button>
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
})
