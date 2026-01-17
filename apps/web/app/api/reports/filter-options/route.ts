import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/reports/filter-options
 * Get available filter options for AI Report Builder
 */
export async function GET() {
  try {
    const session = await getServerSession();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = (session.user as { tenantId?: string }).tenantId;
    
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 400 });
    }

    // Get unique suppliers
    const suppliersData = await prisma.contract.findMany({
      where: { tenantId },
      select: { supplierName: true },
      distinct: ['supplierName'],
    });
    
    const suppliers = suppliersData
      .map(c => c.supplierName)
      .filter((s): s is string => !!s && s.trim() !== '')
      .sort();

    // Get unique categories (from categoryL1)
    const categoriesData = await prisma.contract.findMany({
      where: { tenantId },
      select: { categoryL1: true },
      distinct: ['categoryL1'],
    });
    
    const categories = categoriesData
      .map(c => c.categoryL1)
      .filter((c): c is string => !!c && c.trim() !== '')
      .sort();

    return NextResponse.json({
      success: true,
      suppliers,
      categories,
    });

  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch filter options' },
      { status: 500 }
    );
  }
}
