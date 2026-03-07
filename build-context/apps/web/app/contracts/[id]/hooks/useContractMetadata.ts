'use client'

import { useCallback, useMemo } from 'react'
import type { DocumentClassification } from '@/lib/types/contract-metadata-schema'

interface ContractMetadata {
  document_number: string
  document_title: string
  contract_short_description: string
  contract_type: string
  jurisdiction: string
  contract_language: string
  document_classification: DocumentClassification
  document_classification_warning?: string
  external_parties: Array<{ legalName: string; role?: string; legalForm?: string }>
  tcv_amount: number
  tcv_text: string
  payment_type: string
  billing_frequency_type: string
  periodicity: string
  currency: string
  signature_date: string
  signature_status: 'signed' | 'partially_signed' | 'unsigned' | 'unknown'
  signature_required_flag: boolean
  start_date: string
  end_date: string
  termination_date: string
  reminder_enabled: boolean
  reminder_days_before_end: number
  notice_period: string
}

interface ContractData {
  id: string
  filename?: string
  status?: string
  uploadDate?: string
  fileSize?: number
  mimeType?: string
  extractedData?: any
  document_number?: string | null
  document_title?: string | null
  contract_short_description?: string | null
  jurisdiction?: string | null
  contract_language?: string | null
  document_classification?: DocumentClassification | null
  document_classification_warning?: string | null
  external_parties?: Array<{ legalName: string; role?: string; legalForm?: string }> | null
  tcv_amount?: number | null
  tcv_text?: string | null
  payment_type?: string | null
  billing_frequency_type?: string | null
  periodicity?: string | null
  currency?: string | null
  effectiveDate?: string | null
  expirationDate?: string | null
  signature_date?: string | null
  signature_status?: 'signed' | 'partially_signed' | 'unsigned' | 'unknown' | null
  signature_required_flag?: boolean | null
  start_date?: string | null
  end_date?: string | null
  termination_date?: string | null
  reminder_enabled?: boolean | null
  reminder_days_before_end?: number | null
  notice_period?: string | null
  clientName?: string | null
  supplierName?: string | null
  description?: string | null
  totalValue?: number | string | null
}

/**
 * Hook to derive and manage contract metadata from various sources
 * Prioritizes: DB fields > AI-extracted > defaults
 */
