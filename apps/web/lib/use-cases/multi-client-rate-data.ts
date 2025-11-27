/**
 * Multi-Client Rate Card Data Model and Generator
 * Supports enterprise-level rate card management across multiple clients
 */

import {
  type Geography,
  type ServiceLine,
  type SeniorityLevel,
  type SupplierData,
  suppliers,
  roleTaxonomy,
  geographyCostMultipliers
} from './enhanced-rate-benchmarking-data'
import {
  type Currency,
  type RatePeriod,
  rateNormalizer,
  type NormalizedRate
} from './rate-normalizer'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface Client {
  id: string
  name: string
  industry: string
  region: string
  tags: string[]
  rateCardCount: number
  averageDailyRateCHF: number
  rateRange: { min: number; max: number }
  createdAt: Date
  updatedAt: Date
  status: 'active' | 'inactive'
}

export interface RateCard {
  id: string
  clientId: string
  clientName: string
  supplierId: string
  supplierName: string
  contractId: string
  effectiveDate: Date
  expiryDate?: Date
  currency: Currency
  status: 'draft' | 'pending' | 'approved' | 'archived'
  roles: RateCardRole[]
  metadata: {
    uploadedBy: string
    uploadedAt: Date
    approvedBy?: string
    approvedAt?: Date
    version: number
  }
}

export interface RateCardRole {
  id: string
  rateCardId: string
  clientId: string
  clientName: string
  role: string
  standardizedRole: string
  level: SeniorityLevel
  location: string
  geography: Geography
  serviceLine: ServiceLine
  supplierId: string
  supplierName: string
  
  // Original rate data
  originalRate: number
  originalPeriod: RatePeriod
  originalCurrency: Currency
  
  // Normalized to daily CHF
  dailyRateCHF: number
  
  // Benchmarking (calculated)
  marketMedianCHF?: number
  marketP25CHF?: number
  marketP75CHF?: number
  variancePercent?: number
  varianceCHF?: number
  competitiveBand?: 'highly-competitive' | 'market-rate' | 'above-market' | 'premium'
  
  // Savings potential (calculated)
  potentialSavingsDailyCHF?: number
  potentialSavingsAnnualCHF?: number
  
  // Metadata
  fteCount?: number
  skills: string[]
  certifications: string[]
  effectiveDate: Date
  lastUpdated: Date
}

export interface ClientAnalytics {
  clientId: string
  clientName: string
  period: { start: Date; end: Date }
  metrics: {
    totalRateCards: number
    totalRoles: number
    averageDailyRateCHF: number
    medianDailyRateCHF: number
    totalDailyExposureCHF: number
    projectedAnnualSpendCHF: number
    
    // Benchmarking
    aboveMarketCount: number
    atMarketCount: number
    belowMarketCount: number
    averageVariancePercent: number
    
    // Savings
    totalPotentialSavingsDailyCHF: number
    totalPotentialSavingsAnnualCHF: number
    
    // Distribution
    roleDistribution: Record<string, number>
    locationDistribution: Record<string, number>
    supplierDistribution: Record<string, { count: number; avgRate: number }>
  }
  trends: {
    month: string
    averageDailyRateCHF: number
    rateCardCount: number
  }[]
  topSuppliers: {
    supplierId: string
    supplierName: string
    rateCardCount: number
    averageDailyRateCHF: number
    competitivenessScore: number
  }[]
}

// ============================================================================
// CLIENT DATABASE
// ============================================================================

