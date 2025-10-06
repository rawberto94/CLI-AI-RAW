'use client'

import React from 'react'
import { RateCardRole } from '@/lib/use-cases/multi-client-rate-data'
import { NegotiationPrepDashboard } from './NegotiationPrepDashboard'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

interface NegotiationPrepModalProps {
  isOpen: boolean
  onClose: () => void
  role: string
  level: string
  location: string
  supplier: string
  client?: string
  currentRate: number
  annualVolume?: number
  marketData: RateCardRole[]
}

export function NegotiationPrepModal({
  isOpen,
  onClose,
  role,
  level,
  location,
  supplier,
  client,
  currentRate,
  annualVolume,
  marketData
}: NegotiationPrepModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Negotiation Preparation</DialogTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <NegotiationPrepDashboard
          role={role}
          level={level}
          location={location}
          supplier={supplier}
          client={client}
          currentRate={currentRate}
          annualVolume={annualVolume}
          marketData={marketData}
        />
      </DialogContent>
    </Dialog>
  )
}
