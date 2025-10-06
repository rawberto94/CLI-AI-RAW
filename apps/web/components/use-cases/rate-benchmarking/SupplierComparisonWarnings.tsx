'use client'

import React from 'react'
import { AlertCircle, Info, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface SupplierComparisonWarningsProps {
  supplierCount: number
  totalRateCards: number
  onClearFilters: () => void
}

export function SupplierComparisonWarnings({
  supplierCount,
  totalRateCards,
  onClearFilters
}: SupplierComparisonWarningsProps) {
  // No data at all
  if (supplierCount === 0) {
    return (
      <Card className="mb-6 border-yellow-200 bg-yellow-50">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-yellow-900 mb-2">No Suppliers Match Your Filters</h3>
              <p className="text-yellow-800 mb-4">
                Try adjusting your filters to see supplier comparison data. Consider broadening your search criteria.
              </p>
              <Button 
                onClick={onClearFilters}
                variant="outline"
                className="border-yellow-300 text-yellow-900 hover:bg-yellow-100"
              >
                <X className="w-4 h-4 mr-2" />
                Clear All Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }
  
  // Only one supplier
  if (supplierCount === 1) {
    return (
      <Card className="mb-6 border-blue-200 bg-blue-50">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <Info className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 mb-2">Insufficient Data for Comparison</h3>
              <p className="text-blue-800 mb-4">
                Only 1 supplier matches your filters. Comparison requires at least 2 suppliers. Try broadening your filters to see more suppliers.
              </p>
              <Button 
                onClick={onClearFilters}
                variant="outline"
                className="border-blue-300 text-blue-900 hover:bg-blue-100"
              >
                Broaden Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }
  
  // Limited data warning
  if (totalRateCards < 10) {
    return (
      <Card className="mb-6 border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-blue-800 text-sm">
                <span className="font-semibold">Limited data available ({totalRateCards} rate cards).</span> Results may not be statistically significant. Consider broadening filters for more comprehensive comparison.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }
  
  return null
}
