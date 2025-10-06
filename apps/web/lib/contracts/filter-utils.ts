import { Contract } from './contracts-data-service'
import { FilterOptions } from '@/components/contracts/ContractFiltersPanel'

/**
 * Apply filters to a list of contracts
 */
export function filterContracts(
  contracts: Contract[],
  filters: FilterOptions
): Contract[] {
  let filtered = [...contracts]

  // Search filter
  if (filters.search) {
    const searchLower = filters.search.toLowerCase()
    filtered = filtered.filter((contract) => {
      const filename = (contract.filename || '').toLowerCase()
      const id = (contract.id || '').toLowerCase()
      const parties = contract.extractedData?.metadata?.parties || []
      const partiesText = parties.join(' ').toLowerCase()
      const contractType = (
        contract.extractedData?.metadata?.contractType || ''
      ).toLowerCase()

      return (
        filename.includes(searchLower) ||
        id.includes(searchLower) ||
        partiesText.includes(searchLower) ||
        contractType.includes(searchLower)
      )
    })
  }

  // Status filter
  if (filters.status && filters.status.length > 0) {
    filtered = filtered.filter((contract) =>
      filters.status.includes(contract.status)
    )
  }

  // Contract type filter
  if (filters.contractType && filters.contractType.length > 0) {
    filtered = filtered.filter((contract) => {
      const type = contract.extractedData?.metadata?.contractType
      return type && filters.contractType.includes(type)
    })
  }

  // Date range filter
  if (filters.dateRange?.from || filters.dateRange?.to) {
    filtered = filtered.filter((contract) => {
      if (!contract.uploadDate) return false
      const uploadDate = new Date(contract.uploadDate)

      if (filters.dateRange.from) {
        const fromDate = new Date(filters.dateRange.from)
        if (uploadDate < fromDate) return false
      }

      if (filters.dateRange.to) {
        const toDate = new Date(filters.dateRange.to)
        toDate.setHours(23, 59, 59, 999) // End of day
        if (uploadDate > toDate) return false
      }

      return true
    })
  }

  // Value range filter
  if (filters.valueRange?.min || filters.valueRange?.max) {
    filtered = filtered.filter((contract) => {
      const value = contract.extractedData?.financial?.totalValue
      if (value === undefined || value === null) return false

      if (filters.valueRange.min && value < filters.valueRange.min) {
        return false
      }

      if (filters.valueRange.max && value > filters.valueRange.max) {
        return false
      }

      return true
    })
  }

  // Risk level filter
  if (filters.riskLevel && filters.riskLevel.length > 0) {
    filtered = filtered.filter((contract) => {
      const riskLevel = contract.extractedData?.risk?.level
      return riskLevel && filters.riskLevel.includes(riskLevel)
    })
  }

  // Compliance score filter
  if (filters.complianceScore?.min || filters.complianceScore?.max) {
    filtered = filtered.filter((contract) => {
      const score = contract.extractedData?.compliance?.score
      if (score === undefined || score === null) return false

      if (filters.complianceScore.min && score < filters.complianceScore.min) {
        return false
      }

      if (filters.complianceScore.max && score > filters.complianceScore.max) {
        return false
      }

      return true
    })
  }

  // Client filter
  if (filters.clients && filters.clients.length > 0) {
    filtered = filtered.filter((contract) => {
      const parties = contract.extractedData?.metadata?.parties || []
      // Check if any selected client is in the parties list
      return filters.clients.some(client => 
        parties.some(party => 
          party.toLowerCase().includes(client.toLowerCase())
        )
      )
    })
  }

  // Supplier filter
  if (filters.suppliers && filters.suppliers.length > 0) {
    filtered = filtered.filter((contract) => {
      const parties = contract.extractedData?.metadata?.parties || []
      // Check if any selected supplier is in the parties list
      return filters.suppliers.some(supplier => 
        parties.some(party => 
          party.toLowerCase().includes(supplier.toLowerCase())
        )
      )
    })
  }

  return filtered
}

/**
 * Get default filter options
 */
export function getDefaultFilters(): FilterOptions {
  return {
    search: '',
    status: [],
    dateRange: { from: '', to: '' },
    valueRange: { min: 0, max: 0 },
    contractType: [],
    riskLevel: [],
    complianceScore: { min: 0, max: 0 },
    clients: [],
    suppliers: [],
  }
}

/**
 * Extract unique clients and suppliers from contracts
 */
export function extractPartiesFromContracts(contracts: Contract[]): {
  clients: string[]
  suppliers: string[]
} {
  const allParties = new Set<string>()
  
  contracts.forEach(contract => {
    const parties = contract.extractedData?.metadata?.parties || []
    parties.forEach(party => {
      if (party && party.trim()) {
        allParties.add(party.trim())
      }
    })
  })
  
  const partiesArray = Array.from(allParties).sort()
  
  // For now, treat all parties as both potential clients and suppliers
  // In a real system, you'd have a way to distinguish between them
  return {
    clients: partiesArray,
    suppliers: partiesArray,
  }
}

/**
 * Sort contracts by various criteria
 */
export type SortOption =
  | 'date-desc'
  | 'date-asc'
  | 'value-desc'
  | 'value-asc'
  | 'name-asc'
  | 'name-desc'
  | 'risk-desc'
  | 'risk-asc'

export function sortContracts(
  contracts: Contract[],
  sortBy: SortOption
): Contract[] {
  const sorted = [...contracts]

  switch (sortBy) {
    case 'date-desc':
      return sorted.sort((a, b) => {
        const dateA = new Date(a.uploadDate || 0).getTime()
        const dateB = new Date(b.uploadDate || 0).getTime()
        return dateB - dateA
      })

    case 'date-asc':
      return sorted.sort((a, b) => {
        const dateA = new Date(a.uploadDate || 0).getTime()
        const dateB = new Date(b.uploadDate || 0).getTime()
        return dateA - dateB
      })

    case 'value-desc':
      return sorted.sort((a, b) => {
        const valueA = a.extractedData?.financial?.totalValue || 0
        const valueB = b.extractedData?.financial?.totalValue || 0
        return valueB - valueA
      })

    case 'value-asc':
      return sorted.sort((a, b) => {
        const valueA = a.extractedData?.financial?.totalValue || 0
        const valueB = b.extractedData?.financial?.totalValue || 0
        return valueA - valueB
      })

    case 'name-asc':
      return sorted.sort((a, b) => {
        const nameA = (a.filename || '').toLowerCase()
        const nameB = (b.filename || '').toLowerCase()
        return nameA.localeCompare(nameB)
      })

    case 'name-desc':
      return sorted.sort((a, b) => {
        const nameA = (a.filename || '').toLowerCase()
        const nameB = (b.filename || '').toLowerCase()
        return nameB.localeCompare(nameA)
      })

    case 'risk-desc':
      return sorted.sort((a, b) => {
        const riskA = a.extractedData?.risk?.overallScore || 0
        const riskB = b.extractedData?.risk?.overallScore || 0
        return riskB - riskA
      })

    case 'risk-asc':
      return sorted.sort((a, b) => {
        const riskA = a.extractedData?.risk?.overallScore || 0
        const riskB = b.extractedData?.risk?.overallScore || 0
        return riskA - riskB
      })

    default:
      return sorted
  }
}
