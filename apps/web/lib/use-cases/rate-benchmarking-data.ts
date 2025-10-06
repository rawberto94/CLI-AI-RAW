/**
 * Mock data for Rate Card Benchmarking use case
 */

export interface RateCardRole {
  role: string
  level: string
  hourlyRate: number
  dailyRate: number
  marketBenchmark: number
  variance: string
  variancePercent: number
  annualSavingsOpportunity: string
  status: 'above-market' | 'at-market' | 'below-market'
}

export interface RateCardData {
  supplier: string
  contract: string
  effectiveDate: string
  currency: string
  roles: RateCardRole[]
  summary: {
    totalRoles: number
    aboveMarket: number
    atMarket: number
    belowMarket: number
    totalAnnualSavings: string
    averageVariance: string
    confidence: string
  }
  recommendations: string[]
}

export const mockRateCardData: RateCardData = {
  supplier: "Deloitte Consulting",
  contract: "SOW-2024-001",
  effectiveDate: "2024-01-01",
  currency: "CHF",
  roles: [
    {
      role: "Senior Consultant",
      level: "Senior",
      hourlyRate: 175,
      dailyRate: 1232, // CHF (converted from $175/hr)
      marketBenchmark: 156,
      variance: "+CHF 84/day",
      variancePercent: 7.3,
      annualSavingsOpportunity: "CHF 21,840",
      status: "above-market"
    },
    {
      role: "Project Manager",
      level: "Senior",
      hourlyRate: 150,
      dailyRate: 1056, // CHF (converted from $150/hr)
      marketBenchmark: 145,
      variance: "+CHF 96/day",
      variancePercent: 10.0,
      annualSavingsOpportunity: "CHF 24,960",
      status: "above-market"
    },
    {
      role: "Business Analyst",
      level: "Mid",
      hourlyRate: 125,
      dailyRate: 880, // CHF (converted from $125/hr)
      marketBenchmark: 120,
      variance: "+CHF 40/day",
      variancePercent: 4.8,
      annualSavingsOpportunity: "CHF 10,400",
      status: "above-market"
    },
    {
      role: "Senior Developer",
      level: "Senior",
      hourlyRate: 140,
      dailyRate: 986, // CHF (converted from $140/hr)
      marketBenchmark: 155,
      variance: "-CHF 254/day",
      variancePercent: -20.5,
      annualSavingsOpportunity: "Competitive Rate",
      status: "below-market"
    },
    {
      role: "QA Engineer",
      level: "Mid",
      hourlyRate: 110,
      dailyRate: 774, // CHF (converted from $110/hr)
      marketBenchmark: 115,
      variance: "-CHF 146/day",
      variancePercent: -15.9,
      annualSavingsOpportunity: "Competitive Rate",
      status: "below-market"
    },
    {
      role: "Technical Architect",
      level: "Principal",
      hourlyRate: 195,
      dailyRate: 1372, // CHF (converted from $195/hr)
      marketBenchmark: 185,
      variance: "+CHF 92/day",
      variancePercent: 7.2,
      annualSavingsOpportunity: "CHF 23,920",
      status: "above-market"
    }
  ],
  summary: {
    totalRoles: 6,
    aboveMarket: 3,
    atMarket: 0,
    belowMarket: 2,
    totalAnnualSavings: "CHF 81,120",
    averageVariance: "+5.8%",
    confidence: "94%"
  },
  recommendations: [
    "Negotiate rates for Project Manager role - highest savings opportunity (CHF 24.9K annually)",
    "Bundle Senior Consultant and Technical Architect roles for volume discount",
    "Maintain current rates for Developer and QA roles - already highly competitive",
    "Consider performance-based pricing for Business Analyst role",
    "Request annual rate freeze to lock in competitive Developer and QA rates"
  ]
}

export const processingSteps = [
  {
    id: 1,
    title: "Upload Rate Card",
    description: "Upload your supplier's rate card document",
    duration: 500
  },
  {
    id: 2,
    title: "AI Extraction",
    description: "AI extracts all rates, roles, and terms",
    duration: 1500
  },
  {
    id: 3,
    title: "Normalization",
    description: "Standardize rates across different formats",
    duration: 1000
  },
  {
    id: 4,
    title: "Market Benchmarking",
    description: "Compare against 50+ supplier database",
    duration: 2000
  },
  {
    id: 5,
    title: "Savings Calculation",
    description: "Calculate potential savings opportunities",
    duration: 1000
  },
  {
    id: 6,
    title: "Generate Report",
    description: "Create negotiation-ready insights",
    duration: 500
  }
]