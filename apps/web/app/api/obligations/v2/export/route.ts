import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import getClient from 'clients-db';
import { Prisma } from '@prisma/client';

const prisma = getClient();

/**
 * GET /api/obligations/v2/export
 * Export obligations as CSV or JSON
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'csv';
    const contractId = searchParams.get('contractId');
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const type = searchParams.get('type');

    // Build where clause
    const where: Prisma.ObligationWhereInput = {
      tenantId: session.user.tenantId,
      ...(contractId && { contractId }),
      ...(status && { status: status.toUpperCase() as Prisma.EnumObligationStatusFilter }),
      ...(priority && { priority: priority.toUpperCase() as Prisma.EnumObligationPriorityFilter }),
      ...(type && { type: type.toUpperCase() as Prisma.EnumObligationTypeFilter }),
    };

    // Get obligations
    const obligations = await prisma.obligation.findMany({
      where,
      include: {
        contract: {
          select: {
            contractTitle: true,
            supplier: { select: { name: true } },
            client: { select: { name: true } },
          },
        },
        assignedToUser: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    if (format === 'json') {
      return NextResponse.json({
        success: true,
        count: obligations.length,
        obligations: obligations.map((o) => ({
          id: o.id,
          title: o.title,
          description: o.description,
          type: o.type.toLowerCase(),
          status: o.status.toLowerCase(),
          priority: o.priority.toLowerCase(),
          owner: o.owner.toLowerCase(),
          dueDate: o.dueDate?.toISOString(),
          completedAt: o.completedAt?.toISOString(),
          contractId: o.contractId,
          contractTitle: o.contract?.contractTitle,
          vendorName: o.contract?.supplier?.name || o.contract?.client?.name,
          assignedTo: o.assignedToUser
            ? `${o.assignedToUser.firstName || ''} ${o.assignedToUser.lastName || ''}`.trim() || o.assignedToUser.email
            : null,
          riskScore: o.riskScore,
          financialImpact: o.financialImpact?.toString(),
          currency: o.currency,
          clauseReference: o.clauseReference,
          tags: o.tags,
          createdAt: o.createdAt.toISOString(),
        })),
        exportedAt: new Date().toISOString(),
      });
    }

    // CSV export
    const headers = [
      'ID',
      'Title',
      'Description',
      'Type',
      'Status',
      'Priority',
      'Owner',
      'Due Date',
      'Completed At',
      'Contract Title',
      'Vendor Name',
      'Assigned To',
      'Risk Score',
      'Financial Impact',
      'Currency',
      'Clause Reference',
      'Tags',
      'Created At',
    ];

    const rows = obligations.map((o) => [
      o.id,
      escapeCSV(o.title),
      escapeCSV(o.description || ''),
      o.type.toLowerCase(),
      o.status.toLowerCase(),
      o.priority.toLowerCase(),
      o.owner.toLowerCase(),
      o.dueDate?.toISOString() || '',
      o.completedAt?.toISOString() || '',
      escapeCSV(o.contract?.contractTitle || ''),
      escapeCSV(o.contract?.supplier?.name || o.contract?.client?.name || ''),
      o.assignedToUser
        ? escapeCSV(`${o.assignedToUser.firstName || ''} ${o.assignedToUser.lastName || ''}`.trim() || o.assignedToUser.email)
        : '',
      o.riskScore?.toString() || '',
      o.financialImpact?.toString() || '',
      o.currency || '',
      escapeCSV(o.clauseReference || ''),
      escapeCSV((o.tags as string[])?.join(', ') || ''),
      o.createdAt.toISOString(),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="obligations-export-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('Failed to export obligations:', error);
    return NextResponse.json(
      { error: 'Failed to export obligations' },
      { status: 500 }
    );
  }
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
