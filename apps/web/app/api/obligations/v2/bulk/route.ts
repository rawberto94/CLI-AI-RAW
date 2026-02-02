import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import getClient from 'clients-db';
import { ObligationStatus } from '@prisma/client';

const prisma = getClient();

const statusMap: Record<string, ObligationStatus> = {
  pending: 'PENDING',
  in_progress: 'IN_PROGRESS',
  completed: 'COMPLETED',
  overdue: 'OVERDUE',
  at_risk: 'AT_RISK',
  waived: 'WAIVED',
  cancelled: 'CANCELLED',
  disputed: 'DISPUTED',
};

/**
 * POST /api/obligations/v2/bulk
 * Bulk operations on obligations
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, obligationIds, data } = body;

    if (!obligationIds || !Array.isArray(obligationIds) || obligationIds.length === 0) {
      return NextResponse.json(
        { error: 'obligationIds array is required' },
        { status: 400 }
      );
    }

    // Verify all obligations belong to tenant
    const obligations = await prisma.obligation.findMany({
      where: {
        id: { in: obligationIds },
        tenantId: session.user.tenantId,
      },
      select: { id: true, status: true },
    });

    if (obligations.length !== obligationIds.length) {
      return NextResponse.json(
        { error: 'Some obligations not found or unauthorized' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'update_status': {
        if (!data?.status) {
          return NextResponse.json(
            { error: 'data.status is required' },
            { status: 400 }
          );
        }

        const newStatus = statusMap[data.status] || data.status as ObligationStatus;
        const isCompleting = newStatus === 'COMPLETED';

        await prisma.obligation.updateMany({
          where: {
            id: { in: obligationIds },
            tenantId: session.user.tenantId,
          },
          data: {
            status: newStatus,
            ...(isCompleting && {
              completedAt: new Date(),
              completedBy: session.user.id,
            }),
            updatedBy: session.user.id,
          },
        });

        // Create history entries
        for (const oblId of obligationIds) {
          await prisma.obligationHistory.create({
            data: {
              obligationId: oblId,
              action: isCompleting ? 'COMPLETED' : 'STATUS_CHANGED',
              description: `Status changed to ${data.status} via bulk operation`,
              performedBy: session.user.id,
            },
          });
        }

        return NextResponse.json({
          success: true,
          updated: obligationIds.length,
          message: `Updated ${obligationIds.length} obligations to ${data.status}`,
        });
      }

      case 'assign': {
        if (!data?.assignedToUserId) {
          return NextResponse.json(
            { error: 'data.assignedToUserId is required' },
            { status: 400 }
          );
        }

        await prisma.obligation.updateMany({
          where: {
            id: { in: obligationIds },
            tenantId: session.user.tenantId,
          },
          data: {
            assignedToUserId: data.assignedToUserId,
            updatedBy: session.user.id,
          },
        });

        for (const oblId of obligationIds) {
          await prisma.obligationHistory.create({
            data: {
              obligationId: oblId,
              action: 'ASSIGNED',
              description: `Assigned via bulk operation`,
              performedBy: session.user.id,
            },
          });
        }

        return NextResponse.json({
          success: true,
          updated: obligationIds.length,
          message: `Assigned ${obligationIds.length} obligations`,
        });
      }

      case 'reschedule': {
        if (!data?.dueDate) {
          return NextResponse.json(
            { error: 'data.dueDate is required' },
            { status: 400 }
          );
        }

        await prisma.obligation.updateMany({
          where: {
            id: { in: obligationIds },
            tenantId: session.user.tenantId,
          },
          data: {
            dueDate: new Date(data.dueDate),
            updatedBy: session.user.id,
          },
        });

        for (const oblId of obligationIds) {
          await prisma.obligationHistory.create({
            data: {
              obligationId: oblId,
              action: 'RESCHEDULED',
              description: `Due date changed to ${data.dueDate} via bulk operation`,
              performedBy: session.user.id,
            },
          });
        }

        return NextResponse.json({
          success: true,
          updated: obligationIds.length,
          message: `Rescheduled ${obligationIds.length} obligations`,
        });
      }

      case 'add_tags': {
        if (!data?.tags || !Array.isArray(data.tags)) {
          return NextResponse.json(
            { error: 'data.tags array is required' },
            { status: 400 }
          );
        }

        // Need to update each individually to append tags
        for (const oblId of obligationIds) {
          const obl = await prisma.obligation.findUnique({
            where: { id: oblId },
            select: { tags: true },
          });

          const existingTags = (obl?.tags as string[]) || [];
          const newTags = [...new Set([...existingTags, ...data.tags])];

          await prisma.obligation.update({
            where: { id: oblId },
            data: {
              tags: newTags,
              updatedBy: session.user.id,
            },
          });
        }

        return NextResponse.json({
          success: true,
          updated: obligationIds.length,
          message: `Added tags to ${obligationIds.length} obligations`,
        });
      }

      case 'delete': {
        await prisma.obligation.deleteMany({
          where: {
            id: { in: obligationIds },
            tenantId: session.user.tenantId,
          },
        });

        return NextResponse.json({
          success: true,
          deleted: obligationIds.length,
          message: `Deleted ${obligationIds.length} obligations`,
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: update_status, assign, reschedule, add_tags, delete' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Bulk operation failed:', error);
    return NextResponse.json(
      { error: 'Bulk operation failed' },
      { status: 500 }
    );
  }
}
