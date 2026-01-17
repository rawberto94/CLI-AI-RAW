/**
 * Individual Obligation Notification API - Update/delete specific notifications
 * 
 * GET /api/obligations/notifications/[id] - Get notification details
 * PATCH /api/obligations/notifications/[id] - Update notification
 * DELETE /api/obligations/notifications/[id] - Delete notification
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/auth';
import { getApiTenantId } from '@/lib/tenant-server';

export const dynamic = 'force-dynamic';

// GET /api/obligations/notifications/[id] - Get notification
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const tenantId = await getApiTenantId(request);
    const { id } = await params;

    const notification = await prisma.obligationNotification.findFirst({
      where: { id, tenantId, userId: session.user.id },
      include: {
        obligation: {
          select: {
            id: true,
            title: true,
            description: true,
            type: true,
            dueDate: true,
            status: true,
            priority: true,
          },
        },
        contract: {
          select: {
            id: true,
            title: true,
            status: true,
            parties: true,
          },
        },
      },
    });

    if (!notification) {
      return NextResponse.json(
        { success: false, error: 'Notification not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { notification },
    });
  } catch (error) {
    console.error('Error fetching notification:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch notification' },
      { status: 500 }
    );
  }
}

// PATCH /api/obligations/notifications/[id] - Update notification
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const tenantId = await getApiTenantId(request);
    const { id } = await params;
    const body = await request.json();

    // Verify ownership
    const existing = await prisma.obligationNotification.findFirst({
      where: { id, tenantId, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Notification not found' },
        { status: 404 }
      );
    }

    const {
      status, // 'pending', 'sent', 'read', 'dismissed'
      scheduledFor,
      message,
      channels,
      sentAt,
      readAt,
      metadata,
    } = body;

    const updateData: Record<string, unknown> = {};

    if (status !== undefined) {
      if (!['pending', 'sent', 'read', 'dismissed'].includes(status)) {
        return NextResponse.json(
          { success: false, error: 'Invalid status' },
          { status: 400 }
        );
      }
      updateData.status = status;
      
      // Auto-set timestamps based on status
      if (status === 'sent' && !sentAt) {
        updateData.sentAt = new Date();
      }
      if (status === 'read' && !readAt) {
        updateData.readAt = new Date();
      }
    }

    if (scheduledFor !== undefined) updateData.scheduledFor = new Date(scheduledFor);
    if (message !== undefined) updateData.message = message;
    if (channels !== undefined) updateData.channels = channels;
    if (sentAt !== undefined) updateData.sentAt = sentAt ? new Date(sentAt) : null;
    if (readAt !== undefined) updateData.readAt = readAt ? new Date(readAt) : null;
    if (metadata !== undefined) updateData.metadata = metadata;

    const notification = await prisma.obligationNotification.update({
      where: { id },
      data: updateData,
      include: {
        obligation: {
          select: {
            id: true,
            title: true,
            type: true,
            dueDate: true,
          },
        },
        contract: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: { notification },
    });
  } catch (error) {
    console.error('Error updating notification:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update notification' },
      { status: 500 }
    );
  }
}

// DELETE /api/obligations/notifications/[id] - Delete notification
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const tenantId = await getApiTenantId(request);
    const { id } = await params;

    // Verify ownership
    const existing = await prisma.obligationNotification.findFirst({
      where: { id, tenantId, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Notification not found' },
        { status: 404 }
      );
    }

    await prisma.obligationNotification.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Notification deleted',
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete notification' },
      { status: 500 }
    );
  }
}
