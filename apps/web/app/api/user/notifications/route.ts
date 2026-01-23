/**
 * User Notifications API Routes
 * 
 * GET /api/user/notifications - Get all notifications
 * POST /api/user/notifications - Create a notification
 * PATCH /api/user/notifications - Mark notifications as read
 * DELETE /api/user/notifications - Delete notifications
 * 
 * Note: Uses existing Notification model from Prisma schema
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from '@/lib/auth'
import { getSessionTenantId } from '@/lib/tenant-server'

// ============ GET - Fetch notifications ============
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession()
    
    // Require authentication
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const userId = session.user.id
    const { searchParams } = new URL(request.url)
    
    // Parse query params
    const unreadOnly = searchParams.get('unread') === 'true'
    const type = searchParams.get('type')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    
    // Build where clause
    const where: Record<string, unknown> = { userId }
    if (unreadOnly) {
      where.isRead = false
    }
    if (type) {
      where.type = type
    }
    
    // Fetch from database
    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: [
          { isRead: 'asc' },
          { createdAt: 'desc' }
        ],
        take: limit,
        skip: offset,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, isRead: false } })
    ])
    
    // Map to response format
    const mappedNotifications = notifications.map(n => ({
      id: n.id,
      type: n.type,
      priority: getPriorityFromType(n.type),
      title: n.title,
      message: n.message,
      timestamp: n.createdAt,
      read: n.isRead,
      actionUrl: n.link,
      metadata: n.metadata,
    }))
    
    return NextResponse.json({
      success: true,
      data: {
        notifications: mappedNotifications,
        unreadCount,
        total
      }
    })
  } catch {
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch notifications'
    }, { status: 500 })
  }
}

// ============ POST - Create notification ============
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession()
    
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 })
    }
    
    const body = await request.json()
    const { type, title, message, link, metadata } = body
    
    // Validate required fields
    if (!title || !message) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: title, message'
      }, { status: 400 })
    }
    
    const userId = session.user.id
    const tenantId = getSessionTenantId(session)
    
    // Create notification
    const notification = await prisma.notification.create({
      data: {
        tenantId,
        userId,
        type: type || 'SYSTEM',
        title,
        message,
        link,
        metadata: metadata || {},
        isRead: false,
      },
    })
    
    return NextResponse.json({
      success: true,
      data: {
        id: notification.id,
        type: notification.type,
        priority: getPriorityFromType(notification.type),
        title: notification.title,
        message: notification.message,
        timestamp: notification.createdAt,
        read: notification.isRead,
        actionUrl: notification.link,
      }
    })
  } catch {
    return NextResponse.json({
      success: false,
      error: 'Failed to create notification'
    }, { status: 500 })
  }
}

// ============ PATCH - Mark as read ============
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession()
    
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 })
    }
    
    const body = await request.json()
    const { ids, markAll } = body as { ids?: string[]; markAll?: boolean }
    
    const userId = session.user.id
    
    if (markAll) {
      // Mark all as read
      await prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true }
      })
      
      return NextResponse.json({
        success: true,
        message: 'All notifications marked as read'
      })
    }
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Notification IDs required'
      }, { status: 400 })
    }
    
    // Mark specific notifications as read
    await prisma.notification.updateMany({
      where: {
        id: { in: ids },
        userId,
      },
      data: { isRead: true }
    })
    
    return NextResponse.json({
      success: true,
      message: `${ids.length} notification(s) marked as read`
    })
  } catch {
    return NextResponse.json({
      success: false,
      error: 'Failed to update notifications'
    }, { status: 500 })
  }
}

// ============ DELETE - Delete notifications ============
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession()
    
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 })
    }
    
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const deleteRead = searchParams.get('deleteRead') === 'true'
    const deleteAll = searchParams.get('deleteAll') === 'true'
    
    const userId = session.user.id
    
    if (deleteAll) {
      await prisma.notification.deleteMany({
        where: { userId }
      })
      return NextResponse.json({
        success: true,
        message: 'All notifications deleted'
      })
    }
    
    if (deleteRead) {
      const result = await prisma.notification.deleteMany({
        where: { userId, isRead: true }
      })
      return NextResponse.json({
        success: true,
        message: `${result.count} read notification(s) deleted`
      })
    }
    
    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Notification ID required'
      }, { status: 400 })
    }
    
    await prisma.notification.delete({
      where: { id, userId }
    })
    
    return NextResponse.json({
      success: true,
      message: 'Notification deleted'
    })
  } catch {
    return NextResponse.json({
      success: false,
      error: 'Failed to delete notification'
    }, { status: 500 })
  }
}

// ============ Helper Functions ============

function getPriorityFromType(type: string): 'critical' | 'high' | 'medium' | 'low' {
  switch (type) {
    case 'APPROVAL_REQUEST':
    case 'CONTRACT_DEADLINE':
      return 'high';
    case 'WORKFLOW_STEP':
    case 'APPROVAL_COMPLETED':
      return 'medium';
    case 'COMMENT_MENTION':
    case 'SHARE_INVITE':
      return 'medium';
    case 'SYSTEM':
    default:
      return 'low';
  }
}

function generateMockNotifications() {
  const types = ['APPROVAL_REQUEST', 'APPROVAL_COMPLETED', 'COMMENT_MENTION', 'CONTRACT_DEADLINE', 'WORKFLOW_STEP', 'SHARE_INVITE', 'SYSTEM'];
  
  const contracts = [
    'Microsoft Enterprise Agreement',
    'AWS Services Contract', 
    'Salesforce CRM License',
    'Google Cloud Platform',
    'Adobe Creative Suite',
  ];

  return Array.from({ length: 10 }, (_, i) => ({
    id: `notif-${i + 1}`,
    type: types[Math.floor(Math.random() * types.length)],
    priority: getPriorityFromType(types[Math.floor(Math.random() * types.length)]),
    title: `Notification ${i + 1}`,
    message: `This is a sample notification message for testing purposes.`,
    contractName: contracts[Math.floor(Math.random() * contracts.length)],
    timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
    read: Math.random() > 0.5,
    actionUrl: `/contracts/contract-${i + 1}`,
  }));
}
