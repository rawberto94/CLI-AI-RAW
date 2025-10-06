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

    // Fetch from backend API
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    
    try {
      const backendRes = await fetch(`${API_URL}/api/contracts`, {
        headers: {
          'x-tenant-id': 'demo'
        }
      });
      
      if (!backendRes.ok) {
        throw new Error('Backend API request failed');
      }
      
      const backendData = await backendRes.json();
      const contracts = Array.isArray(backendData) ? backendData : backendData.contracts || [];
      
      // Transform backend contracts to frontend format
      const transformedContracts = contracts.map((c: any) => ({
        id: c.id,
        filename: c.name || c.filename,
        originalName: c.name || c.filename,
        status: c.status,
        processingStatus: c.status,
        uploadedAt: c.createdAt || c.uploadedAt,
        fileSize: c.fileSize || 0,
        mimeType: c.mimeType || 'application/pdf',
        contractType: c.contractType || 'UNKNOWN',
        totalValue: c.totalValue || 0,
        currency: c.currency || 'USD',
        startDate: c.startDate,
        endDate: c.endDate,
      }));
      
      // Apply filters
      let filtered = transformedContracts;
      if (validated.status) {
        filtered = filtered.filter((c: any) => c.status === validated.status);
      }
      if (validated.search) {
        const searchLower = validated.search.toLowerCase();
        filtered = filtered.filter((c: any) => 
          c.filename?.toLowerCase().includes(searchLower)
        );
      }
      
      // Apply sorting
      filtered.sort((a: any, b: any) => {
        const aVal = a[validated.sortBy] || '';
        const bVal = b[validated.sortBy] || '';
        const comparison = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
        return validated.sortOrder === 'desc' ? -comparison : comparison;
      });
      
      // Apply pagination
      const total = filtered.length;
      const offset = validated.page ? (validated.page - 1) * validated.limit : validated.offset;
      const paginatedContracts = filtered.slice(offset, offset + validated.limit);
      const totalPages = Math.ceil(total / validated.limit);
      
      return NextResponse.json({
        success: true,
        data: {
          contracts: paginatedContracts,
          pagination: {
            total,
            limit: validated.limit,
            offset,
            page: validated.page || Math.floor(offset / validated.limit) + 1,
            totalPages,
            hasMore: offset + validated.limit < total,
            hasPrevious: offset > 0,
          },
        },
      });
    } catch (backendError) {
      console.error('Backend API error:', backendError);
      // Return empty list if backend fails
      return NextResponse.json({
        success: true,
        data: {
          contracts: [],
          pagination: {
            total: 0,
            limit: validated.limit,
            offset: validated.offset,
            page: validated.page || 1,
            totalPages: 0,
            hasMore: false,
            hasPrevious: false,
          },
        },
      });
    }
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
