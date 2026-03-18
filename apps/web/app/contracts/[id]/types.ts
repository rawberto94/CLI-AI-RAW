// ============================================================================
// Contract Detail Page — Shared Types
// ============================================================================

import type { DocumentClassification } from '@/lib/types/contract-metadata-schema'

export interface CategoryInfo {
  id: string
  name: string
  color: string
  icon: string
  path: string
  level?: number
  l1?: string | null
  l2?: string | null
  parent?: {
    id: string
    name: string
    code: string
    color: string
    icon: string
  } | null
}

export interface ParentContract {
  id: string
  title: string
  type: string | null
  status: string
  clientName: string | null
  supplierName: string | null
  effectiveDate: string | null
  expirationDate: string | null
}

export interface ChildContract {
  id: string
  title: string
  type: string | null
  status: string
  relationshipType: string | null
  clientName: string | null
  supplierName: string | null
  effectiveDate: string | null
  expirationDate: string | null
  totalValue: number | null
  createdAt: string | null
}

export interface ExternalParty {
  legalName: string
  role?: string
  legalForm?: string
}

export interface ContractProcessing {
  progress: number
  currentStage: string
  status: string
}

export interface ContractData {
  id: string
  filename: string
  status: string
  uploadDate: string
  fileSize: number
  mimeType: string
  extractedData?: Record<string, any>
  artifacts?: any[]
  artifactCount?: number
  summary?: any
  insights?: any[]
  category?: CategoryInfo | null
  categoryL1?: string | null
  categoryL2?: string | null
  contractCategoryId?: string | null
  classifiedAt?: string | null
  aiSuggestedCategory?: CategoryInfo | null
  processing?: ContractProcessing
  // Contract metadata fields
  totalValue?: number | string | null
  currency?: string | null
  contractType?: string | null
  effectiveDate?: string | null
  expirationDate?: string | null
  clientName?: string | null
  supplierName?: string | null
  description?: string | null
  tags?: string[] | null
  // Official schema fields
  document_number?: string | null
  document_title?: string | null
  contract_short_description?: string | null
  jurisdiction?: string | null
  contract_language?: string | null
  external_parties?: ExternalParty[] | null
  tcv_amount?: number | null
  tcv_text?: string | null
  payment_type?: string | null
  billing_frequency_type?: string | null
  periodicity?: string | null
  signature_date?: string | null
  signature_status?: string | null
  signature_required_flag?: boolean | null
  document_classification?: DocumentClassification | null
  document_classification_warning?: string | null
  start_date?: string | null
  end_date?: string | null
  termination_date?: string | null
  notice_period?: string | null
  reminder_enabled?: boolean | null
  reminder_days_before_end?: number | null
  // Contract Hierarchy
  parentContract?: ParentContract | null
  childContracts?: ChildContract[]
  parentContractId?: string | null
  relationshipType?: string | null
  relationshipNote?: string | null
  linkedAt?: string | null
  // Raw text for AI analysis
  rawText?: string | null
  // AI metadata
  aiMetadata?: any
  metadata?: any
  overview?: any
  financial?: any
}

export interface ContractVersion {
  id: string
  version: string
  title: string
  createdAt: Date
  createdBy: string
  status: 'active' | 'archived'
}

export interface ContractNote {
  id: string
  content: string
  createdAt: Date
  updatedAt?: Date
  author: { id: string; name: string; avatar?: string }
  isPinned?: boolean
}

export interface HealthData {
  healthScore: number
  completeness: number
  issues: Array<{ type: string; severity: 'low' | 'medium' | 'high'; message: string }>
}

export interface AIExtensionRecommendation {
  recommendedAction: string
  reasoning: string
  suggestedExtensionMonths?: number
  valueRecommendation: {
    adjustValue: boolean
    suggestedValue?: number
    adjustmentReason: string
  }
  risks: Array<{ risk: string; severity: string; mitigation: string }>
  advantages: string[]
}

export type TabValue = 'overview' | 'details' | 'ai' | 'activity'
