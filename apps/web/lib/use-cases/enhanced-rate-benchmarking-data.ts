// @ts-nocheck
/**
 * Enhanced Mock Data for Rate Card Benchmarking Use Case
 * Includes multi-dimensional data: suppliers, service lines, geographies, role taxonomy
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type SeniorityLevel = 'Junior' | 'Mid' | 'Senior' | 'Principal' | 'Partner'
export type SupplierTier = 'Big 4' | 'Tier 2' | 'Boutique' | 'Offshore'
export type Geography = 
  | 'North America - Onshore'
  | 'North America - Nearshore'
  | 'EMEA - Western Europe'
  | 'EMEA - Eastern Europe'
  | 'APAC - India'
  | 'APAC - Philippines'
  | 'LATAM - Mexico'
  | 'LATAM - Brazil'

export type ServiceLine = 
  | 'IT Consulting'
  | 'BPO Services'
  | 'Finance & Accounting'
  | 'HR Services'
  | 'Customer Service'
  | 'Data Analytics'

export interface SupplierData {
  id: string
  name: string
  tier: SupplierTier
  serviceLines: ServiceLine[]
  geographies: Geography[]
  reputation: number
  dataQuality: {
    sampleSize: number
    lastUpdated: Date
    confidence: number
  }
}

export interface RoleRate {
  id: string
  role: string
  standardizedRole: string
  level: SeniorityLevel
  serviceLine: ServiceLine
  geography: Geography
  supplierId: string
  hourlyRate: number
  dailyRate: number
  effectiveDate: Date
  // ChainIQ enhanced fields
  chainIQBenchmark: number
  chainIQPercentile: {
    p25: number
    p75: number
    p90: number
  }
  industryAverage: number
  fteCount?: number
  totalAnnualCost: number
  contractDate: Date
  lastUpdated: Date
  supplierName: string
  locationPremium: number
  skillsPremium: number
}

export interface BenchmarkStatistics {
  roleId: string
  standardizedRole: string
  geography: Geography
  serviceLine: ServiceLine
  statistics: {
    mean: number
    median: number
    p25: number
    p75: number
    p10: number
    p90: number
    stdDev: number
    sampleSize: number
    confidence: number
  }
  trends: {
    month: string
    value: number
    direction: 'up' | 'down' | 'stable'
  }[]
}

export interface RoleTaxonomy {
  standardizedRole: string
  aliases: string[]
  category: string
  subCategory: string
  typicalSeniority: SeniorityLevel[]
  requiredSkills: string[]
}

// ============================================================================
// SUPPLIERS DATABASE
// ============================================================================

export const suppliers: SupplierData[] = [
  {
    id: 'deloitte',
    name: 'Deloitte Consulting',
    tier: 'Big 4',
    serviceLines: ['IT Consulting', 'BPO Services', 'Finance & Accounting', 'Data Analytics'],
    geographies: [
      'North America - Onshore',
      'EMEA - Western Europe',
      'APAC - India',
      'LATAM - Mexico'
    ],
    reputation: 4.5,
    dataQuality: {
      sampleSize: 127,
      lastUpdated: new Date('2024-01-15'),
      confidence: 0.94
    }
  },
  {
    id: 'accenture',
    name: 'Accenture',
    tier: 'Big 4',
    serviceLines: ['IT Consulting', 'BPO Services', 'Customer Service', 'Data Analytics'],
    geographies: [
      'North America - Onshore',
      'EMEA - Western Europe',
      'APAC - India',
      'APAC - Philippines'
    ],
    reputation: 4.6,
    dataQuality: {
      sampleSize: 156,
      lastUpdated: new Date('2024-01-20'),
      confidence: 0.96
    }
  },
  {
    id: 'pwc',
    name: 'PwC',
    tier: 'Big 4',
    serviceLines: ['Finance & Accounting', 'IT Consulting', 'Data Analytics'],
    geographies: [
      'North America - Onshore',
      'EMEA - Western Europe',
      'APAC - India'
    ],
    reputation: 4.4,
    dataQuality: {
      sampleSize: 98,
      lastUpdated: new Date('2024-01-10'),
      confidence: 0.91
    }
  },
  {
    id: 'ey',
    name: 'EY (Ernst & Young)',
    tier: 'Big 4',
    serviceLines: ['Finance & Accounting', 'IT Consulting', 'BPO Services'],
    geographies: [
      'North America - Onshore',
      'EMEA - Western Europe',
      'APAC - India'
    ],
    reputation: 4.3,
    dataQuality: {
      sampleSize: 89,
      lastUpdated: new Date('2024-01-12'),
      confidence: 0.89
    }
  },
  {
    id: 'cognizant',
    name: 'Cognizant',
    tier: 'Tier 2',
    serviceLines: ['IT Consulting', 'BPO Services', 'Data Analytics', 'Customer Service'],
    geographies: [
      'North America - Onshore',
      'APAC - India',
      'APAC - Philippines',
      'LATAM - Mexico'
    ],
    reputation: 4.1,
    dataQuality: {
      sampleSize: 112,
      lastUpdated: new Date('2024-01-18'),
      confidence: 0.93
    }
  },
  {
    id: 'wipro',
    name: 'Wipro',
    tier: 'Tier 2',
    serviceLines: ['IT Consulting', 'BPO Services', 'Customer Service'],
    geographies: [
      'North America - Nearshore',
      'APAC - India',
      'EMEA - Eastern Europe'
    ],
    reputation: 3.9,
    dataQuality: {
      sampleSize: 87,
      lastUpdated: new Date('2024-01-08'),
      confidence: 0.87
    }
  },
  {
    id: 'tcs',
    name: 'Tata Consultancy Services',
    tier: 'Tier 2',
    serviceLines: ['IT Consulting', 'BPO Services', 'Finance & Accounting'],
    geographies: [
      'North America - Nearshore',
      'APAC - India',
      'LATAM - Brazil'
    ],
    reputation: 4.0,
    dataQuality: {
      sampleSize: 103,
      lastUpdated: new Date('2024-01-14'),
      confidence: 0.90
    }
  },
  {
    id: 'infosys',
    name: 'Infosys',
    tier: 'Tier 2',
    serviceLines: ['IT Consulting', 'Data Analytics', 'BPO Services'],
    geographies: [
      'North America - Onshore',
      'APAC - India',
      'EMEA - Eastern Europe'
    ],
    reputation: 4.2,
    dataQuality: {
      sampleSize: 95,
      lastUpdated: new Date('2024-01-16'),
      confidence: 0.88
    }
  }
]

// ============================================================================
// ROLE TAXONOMY
// ============================================================================

export const roleTaxonomy: RoleTaxonomy[] = [
  {
    standardizedRole: 'Senior Consultant',
    aliases: ['Sr. Consultant', 'Senior Business Consultant', 'Consultant III'],
    category: 'Consulting',
    subCategory: 'Business Consulting',
    typicalSeniority: ['Senior'],
    requiredSkills: ['Strategy', 'Business Analysis', 'Stakeholder Management']
  },
  {
    standardizedRole: 'Project Manager',
    aliases: ['PM', 'Program Manager', 'Delivery Manager', 'Project Lead'],
    category: 'Management',
    subCategory: 'Project Management',
    typicalSeniority: ['Senior', 'Principal'],
    requiredSkills: ['PMP', 'Agile', 'Stakeholder Management', 'Risk Management']
  },
  {
    standardizedRole: 'Business Analyst',
    aliases: ['BA', 'Systems Analyst', 'Requirements Analyst'],
    category: 'Analysis',
    subCategory: 'Business Analysis',
    typicalSeniority: ['Mid', 'Senior'],
    requiredSkills: ['Requirements Gathering', 'Process Mapping', 'SQL']
  },
  {
    standardizedRole: 'Software Developer',
    aliases: ['Developer', 'Software Engineer', 'Programmer', 'Coder'],
    category: 'Technology',
    subCategory: 'Software Development',
    typicalSeniority: ['Junior', 'Mid', 'Senior'],
    requiredSkills: ['Programming', 'Git', 'Testing', 'Debugging']
  },
  {
    standardizedRole: 'QA Engineer',
    aliases: ['Quality Assurance', 'Test Engineer', 'QA Analyst', 'Tester'],
    category: 'Technology',
    subCategory: 'Quality Assurance',
    typicalSeniority: ['Junior', 'Mid', 'Senior'],
    requiredSkills: ['Test Automation', 'Selenium', 'JIRA', 'Test Planning']
  },
  {
    standardizedRole: 'Technical Architect',
    aliases: ['Solution Architect', 'Enterprise Architect', 'Systems Architect'],
    category: 'Technology',
    subCategory: 'Architecture',
    typicalSeniority: ['Principal', 'Partner'],
    requiredSkills: ['System Design', 'Cloud Architecture', 'Security', 'Scalability']
  },
  {
    standardizedRole: 'Data Analyst',
    aliases: ['Data Scientist', 'Analytics Consultant', 'BI Analyst'],
    category: 'Analytics',
    subCategory: 'Data Analysis',
    typicalSeniority: ['Mid', 'Senior'],
    requiredSkills: ['SQL', 'Python', 'Tableau', 'Statistics']
  },
  {
    standardizedRole: 'DevOps Engineer',
    aliases: ['Site Reliability Engineer', 'Infrastructure Engineer', 'Platform Engineer'],
    category: 'Technology',
    subCategory: 'DevOps',
    typicalSeniority: ['Mid', 'Senior'],
    requiredSkills: ['CI/CD', 'Docker', 'Kubernetes', 'AWS']
  },
  {
    standardizedRole: 'Accountant',
    aliases: ['Financial Analyst', 'Accounting Specialist', 'Finance Associate'],
    category: 'Finance',
    subCategory: 'Accounting',
    typicalSeniority: ['Junior', 'Mid', 'Senior'],
    requiredSkills: ['GAAP', 'Excel', 'QuickBooks', 'Financial Reporting']
  },
  {
    standardizedRole: 'Customer Service Representative',
    aliases: ['CSR', 'Support Agent', 'Customer Support', 'Help Desk'],
    category: 'Customer Service',
    subCategory: 'Support',
    typicalSeniority: ['Junior', 'Mid'],
    requiredSkills: ['Communication', 'CRM', 'Problem Solving', 'Empathy']
  }
]

// ============================================================================
// GEOGRAPHY COST ADJUSTMENTS
// ============================================================================

export const geographyCostMultipliers: Record<Geography, number> = {
  'North America - Onshore': 1.0,
  'North America - Nearshore': 0.65,
  'EMEA - Western Europe': 0.95,
  'EMEA - Eastern Europe': 0.55,
  'APAC - India': 0.35,
  'APAC - Philippines': 0.40,
  'LATAM - Mexico': 0.50,
  'LATAM - Brazil': 0.48
}

// ============================================================================
// BASE RATES (North America Onshore)
// ============================================================================

const baseRates: Record<string, Record<SeniorityLevel, number>> = {
  'Senior Consultant': {
    Junior: 95,
    Mid: 125,
    Senior: 156,
    Principal: 195,
    Partner: 275
  },
  'Project Manager': {
    Junior: 85,
    Mid: 115,
    Senior: 145,
    Principal: 185,
    Partner: 250
  },
  'Business Analyst': {
    Junior: 75,
    Mid: 105,
    Senior: 135,
    Principal: 170,
    Partner: 220
  },
  'Software Developer': {
    Junior: 85,
    Mid: 115,
    Senior: 155,
    Principal: 195,
    Partner: 260
  },
  'QA Engineer': {
    Junior: 65,
    Mid: 95,
    Senior: 125,
    Principal: 160,
    Partner: 210
  },
  'Technical Architect': {
    Junior: 125,
    Mid: 155,
    Senior: 185,
    Principal: 235,
    Partner: 325
  },
  'Data Analyst': {
    Junior: 80,
    Mid: 110,
    Senior: 145,
    Principal: 180,
    Partner: 240
  },
  'DevOps Engineer': {
    Junior: 90,
    Mid: 120,
    Senior: 160,
    Principal: 200,
    Partner: 270
  },
  'Accountant': {
    Junior: 55,
    Mid: 75,
    Senior: 95,
    Principal: 125,
    Partner: 175
  },
  'Customer Service Representative': {
    Junior: 25,
    Mid: 35,
    Senior: 50,
    Principal: 70,
    Partner: 95
  }
}

// ============================================================================
// GENERATE COMPREHENSIVE RATE DATA
// ============================================================================

export function generateRateData(): RoleRate[] {
  const rates: RoleRate[] = []
  let idCounter = 1

  suppliers.forEach(supplier => {
    supplier.serviceLines.forEach(serviceLine => {
      supplier.geographies.forEach(geography => {
        // Get roles for this service line
        const rolesForService = getRolesForServiceLine(serviceLine)
        
        rolesForService.forEach(standardizedRole => {
          const taxonomy = roleTaxonomy.find(t => t.standardizedRole === standardizedRole)
          if (!taxonomy) return

          taxonomy.typicalSeniority.forEach(level => {
            const baseRate = baseRates[standardizedRole]?.[level]
            if (!baseRate) return

            // Apply geography multiplier
            const geoMultiplier = geographyCostMultipliers[geography]
            
            // Apply supplier variance (-10% to +15%)
            const supplierVariance = getSupplierVariance(supplier.tier)
            
            const hourlyRate = Math.round(baseRate * geoMultiplier * supplierVariance)

            rates.push({
              id: `rate-${idCounter++}`,
              role: standardizedRole,
              standardizedRole,
              level,
              serviceLine,
              geography,
              supplierId: supplier.id,
              hourlyRate,
              dailyRate: hourlyRate * 8,
              effectiveDate: new Date('2024-01-01'),
              chainIQBenchmark: 0,
              chainIQPercentile: 0,
              industryAverage: 0,
              totalAnnualCost: 0,
              variance: 0,
            } as any)
          })
        })
      })
    })
  })

  return rates
}

function getRolesForServiceLine(serviceLine: ServiceLine): string[] {
  const serviceLineRoles: Record<ServiceLine, string[]> = {
    'IT Consulting': [
      'Senior Consultant',
      'Project Manager',
      'Business Analyst',
      'Software Developer',
      'QA Engineer',
      'Technical Architect',
      'DevOps Engineer'
    ],
    'BPO Services': [
      'Project Manager',
      'Business Analyst',
      'Customer Service Representative',
      'Data Analyst'
    ],
    'Finance & Accounting': [
      'Accountant',
      'Business Analyst',
      'Data Analyst',
      'Senior Consultant'
    ],
    'HR Services': [
      'Senior Consultant',
      'Business Analyst',
      'Data Analyst'
    ],
    'Customer Service': [
      'Customer Service Representative',
      'Project Manager',
      'QA Engineer'
    ],
    'Data Analytics': [
      'Data Analyst',
      'Software Developer',
      'Technical Architect',
      'Business Analyst'
    ]
  }

  return serviceLineRoles[serviceLine] || []
}

function getSupplierVariance(tier: SupplierTier): number {
  const variances: Record<SupplierTier, [number, number]> = {
    'Big 4': [1.05, 1.15],
    'Tier 2': [0.95, 1.05],
    'Boutique': [0.90, 1.10],
    'Offshore': [0.85, 0.95]
  }

  const [min, max] = variances[tier]
  return min + Math.random() * (max - min)
}

// ============================================================================
// BENCHMARK STATISTICS
// ============================================================================

export function calculateBenchmarkStatistics(
  standardizedRole: string,
  geography: Geography,
  serviceLine: ServiceLine,
  allRates: RoleRate[]
): BenchmarkStatistics {
  const relevantRates = allRates.filter(
    r => r.standardizedRole === standardizedRole &&
         r.geography === geography &&
         r.serviceLine === serviceLine
  )

  const hourlyRates = relevantRates.map(r => r.hourlyRate).sort((a, b) => a - b)
  const n = hourlyRates.length

  if (n === 0) {
    return createEmptyStatistics(standardizedRole, geography, serviceLine)
  }

  const mean = hourlyRates.reduce((sum, rate) => sum + rate, 0) / n
  const median = hourlyRates[Math.floor(n / 2)]
  const p25 = hourlyRates[Math.floor(n * 0.25)]
  const p75 = hourlyRates[Math.floor(n * 0.75)]
  const p10 = hourlyRates[Math.floor(n * 0.10)]
  const p90 = hourlyRates[Math.floor(n * 0.90)]

  const variance = hourlyRates.reduce((sum, rate) => sum + Math.pow(rate - mean, 2), 0) / n
  const stdDev = Math.sqrt(variance)

  const confidence = Math.min(0.99, 0.5 + (n / 100) * 0.5)

  return {
    roleId: `${standardizedRole}-${geography}-${serviceLine}`,
    standardizedRole,
    geography,
    serviceLine,
    statistics: {
      mean: Math.round(mean),
      median: Math.round(median),
      p25: Math.round(p25),
      p75: Math.round(p75),
      p10: Math.round(p10),
      p90: Math.round(p90),
      stdDev: Math.round(stdDev),
      sampleSize: n,
      confidence
    },
    trends: generateTrends(median)
  }
}

function createEmptyStatistics(
  standardizedRole: string,
  geography: Geography,
  serviceLine: ServiceLine
): BenchmarkStatistics {
  return {
    roleId: `${standardizedRole}-${geography}-${serviceLine}`,
    standardizedRole,
    geography,
    serviceLine,
    statistics: {
      mean: 0,
      median: 0,
      p25: 0,
      p75: 0,
      p10: 0,
      p90: 0,
      stdDev: 0,
      sampleSize: 0,
      confidence: 0
    },
    trends: []
  }
}

function generateTrends(currentRate: number): BenchmarkStatistics['trends'] {
  const months = [
    'Feb 2023', 'Mar 2023', 'Apr 2023', 'May 2023', 'Jun 2023',
    'Jul 2023', 'Aug 2023', 'Sep 2023', 'Oct 2023', 'Nov 2023',
    'Dec 2023', 'Jan 2024'
  ]

  const trends: BenchmarkStatistics['trends'] = []
  let rate = currentRate * 0.92 // Start 8% lower a year ago

  months.forEach((month, index) => {
    // Gradual increase with some randomness
    const increase = (currentRate - rate) / (months.length - index) + (Math.random() - 0.5) * 2
    rate += increase

    const prevRate = (trends[index - 1]?.value as number) || (rate - 1)
    const direction: 'up' | 'down' | 'stable' = 
      rate > (prevRate as number) + 1 ? 'up' :
      rate < (prevRate as number) - 1 ? 'down' : 'stable'

    trends.push({
      month,
      value: Math.round(rate),
      direction
    })
  })

  return trends
}

// ============================================================================
// INITIALIZE DATA
// ============================================================================

export const allRateData = generateRateData()

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getSupplierById(id: string): SupplierData | undefined {
  return suppliers.find(s => s.id === id)
}

export function getSuppliersByServiceLine(serviceLine: ServiceLine): SupplierData[] {
  return suppliers.filter(s => s.serviceLines.includes(serviceLine))
}

export function getRatesBySupplier(
  supplierId: string,
  serviceLine?: ServiceLine,
  geography?: Geography
): RoleRate[] {
  return allRateData.filter(r => {
    if (r.supplierId !== supplierId) return false
    if (serviceLine && r.serviceLine !== serviceLine) return false
    if (geography && r.geography !== geography) return false
    return true
  })
}

export function compareRates(
  roleId: string,
  supplierIds: string[],
  geography: Geography,
  serviceLine: ServiceLine
): RoleRate[] {
  return allRateData.filter(r =>
    r.standardizedRole === roleId &&
    supplierIds.includes(r.supplierId) &&
    r.geography === geography &&
    r.serviceLine === serviceLine
  )
}

export function mapRoleToTaxonomy(rawRole: string): RoleTaxonomy | undefined {
  return roleTaxonomy.find(t =>
    t.standardizedRole.toLowerCase() === rawRole.toLowerCase() ||
    t.aliases.some(alias => alias.toLowerCase() === rawRole.toLowerCase())
  )
}

export function suggestRoleMappings(rawRole: string): Array<{ taxonomy: RoleTaxonomy; confidence: number }> {
  const suggestions: Array<{ taxonomy: RoleTaxonomy; confidence: number }> = []

  roleTaxonomy.forEach(taxonomy => {
    let confidence = 0

    // Exact match
    if (taxonomy.standardizedRole.toLowerCase() === rawRole.toLowerCase()) {
      confidence = 1.0
    }
    // Alias match
    else if (taxonomy.aliases.some(alias => alias.toLowerCase() === rawRole.toLowerCase())) {
      confidence = 0.95
    }
    // Partial match
    else if (taxonomy.standardizedRole.toLowerCase().includes(rawRole.toLowerCase()) ||
             rawRole.toLowerCase().includes(taxonomy.standardizedRole.toLowerCase())) {
      confidence = 0.7
    }
    // Word overlap
    else {
      const rawWords = rawRole.toLowerCase().split(/\s+/)
      const taxonomyWords = taxonomy.standardizedRole.toLowerCase().split(/\s+/)
      const overlap = rawWords.filter(w => taxonomyWords.includes(w)).length
      if (overlap > 0) {
        confidence = 0.4 + (overlap / Math.max(rawWords.length, taxonomyWords.length)) * 0.3
      }
    }

    if (confidence > 0.3) {
      suggestions.push({ taxonomy, confidence })
    }
  })

  return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 5)
}
