/**
 * User Department Assignment API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';

import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/permissions';
import { auditLog, AuditAction } from '@/lib/security/audit';

/**
 * POST /api/admin/departments/assign - Assign users to departments
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.id || !session.user.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const canManage = await hasPermission(session.user.id, 'users:manage');
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const { userId, departmentIds, accessLevel = 'member' } = await request.json();
    
    if (!userId || !departmentIds || !Array.isArray(departmentIds)) {
      return NextResponse.json({ error: 'userId and departmentIds array required' }, { status: 400 });
    }
    
    // Verify user belongs to tenant
    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId: session.user.tenantId },
    });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // Remove existing department assignments
    await prisma.userDepartment.deleteMany({
      where: { userId },
    });
    
    // Add new assignments
    if (departmentIds.length > 0) {
      await prisma.userDepartment.createMany({
        data: departmentIds.map(departmentId => ({
          userId,
          departmentId,
          accessLevel,
          assignedById: session.user.id,
        })),
      });
    }
    
    await auditLog({
      action: AuditAction.USER_DEPARTMENTS_UPDATED,
      userId: session.user.id,
      tenantId: session.user.tenantId,
      resourceType: 'user',
      resourceId: userId,
      metadata: { departmentIds, accessLevel },
      request,
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Department Assign Error]:', error);
    return NextResponse.json({ error: 'Failed to assign departments' }, { status: 500 });
  }
}

/**
 * GET /api/admin/departments/assign - Get user's department assignments
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.id || !session.user.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }
    
    // Verify user belongs to tenant
    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId: session.user.tenantId },
    });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    const assignments = await prisma.userDepartment.findMany({
      where: { userId },
      include: {
        department: {
          select: { id: true, name: true, color: true, icon: true },
        },
      },
    });
    
    return NextResponse.json({
      userId,
      departments: assignments.map(a => ({
        id: a.departmentId,
        name: a.department?.name || a.departmentId,
        color: a.department?.color || '#3B82F6',
        icon: a.department?.icon || 'Folder',
        accessLevel: a.accessLevel,
        assignedAt: a.createdAt,
      })),
    });
  } catch (error) {
    console.error('[Department Assignment GET Error]:', error);
    return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 });
  }
}
