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
import { detailUi } from './detail-ui'

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
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.99 }}
        className={cn(detailUi.fieldCell, 'cursor-pointer group hover:border-violet-200')}
      >
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center shrink-0">
            <FileText className="h-4 w-4 text-violet-600" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className={cn(detailUi.fieldValue, 'truncate group-hover:text-violet-700 transition-colors')}>
                {contract.filename}
              </p>
              <ChevronRight className="h-4 w-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </div>
            
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              <Badge className={cn(detailUi.fieldBadge, "border-0", relationship.color)}>
                {relationship.label}
              </Badge>
              {contract.similarity && contract.similarity >= 70 && (
                <Badge variant="outline" className={cn(detailUi.fieldBadge, 'border-slate-200')}>
                  {contract.similarity}% match
                </Badge>
              )}
            </div>
            
            <div className="flex flex-wrap items-center gap-3 text-xs leading-4 text-slate-500">
              {contract.clientName && (
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  <span className="truncate max-w-[100px]">{contract.clientName}</span>
                </span>
              )}
              {contract.totalValue && (
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  {formatCurrency(contract.totalValue, contract.currency || 'CHF')}
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
    <div className="space-y-2.5">
      {[1, 2, 3].map((i) => (
        <div key={i} className={detailUi.fieldCell}>
          <div className="flex items-start gap-3">
            <Skeleton className="w-9 h-9 rounded-xl" />
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
    <Card className={cn(detailUi.card, className)}>
      <CardHeader className={detailUi.cardHeader}>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className={detailUi.cardTitle}>
            <Layers className="h-4 w-4 text-violet-500" />
            Related Contracts
            {contracts.length > 0 && (
              <span className="ml-0.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs font-medium leading-4 text-slate-600">
                {contracts.length}
              </span>
            )}
          </CardTitle>
          {!loading && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={fetchRelated}
              className="h-8 w-8 text-slate-400 hover:text-slate-600"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className={detailUi.cardContent}>
        {loading ? (
          <LoadingSkeleton />
        ) : error ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center">
            <p className={detailUi.fieldEmpty}>{error}</p>
            <Button variant="ghost" size="sm" onClick={fetchRelated} className={cn(detailUi.headerBtn, 'mt-2')}>
              Try again
            </Button>
          </div>
        ) : (
          <div className="space-y-2.5">
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
