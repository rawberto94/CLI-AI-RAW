'use client'

import { X, Search, Calendar, DollarSign, Users, Tag } from 'lucide-react'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { slideInRight, fadeIn } from '@/lib/contracts/animations'
import { CONTRACT_STATUS_OPTIONS, CONTRACT_TYPE_OPTIONS, RISK_LEVEL_OPTIONS } from '@/lib/contracts/filters'
import { cn } from '@/lib/utils'

export interface AdvancedSearchCriteria {
  query?: string
  statuses?: string[]
  types?: string[]
  riskLevels?: string[]
  dateRange?: {
    from?: Date
    to?: Date
  }
  valueRange?: {
    min?: number
    max?: number
  }
  parties?: string
  tags?: string[]
}

export interface AdvancedSearchModalProps {
  isOpen: boolean
  onClose: () => void
  onSearch: (criteria: AdvancedSearchCriteria) => void
  initialCriteria?: AdvancedSearchCriteria
}

export function AdvancedSearchModal({
  isOpen,
  onClose,
  onSearch,
  initialCriteria = {}
}: AdvancedSearchModalProps) {
  const [criteria, setCriteria] = useState<AdvancedSearchCriteria>(initialCriteria)

  const handleSearch = () => {
    onSearch(criteria)
    onClose()
  }

  const handleReset = () => {
    setCriteria({})
  }

  const updateCriteria = (key: keyof AdvancedSearchCriteria, value: any) => {
    setCriteria(prev => ({ ...prev, [key]: value }))
  }

  const toggleArrayValue = (key: 'statuses' | 'types' | 'riskLevels' | 'tags', value: string) => {
    const currentArray = criteria[key] || []
    const newArray = currentArray.includes(value)
      ? currentArray.filter(v => v !== value)
      : [...currentArray, value]
    updateCriteria(key, newArray.length > 0 ? newArray : undefined)
  }

  const hasAnyCriteria = Object.values(criteria).some(value => {
    if (Array.isArray(value)) return value.length > 0
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).some(v => v !== undefined && v !== null)
    }
    return value !== undefined && value !== null && value !== ''
  })

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              variants={slideInRight}
              initial="initial"
              animate="animate"
              exit="exit"
              className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <Search className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Advanced Search</h2>
                    <p className="text-sm text-gray-500">Search contracts with multiple criteria</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Text Search */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Search Query
                  </label>
                  <input
                    type="text"
                    value={criteria.query || ''}
                    onChange={(e) => updateCriteria('query', e.target.value || undefined)}
                    placeholder="Search by name, content, or keywords..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>

                {/* Status Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {CONTRACT_STATUS_OPTIONS.map(option => (
                      <button
                        key={option.value}
                        onClick={() => toggleArrayValue('statuses', option.value)}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                          criteria.statuses?.includes(option.value)
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Type Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contract Type
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {CONTRACT_TYPE_OPTIONS.map(option => (
                      <button
                        key={option.value}
                        onClick={() => toggleArrayValue('types', option.value)}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                          criteria.types?.includes(option.value)
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Risk Level Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Risk Level
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {RISK_LEVEL_OPTIONS.map(option => (
                      <button
                        key={option.value}
                        onClick={() => toggleArrayValue('riskLevels', option.value)}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                          criteria.riskLevels?.includes(option.value)
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Date Range */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Date Range
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">From</label>
                      <input
                        type="date"
                        value={criteria.dateRange?.from ? format(criteria.dateRange.from, 'yyyy-MM-dd') : ''}
                        onChange={(e) => {
                          const date = e.target.value ? new Date(e.target.value) : undefined
                          updateCriteria('dateRange', {
                            ...criteria.dateRange,
                            from: date
                          })
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">To</label>
                      <input
                        type="date"
                        value={criteria.dateRange?.to ? format(criteria.dateRange.to, 'yyyy-MM-dd') : ''}
                        onChange={(e) => {
                          const date = e.target.value ? new Date(e.target.value) : undefined
                          updateCriteria('dateRange', {
                            ...criteria.dateRange,
                            to: date
                          })
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Value Range */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Contract Value Range
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Minimum</label>
                      <input
                        type="number"
                        value={criteria.valueRange?.min || ''}
                        onChange={(e) => {
                          const value = e.target.value ? parseFloat(e.target.value) : undefined
                          updateCriteria('valueRange', {
                            ...criteria.valueRange,
                            min: value
                          })
                        }}
                        placeholder="0"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Maximum</label>
                      <input
                        type="number"
                        value={criteria.valueRange?.max || ''}
                        onChange={(e) => {
                          const value = e.target.value ? parseFloat(e.target.value) : undefined
                          updateCriteria('valueRange', {
                            ...criteria.valueRange,
                            max: value
                          })
                        }}
                        placeholder="No limit"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Parties */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Parties
                  </label>
                  <input
                    type="text"
                    value={criteria.parties || ''}
                    onChange={(e) => updateCriteria('parties', e.target.value || undefined)}
                    placeholder="Search by party name..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Tag className="w-4 h-4" />
                    Tags
                  </label>
                  <input
                    type="text"
                    value={criteria.tags?.join(', ') || ''}
                    onChange={(e) => {
                      const tags = e.target.value
                        .split(',')
                        .map(t => t.trim())
                        .filter(t => t.length > 0)
                      updateCriteria('tags', tags.length > 0 ? tags : undefined)
                    }}
                    placeholder="Enter tags separated by commas..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                  <p className="mt-1 text-xs text-gray-500">Separate multiple tags with commas</p>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={handleReset}
                  disabled={!hasAnyCriteria}
                  className={cn(
                    'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                    hasAnyCriteria
                      ? 'text-gray-700 hover:bg-gray-200'
                      : 'text-gray-400 cursor-not-allowed'
                  )}
                >
                  Reset All
                </button>
                <div className="flex items-center gap-3">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSearch}
                    className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Search className="w-4 h-4" />
                    Search
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
