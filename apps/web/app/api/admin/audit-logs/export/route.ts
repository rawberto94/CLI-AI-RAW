/**
 * Audit Logs Export API
 * Export audit logs in CSV or JSON format
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';

import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { tenantId: true, role: true },
    });

    if (!user || !['admin', 'owner'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'csv';
    const days = parseInt(searchParams.get('days') || '30');
    const limit = Math.min(parseInt(searchParams.get('limit') || '10000'), 50000);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Fetch audit logs
    const logs = await prisma.auditLog.findMany({
      where: {
        tenantId: user.tenantId,
        createdAt: {
          gte: startDate,
        },
      },
      include: {
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    if (format === 'json') {
      return NextResponse.json({
        exportedAt: new Date().toISOString(),
        totalRecords: logs.length,
        logs: logs.map(log => ({
          id: log.id,
          timestamp: log.createdAt.toISOString(),
          action: log.action,
          user: log.user?.email || 'System',
          resourceType: log.resourceType,
          resourceId: log.resourceId,
          details: log.details,
          ipAddress: log.ipAddress,
        })),
      });
    }

    // CSV format
    const headers = ['Timestamp', 'Action', 'User', 'Resource Type', 'Resource ID', 'IP Address', 'Details'];
    const rows = logs.map(log => [
      log.createdAt.toISOString(),
      log.action,
      log.user?.email || 'System',
      log.resourceType || '',
      log.resourceId || '',
      log.ipAddress || '',
      JSON.stringify(log.details || {}),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('Failed to export audit logs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
