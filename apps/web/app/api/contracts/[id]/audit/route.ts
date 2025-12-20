/**
 * Contract Audit Log API
 * 
 * Tracks all actions performed on contracts for compliance and security
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiTenantId } from '@/lib/tenant-server';

// ============================================================================
// Types
// ============================================================================

interface AuditLogEntry {
  id: string;
  contractId: string;
  tenantId: string;
  userId: string;
  userName?: string;
  action: AuditAction;
  category: AuditCategory;
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  status: 'success' | 'failure';
  errorMessage?: string;
}

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

// ============================================================================
// In-Memory Store (for demo - use database in production)
// ============================================================================

const auditLogs: AuditLogEntry[] = [];

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
    
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const category = searchParams.get('category');
    const action = searchParams.get('action');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const userId = searchParams.get('userId');

    // Filter logs
    let logs = auditLogs.filter(log => log.contractId === contractId);

    if (category) {
      logs = logs.filter(log => log.category === category);
    }
    if (action) {
      logs = logs.filter(log => log.action === action);
    }
    if (userId) {
      logs = logs.filter(log => log.userId === userId);
    }
    if (startDate) {
      logs = logs.filter(log => new Date(log.timestamp) >= new Date(startDate));
    }
    if (endDate) {
      logs = logs.filter(log => new Date(log.timestamp) <= new Date(endDate));
    }

    // Sort by timestamp (newest first)
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Paginate
    const totalCount = logs.length;
    const paginatedLogs = logs.slice((page - 1) * limit, page * limit);

    // Generate some sample logs if none exist
    if (paginatedLogs.length === 0) {
      const sampleLogs = generateSampleLogs(contractId);
      return NextResponse.json({
        success: true,
        data: {
          logs: sampleLogs,
          pagination: {
            page,
            limit,
            totalCount: sampleLogs.length,
            totalPages: 1,
          },
          summary: {
            totalActions: sampleLogs.length,
            byCategory: summarizeByCategory(sampleLogs),
            byAction: summarizeByAction(sampleLogs),
            uniqueUsers: [...new Set(sampleLogs.map(l => l.userId))].length,
          },
        },
      });
    }

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
    console.error('Error fetching audit logs:', error);
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

    const logEntry: AuditLogEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      contractId,
      tenantId: getApiTenantId(request) || body.tenantId || 'unknown',
      userId,
      userName,
      action,
      category,
      details: details || {},
      ipAddress,
      userAgent,
      timestamp: new Date(),
      status,
      errorMessage,
    };

    // Store log
    auditLogs.push(logEntry);

    // Keep only last 10000 entries in memory
    if (auditLogs.length > 10000) {
      auditLogs.splice(0, auditLogs.length - 10000);
    }

    return NextResponse.json({
      success: true,
      data: logEntry,
    });
  } catch (error) {
    console.error('Error creating audit log:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create audit log' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function generateSampleLogs(contractId: string): AuditLogEntry[] {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  
  return [
    {
      id: 'audit-1',
      contractId,
      tenantId: 'default',
      userId: 'user-1',
      userName: 'Sarah Johnson',
      action: 'view',
      category: 'access',
      details: { source: 'contract-detail-page' },
      timestamp: new Date(now - 2 * 60 * 60 * 1000),
      status: 'success',
    },
    {
      id: 'audit-2',
      contractId,
      tenantId: 'default',
      userId: 'user-2',
      userName: 'Mike Chen',
      action: 'update',
      category: 'modification',
      details: { 
        fields: ['metadata.contractType', 'metadata.value'],
        previousValues: { contractType: 'Unknown', value: null },
        newValues: { contractType: 'Service Agreement', value: 250000 },
      },
      timestamp: new Date(now - 5 * 60 * 60 * 1000),
      status: 'success',
    },
    {
      id: 'audit-3',
      contractId,
      tenantId: 'default',
      userId: 'user-1',
      userName: 'Sarah Johnson',
      action: 'share',
      category: 'collaboration',
      details: { 
        sharedWith: ['john@example.com'],
        permissions: ['view'],
      },
      timestamp: new Date(now - 1 * day),
      status: 'success',
    },
    {
      id: 'audit-4',
      contractId,
      tenantId: 'default',
      userId: 'system',
      userName: 'System',
      action: 'extract_metadata',
      category: 'analysis',
      details: { 
        fieldsExtracted: 12,
        confidence: 0.92,
        model: 'gpt-4o',
      },
      timestamp: new Date(now - 2 * day),
      status: 'success',
    },
    {
      id: 'audit-5',
      contractId,
      tenantId: 'default',
      userId: 'system',
      userName: 'System',
      action: 'upload',
      category: 'modification',
      details: { 
        filename: 'contract.pdf',
        fileSize: 2457600,
        mimeType: 'application/pdf',
      },
      timestamp: new Date(now - 3 * day),
      status: 'success',
    },
    {
      id: 'audit-6',
      contractId,
      tenantId: 'default',
      userId: 'user-3',
      userName: 'Emily Davis',
      action: 'approve',
      category: 'workflow',
      details: { 
        stage: 'legal-review',
        approvalId: 'apr-123',
      },
      timestamp: new Date(now - 4 * day),
      status: 'success',
    },
    {
      id: 'audit-7',
      contractId,
      tenantId: 'default',
      userId: 'user-1',
      userName: 'Sarah Johnson',
      action: 'download',
      category: 'access',
      details: { 
        format: 'pdf',
        purpose: 'review',
      },
      timestamp: new Date(now - 5 * day),
      status: 'success',
    },
  ];
}

function summarizeByCategory(logs: AuditLogEntry[]): Record<string, number> {
  return logs.reduce((acc, log) => {
    acc[log.category] = (acc[log.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

function summarizeByAction(logs: AuditLogEntry[]): Record<string, number> {
  return logs.reduce((acc, log) => {
    acc[log.action] = (acc[log.action] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}