export function useContractMetadata(contract: ContractData | null) {
  // Support multiple possible locations for artifact data
  const overviewData = contract?.extractedData?.overview || contract?.extractedData?.metadata || contract?.metadata || contract?.overview
  const financialData = contract?.extractedData?.financial || contract?.financial
  
  // Helper to extract value from wrapped or direct values
  // AI may return { value: X, source: '...' } or just X
  const unwrapValue = useCallback((val: any): any => {
    if (val === null || val === undefined) return null
    if (typeof val === 'object' && 'value' in val) return val.value
    return val
  }, [])
  
  // Helper to extract numeric value from various formats
  const extractNumericValue = useCallback((val: any): number => {
    const unwrapped = unwrapValue(val)
    if (unwrapped === null || unwrapped === undefined) return 0
    if (typeof unwrapped === 'number') return unwrapped
    if (typeof unwrapped === 'string') {
      // Remove currency symbols and parse
      const cleaned = unwrapped.replace(/[$€£¥,]/g, '').trim()
      const parsed = parseFloat(cleaned)
      return isNaN(parsed) ? 0 : parsed
    }
    return 0
  }, [unwrapValue])
  
  const formatDateStr = useCallback((date: string | Date | null | undefined): string => {
    if (!date) return ''
    try {
      const result = new Date(date).toISOString().split('T')[0]
      return result ?? ''
    } catch {
      return ''
    }
  }, [])
  
  const buildExternalParties = useCallback((): Array<{ legalName: string; role?: string; legalForm?: string }> => {
    if (!contract) return []
    
    // First check if contract has external_parties array (built by API from artifacts)
    if (contract.external_parties && Array.isArray(contract.external_parties) && contract.external_parties.length > 0) {
      return contract.external_parties.filter((p: any) => p.legalName)
    }
    
    // Fallback to AI-extracted parties from overview artifact
    // Handle various possible structures
    const partiesData = overviewData?.parties
    if (partiesData && Array.isArray(partiesData) && partiesData.length > 0) {
      return partiesData
        .filter((p: any) => unwrapValue(p.name) || unwrapValue(p.legalName) || p.value?.name)
        .map((p: any) => ({
          // Handle wrapped values (e.g., { value: 'Name', source: '...' })
          legalName: unwrapValue(p.legalName) || unwrapValue(p.name) || p.value?.name || unwrapValue(p.value) || '',
          role: unwrapValue(p.role) || unwrapValue(p.type) || '',
          legalForm: unwrapValue(p.legalForm) || unwrapValue(p.entityType) || ''
        }))
    }
    
    // Fallback to enterprise metadata (aiMetadata.external_parties from worker)
    const aiMeta = (contract as any).aiMetadata
    if (aiMeta?.external_parties && Array.isArray(aiMeta.external_parties) && aiMeta.external_parties.length > 0) {
      return aiMeta.external_parties
        .filter((p: any) => p.legalName || p.name)
        .map((p: any) => ({
          legalName: p.legalName || p.name || '',
          role: p.role || '',
          legalForm: p.legalForm || ''
        }))
    }
    
    // Fallback to legacy clientName/supplierName fields on contract
    const parties: Array<{ legalName: string; role?: string; legalForm?: string }> = []
    if (contract.clientName) {
      parties.push({ legalName: contract.clientName, role: 'Client' })
    }
    if (contract.supplierName) {
      parties.push({ legalName: contract.supplierName, role: 'Supplier' })
    }
    
    // Also check overview for party names if still empty
    if (parties.length === 0 && overviewData) {
      // Some AI outputs have partyA/partyB structure
      const partyAName = unwrapValue(overviewData.partyA?.name) || unwrapValue(overviewData.party_a_name)
      const partyBName = unwrapValue(overviewData.partyB?.name) || unwrapValue(overviewData.party_b_name)
      if (partyAName) {
        parties.push({ legalName: partyAName, role: 'Party A' })
      }
      if (partyBName) {
        parties.push({ legalName: partyBName, role: 'Party B' })
      }
      // Check for client_name/supplier_name in artifact data
      const clientName = unwrapValue(overviewData.client_name) || unwrapValue(overviewData.clientName)
      const supplierName = unwrapValue(overviewData.supplier_name) || unwrapValue(overviewData.supplierName) || unwrapValue(overviewData.vendor_name)
      if (clientName && !parties.some(p => p.legalName === clientName)) {
        parties.push({ legalName: clientName, role: 'Client' })
      }
      if (supplierName && !parties.some(p => p.legalName === supplierName)) {
        parties.push({ legalName: supplierName, role: 'Supplier' })
      }
    }
    
    return parties
  }, [contract, overviewData, unwrapValue])
  
  const metadata: ContractMetadata = useMemo(() => {
    if (!contract) {
      return {
        document_number: '',
        document_title: '',
        contract_short_description: '',
        contract_type: '',
        jurisdiction: '',
        contract_language: '',
        document_classification: 'unknown' as DocumentClassification,
        document_classification_warning: undefined,
        external_parties: [],
        tcv_amount: 0,
        tcv_text: '',
        payment_type: 'none',
        billing_frequency_type: 'none',
        periodicity: 'none',
        currency: 'USD',
        signature_date: '',
        signature_status: 'unknown' as const,
        signature_required_flag: false,
        start_date: '',
        end_date: '',
        termination_date: '',
        reminder_enabled: true,
        reminder_days_before_end: 60,
        notice_period: ''
      }
    }
    
    // Get executive summary data if available
    const execSummaryData = contract?.extractedData?.executive_summary
    
    return {
      // Identification
      document_number: contract.document_number || contract.id || '',
      document_title: contract.document_title || (contract as any).contractTitle || unwrapValue(overviewData?.title) || unwrapValue(overviewData?.contractTitle) || contract.filename || '',
      contract_short_description: contract.contract_short_description || contract.description || unwrapValue(execSummaryData?.executiveSummary) || unwrapValue(execSummaryData?.summary) || unwrapValue(overviewData?.summary) || '',
      contract_type: (contract as any).contractType || unwrapValue(overviewData?.contractType) || unwrapValue(overviewData?.type) || unwrapValue(overviewData?.contract_type) || '',
      jurisdiction: contract.jurisdiction || unwrapValue(overviewData?.jurisdiction) || '',
      contract_language: contract.contract_language || unwrapValue(overviewData?.language) || unwrapValue(overviewData?.contract_language) || '',
      document_classification: contract.document_classification || unwrapValue(overviewData?.documentClassification) || 'contract' as DocumentClassification,
      document_classification_warning: contract.document_classification_warning || unwrapValue(overviewData?.documentClassificationWarning),
      
      // Parties
      external_parties: buildExternalParties(),
      
      // Commercials - check multiple sources and handle wrapped values
      tcv_amount: extractNumericValue(
        contract.tcv_amount ?? 
        contract.totalValue ?? 
        overviewData?.totalValue ?? 
        financialData?.totalValue ?? 
        overviewData?.total_value ?? 
        financialData?.total_value ??
        overviewData?.contractValue ??
        0
      ),
      tcv_text: contract.tcv_text || 
        unwrapValue(financialData?.description) || 
        unwrapValue(overviewData?.summary) || '',
      payment_type: contract.payment_type || 
        unwrapValue(financialData?.paymentType) || 
        unwrapValue(financialData?.payment_type) || 'none',
      billing_frequency_type: contract.billing_frequency_type || 
        unwrapValue(financialData?.billingFrequency) || 
        unwrapValue(financialData?.billing_frequency) || 'none',
      periodicity: contract.periodicity || 
        unwrapValue(financialData?.periodicity) || 'none',
      currency: contract.currency || 
        unwrapValue(financialData?.currency) || 
        unwrapValue(overviewData?.currency) || 'USD',
      
      // Dates - handle wrapped values
      signature_date: formatDateStr(
        contract.signature_date || 
        unwrapValue(overviewData?.signatureDate) || 
        unwrapValue(overviewData?.signature_date)
      ),
      signature_status: contract.signature_status || 'unknown',
      signature_required_flag: contract.signature_required_flag ?? (
        // Auto-flag if unsigned or partially signed
        contract.signature_status === 'unsigned' || 
        contract.signature_status === 'partially_signed' ||
        (!contract.signature_date && contract.signature_status !== 'signed')
      ),
      start_date: formatDateStr(
        contract.start_date || 
        (contract as any).startDate ||
        contract.effectiveDate || 
        unwrapValue(overviewData?.effectiveDate) || 
        unwrapValue(overviewData?.effective_date) ||
        unwrapValue(overviewData?.startDate) ||
        unwrapValue(overviewData?.start_date)
      ),
      end_date: formatDateStr(
        contract.end_date || 
        (contract as any).endDate ||
        contract.expirationDate || 
        unwrapValue(overviewData?.expirationDate) || 
        unwrapValue(overviewData?.expiration_date) ||
        unwrapValue(overviewData?.endDate) ||
        unwrapValue(overviewData?.end_date)
      ),
      termination_date: formatDateStr(
        contract.termination_date || 
        (contract as any).terminationDate ||
        unwrapValue(overviewData?.terminationDate) ||
        unwrapValue(overviewData?.termination_date)
      ),
      
      // Reminders & Notices
      reminder_enabled: contract.reminder_enabled ?? true,
      reminder_days_before_end: contract.reminder_days_before_end ?? 60,
      notice_period: contract.notice_period || unwrapValue(overviewData?.noticePeriod) || unwrapValue(overviewData?.notice_period) || ''
    }
  }, [contract, overviewData, financialData, buildExternalParties, formatDateStr, extractNumericValue, unwrapValue])
  
  // Derived state calculations
  const riskInfo = useMemo(() => {
    const riskData = contract?.extractedData?.risk
    const score = riskData?.riskScore || riskData?.overallScore
    const level = riskData?.riskLevel || riskData?.overallRisk
    
    // If no risk data at all (no artifact), mark as not-assessed rather than fabricating 'medium'
    const hasRiskData = riskData && !riskData?._meta?.fallback && !riskData?.error
    
    let riskLevel: 'low' | 'medium' | 'high'
    if (level) {
      riskLevel = level.toLowerCase() as 'low' | 'medium' | 'high'
    } else if (score !== undefined && score !== null) {
      riskLevel = score < 30 ? 'low' : score < 60 ? 'medium' : 'high'
    } else {
      // No risk data — default to 'low' (neutral) rather than alarming 'medium'
      riskLevel = hasRiskData ? 'medium' : 'low'
    }
    
    const riskScore = score ?? (hasRiskData ? (riskLevel === 'low' ? 25 : riskLevel === 'medium' ? 50 : 75) : 0)
    const risks = riskData?.risks || []
    
    // Extract risk factors as string array for display
    const factors: string[] = risks.map((r: { title?: string; description?: string }) => 
      r.title || r.description || ''
    ).filter(Boolean)
    
    // Extract mitigations if available
    const mitigations: string[] = riskData?.mitigations || riskData?.recommendations || []
    
    return { riskLevel, riskScore, risks, factors, mitigations }
  }, [contract?.extractedData?.risk])
  
  const complianceInfo = useMemo(() => {
    const complianceData = contract?.extractedData?.compliance
    const checks = complianceData?.checks || []
    
    // Extract violations from failed checks
    const violations: string[] = checks
      .filter((c: { status?: string; passed?: boolean }) => c.status === 'failed' || c.passed === false)
      .map((c: { name?: string; message?: string }) => c.message || c.name || '')
      .filter(Boolean)
    
    // Calculate compliance score from checks if available
    const passedChecks = checks.filter((c: { status?: string; passed?: boolean }) => 
      c.status === 'passed' || c.passed === true
    ).length
    const score = checks.length > 0 ? Math.round((passedChecks / checks.length) * 100) : undefined
    
    return {
      isCompliant: complianceData?.compliant ?? (violations.length === 0),
      checks,
      violations,
      score
    }
  }, [contract?.extractedData?.compliance])
  
  const isProcessing = useMemo(() => {
    const status = contract?.status?.toLowerCase()
    return status === 'processing' || status === 'uploaded'
  }, [contract?.status])
  
  return {
    metadata,
    riskInfo,
    complianceInfo,
    isProcessing,
    overviewData,
    financialData,
  }
}

export type { ContractMetadata, ContractData }
