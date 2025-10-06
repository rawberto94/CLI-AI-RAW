'use client'

import React from 'react'
import { AlertCircle, CheckCircle, Info } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface ComparisonContextBannerProps {
  selectedCountry: string | null
  selectedService: string | null
  selectedStandardizedRole: string | null
  selectedSupplier: string | null
  searchQuery: string
  totalMatches: number
  supplierCount: number
}

export function ComparisonContextBanner({
  selectedCountry,
  selectedService,
  selectedStandardizedRole,
  selectedSupplier,
  searchQuery,
  totalMatches,
  supplierCount
}: ComparisonContextBannerProps) {
  // Build filter context
  const filters: string[] = []
  
  if (selectedStandardizedRole) filters.push(selectedStandardizedRole)
  if (selectedCountry) filters.push(selectedCountry)
  if (selectedService) filters.push(selectedService)
  if (selectedSupplier) filters.push(`Supplier: ${selectedSupplier}`)
  if (searchQuery) filters.push(`Search: "${searchQuery}"`)
  
  const hasSpecificFilters = filters.length >= 2 // At least role + location or role + service
  const displayText = filters.length > 0 
    ? filters.join(' | ') 
    : 'All Roles, All Locations, All Services'
  
  // Determine warning level
  let warningLevel: 'success' | 'warning' | 'info' = 'info'
  let warningMessage = ''
  let Icon = Info
  
  if (filters.length === 0) {
    warningLevel = 'warning'
    warningMessage = 'Comparing all data - not apple-to-apple. Apply filters for meaningful comparison.'
    Icon = AlertCircle
  } else if (hasSpecificFilters) {
    warningLevel = 'success'
    warningMessage = 'Apple-to-apple comparison active'
    Icon = CheckCircle
  } else {
    warningLevel = 'info'
    warningMessage = 'Consider adding more filters for better comparison'
    Icon = Info
  }
  
  // Styling based on warning level
  const bgColor = {
    success: 'bg-green-50 border-green-200',
    warning: 'bg-yellow-50 border-yellow-200',
    info: 'bg-blue-50 border-blue-200'
  }[warningLevel]
  
  const textColor = {
    success: 'text-green-800',
    warning: 'text-yellow-800',
    info: 'text-blue-800'
  }[warningLevel]
  
  const iconColor = {
    success: 'text-green-600',
    warning: 'text-yellow-600',
    info: 'text-blue-600'
  }[warningLevel]
  
  return (
    <div className={`rounded-lg border p-4 ${bgColor} mb-4`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${iconColor}`} />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`font-semibold ${textColor}`}>
              Comparing: {displayText}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className={textColor}>
              {supplierCount} {supplierCount === 1 ? 'supplier' : 'suppliers'} • {totalMatches} rate {totalMatches === 1 ? 'card' : 'cards'}
            </span>
            {warningMessage && (
              <>
                <span className={textColor}>•</span>
                <span className={textColor}>{warningMessage}</span>
              </>
            )}
          </div>
        </div>
        {warningLevel === 'success' && (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            Valid Comparison
          </Badge>
        )}
      </div>
    </div>
  )
}
