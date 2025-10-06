import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Mock data for development
const mockContracts = [
  {
    id: '1',
    filename: 'Master Service Agreement.pdf',
    originalName: 'MSA_Acme_Corp_2024.pdf',
    status: 'COMPLETED',
    uploadDate: new Date('2024-01-15'),
    fileSize: 2500000,
    mimeType: 'application/pdf',
    extractedData: {
      contractType: 'MSA',
      totalValue: 500000,
      currency: 'USD',
      startDate: '2024-01-01',
      endDate: '2025-12-31',
    },
    parties: [
      { id: 'p1', name: 'Acme Corp', role: 'CLIENT' },
      { id: 'p2', name: 'Tech Services Inc', role: 'SUPPLIER' },
    ],
    _count: { clauses: 15, artifacts: 3 },
  },
  {
    id: '2',
    filename: 'Statement of Work Q1.pdf',
    originalName: 'SOW_Q1_2024.pdf',
    status: 'COMPLETED',
    uploadDate: new Date('2024-02-01'),
    fileSize: 1800000,
    mimeType: 'application/pdf',
    extractedData: {
      contractType: 'SOW',
      totalValue: 150000,
      currency: 'USD',
      startDate: '2024-01-01',
      endDate: '2024-03-31',
    },
    parties: [
      { id: 'p1', name: 'Acme Corp', role: 'CLIENT' },
      { id: 'p3', name: 'Consulting Partners', role: 'SUPPLIER' },
    ],
    _count: { clauses: 8, artifacts: 2 },
  },
]

interface QueryParams {
  page?: number
  limit?: number
  status?: string
  search?: string
  sortBy?: string
  sortDirection?: 'asc' | 'desc'
  startDate?: string
  endDate?: string
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const tenantId = request.headers.get('x-tenant-id') || 'default-tenant'

    // Parse query parameters
    const params: QueryParams = {
      page: parseInt(searchParams.get('page') || '1'),
      limit: Math.min(parseInt(searchParams.get('limit') || '50'), 100),
      status: searchParams.get('status') || undefined,
      search: searchParams.get('search') || undefined,
      sortBy: searchParams.get('sortBy') || 'uploadDate',
      sortDirection: (searchParams.get('sortDirection') as 'asc' | 'desc') || 'desc',
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
    }

    const offset = ((params.page || 1) - 1) * (params.limit || 50)

    // Build where clause
    const where: any = {
      tenantId,
    }

    if (params.status) {
      where.status = params.status
    }

    if (params.startDate || params.endDate) {
      where.uploadDate = {}
      if (params.startDate) {
        where.uploadDate.gte = new Date(params.startDate)
      }
      if (params.endDate) {
        where.uploadDate.lte = new Date(params.endDate)
      }
    }

    if (params.search) {
      where.OR = [
        { filename: { contains: params.search, mode: 'insensitive' } },
        { originalName: { contains: params.search, mode: 'insensitive' } },
      ]
    }

    // Build order by
    const orderBy: any = {}
    if (params.sortBy === 'uploadDate') {
      orderBy.uploadDate = params.sortDirection
    } else if (params.sortBy === 'filename') {
      orderBy.filename = params.sortDirection
    } else if (params.sortBy === 'status') {
      orderBy.status = params.sortDirection
    }

    // For production, use the actual repository
    let contracts = mockContracts
    let total = mockContracts.length

    if (process.env.NODE_ENV === 'production' || process.env.USE_DATABASE === 'true') {
      try {
        const { contractRepository } = await import('../../../../../../packages/clients/db/src/repositories')
        
        const [dbContracts, dbTotal] = await Promise.all([
          contractRepository.findMany({
            where,
            include: {
              parties: {
                select: {
                  id: true,
                  name: true,
                  role: true,
                },
                take: 5,
              },
              _count: {
                select: {
                  clauses: true,
                  artifacts: true,
                },
              },
            },
            orderBy,
            take: params.limit,
            skip: offset,
          }),
          contractRepository.count({ where }),
        ])
        
        contracts = dbContracts
        total = dbTotal
      } catch (error) {
        console.warn('Database not available, using mock data:', error)
      }
    }

    // Format response
    const formattedContracts = contracts.map((contract) => ({
      id: contract.id,
      filename: contract.filename,
      originalName: contract.originalName,
      status: contract.status,
      uploadDate: contract.uploadDate,
      fileSize: contract.fileSize,
      mimeType: contract.mimeType,
      extractedData: contract.extractedData,
      parties: contract.parties,
      clauseCount: contract._count?.clauses || 0,
      artifactCount: contract._count?.artifacts || 0,
      processing: contract.status === 'processing' ? {
        currentStage: 'Processing',
        progress: 50,
      } : undefined,
      error: contract.status === 'failed' ? 'Processing failed' : undefined,
    }))

    return NextResponse.json({
      success: true,
      contracts: formattedContracts,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / (params.limit || 50)),
        hasMore: offset + (params.limit || 50) < total,
      },
    })
  } catch (error) {
    console.error('Error fetching contracts:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch contracts',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
