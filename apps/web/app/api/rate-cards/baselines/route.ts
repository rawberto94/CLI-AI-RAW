import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { BaselineManagementService } from 'data-orchestration/services';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, tenantId: true },
    });

    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const baselineType = searchParams.get('baselineType');
    const isActive = searchParams.get('isActive');
    const approvalStatus = searchParams.get('approvalStatus');

    const where: Record<string, unknown> = {
      tenantId: user.tenantId,
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

    return NextResponse.json({
      baselines,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching baselines:', error);
    return NextResponse.json(
      { error: 'Failed to fetch baselines' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, tenantId: true },
    });

    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
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
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check for duplicate baseline name
    const existing = await prisma.rateCardBaseline.findUnique({
      where: {
        tenantId_baselineName: {
          tenantId: user.tenantId,
          baselineName,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'A baseline with this name already exists' },
        { status: 409 }
      );
    }

    // Get procurement category if provided
    let procurementCategoryId = null;
    if (categoryL1 && categoryL2) {
      const category = await prisma.procurementCategory.findFirst({
        where: {
          tenantId: user.tenantId,
          categoryL1,
          categoryL2,
        },
      });
      procurementCategoryId = category?.id || null;
    }

    // Create baseline
    const baseline = await prisma.rateCardBaseline.create({
      data: {
        tenantId: user.tenantId,
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
          createdBy: user.id,
          createdAt: new Date().toISOString(),
        },
      },
    });

    return NextResponse.json(baseline, { status: 201 });
  } catch (error) {
    console.error('Error creating baseline:', error);
    return NextResponse.json(
      { error: 'Failed to create baseline' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, tenantId: true },
    });

    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Baseline ID is required' },
        { status: 400 }
      );
    }

    // Verify baseline belongs to user's tenant
    const existing = await prisma.rateCardBaseline.findUnique({
      where: { id },
    });

    if (!existing || existing.tenantId !== user.tenantId) {
      return NextResponse.json(
        { error: 'Baseline not found' },
        { status: 404 }
      );
    }

    // Update baseline
    const baseline = await prisma.rateCardBaseline.update({
      where: { id },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(baseline);
  } catch (error) {
    console.error('Error updating baseline:', error);
    return NextResponse.json(
      { error: 'Failed to update baseline' },
      { status: 500 }
    );
  }
}
