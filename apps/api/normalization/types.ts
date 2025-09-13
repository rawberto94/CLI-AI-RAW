export type SupplierCanonical = {
  supplierId: string
  canonicalName: string
  aka: string[]
  countryCodes: string[]
  domains: string[]
  registrationIds: string[]
  version: string
  createdAt: string
  updatedAt: string
}

export type RoleCanonical = {
  roleId: string
  canonicalRole: string
  level: number
  capability?: string[]
  uomDefaults: 'day' | 'hour' | 'month'
  minPlausibleRate?: number
  maxPlausibleRate?: number
  version: string
}

export type SupplierAlias = {
  id: string
  aliasText: string
  supplierId: string
  confidence: number
  approvedBy?: string
  firstSeen: string
  lastSeen: string
  autoMapped: boolean
}

export type RoleAlias = {
  id: string
  rawRole: string
  capabilityHint?: string[]
  roleId: string
  confidence: number
  approvedBy?: string
  createdAt: string
  autoMapped: boolean
}

export type NormalizationMatch = {
  type: 'supplier' | 'role'
  rawValue: string
  matches: Array<{
    id: string
    canonicalName: string
    score: number
    scoreBreakdown: {
      jaroWinkler: number
      tokenSet: number
      phonetic: number
      contextBoost?: number
    }
    evidence: string[]
  }>
  status: 'auto' | 'review' | 'unmapped'
  selectedId?: string
}