export const clients: Client[] = [
  {
    id: 'client-001',
    name: 'Swiss Re',
    industry: 'Insurance',
    region: 'EMEA',
    tags: ['enterprise', 'financial-services', 'tier-1'],
    rateCardCount: 0, // Will be calculated
    averageDailyRateCHF: 0,
    rateRange: { min: 0, max: 0 },
    createdAt: new Date('2023-01-15'),
    updatedAt: new Date('2024-02-01'),
    status: 'active'
  },
  {
    id: 'client-002',
    name: 'Nestlé',
    industry: 'Consumer Goods',
    region: 'EMEA',
    tags: ['enterprise', 'manufacturing', 'tier-1'],
    rateCardCount: 0,
    averageDailyRateCHF: 0,
    rateRange: { min: 0, max: 0 },
    createdAt: new Date('2023-02-20'),
    updatedAt: new Date('2024-01-28'),
    status: 'active'
  },
  {
    id: 'client-003',
    name: 'UBS',
    industry: 'Banking',
    region: 'EMEA',
    tags: ['enterprise', 'financial-services', 'tier-1'],
    rateCardCount: 0,
    averageDailyRateCHF: 0,
    rateRange: { min: 0, max: 0 },
    createdAt: new Date('2023-03-10'),
    updatedAt: new Date('2024-02-05'),
    status: 'active'
  },
  {
    id: 'client-004',
    name: 'Novartis',
    industry: 'Pharmaceuticals',
    region: 'EMEA',
    tags: ['enterprise', 'healthcare', 'tier-1'],
    rateCardCount: 0,
    averageDailyRateCHF: 0,
    rateRange: { min: 0, max: 0 },
    createdAt: new Date('2023-04-05'),
    updatedAt: new Date('2024-01-30'),
    status: 'active'
  },
  {
    id: 'client-005',
    name: 'Roche',
    industry: 'Pharmaceuticals',
    region: 'EMEA',
    tags: ['enterprise', 'healthcare', 'tier-1'],
    rateCardCount: 0,
    averageDailyRateCHF: 0,
    rateRange: { min: 0, max: 0 },
    createdAt: new Date('2023-05-12'),
    updatedAt: new Date('2024-02-03'),
    status: 'active'
  },
  {
    id: 'client-006',
    name: 'ABB',
    industry: 'Industrial Technology',
    region: 'EMEA',
    tags: ['enterprise', 'manufacturing', 'tier-1'],
    rateCardCount: 0,
    averageDailyRateCHF: 0,
    rateRange: { min: 0, max: 0 },
    createdAt: new Date('2023-06-18'),
    updatedAt: new Date('2024-01-25'),
    status: 'active'
  },
  {
    id: 'client-007',
    name: 'Zurich Insurance',
    industry: 'Insurance',
    region: 'EMEA',
    tags: ['enterprise', 'financial-services', 'tier-1'],
    rateCardCount: 0,
    averageDailyRateCHF: 0,
    rateRange: { min: 0, max: 0 },
    createdAt: new Date('2023-07-22'),
    updatedAt: new Date('2024-02-02'),
    status: 'active'
  },
  {
    id: 'client-008',
    name: 'Swisscom',
    industry: 'Telecommunications',
    region: 'EMEA',
    tags: ['enterprise', 'technology', 'tier-1'],
    rateCardCount: 0,
    averageDailyRateCHF: 0,
    rateRange: { min: 0, max: 0 },
    createdAt: new Date('2023-08-30'),
    updatedAt: new Date('2024-01-29'),
    status: 'active'
  },
  {
    id: 'client-009',
    name: 'Credit Suisse',
    industry: 'Banking',
    region: 'EMEA',
    tags: ['enterprise', 'financial-services', 'tier-1'],
    rateCardCount: 0,
    averageDailyRateCHF: 0,
    rateRange: { min: 0, max: 0 },
    createdAt: new Date('2023-09-14'),
    updatedAt: new Date('2024-01-31'),
    status: 'active'
  },
  {
    id: 'client-010',
    name: 'Swatch Group',
    industry: 'Luxury Goods',
    region: 'EMEA',
    tags: ['enterprise', 'manufacturing', 'tier-2'],
    rateCardCount: 0,
    averageDailyRateCHF: 0,
    rateRange: { min: 0, max: 0 },
    createdAt: new Date('2023-10-08'),
    updatedAt: new Date('2024-02-04'),
    status: 'active'
  },
  {
    id: 'client-011',
    name: 'Holcim',
    industry: 'Construction Materials',
    region: 'EMEA',
    tags: ['enterprise', 'manufacturing', 'tier-2'],
    rateCardCount: 0,
    averageDailyRateCHF: 0,
    rateRange: { min: 0, max: 0 },
    createdAt: new Date('2023-11-19'),
    updatedAt: new Date('2024-01-27'),
    status: 'active'
  },
  {
    id: 'client-012',
    name: 'Schindler',
    industry: 'Industrial Technology',
    region: 'EMEA',
    tags: ['enterprise', 'manufacturing', 'tier-2'],
    rateCardCount: 0,
    averageDailyRateCHF: 0,
    rateRange: { min: 0, max: 0 },
    createdAt: new Date('2023-12-05'),
    updatedAt: new Date('2024-02-06'),
    status: 'active'
  }
]

