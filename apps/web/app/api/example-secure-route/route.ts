/**
 * Example Secure API Route
 * 
 * Demonstrates how to use the comprehensive security middleware
 * with validation, sanitization, rate limiting, and security headers
 */

import { NextRequest as _NextRequest, NextResponse } from 'next/server';
import { withSecurity, AuthenticatedEndpointSecurity } from '@/lib/middleware/security.middleware';
import { z } from 'zod';

// =========================================================================
// VALIDATION SCHEMAS
// =========================================================================

const createItemSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  value: z.number().positive('Value must be positive'),
  tags: z.array(z.string().max(50)).max(10, 'Too many tags').optional(),
});

const querySchema = z.object({
  tenantId: z.string().uuid('Invalid tenant ID'),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  search: z.string().max(200).optional(),
});

// =========================================================================
// ROUTE HANDLERS
// =========================================================================

/**
 * GET - List items with security
 */
export const GET = withSecurity(
  async (request, data) => {
    // data.validated.query contains validated and sanitized query parameters
    const { tenantId, page, limit, search } = data.validated!.query;

    // Simulate fetching data
    const items = [
      {
        id: '1',
        name: 'Item 1',
        description: 'This is item 1',
        value: 100,
        tenantId,
      },
      {
        id: '2',
        name: 'Item 2',
        description: 'This is item 2',
        value: 200,
        tenantId,
      },
    ];

    // Filter by search if provided
    const filtered = search
      ? items.filter((item) =>
          item.name.toLowerCase().includes(search.toLowerCase())
        )
      : items;

    // Paginate
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginated = filtered.slice(start, end);

    return NextResponse.json({
      data: paginated,
      pagination: {
        page,
        limit,
        total: filtered.length,
        totalPages: Math.ceil(filtered.length / limit),
      },
    });
  },
  {
    ...AuthenticatedEndpointSecurity,
    validation: {
      querySchema,
    },
  }
);

/**
 * POST - Create item with security
 */
export const POST = withSecurity(
  async (request, data) => {
    // data.validated.body contains validated and sanitized request body
    const itemData = data.validated!.body;

    // Simulate creating item
    const newItem = {
      id: Math.random().toString(36).substring(7),
      ...itemData,
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json(
      {
        success: true,
        data: newItem,
      },
      { status: 201 }
    );
  },
  {
    ...AuthenticatedEndpointSecurity,
    validation: {
      bodySchema: createItemSchema,
    },
  }
);

/**
 * PUT - Update item with security
 */
export const PUT = withSecurity(
  async (request, data) => {
    const itemData = data.validated!.body;

    // Simulate updating item
    const updatedItem = {
      id: '1',
      ...itemData,
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: updatedItem,
    });
  },
  {
    ...AuthenticatedEndpointSecurity,
    validation: {
      bodySchema: createItemSchema.partial(),
    },
  }
);

/**
 * DELETE - Delete item with security
 */
export const DELETE = withSecurity(
  async (request, data) => {
    const { tenantId: _tenantId } = data.validated!.query;

    // Simulate deleting item
    return NextResponse.json({
      success: true,
      message: 'Item deleted successfully',
    });
  },
  {
    ...AuthenticatedEndpointSecurity,
    validation: {
      querySchema: z.object({
        tenantId: z.string().uuid(),
        id: z.string().uuid(),
      }),
    },
  }
);

// =========================================================================
// NOTES
// =========================================================================

/**
 * This example demonstrates:
 * 
 * 1. Input Validation
 *    - All inputs are validated against Zod schemas
 *    - Invalid inputs return 400 with detailed error messages
 * 
 * 2. Data Sanitization
 *    - All string inputs are sanitized to prevent XSS
 *    - Dangerous patterns are removed or escaped
 * 
 * 3. Rate Limiting
 *    - Requests are rate limited based on endpoint type
 *    - Rate limit headers are included in responses
 * 
 * 4. Security Headers
 *    - All responses include security headers (CSP, HSTS, etc.)
 *    - Headers are automatically applied by middleware
 * 
 * 5. Error Handling
 *    - Validation errors return structured error responses
 *    - Rate limit errors return 429 with retry information
 *    - Internal errors are caught and return 500
 */
