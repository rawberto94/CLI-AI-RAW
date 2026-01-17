import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantIdFromRequest } from '@/lib/tenant-server';
import { publishRealtimeEvent } from '@/lib/realtime/publish';

export const dynamic = 'force-dynamic';

/**
 * Notification Types:
 * - APPROVAL_REQUEST: New approval request assigned
 * - APPROVAL_COMPLETED: Approval completed by someone in chain
 * - COMMENT_MENTION: @mentioned in a comment
 * - COMMENT_REPLY: Reply to your comment
 * - CONTRACT_DEADLINE: Contract deadline approaching
 * - CONTRACT_UPDATE: Contract was updated
 * - WORKFLOW_STEP: Workflow step requires action
 * - SHARE_INVITE: Document shared with you
 * - SYSTEM: System notifications
 */

interface Notification {
  id: string;
  tenantId: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
  expiresAt?: string;
}

// Mock notifications for fallback
const getMockNotifications = (userId: string): Notification[] => [
  {
    id: 'n1',
    tenantId: 'demo',
    userId,
    type: 'APPROVAL_REQUEST',
    title: 'New Approval Required',
    message: 'Master Agreement with Acme Corp requires your approval',
    link: '/approvals',
    metadata: { contractId: 'c1', approvalId: 'a1', priority: 'high' },
    isRead: false,
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
  {
    id: 'n2',
    tenantId: 'demo',
    userId,
    type: 'COMMENT_MENTION',
    title: 'You were mentioned',
    message: '@you was mentioned by Sarah in Contract ABC-001',
    link: '/contracts/c2',
    metadata: { contractId: 'c2', commentId: 'cm1', mentionedBy: 'Sarah Johnson' },
    isRead: false,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'n3',
    tenantId: 'demo',
    userId,
    type: 'CONTRACT_DEADLINE',
    title: 'Deadline Approaching',
    message: 'Contract "TechVendor SLA" expires in 7 days',
    link: '/contracts/c3',
    metadata: { contractId: 'c3', daysRemaining: 7, urgency: 'medium' },
    isRead: true,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'n4',
    tenantId: 'demo',
    userId,
    type: 'WORKFLOW_STEP',
    title: 'Workflow Action Required',
    message: 'Legal Review step awaits your input for CloudServices NDA',
    link: '/workflows/w1/executions/e1',
    metadata: { workflowId: 'w1', executionId: 'e1', stepName: 'Legal Review' },
    isRead: false,
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'n5',
    tenantId: 'demo',
    userId,
    type: 'APPROVAL_COMPLETED',
    title: 'Approval Completed',
    message: 'Mike Johnson approved the Vendor Agreement',
    link: '/contracts/c4',
    metadata: { contractId: 'c4', approvedBy: 'Mike Johnson' },
    isRead: true,
    createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
  },
];

/**
 * GET /api/notifications - Get user notifications
 */
export async function GET(request: NextRequest) {
  try {
    let tenantId: string;
    try {
      tenantId = await getTenantIdFromRequest(request);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Tenant ID is required' },
        { status: 400 }
      );
    }
    const userId = request.headers.get('x-user-id') || 'current-user';
    const { searchParams } = new URL(request.url);
    
    const unreadOnly = searchParams.get('unread') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');
    const type = searchParams.get('type');

    // Try database first
    try {
      const where: Record<string, unknown> = { tenantId, userId };
      if (unreadOnly) where.isRead = false;
      if (type) where.type = type;

      const notifications = await prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      const unreadCount = await prisma.notification.count({
        where: { tenantId, userId, isRead: false },
      });

      return NextResponse.json({
        success: true,
        notifications,
        unreadCount,
        total: notifications.length,
        source: 'database',
      });
    } catch {
      return NextResponse.json(
        { success: false, error: 'Database connection failed' },
        { status: 503 }
      );
    }
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notifications - Create a notification
 */
export async function POST(request: NextRequest) {
  try {
    let tenantId: string;
    try {
      tenantId = await getTenantIdFromRequest(request);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Tenant ID is required' },
        { status: 400 }
      );
    }
    const body = await request.json();
    
    const { userId, type, title, message, link, metadata, recipients } = body;

    if (!title || !message) {
      return NextResponse.json(
        { success: false, error: 'Title and message are required' },
        { status: 400 }
      );
    }

    // Support bulk notifications to multiple recipients
    const targetUsers = recipients || (userId ? [userId] : []);
    
    if (targetUsers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one recipient is required' },
        { status: 400 }
      );
    }

    try {
      const notifications = await prisma.notification.createMany({
        data: targetUsers.map((uid: string) => ({
          tenantId,
          userId: uid,
          type: type || 'SYSTEM',
          title,
          message,
          link,
          metadata: metadata || {},
          isRead: false,
        })),
      });

      void publishRealtimeEvent({
        event: 'notification:new',
        data: { tenantId },
        source: 'api:notifications',
      });

      return NextResponse.json({
        success: true,
        message: `${notifications.count} notification(s) created`,
        count: notifications.count,
        source: 'database',
      });
    } catch {
      return NextResponse.json(
        { success: false, error: 'Database operation failed' },
        { status: 503 }
      );
    }
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to create notification' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/notifications - Mark notifications as read
 */
export async function PATCH(request: NextRequest) {
  try {
    let tenantId: string;
    try {
      tenantId = await getTenantIdFromRequest(request);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Tenant ID is required' },
        { status: 400 }
      );
    }
    const userId = request.headers.get('x-user-id') || 'current-user';
    const body = await request.json();
    
    const { notificationIds, markAllRead } = body;

    try {
      if (markAllRead) {
        const result = await prisma.notification.updateMany({
          where: { tenantId, userId, isRead: false },
          data: { isRead: true },
        });

        void publishRealtimeEvent({
          event: 'notification:new',
          data: { tenantId },
          source: 'api:notifications',
        });

        return NextResponse.json({
          success: true,
          message: `${result.count} notifications marked as read`,
          count: result.count,
          source: 'database',
        });
      }

      if (notificationIds && notificationIds.length > 0) {
        const result = await prisma.notification.updateMany({
          where: { id: { in: notificationIds }, tenantId, userId },
          data: { isRead: true },
        });

        void publishRealtimeEvent({
          event: 'notification:new',
          data: { tenantId },
          source: 'api:notifications',
        });

        return NextResponse.json({
          success: true,
          message: `${result.count} notifications marked as read`,
          count: result.count,
          source: 'database',
        });
      }

      return NextResponse.json(
        { success: false, error: 'Either notificationIds or markAllRead is required' },
        { status: 400 }
      );
    } catch {
      return NextResponse.json(
        { success: false, error: 'Database operation failed' },
        { status: 503 }
      );
    }
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to update notifications' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/notifications - Delete notifications
 */
export async function DELETE(request: NextRequest) {
  try {
    let tenantId: string;
    try {
      tenantId = await getTenantIdFromRequest(request);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Tenant ID is required' },
        { status: 400 }
      );
    }
    const userId = request.headers.get('x-user-id') || 'current-user';
    const { searchParams } = new URL(request.url);
    
    const notificationId = searchParams.get('id');
    const deleteRead = searchParams.get('deleteRead') === 'true';

    try {
      if (notificationId) {
        await prisma.notification.delete({
          where: { id: notificationId, tenantId, userId },
        });

        void publishRealtimeEvent({
          event: 'notification:new',
          data: { tenantId },
          source: 'api:notifications',
        });

        return NextResponse.json({
          success: true,
          message: 'Notification deleted',
          source: 'database',
        });
      }

      if (deleteRead) {
        const result = await prisma.notification.deleteMany({
          where: { tenantId, userId, isRead: true },
        });

        void publishRealtimeEvent({
          event: 'notification:new',
          data: { tenantId },
          source: 'api:notifications',
        });

        return NextResponse.json({
          success: true,
          message: `${result.count} read notifications deleted`,
          count: result.count,
          source: 'database',
        });
      }

      return NextResponse.json(
        { success: false, error: 'Either id or deleteRead parameter is required' },
        { status: 400 }
      );
    } catch {
      return NextResponse.json(
        { success: false, error: 'Database operation failed' },
        { status: 503 }
      );
    }
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to delete notification' },
      { status: 500 }
    );
  }
}
