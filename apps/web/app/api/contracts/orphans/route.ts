import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { contractService } from 'data-orchestration/services'
import { getTenantIdFromRequest } from '@/lib/tenant-server'
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

export const dynamic = 'force-dynamic'

/**
 * GET /api/contracts/orphans
 * Returns contracts that should have parent relationships but don't
 */
export const GET = withAuthApiHandler(async (request, ctx) => {
  let tenantId: string
  
  try {
    tenantId = await getTenantIdFromRequest(request)
  } catch {
    tenantId = 'demo'
  }

  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') || '50')
  const includeExpired = searchParams.get('includeExpired') === 'true'

  // Categories that typically should have parent contracts
  const childCategories = [
    'scope_work_authorization',
    'performance_operations', 
    'data_security_privacy',
    'commercial_terms'
  ]

  // Contract types that suggest they should have parents
  const childTypes = [
    'SOW', 'Statement of Work',
    'SLA', 'Service Level Agreement',
    'DPA', 'Data Processing Agreement',
    'Amendment', 'Addendum',
    'Change Order', 'Work Order',
    'Task Order', 'Purchase Order'
  ]

  // Find orphan contracts
  const orphanContracts = await prisma.contract.findMany({
    where: {
      tenantId,
      isDeleted: false,
      parentContractId: null,
      OR: [
        { contractCategoryId: { in: childCategories } },
        { contractType: { in: childTypes, mode: 'insensitive' } },
        { fileName: { contains: 'SOW', mode: 'insensitive' } },
        { fileName: { contains: 'Amendment', mode: 'insensitive' } },
        { fileName: { contains: 'SLA', mode: 'insensitive' } },
        { fileName: { contains: 'DPA', mode: 'insensitive' } },
        { contractTitle: { contains: 'Statement of Work', mode: 'insensitive' } },
        { contractTitle: { contains: 'Amendment', mode: 'insensitive' } },
      ],
      ...(includeExpired ? {} : { isExpired: false }),
    },
    select: {
      id: true,
      contractTitle: true,
      fileName: true,
      contractType: true,
      contractCategoryId: true,
      status: true,
      clientName: true,
      supplierName: true,
      totalValue: true,
      effectiveDate: true,
      expirationDate: true,
      isExpired: true,
      createdAt: true,
    },
    orderBy: [
      { isExpired: 'asc' },
      { createdAt: 'desc' }
    ],
    take: limit
  })

  // Find suggested parents for each orphan
  const orphansWithSuggestions = await Promise.all(
    orphanContracts.map(async (orphan) => {
      // Build client/supplier filter conditions
      const clientSupplierFilters = [
        orphan.clientName ? { clientName: orphan.clientName } : null,
        orphan.supplierName ? { supplierName: orphan.supplierName } : null,
      ].filter((x): x is { clientName: string } | { supplierName: string } => x !== null)

      // Find potential MSAs with same client/supplier
      const potentialParents = await prisma.contract.findMany({
        where: {
          tenantId,
          id: { not: orphan.id },
          isDeleted: false,
          parentContractId: null, // Only root contracts
          AND: [
            {
              OR: [
                { contractCategoryId: 'master_framework' },
                { contractType: { contains: 'MSA', mode: 'insensitive' } },
                { contractType: { contains: 'Master', mode: 'insensitive' } },
                { contractType: { contains: 'Framework', mode: 'insensitive' } },
                { fileName: { contains: 'MSA', mode: 'insensitive' } },
                { contractTitle: { contains: 'Master', mode: 'insensitive' } },
              ],
            },
            clientSupplierFilters.length > 0 ? { OR: clientSupplierFilters } : {},
          ],
        },
        select: {
          id: true,
          contractTitle: true,
          fileName: true,
          contractType: true,
          clientName: true,
          supplierName: true,
        },
        take: 3
      })

      const suggestedParents = potentialParents.map(parent => {
        let score = 50
        const reasons: string[] = []

        if (parent.clientName && parent.clientName === orphan.clientName) {
          score += 25
          reasons.push('Same client')
        }
        if (parent.supplierName && parent.supplierName === orphan.supplierName) {
          score += 25
          reasons.push('Same supplier')
        }

        return {
          id: parent.id,
          title: parent.contractTitle || parent.fileName || 'Untitled',
          type: parent.contractType,
          score: Math.min(100, score),
          reason: reasons.join(', ') || 'Compatible type'
        }
      }).sort((a, b) => b.score - a.score)

      // Determine suggested relationship type
      let suggestedRelationshipType = 'SOW_UNDER_MSA'
      const titleLower = (orphan.contractTitle || orphan.fileName || '').toLowerCase()
      const typeLower = (orphan.contractType || '').toLowerCase()
      
      if (titleLower.includes('sla') || typeLower.includes('sla') || typeLower.includes('service level')) {
        suggestedRelationshipType = 'SLA_UNDER_MSA'
      } else if (titleLower.includes('dpa') || typeLower.includes('dpa') || typeLower.includes('data processing')) {
        suggestedRelationshipType = 'DPA_UNDER_MSA'
      } else if (titleLower.includes('amendment') || typeLower.includes('amendment')) {
        suggestedRelationshipType = 'AMENDMENT'
      } else if (titleLower.includes('addendum') || typeLower.includes('addendum')) {
        suggestedRelationshipType = 'ADDENDUM'
      } else if (titleLower.includes('change order') || typeLower.includes('change order')) {
        suggestedRelationshipType = 'CHANGE_ORDER'
      }

      return {
        id: orphan.id,
        title: orphan.contractTitle || orphan.fileName || 'Untitled',
        type: orphan.contractType,
        category: orphan.contractCategoryId,
        status: orphan.status,
        clientName: orphan.clientName,
        supplierName: orphan.supplierName,
        totalValue: orphan.totalValue ? Number(orphan.totalValue) : null,
        effectiveDate: orphan.effectiveDate?.toISOString() || null,
        expirationDate: orphan.expirationDate?.toISOString() || null,
        isExpired: orphan.isExpired,
        createdAt: orphan.createdAt.toISOString(),
        suggestedParents,
        suggestedRelationshipType,
        urgency: orphan.isExpired ? 'low' : suggestedParents.length > 0 ? 'medium' : 'high'
      }
    })
  )

  // Statistics
  const stats = {
    totalOrphans: orphansWithSuggestions.length,
    withSuggestions: orphansWithSuggestions.filter(o => o.suggestedParents.length > 0).length,
    withoutSuggestions: orphansWithSuggestions.filter(o => o.suggestedParents.length === 0).length,
    expired: orphansWithSuggestions.filter(o => o.isExpired).length,
    byCategory: orphansWithSuggestions.reduce((acc, o) => {
      const cat = o.category || 'unknown'
      acc[cat] = (acc[cat] || 0) + 1
      return acc
    }, {} as Record<string, number>),
    totalValue: orphansWithSuggestions.reduce((sum, o) => sum + (o.totalValue || 0), 0)
  }

  return createSuccessResponse(ctx, {
    orphans: orphansWithSuggestions,
    stats,
    source: 'database'
  })
});
