/**
 * Contracts List API
 * GET /api/contracts - List contracts with filtering, sorting, and pagination
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Query parameter schema
const querySchema = z.object({
  // Filters
  status: z.string().optional(),
  contractType: z.string().optional(),
  clientId: z.string().optional(),
  supplierId: z.string().optional(),
  startDateFrom: z.string().datetime().optional(),
  startDateTo: z.string().datetime().optional(),
  endDateFrom: z.string().datetime().optional(),
  endDateTo: z.string().datetime().optional(),
  search: z.string().optional(),
  
  // Sorting
  sortBy: z.string().optional().default('uploadedAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  
  // Pagination
  limit: z.string().optional().transform((val: string | undefined) => val ? parseInt(val) : 20),
  offset: z.string().optional().transform((val: string | undefined) => val ? parseInt(val) : 0),
  page: z.string().optional().transform((val: string | undefined) => val ? parseInt(val) : undefined),
  
  // Includes
  include: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const params = Object.fromEntries(searchParams.entries());
    
    // Validate query parameters
    const validated = querySchema.parse(params);

    // For production, use the actual service
    if (process.env.NODE_ENV === 'production' || process.env.USE_DATABASE === 'true') {
      const { ContractQueryService } = await import('../../../../../apps/core/contracts/contract-query.service');
      const { ContractRepository } = await import('../../../../../packages/clients/db/src/repositories/contract.repository');
      const { DatabaseManager } = await import('../../../../../packages/clients/db/index');
      const prismaClient = (await import('../../../../../packages/clients/db/index')).default;

      const dbManager = new DatabaseManager();
      const repository = new ContractRepository(dbManager);
      const service = new ContractQueryService(repository);

      // Build filter
      const filter: any = {};
      if (validated.status) filter.status = validated.status;
      if (validated.contractType) filter.contractType = validated.contractType;
      if (validated.clientId) filter.clientId = validated.clientId;
      if (validated.supplierId) filter.supplierId = validated.supplierId;
      if (validated.search) filter.search = validated.search;
      if (validated.startDateFrom) filter.startDateFrom = new Date(validated.startDateFrom);
      if (validated.startDateTo) filter.startDateTo = new Date(validated.startDateTo);
      if (validated.endDateFrom) filter.endDateFrom = new Date(validated.endDateFrom);
      if (validated.endDateTo) filter.endDateTo = new Date(validated.endDateTo);

      // Build includes
      const include: any = {};
      if (validated.include) {
        const includeFields = validated.include.split(',');
        includeFields.forEach((field: string) => {
          include[field.trim()] = true;
        });
      }

      // Calculate pagination
      const limit = validated.limit;
      const offset = validated.page ? (validated.page - 1) * limit : validated.offset;

      // Query contracts
      const result = await service.query({
        filter,
        sort: {
          field: validated.sortBy,
          direction: validated.sortOrder,
        },
        pagination: { limit, offset },
        include,
      });

      // Build response
      const page = validated.page || Math.floor(offset / limit) + 1;
      const totalPages = Math.ceil(result.total / limit);

      return NextResponse.json({
        success: true,
        data: {
          contracts: result.contracts,
          pagination: {
            total: result.total,
            limit,
            offset,
            page,
            totalPages,
            hasMore: result.hasMore,
            hasPrevious: offset > 0,
          },
        },
      });
    }

    // Development mock data
    const mockContracts = [
      {
        id: '1',
        filename: 'Master Service Agreement.pdf',
        originalName: 'MSA_Acme_Corp_2024.pdf',
        status: 'COMPLETED',
        processingStatus: 'COMPLETED',
        uploadedAt: new Date('2024-01-15'),
        fileSize: 2500000,
        mimeType: 'application/pdf',
        contractType: 'MSA',
        totalValue: 500000,
        currency: 'USD',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2025-12-31'),
      },
      {
        id: '2',
        filename: 'Statement of Work Q1.pdf',
        originalName: 'SOW_Q1_2024.pdf',
        status: 'COMPLETED',
        processingStatus: 'COMPLETED',
        uploadedAt: new Date('2024-02-01'),
        fileSize: 1800000,
        mimeType: 'application/pdf',
        contractType: 'SOW',
        totalValue: 150000,
        currency: 'USD',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-03-31'),
      },
    ];

    return NextResponse.json({
      success: true,
      data: {
        contracts: mockContracts,
        pagination: {
          total: mockContracts.length,
          limit: validated.limit,
          offset: validated.offset,
          page: validated.page || 1,
          totalPages: 1,
          hasMore: false,
          hasPrevious: false,
        },
      },
    });
  } catch (error) {
    console.error('Contract query error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to query contracts',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
