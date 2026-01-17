import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/prisma';
import { getApiTenantId } from '@/lib/tenant-server';

export const dynamic = 'force-dynamic';

// Mock data for demonstration
const getMockDeadlines = () => {
  const now = Date.now();
  return [
    {
      id: '1',
      contractId: 'demo-1',
      contractName: 'Software License Agreement - Acme Corp',
      type: 'renewal',
      date: new Date(now + 15 * 24 * 60 * 60 * 1000).toISOString(),
      daysUntil: 15,
      status: 'due-soon',
      priority: 'high',
      clientName: 'Acme Corp',
      value: 250000,
      currency: 'USD'
    },
    {
      id: '2',
      contractId: 'demo-2',
      contractName: 'Master Services Agreement - TechStart',
      type: 'expiration',
      date: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(),
      daysUntil: -5,
      status: 'overdue',
      priority: 'high',
      clientName: 'TechStart',
      value: 500000,
      currency: 'USD'
    },
    {
      id: '3',
      contractId: 'demo-3',
      contractName: 'Consulting Agreement - GlobalCo',
      type: 'milestone',
      date: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
      daysUntil: 7,
      status: 'due-soon',
      priority: 'medium',
      clientName: 'GlobalCo',
      value: 75000,
      currency: 'USD'
    },
    {
      id: '4',
      contractId: 'demo-4',
      contractName: 'NDA - Innovation Labs',
      type: 'expiration',
      date: new Date(now + 60 * 24 * 60 * 60 * 1000).toISOString(),
      daysUntil: 60,
      status: 'upcoming',
      priority: 'low',
      clientName: 'Innovation Labs'
    }
  ];
};

/**
 * GET /api/deadlines
 * Get all contract deadlines and obligations
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = await getApiTenantId(request);
    const client = searchParams.get('client');
    const type = searchParams.get('type');
    const useMock = searchParams.get('mock') === 'true';

    // Return mock data if requested
    if (useMock) {
      return NextResponse.json({
        success: true,
        deadlines: getMockDeadlines(),
        source: 'mock',
        stats: {
          total: 4,
          overdue: 1,
          dueSoon: 2,
          upcoming: 1,
          completed: 0
        }
      });
    }

    try {
      const db = await getDb();

      // Fetch all contracts with date fields
      const contracts = await db.contract.findMany({
      where: {
        tenantId,
        status: {
          in: ['ACTIVE', 'PENDING', 'COMPLETED']
        }
      },
      select: {
        id: true,
        fileName: true,
        clientName: true,
        supplierName: true,
        effectiveDate: true,
        startDate: true,
        endDate: true,
        expirationDate: true,
        totalValue: true,
        currency: true,
        contractType: true,
        status: true,
      }
    });

    interface Deadline {
      id: string;
      contractId: string;
      contractName: string;
      type: string;
      date: string;
      description: string;
      status: string;
      daysUntil: number;
      value?: number;
      currency?: string;
      clientName?: string;
      supplierName?: string;
    }

    // Transform contracts into deadlines
    const deadlines: Deadline[] = [];
    const now = new Date();

    contracts.forEach(contract => {
      // Expiration/End Date
      if (contract.expirationDate || contract.endDate) {
        const date = contract.expirationDate || contract.endDate!;
        const daysUntil = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        let status: string;
        if (daysUntil < 0) status = 'overdue';
        else if (daysUntil <= 30) status = 'due-soon';
        else status = 'upcoming';

        deadlines.push({
          id: `${contract.id}-expiration`,
          contractId: contract.id,
          contractName: contract.fileName || 'Untitled Contract',
          type: 'expiration',
          date: date.toISOString(),
          description: `Contract expiration date`,
          priority: daysUntil <= 30 ? 'high' : daysUntil <= 90 ? 'medium' : 'low',
          status,
          daysUntil,
          clientName: contract.clientName || undefined,
          supplierName: contract.supplierName || undefined,
          value: contract.totalValue ? Number(contract.totalValue) : undefined,
          currency: contract.currency || undefined,
          notificationSent: daysUntil <= 30,
        });
      }

      // Renewal (90 days before expiration)
      if (contract.expirationDate || contract.endDate) {
        const expirationDate = contract.expirationDate || contract.endDate!;
        const renewalDate = new Date(expirationDate);
        renewalDate.setDate(renewalDate.getDate() - 90); // 90 days before expiration
        
        const daysUntil = Math.ceil((renewalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysUntil >= -30) { // Show if within 30 days past renewal window
          let status: string;
          if (daysUntil < 0) status = 'overdue';
          else if (daysUntil <= 14) status = 'due-soon';
          else status = 'upcoming';

          deadlines.push({
            id: `${contract.id}-renewal`,
            contractId: contract.id,
            contractName: contract.fileName || 'Untitled Contract',
            type: 'renewal',
            date: renewalDate.toISOString(),
            description: `Renewal window opens (90 days before expiration)`,
            priority: daysUntil <= 14 ? 'high' : daysUntil <= 30 ? 'medium' : 'low',
            status,
            daysUntil,
            clientName: contract.clientName || undefined,
            supplierName: contract.supplierName || undefined,
            value: contract.totalValue ? Number(contract.totalValue) : undefined,
            currency: contract.currency || undefined,
            notificationSent: daysUntil <= 14,
          });
        }
      }

      // Effective/Start Date
      if (contract.effectiveDate || contract.startDate) {
        const date = contract.effectiveDate || contract.startDate!;
        const daysUntil = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysUntil >= -7 && daysUntil <= 90) { // Show if upcoming in next 90 days or up to 7 days past
          let status: string;
          if (daysUntil < 0) status = 'completed';
          else if (daysUntil <= 7) status = 'due-soon';
          else status = 'upcoming';

          deadlines.push({
            id: `${contract.id}-start`,
            contractId: contract.id,
            contractName: contract.fileName || 'Untitled Contract',
            type: 'milestone',
            date: date.toISOString(),
            description: `Contract effective/start date`,
            priority: daysUntil <= 7 ? 'high' : 'medium',
            status,
            daysUntil,
            clientName: contract.clientName || undefined,
            supplierName: contract.supplierName || undefined,
            value: contract.totalValue ? Number(contract.totalValue) : undefined,
            currency: contract.currency || undefined,
            notificationSent: daysUntil <= 7,
          });
        }
      }
    });

    // Apply filters
    let filteredDeadlines = deadlines;
    
    if (client) {
      filteredDeadlines = filteredDeadlines.filter(d => 
        d.clientName?.toLowerCase().includes(client.toLowerCase())
      );
    }
    
    if (type && type !== 'all') {
      filteredDeadlines = filteredDeadlines.filter(d => d.type === type);
    }

    // Sort by date (earliest first)
    filteredDeadlines.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      return NextResponse.json({
        success: true,
        deadlines: filteredDeadlines,
        source: 'database',
        stats: {
          total: filteredDeadlines.length,
          overdue: filteredDeadlines.filter(d => d.status === 'overdue').length,
          dueSoon: filteredDeadlines.filter(d => d.status === 'due-soon').length,
          upcoming: filteredDeadlines.filter(d => d.status === 'upcoming').length,
          completed: filteredDeadlines.filter(d => d.status === 'completed').length,
        }
      });

    } catch {
      return NextResponse.json({
        success: true,
        deadlines: getMockDeadlines(),
        source: 'mock-fallback',
        stats: {
          total: 4,
          overdue: 1,
          dueSoon: 2,
          upcoming: 1,
          completed: 0
        }
      });
    }

  } catch (error: unknown) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch deadlines',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