// ============================================================================
// DATA GENERATION
// ============================================================================

/**
 * Generate comprehensive multi-client rate card data
 */
export function generateMultiClientRateData(): {
  clients: Client[]
  rateCards: RateCard[]
  allRoles: RateCardRole[]
} {
  const allRateCards: RateCard[] = []
  const allRoles: RateCardRole[] = []
  let rateCardIdCounter = 1
  let roleIdCounter = 1

  // Generate rate cards for each client
  clients.forEach((client, clientIndex) => {
    // Each client gets 15-45 rate cards
    const numRateCards = 15 + Math.floor(Math.random() * 30)
    
    for (let i = 0; i < numRateCards; i++) {
      const supplier = suppliers[Math.floor(Math.random() * suppliers.length)]
      if (!supplier) continue
      const serviceLine = supplier.serviceLines[
        Math.floor(Math.random() * supplier.serviceLines.length)
      ]
      const geography = supplier.geographies[
        Math.floor(Math.random() * supplier.geographies.length)
      ]
      if (!serviceLine || !geography) continue
      
      const rateCardId = `rc-${String(rateCardIdCounter++).padStart(5, '0')}`
      const contractId = `${client.id.toUpperCase()}-${supplier.id.toUpperCase()}-${String(i + 1).padStart(3, '0')}`
      
      // Generate 3-8 roles per rate card
      const numRoles = 3 + Math.floor(Math.random() * 6)
      const roles: RateCardRole[] = []
      
      for (let j = 0; j < numRoles; j++) {
        const taxonomy = roleTaxonomy[Math.floor(Math.random() * roleTaxonomy.length)]
        if (!taxonomy) continue
        const level = taxonomy.typicalSeniority[
          Math.floor(Math.random() * taxonomy.typicalSeniority.length)
        ]
        if (!level) continue
        
        // Generate original rate in various currencies and periods
        const originalCurrency = getRandomCurrency()
        const originalPeriod = getRandomPeriod()
        const baseRate = getBaseRate(taxonomy.standardizedRole, level, geography)
        const originalRate = convertFromDailyCHF(baseRate, originalPeriod, originalCurrency)
        
        // Normalize to daily CHF
        const normalized = rateNormalizer.normalizeToDailyCHF(
          originalRate,
          originalPeriod,
          originalCurrency
        )
        
        const roleId = `role-${String(roleIdCounter++).padStart(6, '0')}`
        
        const role: RateCardRole = {
          id: roleId,
          rateCardId,
          clientId: client.id,
          clientName: client.name,
          role: taxonomy.standardizedRole,
          standardizedRole: taxonomy.standardizedRole,
          level,
          location: getLocationName(geography),
          geography,
          serviceLine,
          supplierId: supplier.id,
          supplierName: supplier.name,
          originalRate,
          originalPeriod,
          originalCurrency,
          dailyRateCHF: normalized.dailyRateCHF,
          fteCount: Math.random() > 0.7 ? Math.floor(Math.random() * 5) + 1 : undefined,
          skills: taxonomy.requiredSkills.slice(0, 2 + Math.floor(Math.random() * 2)),
          certifications: [],
          effectiveDate: new Date(2024, 0, 1 + Math.floor(Math.random() * 365)),
          lastUpdated: new Date()
        }
        
        roles.push(role)
        allRoles.push(role)
      }
      
      const rateCard: RateCard = {
        id: rateCardId,
        clientId: client.id,
        clientName: client.name,
        supplierId: supplier.id,
        supplierName: supplier.name,
        contractId,
        effectiveDate: new Date(2024, 0, 1 + Math.floor(Math.random() * 365)),
        expiryDate: new Date(2025, 11, 31),
        currency: 'CHF',
        status: 'approved',
        roles,
        metadata: {
          uploadedBy: 'system',
          uploadedAt: new Date(2024, 0, 1),
          approvedBy: 'admin',
          approvedAt: new Date(2024, 0, 2),
          version: 1
        }
      }
      
      allRateCards.push(rateCard)
    }
  })

  // Update client statistics
  clients.forEach(client => {
    const clientRoles = allRoles.filter(r => r.clientId === client.id)
    const clientRates = clientRoles.map(r => r.dailyRateCHF)
    
    client.rateCardCount = allRateCards.filter(rc => rc.clientId === client.id).length
    client.averageDailyRateCHF = clientRates.length > 0
      ? Math.round(clientRates.reduce((sum, rate) => sum + rate, 0) / clientRates.length)
      : 0
    client.rateRange = {
      min: clientRates.length > 0 ? Math.min(...clientRates) : 0,
      max: clientRates.length > 0 ? Math.max(...clientRates) : 0
    }
  })

  return {
    clients,
    rateCards: allRateCards,
    allRoles
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getRandomCurrency(): Currency {
  const currencies: Currency[] = ['CHF', 'USD', 'EUR', 'GBP', 'INR']
  const weights = [0.4, 0.3, 0.2, 0.05, 0.05] // CHF most common
  const random = Math.random()
  let cumulative = 0
  
  for (let i = 0; i < currencies.length; i++) {
    cumulative += weights[i] ?? 0
    const currency = currencies[i]
    if (random < cumulative && currency) {
      return currency
    }
  }
  
  return 'CHF'
}

function getRandomPeriod(): RatePeriod {
  const periods: RatePeriod[] = ['hourly', 'daily', 'monthly', 'annual']
  const weights = [0.3, 0.4, 0.2, 0.1] // Daily most common
  const random = Math.random()
  let cumulative = 0
  
  for (let i = 0; i < periods.length; i++) {
    cumulative += weights[i] ?? 0
    const period = periods[i]
    if (random < cumulative && period) {
      return period
    }
  }
  
  return 'daily'
}

function getBaseRate(
  role: string,
  level: SeniorityLevel,
  geography: Geography
): number {
  // Base rates in CHF per day for North America Onshore
  const baseRates: Record<string, Record<SeniorityLevel, number>> = {
    'Senior Consultant': { Junior: 760, Mid: 1000, Senior: 1248, Principal: 1560, Partner: 2200 },
    'Project Manager': { Junior: 680, Mid: 920, Senior: 1160, Principal: 1480, Partner: 2000 },
    'Business Analyst': { Junior: 600, Mid: 840, Senior: 1080, Principal: 1360, Partner: 1760 },
    'Software Developer': { Junior: 680, Mid: 920, Senior: 1240, Principal: 1560, Partner: 2080 },
    'QA Engineer': { Junior: 520, Mid: 760, Senior: 1000, Principal: 1280, Partner: 1680 },
    'Technical Architect': { Junior: 1000, Mid: 1240, Senior: 1480, Principal: 1880, Partner: 2600 },
    'Data Analyst': { Junior: 640, Mid: 880, Senior: 1160, Principal: 1440, Partner: 1920 },
    'DevOps Engineer': { Junior: 720, Mid: 960, Senior: 1280, Principal: 1600, Partner: 2160 },
    'Accountant': { Junior: 440, Mid: 600, Senior: 760, Principal: 1000, Partner: 1400 },
    'Customer Service Representative': { Junior: 200, Mid: 280, Senior: 400, Principal: 560, Partner: 760 }
  }
  
  const defaultRoleRates = { Junior: 600, Mid: 840, Senior: 1080, Principal: 1360, Partner: 1760 }
  const roleRates = baseRates[role] ?? defaultRoleRates
  const baseRate = roleRates[level] ?? roleRates.Mid
  
  // Apply geography multiplier
  const geoMultiplier = geographyCostMultipliers[geography]
  
  // Add some variance (-5% to +10%)
  const variance = 0.95 + Math.random() * 0.15
  
  return Math.round(baseRate * geoMultiplier * variance)
}

function convertFromDailyCHF(
  dailyRateCHF: number,
  targetPeriod: RatePeriod,
  targetCurrency: Currency
): number {
  return rateNormalizer.denormalize(dailyRateCHF, targetPeriod, targetCurrency)
}

function getLocationName(geography: Geography): string {
  const locationMap: Record<Geography, string> = {
    'North America - Onshore': 'United States',
    'North America - Nearshore': 'Mexico',
    'EMEA - Western Europe': 'Switzerland',
    'EMEA - Eastern Europe': 'Poland',
    'APAC - India': 'India',
    'APAC - Philippines': 'Philippines',
    'LATAM - Mexico': 'Mexico',
    'LATAM - Brazil': 'Brazil'
  }
  return locationMap[geography] ?? 'Unknown'
}

// ============================================================================
// INITIALIZE DATA
// ============================================================================

export const multiClientData = generateMultiClientRateData()
export const { clients: allClients, rateCards: allRateCards, allRoles: allRateCardRoles } = multiClientData
