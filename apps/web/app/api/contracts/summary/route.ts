import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

/**
 * GET /api/contracts/summary
 * Returns a summary of contracts for the dashboard
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const tenantId = request.headers.get('x-tenant-id') || session?.user?.tenantId || 'demo';

    // Get total contracts count
    const totalContracts = await prisma.contract.count({
      where: { tenantId },
    });

    // Get contracts by status
    const statusCounts = await prisma.contract.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: { status: true },
    });

    // Get contracts expiring in next 30 days
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    
    const expiringContracts = await prisma.contract.count({
      where: {
        tenantId,
        expirationDate: {
          gte: new Date(),
          lte: thirtyDaysFromNow,
        },
      },
    });

    // Get contracts created in last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentContracts = await prisma.contract.count({
      where: {
        tenantId,
        createdAt: {
          gte: sevenDaysAgo,
        },
      },
    });

    // Get total value
    const valueResult = await prisma.contract.aggregate({
      where: { tenantId },
      _sum: { totalValue: true },
    });

    // Transform status counts to object
    const statusMap: Record<string, number> = {};
    statusCounts.forEach((item) => {
      if (item.status) {
        statusMap[item.status] = item._count.status;
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        totalContracts,
        activeContracts: statusMap['active'] || 0,
        draftContracts: statusMap['draft'] || 0,
        completedContracts: statusMap['completed'] || 0,
        archivedContracts: statusMap['archived'] || 0,
        expiringContracts,
        recentContracts,
        totalValue: valueResult._sum.totalValue || 0,
        statusBreakdown: statusMap,
      },
    });
  } catch (error) {
    console.error('Error fetching contracts summary:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch summary' },
      { status: 500 }
    );
  }
}
