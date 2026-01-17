'use client'

import { useCallback, useMemo } from 'react'

interface ContractMetadata {
  document_number: string
  document_title: string
  contract_short_description: string
  contract_type: string
  jurisdiction: string
  contract_language: string
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
  const overviewData = contract?.extractedData?.overview
  const financialData = contract?.extractedData?.financial
  
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
    
    // First check if contract has external_parties array
    if (contract.external_parties && Array.isArray(contract.external_parties)) {
      return contract.external_parties
    }
    // Fallback to AI-extracted parties
    if (overviewData?.parties && Array.isArray(overviewData.parties)) {
      return overviewData.parties.map((p: any) => ({
        legalName: p.name || p.legalName || '',
        role: p.role || '',
        legalForm: p.legalForm || ''
      }))
    }
    // Fallback to legacy clientName/supplierName fields
    const parties: Array<{ legalName: string; role?: string; legalForm?: string }> = []
    if (contract.clientName) {
      parties.push({ legalName: contract.clientName, role: 'Client' })
    }
    if (contract.supplierName) {
      parties.push({ legalName: contract.supplierName, role: 'Supplier' })
    }
    return parties
  }, [contract, overviewData?.parties])
  
  const metadata: ContractMetadata = useMemo(() => {
    if (!contract) {
      return {
        document_number: '',
        document_title: '',
        contract_short_description: '',
        contract_type: '',
        jurisdiction: '',
        contract_language: '',
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
    
    return {
      // Identification
      document_number: contract.document_number || contract.id || '',
      document_title: contract.document_title || contract.filename || '',
      contract_short_description: contract.contract_short_description || contract.description || overviewData?.summary || '',
      contract_type: overviewData?.contractType || overviewData?.type || '',
      jurisdiction: contract.jurisdiction || overviewData?.jurisdiction || '',
      contract_language: contract.contract_language || overviewData?.language || 'en',
      
      // Parties
      external_parties: buildExternalParties(),
      
      // Commercials
      tcv_amount: contract.tcv_amount ?? financialData?.totalValue ?? (typeof contract.totalValue === 'number' ? contract.totalValue : 0),
      tcv_text: contract.tcv_text || financialData?.description || '',
      payment_type: contract.payment_type || financialData?.paymentType || 'none',
      billing_frequency_type: contract.billing_frequency_type || financialData?.billingFrequency || 'none',
      periodicity: contract.periodicity || financialData?.periodicity || 'none',
      currency: contract.currency || financialData?.currency || 'USD',
      
      // Dates
      signature_date: formatDateStr(contract.signature_date),
      signature_status: contract.signature_status || 'unknown',
      signature_required_flag: contract.signature_required_flag ?? (
        // Auto-flag if unsigned or partially signed
        contract.signature_status === 'unsigned' || 
        contract.signature_status === 'partially_signed' ||
        (!contract.signature_date && contract.signature_status !== 'signed')
      ),
      start_date: formatDateStr(contract.start_date || contract.effectiveDate || overviewData?.effectiveDate),
      end_date: formatDateStr(contract.end_date || contract.expirationDate || overviewData?.expirationDate),
      termination_date: formatDateStr(contract.termination_date),
      
      // Reminders & Notices
      reminder_enabled: contract.reminder_enabled ?? true,
      reminder_days_before_end: contract.reminder_days_before_end ?? 60,
      notice_period: contract.notice_period || overviewData?.noticePeriod || ''
    }
  }, [contract, overviewData, financialData, buildExternalParties, formatDateStr])
  
  // Derived state calculations
  const riskInfo = useMemo(() => {
    const riskData = contract?.extractedData?.risk
    const score = riskData?.riskScore || riskData?.overallScore
    const level = riskData?.riskLevel || riskData?.overallRisk
    
    let riskLevel: 'low' | 'medium' | 'high'
    if (level) {
      riskLevel = level.toLowerCase() as 'low' | 'medium' | 'high'
    } else if (score !== undefined) {
      riskLevel = score < 30 ? 'low' : score < 60 ? 'medium' : 'high'
    } else {
      riskLevel = 'medium'
    }
    
    const riskScore = score ?? (riskLevel === 'low' ? 25 : riskLevel === 'medium' ? 50 : 75)
    const risks = riskData?.risks || []
    
    return { riskLevel, riskScore, risks }
  }, [contract?.extractedData?.risk])
  
  const complianceInfo = useMemo(() => {
    const complianceData = contract?.extractedData?.compliance
    return {
      isCompliant: complianceData?.compliant ?? true,
      checks: complianceData?.checks || []
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
