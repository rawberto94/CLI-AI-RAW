/**
 * Contract Audit Log API
 * 
 * Tracks all actions performed on contracts for compliance and security
 * Database persisted using AuditLog model
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiTenantId } from '@/lib/tenant-server';
import { Prisma } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

type AuditAction = 
  | 'view'
  | 'download'
  | 'upload'
  | 'update'
  | 'delete'
  | 'share'
  | 'unshare'
  | 'approve'
  | 'reject'
  | 'sign'
  | 'export'
  | 'analyze'
  | 'extract_metadata'
  | 'categorize'
  | 'add_reminder'
  | 'comment'
  | 'version_create'
  | 'permission_change';

type AuditCategory = 
  | 'access'
  | 'modification'
  | 'workflow'
  | 'collaboration'
  | 'analysis'
  | 'security';

// Response interface for API
interface AuditLogResponse {
  id: string;
  contractId: string;
  tenantId: string;
  userId: string;
  userName?: string;
  action: string;
  category: string;
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  status: 'success' | 'failure';
  errorMessage?: string;
}

// Transform database log to API response
function transformAuditLog(dbLog: any, contractId: string): AuditLogResponse {
  const metadata = dbLog.metadata as Record<string, any> | null;
  const details = dbLog.details as Record<string, any> | null;
  
  return {
    id: dbLog.id,
    contractId,
    tenantId: dbLog.tenantId,
    userId: dbLog.userId || 'system',
    userName: metadata?.userName,
    action: dbLog.action,
    category: metadata?.category || 'access',
    details: details || {},
    ipAddress: dbLog.ipAddress || undefined,
    userAgent: dbLog.userAgent || undefined,
    timestamp: dbLog.createdAt,
    status: metadata?.status || 'success',
    errorMessage: metadata?.errorMessage,
  };
}

// ============================================================================
// GET - Retrieve audit logs
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const contractId = resolvedParams.id;
    const { searchParams } = new URL(request.url);
    const tenantId = await getApiTenantId(request);
    
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const category = searchParams.get('category');
    const action = searchParams.get('action');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const userId = searchParams.get('userId');

    // Build where clause for database
    const where: any = {
      entityType: 'contract',
      entityId: contractId,
    };

    if (tenantId) {
      where.tenantId = tenantId;
    }

    if (action) {
      where.action = action;
    }

    if (userId) {
      where.userId = userId;
    }

    if (startDate) {
      where.createdAt = { ...where.createdAt, gte: new Date(startDate) };
    }

    if (endDate) {
      where.createdAt = { ...where.createdAt, lte: new Date(endDate) };
    }

    // If category filter, we need to filter after fetch (stored in metadata)
    // First get all matching logs
    const allLogs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Transform and filter by category if needed
    let logs = allLogs.map(log => transformAuditLog(log, contractId));

    if (category) {
      logs = logs.filter(log => log.category === category);
    }

    // Get total count
    const totalCount = logs.length;

    // Paginate
    const paginatedLogs = logs.slice((page - 1) * limit, page * limit);

    // If no logs exist, return empty result (no more sample data)
    return NextResponse.json({
      success: true,
      data: {
        logs: paginatedLogs,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
        summary: {
          totalActions: totalCount,
          byCategory: summarizeByCategory(logs),
          byAction: summarizeByAction(logs),
          uniqueUsers: [...new Set(logs.map(l => l.userId))].length,
        },
      },
    });
  } catch (error) {
    console.error('Failed to fetch audit logs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Create audit log entry
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const contractId = resolvedParams.id;
    const body = await request.json();
    const tenantId = await getApiTenantId(request) || body.tenantId;
    
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant ID is required' },
        { status: 400 }
      );
    }
    
    const {
      userId,
      userName,
      action,
      category,
      details,
      status = 'success',
      errorMessage,
    } = body;

    if (!userId || !action || !category) {
      return NextResponse.json(
        { success: false, error: 'userId, action, and category are required' },
        { status: 400 }
      );
    }

    // Get request metadata
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Create audit log in database
    const dbLog = await prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action,
        resource: `contract/${contractId}`,
        resourceType: 'contract',
        entityType: 'contract',
        entityId: contractId,
        details: details || {},
        metadata: {
          userName,
          category,
          status,
          errorMessage,
        },
        ipAddress,
        userAgent,
      },
    });

    const logEntry = transformAuditLog(dbLog, contractId);

    return NextResponse.json({
      success: true,
      data: logEntry,
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create audit log' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function summarizeByCategory(logs: AuditLogResponse[]): Record<string, number> {
  return logs.reduce((acc, log) => {
    acc[log.category] = (acc[log.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

function summarizeByAction(logs: AuditLogResponse[]): Record<string, number> {
  return logs.reduce((acc, log) => {
    acc[log.action] = (acc[log.action] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

// ============================================================================
// Utility: Create audit log for contract actions (import elsewhere)
// ============================================================================

export async function createContractAuditLog(options: {
  contractId: string;
  tenantId: string;
  userId: string;
  userName?: string;
  action: AuditAction;
  category: AuditCategory;
  details?: Record<string, unknown>;
  status?: 'success' | 'failure';
  errorMessage?: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: options.tenantId,
        userId: options.userId,
        action: options.action,
        resource: `contract/${options.contractId}`,
        resourceType: 'contract',
        entityType: 'contract',
        entityId: options.contractId,
        details: (options.details || {}) as Prisma.InputJsonValue,
        metadata: {
          userName: options.userName,
          category: options.category,
          status: options.status || 'success',
          errorMessage: options.errorMessage,
        } as Prisma.InputJsonValue,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
      },
    });
  } catch (error) {
    console.error('Failed to create contract audit log:', error);
    // Don't throw - audit logging should not break the main flow
  }
}
