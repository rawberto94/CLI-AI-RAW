import { NextRequest } from 'next/server';
import getDb from '@/lib/prisma';
import { getApiTenantId } from '@/lib/tenant-server';
import { getServerSession } from '@/lib/auth';
import { getAuthenticatedApiContext, getApiContext, parseQueryParams, createSuccessResponse, handleApiError, createErrorResponse, createValidationErrorResponse } from '@/lib/api-middleware';
import { z } from 'zod';

const deadlinesQuerySchema = z.object({
  client: z.string().optional(),
  type: z.enum(['all', 'expiration', 'renewal', 'milestone']).optional(),
});

export const dynamic = 'force-dynamic';

/**
 * GET /api/deadlines
 * Get all contract deadlines and obligations
 */
export async function GET(request: NextRequest) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
    }

    const validated = parseQueryParams(request, deadlinesQuerySchema);
    if (!validated.success) {
      return createValidationErrorResponse(ctx, validated.error);
    }
    const queryParams = validated.data;
    const tenantId = await getApiTenantId(request);
    const client = queryParams.client || null;
    const type = queryParams.type || null;

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

      return createSuccessResponse(ctx, {
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
      return createErrorResponse(ctx, 'SERVICE_UNAVAILABLE', 'Database temporarily unavailable. Please retry.', 503);
    }

  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
}
