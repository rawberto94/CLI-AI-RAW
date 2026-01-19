import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTenantIdFromRequest } from '@/lib/tenant-server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/contracts/[id]/family-health
 * Returns health assessment for a contract and its family
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: contractId } = await params
    let tenantId: string
    
    try {
      tenantId = await getTenantIdFromRequest(request)
    } catch {
      tenantId = 'demo'
    }

    // Fetch the contract with its hierarchy
    const contract = await prisma.contract.findFirst({
      where: { 
        id: contractId, 
        tenantId,
        isDeleted: false 
      },
      select: {
        id: true,
        contractTitle: true,
        fileName: true,
        contractType: true,
        contractCategoryId: true,
        documentRole: true,
        status: true,
        totalValue: true,
        effectiveDate: true,
        expirationDate: true,
        clientName: true,
        supplierName: true,
        parentContractId: true,
        relationshipType: true,
        isExpired: true,
        daysUntilExpiry: true,
        parentContract: {
          select: {
            id: true,
            contractTitle: true,
            fileName: true,
            contractType: true,
            status: true,
            isExpired: true,
            expirationDate: true,
          }
        },
        childContracts: {
          where: { isDeleted: false },
          select: {
            id: true,
            contractTitle: true,
            fileName: true,
            contractType: true,
            status: true,
            totalValue: true,
            relationshipType: true,
            effectiveDate: true,
            expirationDate: true,
            isExpired: true,
            daysUntilExpiry: true,
            clientName: true,
            supplierName: true,
          }
        }
      }
    })

    if (!contract) {
      return NextResponse.json(
        { success: false, error: 'Contract not found' },
        { status: 404 }
      )
    }

    // Calculate family statistics
    const members = contract.childContracts.map(child => ({
      id: child.id,
      title: child.contractTitle || child.fileName || 'Untitled',
      type: child.contractType,
      status: child.status,
      relationshipType: child.relationshipType,
      clientName: child.clientName,
      supplierName: child.supplierName,
      totalValue: child.totalValue ? Number(child.totalValue) : null,
      effectiveDate: child.effectiveDate?.toISOString() || null,
      expirationDate: child.expirationDate?.toISOString() || null,
      isExpired: child.isExpired || false,
      daysUntilExpiry: child.daysUntilExpiry,
    }))

    const totalContracts = 1 + members.length
    const totalValue = (contract.totalValue ? Number(contract.totalValue) : 0) + 
      members.reduce((sum, m) => sum + (m.totalValue || 0), 0)

    // Calculate issues
    const issues: Array<{
      type: 'orphan' | 'expired_parent' | 'missing_sla' | 'missing_dpa' | 'value_mismatch'
      severity: 'low' | 'medium' | 'high'
      message: string
      contractId?: string
      action?: string
    }> = []

    // Check for expired parent
    if (contract.parentContract?.isExpired) {
      issues.push({
        type: 'expired_parent',
        severity: 'high',
        message: 'Parent contract has expired',
        contractId: contract.parentContract.id,
        action: 'Review and renew parent contract'
      })
    }

    // Check for expired children
    const expiredChildren = members.filter(m => m.isExpired)
    if (expiredChildren.length > 0) {
      issues.push({
        type: 'expired_parent', // Reusing type
        severity: 'medium',
        message: `${expiredChildren.length} child contract${expiredChildren.length > 1 ? 's have' : ' has'} expired`,
        action: 'Review expired child contracts'
      })
    }

    // Check for contracts expiring soon
    const expiringSoon = members.filter(m => m.daysUntilExpiry !== null && m.daysUntilExpiry <= 30 && m.daysUntilExpiry > 0)
    if (expiringSoon.length > 0) {
      issues.push({
        type: 'orphan', // Reusing type
        severity: 'medium',
        message: `${expiringSoon.length} contract${expiringSoon.length > 1 ? 's' : ''} expiring within 30 days`,
        action: 'Start renewal process'
      })
    }

    // Check if this is a SOW/SLA/DPA without a parent (orphan detection)
    const shouldHaveParent = ['scope_work_authorization', 'performance_operations', 'data_security_privacy']
      .includes(contract.contractCategoryId || '')
    
    if (shouldHaveParent && !contract.parentContractId) {
      issues.push({
        type: 'orphan',
        severity: 'medium',
        message: 'This contract type typically has a parent MSA',
        action: 'Consider linking to a master agreement'
      })
    }

    // Calculate health score
    let healthScore = 100
    
    // Deduct for issues
    issues.forEach(issue => {
      switch (issue.severity) {
        case 'high': healthScore -= 20; break
        case 'medium': healthScore -= 10; break
        case 'low': healthScore -= 5; break
      }
    })

    // Bonus for complete hierarchy
    if (contract.parentContractId) healthScore = Math.min(100, healthScore + 5)
    if (members.length > 0) healthScore = Math.min(100, healthScore + 5)

    healthScore = Math.max(0, healthScore)

    // Calculate completeness - now includes metadata verification progress
    let completeness = 0
    
    // Fetch metadata to check field validations (60% weight for verification)
    // _fieldValidations is stored inside the customFields JSON column
    const metadata = await prisma.contractMetadata.findUnique({
      where: { contractId },
      select: { customFields: true }
    })
    
    // Calculate verification progress
    let verificationProgress = 0
    if (metadata?.customFields && typeof metadata.customFields === 'object') {
      const customFields = metadata.customFields as Record<string, unknown>
      const fieldValidations = customFields._fieldValidations as Record<string, { status?: string; verified?: boolean }> | undefined
      
      if (fieldValidations && typeof fieldValidations === 'object') {
        const entries = Object.entries(fieldValidations)
        if (entries.length > 0) {
          // Check for both formats: status='validate'/'validated' (UI) or verified=true (legacy)
          const verifiedCount = entries.filter(([, v]) => 
            v?.status === 'validate' || v?.status === 'validated' || v?.verified === true
          ).length
          // Total fields should be based on all defined fields in schema (not just touched ones)
          // Based on CONTRACT_METADATA_FIELDS in contract-metadata-schema.ts
          const TOTAL_METADATA_FIELDS = 26
          verificationProgress = Math.round((verifiedCount / TOTAL_METADATA_FIELDS) * 100)
        }
      }
    }
    
    // Weighted completeness calculation:
    // Completeness primarily reflects metadata verification progress
    // with small bonuses for contract hierarchy
    completeness = verificationProgress
    
    // Small bonuses for contract setup (max 10%)
    if (contract.parentContractId || contract.contractCategoryId === 'master_framework') completeness += 4
    if (members.length > 0) completeness += 3
    if (contract.totalValue) completeness += 2
    if (contract.effectiveDate && contract.expirationDate) completeness += 1
    completeness = Math.min(100, completeness)

    // Find suggested parents if this is an orphan
    const suggestedParents: Array<{
      id: string
      title: string
      score: number
      reason: string
    }> = []

    if (!contract.parentContractId && shouldHaveParent) {
      // Find potential MSAs with same client/supplier
      const clientSupplierFilters = [
        contract.clientName ? { clientName: contract.clientName } : null,
        contract.supplierName ? { supplierName: contract.supplierName } : null,
      ].filter((x): x is { clientName: string } | { supplierName: string } => x !== null)

      const potentialParents = await prisma.contract.findMany({
        where: {
          tenantId,
          id: { not: contractId },
          isDeleted: false,
          AND: [
            {
              OR: [
                { contractCategoryId: 'master_framework' },
                { contractType: { contains: 'MSA', mode: 'insensitive' } },
                { contractType: { contains: 'Master', mode: 'insensitive' } },
              ],
            },
            clientSupplierFilters.length > 0 ? { OR: clientSupplierFilters } : {},
          ],
        },
        select: {
          id: true,
          contractTitle: true,
          fileName: true,
          clientName: true,
          supplierName: true,
          effectiveDate: true,
          expirationDate: true,
        },
        take: 5
      })

      for (const parent of potentialParents) {
        let score = 50 // Base score
        const reasons: string[] = []

        // Same client
        if (parent.clientName && parent.clientName === contract.clientName) {
          score += 25
          reasons.push('Same client')
        }

        // Same supplier
        if (parent.supplierName && parent.supplierName === contract.supplierName) {
          score += 25
          reasons.push('Same supplier')
        }

        // Date overlap
        if (parent.effectiveDate && contract.effectiveDate) {
          const parentStart = new Date(parent.effectiveDate)
          const contractStart = new Date(contract.effectiveDate)
          if (parentStart <= contractStart) {
            score += 10
            reasons.push('Date overlap')
          }
        }

        suggestedParents.push({
          id: parent.id,
          title: parent.contractTitle || parent.fileName || 'Untitled',
          score: Math.min(100, score),
          reason: reasons.join(', ') || 'Compatible contract type'
        })
      }

      // Sort by score
      suggestedParents.sort((a, b) => b.score - a.score)
    }

    const root = contract.parentContract ? {
      id: contract.parentContract.id,
      title: contract.parentContract.contractTitle || contract.parentContract.fileName || 'Untitled',
      type: contract.parentContract.contractType,
      status: contract.parentContract.status,
      relationshipType: contract.relationshipType,
      clientName: null,
      supplierName: null,
      totalValue: null,
      effectiveDate: null,
      expirationDate: contract.parentContract.expirationDate?.toISOString() || null,
      isExpired: contract.parentContract.isExpired || false,
      daysUntilExpiry: null,
    } : null

    return NextResponse.json({
      success: true,
      root,
      members,
      totalContracts,
      totalValue,
      healthScore,
      completeness,
      issues,
      suggestedParents
    })
  } catch {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to retrieve family health',
        // Provide fallback data
        root: null,
        members: [],
        totalContracts: 1,
        totalValue: 0,
        healthScore: 100,
        completeness: 100,
        issues: [],
        suggestedParents: []
      },
      { status: 200 } // Return 200 with fallback data
    )
  }
}
