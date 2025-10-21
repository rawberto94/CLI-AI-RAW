'use client'

import React, { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import {
  Search,
  Filter,
  Download,
  TrendingUp,
  TrendingDown,
  MapPin,
  Briefcase,
  Building2,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Calculator,
  BarChart3,
  DollarSign,
  PieChart,
  Users,
  AlertCircle,
  Upload,
  Plus,
  Target
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ClientSelector } from '@/components/use-cases/rate-benchmarking/ClientSelector'
import { CompetitiveBandBadge } from '@/components/use-cases/rate-benchmarking/DailyRateDisplay'
import { ComparisonContextBanner } from '@/components/use-cases/rate-benchmarking/ComparisonContextBanner'
import { DataQualityBadge } from '@/components/use-cases/rate-benchmarking/DataQualityBadge'
import { CompetitivenessIndicator } from '@/components/use-cases/rate-benchmarking/CompetitivenessIndicator'
import { ExpandableRateCards } from '@/components/use-cases/rate-benchmarking/ExpandableRateCards'
import { SupplierComparisonWarnings } from '@/components/use-cases/rate-benchmarking/SupplierComparisonWarnings'
import EnhancedSavingsCalculator from '@/components/use-cases/rate-benchmarking/EnhancedSavingsCalculator'
import MarketIntelligenceEngine from '@/components/use-cases/rate-benchmarking/MarketIntelligenceEngine'
import { allClients, allRateCardRoles } from '@/lib/use-cases/multi-client-rate-data'
import { formatCHF } from '@/lib/use-cases/rate-normalizer'
import { DataModeToggle, DataModeBanner } from '@/components/ui/data-mode-toggle'
import { useRateBenchmarkingData } from '@/hooks/useRateBenchmarkingData'

type SortField = 'role' | 'supplier' | 'country' | 'service' | 'rate' | 'variance' | 'standardizedRole'
type SortDirection = 'asc' | 'desc'
type StandardizedRole = 'Associate' | 'Senior Associate' | 'Manager' | 'Senior Manager' | 'Director' | 'Partner'

// Deterministic pseudo-random function based on role ID
const getMarketVariance = (roleId: string): number => {
  let hash = 0
  for (let i = 0; i < roleId.length; i++) {
    hash = ((hash << 5) - hash) + roleId.charCodeAt(i)
    hash = hash & hash
  }
  // Convert to 0-1 range
  return Math.abs(hash % 100) / 100
}

// Function to standardize role levels
const getStandardizedRole = (role: string, level: string): StandardizedRole => {
  const roleLower = role.toLowerCase()
  const levelLower = level.toLowerCase()
  const combined = `${roleLower} ${levelLower}`

  // Partner level
  if (combined.includes('partner') || combined.includes('principal')) {
    return 'Partner'
  }
  
  // Director level
  if (combined.includes('director') || combined.includes('vp') || combined.includes('vice president')) {
    return 'Director'
  }
  
  // Senior Manager level
  if (combined.includes('senior manager') || combined.includes('sr manager') || combined.includes('lead')) {
    return 'Senior Manager'
  }
  
  // Manager level
  if (combined.includes('manager') && !combined.includes('senior')) {
    return 'Manager'
  }
  
  // Senior Associate level
  if (combined.includes('senior') || combined.includes('sr.') || levelLower === 'senior') {
    return 'Senior Associate'
  }
  
  // Default to Associate
  return 'Associate'
}

export default function RateBenchmarkingPage() {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null)
  const [selectedService, setSelectedService] = useState<string | null>(null)
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null)
  const [selectedStandardizedRole, setSelectedStandardizedRole] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [sortField, setSortField] = useState<SortField>('role')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set())
  const [quickFilter, setQuickFilter] = useState<string | null>(null)
  const [showCharts, setShowCharts] = useState(false)
  const [showSupplierComparison, setShowSupplierComparison] = useState(false)
  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(new Set())
  const [mounted, setMounted] = useState(false)
  const [currentTime, setCurrentTime] = useState<number>(0)
  const [viewMode, setViewMode] = useState<'individual' | 'grouped'>('grouped')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const itemsPerPage = 25

  // Fix hydration by only running on client
  useEffect(() => {
    setMounted(true)
    setCurrentTime(Date.now())
  }, [])

  // Get unique countries, services, and suppliers
  const countries = useMemo(() => {
    const unique = new Set(allRateCardRoles.map((r) => r.location))
    return Array.from(unique).sort()
  }, [])

  const services = useMemo(() => {
    const unique = new Set(allRateCardRoles.map((r) => r.serviceLine))
    return Array.from(unique).sort()
  }, [])

  const suppliers = useMemo(() => {
    const unique = new Set(allRateCardRoles.map((r) => r.supplierName))
    return Array.from(unique).sort()
  }, [])

  const standardizedRoles = useMemo(() => {
    const unique = new Set(allRateCardRoles.map((r) => getStandardizedRole(r.role, r.level)))
    return Array.from(unique).sort()
  }, [])

  // Calculate target rate (average of all YOUR rates) for each role/level/location/service combination
  // This must be calculated BEFORE filteredRoles since it's used in quick filters
  const targetRateMap = useMemo(() => {
    const ratesMap = new Map<string, number[]>()
    
    // Use all roles (respects client selection) to calculate YOUR average
    const rolesToConsider = selectedClientId ? allRateCardRoles.filter(r => r.clientId === selectedClientId) : allRateCardRoles
    
    rolesToConsider.forEach(role => {
      // Key without supplier to get average across all suppliers
      const key = `${role.role}-${role.level}-${role.location}-${role.serviceLine}`
      
      if (!ratesMap.has(key)) {
        ratesMap.set(key, [])
      }
      ratesMap.get(key)!.push(role.dailyRateCHF)
    })
    
    // Calculate average for each role combination
    const targetMap = new Map<string, number>()
    ratesMap.forEach((rates, key) => {
      const average = rates.reduce((sum, rate) => sum + rate, 0) / rates.length
      targetMap.set(key, average)
    })
    
    return targetMap
  }, [selectedClientId])

  // Filter data
  const filteredRoles = useMemo(() => {
    let filtered = allRateCardRoles

    if (selectedClientId) {
      filtered = filtered.filter((r) => r.clientId === selectedClientId)
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (r) =>
          r.role.toLowerCase().includes(query) ||
          r.location.toLowerCase().includes(query) ||
          r.serviceLine.toLowerCase().includes(query) ||
          r.clientName.toLowerCase().includes(query) ||
          r.supplierName.toLowerCase().includes(query)
      )
    }

    if (selectedCountry) {
      filtered = filtered.filter((r) => r.location === selectedCountry)
    }

    if (selectedService) {
      filtered = filtered.filter((r) => r.serviceLine === selectedService)
    }

    if (selectedSupplier) {
      filtered = filtered.filter((r) => r.supplierName === selectedSupplier)
    }

    if (selectedStandardizedRole) {
      filtered = filtered.filter((r) => getStandardizedRole(r.role, r.level) === selectedStandardizedRole)
    }

    // Quick filters
    if (quickFilter) {
      filtered = filtered.filter((r) => {
        const targetKey = `${r.role}-${r.level}-${r.location}-${r.serviceLine}`
        const targetRate = targetRateMap.get(targetKey) || r.dailyRateCHF
        const variance = ((r.dailyRateCHF - targetRate) / targetRate) * 100
        
        switch (quickFilter) {
          case 'above-market':
            return variance > 5
          case 'below-market':
            return variance < -5
          case 'high-value':
            return r.dailyRateCHF > 1500
          case 'recent':
            return mounted && currentTime > 0 && new Date(r.lastUpdated) > new Date(currentTime - 30 * 24 * 60 * 60 * 1000)
          default:
            return true
        }
      })
    }

    return filtered
  }, [selectedClientId, searchQuery, selectedCountry, selectedService, selectedSupplier, selectedStandardizedRole, quickFilter, targetRateMap])

  // Group roles by key attributes
  const groupedRoles = useMemo(() => {
    if (viewMode === 'individual') return null

    const groups = new Map<string, any>()
    
    filteredRoles.forEach(role => {
      const key = `${role.role}-${role.level}-${role.supplierName}-${role.location}-${role.serviceLine}`
      
      if (!groups.has(key)) {
        groups.set(key, {
          groupKey: key,
          role: role.role,
          level: role.level,
          supplierName: role.supplierName,
          location: role.location,
          serviceLine: role.serviceLine,
          contracts: [],
          minRate: role.dailyRateCHF,
          maxRate: role.dailyRateCHF,
          avgRate: 0,
          count: 0,
          clients: new Set<string>()
        })
      }
      
      const group = groups.get(key)!
      group.contracts.push(role)
      group.count++
      group.clients.add(role.clientName)
      group.minRate = Math.min(group.minRate, role.dailyRateCHF)
      group.maxRate = Math.max(group.maxRate, role.dailyRateCHF)
      group.avgRate = group.contracts.reduce((sum: number, r: any) => sum + r.dailyRateCHF, 0) / group.count
    })
    
    return Array.from(groups.values())
  }, [filteredRoles, viewMode])

  // Calculate lowest rate from YOUR entries for each role/level/supplier/location/service combination
  const lowestRateMap = useMemo(() => {
    const map = new Map<string, number>()
    
    // Use filtered roles (respects client selection) to find YOUR lowest rates
    const rolesToConsider = selectedClientId ? allRateCardRoles.filter(r => r.clientId === selectedClientId) : allRateCardRoles
    
    rolesToConsider.forEach(role => {
      // Key WITH supplier to find YOUR lowest for this specific supplier
      const key = `${role.role}-${role.level}-${role.supplierName}-${role.location}-${role.serviceLine}`
      const currentLowest = map.get(key)
      
      if (!currentLowest || role.dailyRateCHF < currentLowest) {
        map.set(key, role.dailyRateCHF)
      }
    })
    
    return map
  }, [selectedClientId])

  // Sort data (works for both individual and grouped)
  const sortedRoles = useMemo(() => {
    const dataToSort = viewMode === 'grouped' && groupedRoles ? groupedRoles : filteredRoles
    const sorted = [...dataToSort]

    sorted.sort((a, b) => {
      let aVal: string | number
      let bVal: string | number

      switch (sortField) {
        case 'role':
          aVal = a.role
          bVal = b.role
          break
        case 'supplier':
          aVal = a.supplierName
          bVal = b.supplierName
          break
        case 'country':
          aVal = a.location
          bVal = b.location
          break
        case 'service':
          aVal = a.serviceLine
          bVal = b.serviceLine
          break
        case 'rate':
          aVal = viewMode === 'grouped' ? a.avgRate : a.dailyRateCHF
          bVal = viewMode === 'grouped' ? b.avgRate : b.dailyRateCHF
          break
        case 'variance':
          const aMarket = a.dailyRateCHF * 0.98
          const bMarket = b.dailyRateCHF * 0.98
          aVal = ((a.dailyRateCHF - aMarket) / aMarket) * 100
          bVal = ((b.dailyRateCHF - bMarket) / bMarket) * 100
          break
        case 'standardizedRole':
          aVal = getStandardizedRole(a.role, a.level)
          bVal = getStandardizedRole(b.role, b.level)
          break
        default:
          return 0
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }

      return sortDirection === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })

    return sorted
  }, [filteredRoles, groupedRoles, sortField, sortDirection, viewMode])

  // Paginate data
  const paginatedRoles = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return sortedRoles.slice(startIndex, startIndex + itemsPerPage)
  }, [sortedRoles, currentPage])

  const totalPages = Math.ceil(sortedRoles.length / itemsPerPage)

  // Calculate stats
  const stats = useMemo(() => {
    if (filteredRoles.length === 0) return null

    const rates = filteredRoles.map((r) => r.dailyRateCHF)
    const avgRate = rates.reduce((sum, r) => sum + r, 0) / rates.length

    // Calculate competitive distribution and savings
    let aboveMarket = 0
    let atMarket = 0
    let belowMarket = 0
    let totalSavingsPotential = 0

    filteredRoles.forEach((role) => {
      const targetKey = `${role.role}-${role.level}-${role.location}-${role.serviceLine}`
      const targetRate = targetRateMap.get(targetKey) || role.dailyRateCHF
      const variance = ((role.dailyRateCHF - targetRate) / targetRate) * 100
      
      if (variance > 5) {
        aboveMarket++
        const dailySavings = role.dailyRateCHF - targetRate
        totalSavingsPotential += dailySavings * 260 * (role.fteCount || 1)
      } else if (variance < -5) {
        belowMarket++
      } else {
        atMarket++
      }
    })

    return {
      totalRoles: filteredRoles.length,
      avgRate,
      minRate: Math.min(...rates),
      maxRate: Math.max(...rates),
      aboveMarket,
      atMarket,
      belowMarket,
      totalSavingsPotential,
      selectedCount: selectedRoles.size
    }
  }, [filteredRoles, selectedRoles, targetRateMap])

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedCountry(null)
    setSelectedService(null)
    setSelectedSupplier(null)
    setSelectedStandardizedRole(null)
    setQuickFilter(null)
    setCurrentPage(1)
  }

  // Toggle supplier expansion
  const toggleSupplierExpansion = (supplierName: string) => {
    const newExpanded = new Set(expandedSuppliers)
    if (newExpanded.has(supplierName)) {
      newExpanded.delete(supplierName)
    } else {
      newExpanded.add(supplierName)
    }
    setExpandedSuppliers(newExpanded)
  }

  // Toggle group expansion
  const toggleGroupExpansion = (groupKey: string) => {
    const newExpanded = new Set(expandedGroups)
    if (newExpanded.has(groupKey)) {
      newExpanded.delete(groupKey)
    } else {
      newExpanded.add(groupKey)
    }
    setExpandedGroups(newExpanded)
  }

  // Bulk selection functions
  const toggleRoleSelection = (roleId: string) => {
    const newSelected = new Set(selectedRoles)
    if (newSelected.has(roleId)) {
      newSelected.delete(roleId)
    } else {
      newSelected.add(roleId)
    }
    setSelectedRoles(newSelected)
  }

  const selectAllVisible = () => {
    const visibleIds = new Set(paginatedRoles.map(r => r.id))
    setSelectedRoles(visibleIds)
  }

  const clearSelection = () => {
    setSelectedRoles(new Set())
  }

  const exportSupplierComparison = () => {
    // Build filter context string
    const filters: string[] = []
    if (selectedStandardizedRole) filters.push(selectedStandardizedRole)
    if (selectedCountry) filters.push(selectedCountry)
    if (selectedService) filters.push(selectedService)
    if (selectedSupplier) filters.push(selectedSupplier)
    
    const filterContext = filters.length > 0 ? filters.join('-') : 'all-data'
    const dateStr = new Date().toISOString().split('T')[0]
    
    // Build CSV content
    const csvContent = [
      [`# Supplier Comparison - ${filters.length > 0 ? filters.join(' | ') : 'All Data'}`],
      [`# Generated: ${new Date().toISOString()}`],
      [`# Total Suppliers: ${supplierStats.length}, Total Rate Cards: ${filteredRoles.length}`],
      [''],
      ['Supplier', 'Rate Cards', 'Avg Rate (CHF)', 'Median Rate (CHF)', 'Min Rate (CHF)', 'Max Rate (CHF)', 'Variance %', 'Competitiveness', 'Data Quality'],
      ...supplierStats.map(s => [
        s.supplier,
        s.count,
        s.avgRate.toFixed(0),
        s.medianRate.toFixed(0),
        s.minRate.toFixed(0),
        s.maxRate.toFixed(0),
        s.variance.toFixed(1),
        s.competitivenessRating,
        s.dataQuality
      ])
    ].map(row => row.join(',')).join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `supplier-comparison-${filterContext}-${dateStr}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportSelected = () => {
    const selectedData = allRateCardRoles.filter(r => selectedRoles.has(r.id))
    const csvContent = [
      ['Role', 'Supplier', 'Country', 'Service', 'Daily Rate CHF', 'Client'].join(','),
      ...selectedData.map(r => [
        r.role,
        r.supplierName,
        r.location,
        r.serviceLine,
        r.dailyRateCHF,
        r.clientName
      ].join(','))
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rate-cards-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Supplier comparison data
  const supplierStats = useMemo(() => {
    const stats = new Map<string, { count: number; avgRate: number; aboveMarket: number; totalRates: number[]; rateCards: typeof filteredRoles }>()
    
    filteredRoles.forEach((role) => {
      const supplier = role.supplierName
      if (!stats.has(supplier)) {
        stats.set(supplier, { count: 0, avgRate: 0, aboveMarket: 0, totalRates: [], rateCards: [] })
      }
      const supplierData = stats.get(supplier)!
      supplierData.count++
      supplierData.totalRates.push(role.dailyRateCHF)
      supplierData.rateCards.push(role)
      
      const targetKey = `${role.role}-${role.level}-${role.location}-${role.serviceLine}`
      const targetRate = targetRateMap.get(targetKey) || role.dailyRateCHF
      const variance = ((role.dailyRateCHF - targetRate) / targetRate) * 100
      if (variance > 5) supplierData.aboveMarket++
    })
    
    // Calculate market average for competitiveness rating
    const allRates = filteredRoles.map(r => r.dailyRateCHF)
    const marketAvg = allRates.length > 0 ? allRates.reduce((sum, r) => sum + r, 0) / allRates.length : 0
    
    return Array.from(stats.entries()).map(([supplier, data]) => {
      // Calculate median
      const sortedRates = [...data.totalRates].sort((a, b) => a - b)
      const medianRate = sortedRates.length % 2 === 0
        ? (sortedRates[sortedRates.length / 2 - 1] + sortedRates[sortedRates.length / 2]) / 2
        : sortedRates[Math.floor(sortedRates.length / 2)]
      
      // Calculate average
      const avgRate = data.totalRates.reduce((sum, r) => sum + r, 0) / data.totalRates.length
      
      // Calculate variance from market
      const variance = marketAvg > 0 ? ((avgRate - marketAvg) / marketAvg) * 100 : 0
      
      // Determine competitiveness rating
      let competitivenessRating: 'best-value' | 'competitive' | 'above-market' | 'premium'
      if (variance < -5) competitivenessRating = 'best-value'
      else if (variance <= 5) competitivenessRating = 'competitive'
      else if (variance <= 15) competitivenessRating = 'above-market'
      else competitivenessRating = 'premium'
      
      // Determine data quality
      let dataQuality: 'sufficient' | 'limited' | 'single-point'
      if (data.count === 1) dataQuality = 'single-point'
      else if (data.count < 3) dataQuality = 'limited'
      else dataQuality = 'sufficient'
      
      return {
        supplier,
        count: data.count,
        avgRate,
        medianRate,
        aboveMarketPercent: (data.aboveMarket / data.count) * 100,
        variance,
        minRate: Math.min(...data.totalRates),
        maxRate: Math.max(...data.totalRates),
        competitivenessRating,
        dataQuality,
        rateCards: data.rateCards
      }
    }).sort((a, b) => a.avgRate - b.avgRate) // Sort by best rate first
  }, [filteredRoles, targetRateMap])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
    setCurrentPage(1)
  }

  const activeFilterCount = [selectedCountry, selectedService, selectedSupplier, selectedStandardizedRole, searchQuery, quickFilter].filter(Boolean).length

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Rate Card Benchmarking</h1>
              <p className="text-gray-600 mt-1">Manage and compare rates across multiple clients</p>
            </div>
            <div className="flex items-center gap-3">
              <DataModeToggle showLabel={true} showStats={true} />
              <Link href="/import/rate-cards">
                <Button variant="outline" className="flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Import Rate Cards
                </Button>
              </Link>
              <Link href="/rate-cards/new">
                <Button variant="outline" className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Add Rate Card
                </Button>
              </Link>
              <Link href="/use-cases/negotiation-prep">
                <Button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700">
                  <Target className="w-4 h-4" />
                  Negotiation Prep
                </Button>
              </Link>
              <Badge className="bg-green-100 text-green-800 border-green-200 px-4 py-2">
                All rates in CHF (daily)
              </Badge>
            </div>
          </div>

          {/* Data Mode Banner */}
          <DataModeBanner />

          <ClientSelector
            clients={allClients}
            selectedClientId={selectedClientId}
            onClientChange={setSelectedClientId}
            allowAll={true}
            showStats={true}
          />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <Tabs defaultValue="benchmarking" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="benchmarking">Rate Benchmarking</TabsTrigger>
            <TabsTrigger value="savings">Savings Calculator</TabsTrigger>
            <TabsTrigger value="intelligence">Market Intelligence</TabsTrigger>
            <TabsTrigger value="analytics">Advanced Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="benchmarking" className="space-y-6">
            {/* Stats Bar */}
            {stats && (
          <div className="grid grid-cols-5 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-gray-600">Total Roles</div>
                <div className="text-2xl font-bold text-gray-900">{stats.totalRoles}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {stats.aboveMarket} above • {stats.atMarket} at • {stats.belowMarket} below market
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-gray-600">Average Rate</div>
                <div className="text-2xl font-bold text-blue-600">{formatCHF(stats.avgRate, { decimals: 0 })}/day</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-gray-600">Rate Range</div>
                <div className="text-lg font-bold text-gray-900">
                  {formatCHF(stats.minRate, { decimals: 0 })} - {formatCHF(stats.maxRate, { decimals: 0 })}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
              <CardContent className="p-4">
                <div className="text-sm text-green-700 font-semibold flex items-center gap-1">
                  <DollarSign className="w-4 h-4" />
                  Savings Potential
                </div>
                <div className="text-2xl font-bold text-green-800">
                  {formatCHF(stats.totalSavingsPotential, { decimals: 0 })}
                </div>
                <div className="text-xs text-green-600 mt-1">Annual opportunity</div>
              </CardContent>
            </Card>
            {stats.selectedCount > 0 && (
              <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                <CardContent className="p-4">
                  <div className="text-sm text-blue-700 font-semibold">Selected</div>
                  <div className="text-2xl font-bold text-blue-800">{stats.selectedCount}</div>
                  <div className="text-xs text-blue-600 mt-1">rate cards</div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Quick Actions Bar */}
        <div className="mb-4 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
            <Button
              variant={viewMode === 'grouped' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grouped')}
              className="h-8"
            >
              Grouped View
            </Button>
            <Button
              variant={viewMode === 'individual' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('individual')}
              className="h-8"
            >
              Individual View
            </Button>
          </div>
          <div className="h-6 w-px bg-gray-300" />
          <Button
            variant={showCharts ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowCharts(!showCharts)}
          >
            <PieChart className="w-4 h-4 mr-2" />
            {showCharts ? 'Hide' : 'Show'} Charts
          </Button>
          <Button
            variant={showSupplierComparison ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowSupplierComparison(!showSupplierComparison)}
          >
            <Users className="w-4 h-4 mr-2" />
            Supplier Comparison
          </Button>
          <div className="h-6 w-px bg-gray-300" />
          <span className="text-sm font-medium text-gray-700">Quick Filters:</span>
          <Button
            variant={quickFilter === 'above-market' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setQuickFilter(quickFilter === 'above-market' ? null : 'above-market')}
          >
            <TrendingUp className="w-4 h-4 mr-1" />
            Above Market
          </Button>
          <Button
            variant={quickFilter === 'below-market' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setQuickFilter(quickFilter === 'below-market' ? null : 'below-market')}
          >
            <TrendingDown className="w-4 h-4 mr-1" />
            Below Market
          </Button>
          <Button
            variant={quickFilter === 'high-value' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setQuickFilter(quickFilter === 'high-value' ? null : 'high-value')}
          >
            <BarChart3 className="w-4 h-4 mr-1" />
            High Value
          </Button>
          {quickFilter && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setQuickFilter(null)}
              className="text-gray-500"
            >
              <X className="w-4 h-4 mr-1" />
              Clear
            </Button>
          )}
        </div>

        {/* Visual Charts */}
        {showCharts && stats && (
          <div className="grid grid-cols-2 gap-4 mb-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Market Position Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-600">Above Market</span>
                      <span className="text-sm font-semibold text-red-600">{stats.aboveMarket} ({((stats.aboveMarket / stats.totalRoles) * 100).toFixed(1)}%)</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-red-500 h-2 rounded-full" style={{ width: `${(stats.aboveMarket / stats.totalRoles) * 100}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-600">At Market</span>
                      <span className="text-sm font-semibold text-yellow-600">{stats.atMarket} ({((stats.atMarket / stats.totalRoles) * 100).toFixed(1)}%)</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-yellow-500 h-2 rounded-full" style={{ width: `${(stats.atMarket / stats.totalRoles) * 100}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-600">Below Market</span>
                      <span className="text-sm font-semibold text-green-600">{stats.belowMarket} ({((stats.belowMarket / stats.totalRoles) * 100).toFixed(1)}%)</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-green-500 h-2 rounded-full" style={{ width: `${(stats.belowMarket / stats.totalRoles) * 100}%` }} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Rate Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Minimum</span>
                    <span className="text-lg font-bold text-gray-900">{formatCHF(stats.minRate, { decimals: 0 })}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Average</span>
                    <span className="text-lg font-bold text-blue-600">{formatCHF(stats.avgRate, { decimals: 0 })}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Maximum</span>
                    <span className="text-lg font-bold text-gray-900">{formatCHF(stats.maxRate, { decimals: 0 })}</span>
                  </div>
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Range</span>
                      <span className="text-lg font-bold text-purple-600">{formatCHF(stats.maxRate - stats.minRate, { decimals: 0 })}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Supplier Comparison */}
        {showSupplierComparison && (
          <>
            <ComparisonContextBanner
              selectedCountry={selectedCountry}
              selectedService={selectedService}
              selectedStandardizedRole={selectedStandardizedRole}
              selectedSupplier={selectedSupplier}
              searchQuery={searchQuery}
              totalMatches={filteredRoles.length}
              supplierCount={supplierStats.length}
            />
            <SupplierComparisonWarnings
              supplierCount={supplierStats.length}
              totalRateCards={filteredRoles.length}
              onClearFilters={clearFilters}
            />
            {supplierStats.length >= 2 && (
              <Card className="mb-6">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Supplier Comparison</CardTitle>
                  <Button
                    onClick={exportSupplierComparison}
                    variant="outline"
                    size="sm"
                    disabled={supplierStats.length === 0}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export Comparison
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-gray-200">
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Supplier</th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-700">Rate Cards</th>
                        <th className="text-right py-3 px-4 font-semibold text-gray-700">Avg Rate</th>
                        <th className="text-right py-3 px-4 font-semibold text-gray-700">Median Rate</th>
                        <th className="text-right py-3 px-4 font-semibold text-gray-700">Rate Range</th>
                        <th className="text-right py-3 px-4 font-semibold text-gray-700">Above Market</th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-700">Competitiveness</th>
                      </tr>
                    </thead>
                    <tbody>
                      {supplierStats.map((supplier) => {
                        const isExpanded = expandedSuppliers.has(supplier.supplier)
                        return (
                          <React.Fragment key={supplier.supplier}>
                            <tr 
                              className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                              onClick={() => toggleSupplierExpansion(supplier.supplier)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  toggleSupplierExpansion(supplier.supplier)
                                }
                              }}
                              tabIndex={0}
                              role="button"
                              aria-expanded={isExpanded}
                              aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${supplier.supplier} rate cards`}
                            >
                              <td className="py-3 px-4">
                                <div 
                                  className="flex items-center gap-2"
                                  title={`${supplier.count} rate ${supplier.count === 1 ? 'card' : 'cards'} from clients: ${supplier.rateCards.map(rc => rc.clientName).filter((v, i, a) => a.indexOf(v) === i).join(', ')}`}
                                >
                                  {isExpanded ? (
                                    <ChevronUp className="w-4 h-4 text-gray-400" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4 text-gray-400" />
                                  )}
                                  <Building2 className="w-4 h-4 text-gray-400" />
                                  <span className="font-medium text-gray-900">{supplier.supplier}</span>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <div className="flex items-center justify-center">
                                  <Badge variant="outline">{supplier.count}</Badge>
                                  <DataQualityBadge quality={supplier.dataQuality} count={supplier.count} />
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right font-semibold text-gray-900">
                                {formatCHF(supplier.avgRate, { decimals: 0 })}
                              </td>
                              <td className="py-3 px-4 text-right font-semibold text-blue-600">
                                {formatCHF(supplier.medianRate, { decimals: 0 })}
                              </td>
                              <td className="py-3 px-4 text-right text-sm text-gray-600">
                                {formatCHF(supplier.minRate, { decimals: 0 })} - {formatCHF(supplier.maxRate, { decimals: 0 })}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <span className={`font-semibold ${supplier.aboveMarketPercent > 50 ? 'text-red-600' : supplier.aboveMarketPercent > 25 ? 'text-yellow-600' : 'text-green-600'}`}>
                                  {supplier.aboveMarketPercent.toFixed(0)}%
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <CompetitivenessIndicator 
                                  rating={supplier.competitivenessRating} 
                                  variance={supplier.variance} 
                                />
                              </td>
                            </tr>
                            <ExpandableRateCards 
                              rateCards={supplier.rateCards}
                              isExpanded={isExpanded}
                            />
                          </React.Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
            )}
          </>
        )}

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search roles, suppliers, countries, services, clients..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="relative">
                <Filter className="w-4 h-4 mr-2" />
                Filters
                {activeFilterCount > 0 && <Badge className="ml-2 bg-blue-600 text-white">{activeFilterCount}</Badge>}
              </Button>

              {selectedRoles.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">{selectedRoles.size} selected</span>
                  <Button variant="outline" size="sm" onClick={exportSelected}>
                    <Download className="w-4 h-4 mr-1" />
                    Export Selected
                  </Button>
                  <Button variant="ghost" size="sm" onClick={clearSelection}>
                    <X className="w-4 h-4 mr-1" />
                    Clear
                  </Button>
                </div>
              )}
              
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Export All
              </Button>
            </div>

            {showFilters && (
              <div className="mt-4 pt-4 border-t space-y-4">
                <div className="grid grid-cols-5 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      <MapPin className="w-4 h-4 inline mr-1" />
                      Country
                    </label>
                    <select
                      value={selectedCountry || ''}
                      onChange={(e) => setSelectedCountry(e.target.value || null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">All Countries</option>
                      {countries.map((country) => (
                        <option key={country} value={country}>
                          {country}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      <Briefcase className="w-4 h-4 inline mr-1" />
                      Line of Service
                    </label>
                    <select
                      value={selectedService || ''}
                      onChange={(e) => setSelectedService(e.target.value || null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">All Services</option>
                      {services.map((service) => (
                        <option key={service} value={service}>
                          {service}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      <Building2 className="w-4 h-4 inline mr-1" />
                      Supplier
                    </label>
                    <select
                      value={selectedSupplier || ''}
                      onChange={(e) => setSelectedSupplier(e.target.value || null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">All Suppliers</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier} value={supplier}>
                          {supplier}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      <Users className="w-4 h-4 inline mr-1" />
                      Role Level
                    </label>
                    <select
                      value={selectedStandardizedRole || ''}
                      onChange={(e) => setSelectedStandardizedRole(e.target.value || null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">All Levels</option>
                      {standardizedRoles.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-end">
                    <Button variant="ghost" onClick={clearFilters} disabled={activeFilterCount === 0} className="w-full">
                      Clear All Filters
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rate Cards Table */}
        <Card>
          <CardHeader>
            <CardTitle>
              Rate Cards ({sortedRoles.length})
              {sortedRoles.length !== filteredRoles.length && ` • Page ${currentPage} of ${totalPages}`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-center py-3 px-4 w-12">
                      <input
                        type="checkbox"
                        checked={selectedRoles.size === paginatedRoles.length && paginatedRoles.length > 0}
                        onChange={(e) => e.target.checked ? selectAllVisible() : clearSelection()}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="text-left py-3 px-4">
                      <button
                        onClick={() => handleSort('role')}
                        className="flex items-center gap-1 font-semibold text-gray-700 hover:text-blue-600"
                      >
                        Role
                        <ArrowUpDown className="w-4 h-4" />
                      </button>
                    </th>
                    <th className="text-left py-3 px-4">
                      <button
                        onClick={() => handleSort('standardizedRole')}
                        className="flex items-center gap-1 font-semibold text-gray-700 hover:text-blue-600"
                      >
                        Role Level
                        <ArrowUpDown className="w-4 h-4" />
                      </button>
                    </th>
                    <th className="text-left py-3 px-4">
                      <button
                        onClick={() => handleSort('supplier')}
                        className="flex items-center gap-1 font-semibold text-gray-700 hover:text-blue-600"
                      >
                        Supplier
                        <ArrowUpDown className="w-4 h-4" />
                      </button>
                    </th>
                    <th className="text-left py-3 px-4">
                      <button
                        onClick={() => handleSort('country')}
                        className="flex items-center gap-1 font-semibold text-gray-700 hover:text-blue-600"
                      >
                        Country
                        <ArrowUpDown className="w-4 h-4" />
                      </button>
                    </th>
                    <th className="text-left py-3 px-4">
                      <button
                        onClick={() => handleSort('service')}
                        className="flex items-center gap-1 font-semibold text-gray-700 hover:text-blue-600"
                      >
                        Line of Service
                        <ArrowUpDown className="w-4 h-4" />
                      </button>
                    </th>
                    <th className="text-right py-3 px-4">
                      <button
                        onClick={() => handleSort('rate')}
                        className="flex items-center justify-end gap-1 font-semibold text-gray-700 hover:text-blue-600 w-full"
                      >
                        Your Rate (CHF/day)
                        <ArrowUpDown className="w-4 h-4" />
                      </button>
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">
                      <div className="flex items-center justify-end gap-1">
                        Your Lowest Rate
                        <span className="text-xs text-gray-500">(Best)</span>
                      </div>
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">
                      <div className="flex items-center justify-end gap-1">
                        Target Rate
                        <span className="text-xs text-gray-500">(Avg)</span>
                      </div>
                    </th>
                    <th className="text-right py-3 px-4">
                      <button
                        onClick={() => handleSort('variance')}
                        className="flex items-center justify-end gap-1 font-semibold text-gray-700 hover:text-blue-600 w-full"
                      >
                        Variance
                        <ArrowUpDown className="w-4 h-4" />
                      </button>
                    </th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRoles.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="text-center py-12 text-gray-500">
                        No rate cards found. Try adjusting your filters.
                      </td>
                    </tr>
                  ) : viewMode === 'grouped' ? (
                    // Grouped view
                    paginatedRoles.map((group: any) => {
                      const isExpanded = expandedGroups.has(group.groupKey)
                      const targetKey = `${group.role}-${group.level}-${group.location}-${group.serviceLine}`
                      const targetRate = targetRateMap.get(targetKey) || group.avgRate
                      const variance = ((group.avgRate - targetRate) / targetRate) * 100
                      const isAbove = variance > 5
                      const isBelow = variance < -5

                      return (
                        <React.Fragment key={group.groupKey}>
                          <tr className="border-b border-gray-200 hover:bg-gray-50 transition-colors bg-gray-50">
                            <td className="py-3 px-4 text-center">
                              <button
                                onClick={() => toggleGroupExpansion(group.groupKey)}
                                className="text-gray-600 hover:text-gray-900"
                              >
                                {isExpanded ? '▼' : '▶'}
                              </button>
                            </td>
                            <td className="py-3 px-4">
                              <div>
                                <div className="font-semibold text-gray-900">{group.role}</div>
                                <div className="text-sm text-gray-500">{group.level}</div>
                                <div className="text-xs text-blue-600 mt-1">
                                  {group.count} contract{group.count > 1 ? 's' : ''} • {group.clients.size} client{group.clients.size > 1 ? 's' : ''}
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <Badge variant="outline" className="font-medium">
                                {getStandardizedRole(group.role, group.level)}
                              </Badge>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-gray-400" />
                                <span className="text-gray-700">{group.supplierName}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-gray-400" />
                                <span className="text-gray-700">{group.location}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <Briefcase className="w-4 h-4 text-gray-400" />
                                <span className="text-gray-700">{group.serviceLine}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="font-semibold text-gray-900 text-lg">
                                {formatCHF(group.avgRate, { decimals: 0 })}
                              </div>
                              <div className="text-xs text-gray-500">
                                {group.count > 1 ? `avg (${formatCHF(group.minRate, { decimals: 0 })} - ${formatCHF(group.maxRate, { decimals: 0 })})` : 'per day'}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right">
                              {(() => {
                                const lowestKey = `${group.role}-${group.level}-${group.supplierName}-${group.location}-${group.serviceLine}`
                                const lowestRate = lowestRateMap.get(lowestKey) || group.avgRate
                                const isBestRate = Math.abs(group.avgRate - lowestRate) < 1
                                const overpaying = group.avgRate - lowestRate
                                return (
                                  <div>
                                    <div className={`font-semibold ${isBestRate ? 'text-green-600' : 'text-gray-700'}`}>
                                      {formatCHF(lowestRate, { decimals: 0 })}
                                    </div>
                                    {isBestRate ? (
                                      <div className="text-xs text-green-600">Your best!</div>
                                    ) : overpaying > 0 && (
                                      <div className="text-xs text-orange-600">
                                        +{formatCHF(overpaying, { decimals: 0 })}/day
                                      </div>
                                    )}
                                  </div>
                                )
                              })()}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="font-medium text-gray-700">{formatCHF(targetRate, { decimals: 0 })}</div>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {isAbove && <TrendingUp className="w-4 h-4 text-red-600" />}
                                {isBelow && <TrendingDown className="w-4 h-4 text-green-600" />}
                                <span className={`font-semibold ${isAbove ? 'text-red-600' : isBelow ? 'text-green-600' : 'text-gray-600'}`}>
                                  {variance > 0 ? '+' : ''}{variance.toFixed(1)}%
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center">
                              {isAbove && <CompetitiveBandBadge band="above-market" size="sm" />}
                              {isBelow && <CompetitiveBandBadge band="highly-competitive" size="sm" />}
                              {!isAbove && !isBelow && <CompetitiveBandBadge band="market-rate" size="sm" />}
                            </td>
                          </tr>
                          {isExpanded && group.contracts.map((contract: any, idx: number) => (
                            <tr key={`${group.groupKey}-${idx}`} className="border-b border-gray-100 bg-blue-50">
                              <td className="py-2 px-4"></td>
                              <td className="py-2 px-4 pl-12" colSpan={2}>
                                <div className="text-sm text-gray-700">
                                  <span className="font-medium">{contract.clientName}</span>
                                  {contract.contractId && <span className="text-gray-500 ml-2">({contract.contractId})</span>}
                                </div>
                              </td>
                              <td className="py-2 px-4" colSpan={3}>
                                <div className="text-sm text-gray-500">
                                  {contract.lastUpdated && `Updated: ${new Date(contract.lastUpdated).toLocaleDateString()}`}
                                </div>
                              </td>
                              <td className="py-2 px-4 text-right">
                                <div className="font-medium text-gray-900">{formatCHF(contract.dailyRateCHF, { decimals: 0 })}</div>
                              </td>
                              <td className="py-2 px-4" colSpan={3}></td>
                            </tr>
                          ))}
                        </React.Fragment>
                      )
                    })
                  ) : (
                    // Individual view
                    paginatedRoles.map((role) => {
                      const targetKey = `${role.role}-${role.level}-${role.location}-${role.serviceLine}`
                      const targetRate = targetRateMap.get(targetKey) || role.dailyRateCHF
                      const variance = ((role.dailyRateCHF - targetRate) / targetRate) * 100
                      const isAbove = variance > 5
                      const isBelow = variance < -5
                      const isSelected = selectedRoles.has(role.id)
                      
                      // Smart recommendation
                      let recommendation = null
                      if (isAbove && variance > 15) {
                        recommendation = { type: 'urgent', message: 'Urgent: Renegotiate immediately', savings: (role.dailyRateCHF - targetRate) * 260 }
                      } else if (isAbove && variance > 10) {
                        recommendation = { type: 'high', message: 'High priority for renegotiation', savings: (role.dailyRateCHF - targetRate) * 260 }
                      } else if (isAbove) {
                        recommendation = { type: 'medium', message: 'Consider renegotiation', savings: (role.dailyRateCHF - targetRate) * 260 }
                      }

                      return (
                        <tr 
                          key={role.id} 
                          className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                            isSelected ? 'bg-blue-50 border-blue-200' : ''
                          }`}
                        >
                          <td className="py-3 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleRoleSelection(role.id)}
                              className="rounded border-gray-300"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <div>
                              <div className="font-medium text-gray-900">{role.role}</div>
                              <div className="text-sm text-gray-500">{role.level}</div>
                              {recommendation && (
                                <div className={`text-xs mt-1 flex items-center gap-1 ${
                                  recommendation.type === 'urgent' ? 'text-red-600' : 
                                  recommendation.type === 'high' ? 'text-orange-600' : 'text-yellow-600'
                                }`}>
                                  <AlertCircle className="w-3 h-3" />
                                  {recommendation.message} • Save {formatCHF(recommendation.savings, { decimals: 0 })}/yr
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="outline" className="font-medium">
                              {getStandardizedRole(role.role, role.level)}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-gray-400" />
                              <span className="text-gray-700">{role.supplierName}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-gray-400" />
                              <span className="text-gray-700">{role.location}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <Briefcase className="w-4 h-4 text-gray-400" />
                              <span className="text-gray-700">{role.serviceLine}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="font-semibold text-gray-900 text-lg">
                              {formatCHF(role.dailyRateCHF, { decimals: 0 })}
                            </div>
                            <div className="text-xs text-gray-500">per day</div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            {(() => {
                              const lowestKey = `${role.role}-${role.level}-${role.supplierName}-${role.location}-${role.serviceLine}`
                              const lowestRate = lowestRateMap.get(lowestKey) || role.dailyRateCHF
                              const isBestRate = Math.abs(role.dailyRateCHF - lowestRate) < 1
                              const overpaying = role.dailyRateCHF - lowestRate
                              return (
                                <div>
                                  <div className={`font-semibold ${isBestRate ? 'text-green-600' : 'text-gray-700'}`}>
                                    {formatCHF(lowestRate, { decimals: 0 })}
                                  </div>
                                  {isBestRate ? (
                                    <div className="text-xs text-green-600">Your best!</div>
                                  ) : overpaying > 0 && (
                                    <div className="text-xs text-orange-600">
                                      +{formatCHF(overpaying, { decimals: 0 })}/day vs your best
                                    </div>
                                  )}
                                </div>
                              )
                            })()}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="font-medium text-gray-700">{formatCHF(targetRate, { decimals: 0 })}</div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {isAbove && <TrendingUp className="w-4 h-4 text-red-600" />}
                              {isBelow && <TrendingDown className="w-4 h-4 text-green-600" />}
                              <span
                                className={`font-semibold ${
                                  isAbove ? 'text-red-600' : isBelow ? 'text-green-600' : 'text-gray-600'
                                }`}
                              >
                                {variance > 0 ? '+' : ''}
                                {variance.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {isAbove && <CompetitiveBandBadge band="above-market" size="sm" />}
                            {isBelow && <CompetitiveBandBadge band="highly-competitive" size="sm" />}
                            {!isAbove && !isBelow && <CompetitiveBandBadge band="market-rate" size="sm" />}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, sortedRoles.length)} of{' '}
                  {sortedRoles.length} rate cards
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </Button>
                  <div className="text-sm text-gray-600">
                    Page {currentPage} of {totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="savings" className="space-y-6">
            <EnhancedSavingsCalculator />
          </TabsContent>

          <TabsContent value="intelligence" className="space-y-6">
            <MarketIntelligenceEngine />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <div className="text-center py-12">
              <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Advanced Analytics</h3>
              <p className="text-gray-600">Comprehensive analytics dashboard coming soon...</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
