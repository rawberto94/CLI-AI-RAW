import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, handleApiError, createErrorResponse, createValidationErrorResponse } from '@/lib/api-middleware'
import { z } from 'zod'
import { contractService } from 'data-orchestration/services';

const searchRequestSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  filters: z.object({
    status: z.string().optional(),
    minValue: z.number().optional(),
    maxValue: z.number().optional(),
    dateRange: z.string().optional(),
  }).optional(),
})

export async function POST(request: NextRequest) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const body = await request.json()
    const parsed = searchRequestSchema.safeParse(body)
    if (!parsed.success) {
      return createValidationErrorResponse(ctx, parsed.error)
    }
    const { query, filters } = parsed.data

    // Build where clause
    const where: Record<string, unknown> = {
      OR: [
        { contractTitle: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { supplierName: { contains: query, mode: 'insensitive' } },
        { clientName: { contains: query, mode: 'insensitive' } }
      ]
    }

    // Apply filters
    if (filters?.status) {
      where.status = filters.status.toUpperCase()
    }
    if (filters?.minValue) {
      where.totalValue = { gte: filters.minValue }
    }
    if (filters?.maxValue) {
      const existingTotalValue =
        typeof where.totalValue === 'object' && where.totalValue !== null
          ? (where.totalValue as Record<string, unknown>)
          : {};
      where.totalValue = { ...existingTotalValue, lte: filters.maxValue }
    }
    if (filters?.dateRange) {
      const now = new Date()
      const daysMap: Record<string, number> = {
        '7d': 7,
        '30d': 30,
        '90d': 90,
        '1y': 365
      }
      const days = daysMap[filters.dateRange]
      if (days) {
        where.uploadedAt = {
          gte: new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
        }
      }
    }

    // Search contracts
    const contracts = await prisma.contract.findMany({
      where,
      include: {
        artifacts: {
          take: 1
        }
      },
      take: 20,
      orderBy: { uploadedAt: 'desc' }
    })

    // Format results
    const results = contracts.map(contract => ({
      id: contract.id,
      title: contract.contractTitle || contract.fileName,
      type: 'contract',
      snippet: contract.description || `Contract with ${contract.supplierName || 'supplier'}`,
      metadata: {
        supplier: contract.supplierName,
        value: Number(contract.totalValue || 0),
        date: contract.uploadedAt.toISOString().split('T')[0],
        status: contract.status
      },
      relevance: 0.85 // Simple relevance score
    }))

    return createSuccessResponse(ctx, { results })
  } catch (error) {
    return handleApiError(ctx, error)
  }
}
