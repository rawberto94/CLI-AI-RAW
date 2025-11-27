import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { query, filters } = await request.json()
    const dataMode = request.headers.get('x-data-mode') || 'real'

    if (dataMode !== 'real') {
      // Return mock data
      return NextResponse.json({
        results: [
          {
            id: '1',
            title: 'Software Development Services Agreement',
            type: 'contract',
            snippet: `...found matching terms for "${query}" in the contract scope...`,
            metadata: {
              supplier: 'TechCorp Inc',
              value: 1250000,
              date: '2024-01-15',
              status: 'Active'
            },
            relevance: 0.95
          }
        ]
      })
    }

    // Build where clause
    const where: any = {
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
      where.totalValue = { ...where.totalValue, lte: filters.maxValue }
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

    return NextResponse.json({ results })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    )
  }
}
