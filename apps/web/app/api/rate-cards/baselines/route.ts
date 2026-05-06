import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { baselineManagementService as _baselineManagementService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

export const GET = withAuthApiHandler(async (request, ctx) => {
    const tenantId = ctx.tenantId;

    if (!tenantId) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Tenant not found', 404);
    }

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50') || 50), 200);
    const baselineType = searchParams.get('baselineType');
    const isActive = searchParams.get('isActive');
    const approvalStatus = searchParams.get('approvalStatus');

    const where: Record<string, unknown> = {
      tenantId,
    };

    if (baselineType) {
      where.baselineType = baselineType;
    }

    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    if (approvalStatus) {
      where.approvalStatus = approvalStatus;
    }

    const [baselines, total] = await Promise.all([
      prisma.rateCardBaseline.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.rateCardBaseline.count({ where }),
    ]);

    return createSuccessResponse(ctx, {
      baselines,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  });

export const POST = withAuthApiHandler(async (request, ctx) => {
    const tenantId = ctx.tenantId;
    const userId = ctx.userId;

    if (!tenantId || !userId) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Tenant not found', 404);
    }

    const body = await request.json();
    const {
      baselineName,
      baselineType,
      role,
      seniority,
      country,
      region,
      categoryL1,
      categoryL2,
      dailyRateUSD,
      currency,
      minimumRate,
      maximumRate,
      tolerancePercentage,
      source,
      sourceDetails,
      effectiveDate,
      expiryDate,
      notes,
    } = body;

    // Validate required fields
    if (!baselineName || !baselineType || !role || !dailyRateUSD) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Missing required fields', 400);
    }

    // Check for duplicate baseline name
    const existing = await prisma.rateCardBaseline.findUnique({
      where: {
        tenantId_baselineName: {
          tenantId,
          baselineName,
        },
      },
    });

    if (existing) {
      return createErrorResponse(ctx, 'CONFLICT', 'A baseline with this name already exists', 409);
    }

    // Get procurement category if provided
    let procurementCategoryId: string | null = null;
    if (categoryL1 && categoryL2) {
      const category = await prisma.procurementCategory.findFirst({
        where: {
          tenantId,
          categoryL1,
          categoryL2,
        },
      });
      procurementCategoryId = category?.id || null;
    }

    // Create baseline
    const baseline = await prisma.rateCardBaseline.create({
      data: {
        tenantId,
        baselineName,
        baselineType,
        roleStandardized: role,
        seniority: seniority || null,
        country: country || null,
        region: region || null,
        categoryL1: categoryL1 || null,
        categoryL2: categoryL2 || null,
        procurementCategoryId,
        targetRateUSD: dailyRateUSD,
        targetRate: dailyRateUSD,
        currency: currency || 'USD',
        rateUnit: 'daily',
        minimumRate: minimumRate || null,
        maximumRate: maximumRate || null,
        tolerancePercentage: tolerancePercentage || 5,
        source: source || 'MANUAL_ENTRY',
        sourceDetails: sourceDetails || null,
        effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        approvalStatus: 'PENDING',
        isActive: true,
        notes: notes || null,
        metadata: {
          createdBy: userId,
          createdAt: new Date().toISOString(),
        },
      },
    });

    return createSuccessResponse(ctx, baseline, { status: 201 });
  });

export const PUT = withAuthApiHandler(async (request, ctx) => {
    const tenantId = ctx.tenantId;

    if (!tenantId) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Tenant not found', 404);
    }

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Baseline ID is required', 400);
    }

    // Verify baseline belongs to user's tenant
    const existing = await prisma.rateCardBaseline.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Baseline not found', 404);
    }

    // Update baseline
    const baseline = await prisma.rateCardBaseline.update({
      where: { id },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
    });

    return createSuccessResponse(ctx, baseline);
  });
