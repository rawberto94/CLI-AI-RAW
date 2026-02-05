/**
 * Department-Based Access Control
 * 
 * Filter contracts and data by user's department assignment
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';

import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/permissions';
import { auditLog, AuditAction, getAuditContext } from '@/lib/security/audit';

// Standard departments - can be customized per tenant
export const STANDARD_DEPARTMENTS = [
  { id: 'legal', name: 'Legal', color: '#6366F1', icon: 'Scale' },
  { id: 'finance', name: 'Finance', color: '#10B981', icon: 'DollarSign' },
  { id: 'hr', name: 'Human Resources', color: '#F59E0B', icon: 'Users' },
  { id: 'it', name: 'Information Technology', color: '#3B82F6', icon: 'Monitor' },
  { id: 'operations', name: 'Operations', color: '#8B5CF6', icon: 'Settings' },
  { id: 'procurement', name: 'Procurement', color: '#EC4899', icon: 'ShoppingCart' },
  { id: 'sales', name: 'Sales', color: '#EF4444', icon: 'TrendingUp' },
  { id: 'marketing', name: 'Marketing', color: '#14B8A6', icon: 'Megaphone' },
  { id: 'engineering', name: 'Engineering', color: '#F97316', icon: 'Code' },
  { id: 'executive', name: 'Executive', color: '#6B7280', icon: 'Crown' },
];

/**
 * GET /api/admin/departments - List all departments
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.id || !session.user.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get custom departments for tenant
    const customDepartments = await prisma.department.findMany({
      where: { tenantId: session.user.tenantId },
      include: {
        _count: {
          select: { members: true },
        },
      },
      orderBy: { name: 'asc' },
    });
    
    // Get user counts per department
    const usersByDepartment = await prisma.userDepartment.groupBy({
      by: ['departmentId'],
      _count: true,
    });
    
    const userCountMap = new Map(usersByDepartment.map(u => [u.departmentId, u._count]));
    
    // Get contract counts by department (through user assignments)
    const contractsByDepartment = await prisma.$queryRaw<Array<{ departmentId: string; count: bigint }>>`
      SELECT ud."departmentId", COUNT(DISTINCT c.id)::bigint as count
      FROM "UserDepartment" ud
      JOIN "Contract" c ON c."ownerId" = ud."userId" OR c."tenantId" = ${session.user.tenantId}
      WHERE ud."departmentId" IS NOT NULL
      GROUP BY ud."departmentId"
    `.catch(() => []);
    
    const contractCountMap = new Map(
      (contractsByDepartment || []).map(c => [c.departmentId, Number(c.count)])
    );
    
    // Merge standard and custom departments
    const departments = [
      ...STANDARD_DEPARTMENTS.map(sd => ({
        ...sd,
        isCustom: false,
        userCount: userCountMap.get(sd.id) || 0,
        contractCount: contractCountMap.get(sd.id) || 0,
      })),
      ...customDepartments.map(cd => ({
        id: cd.id,
        name: cd.name,
        color: cd.color,
        icon: cd.icon,
        isCustom: true,
        userCount: cd._count.members,
        contractCount: contractCountMap.get(cd.id) || 0,
      })),
    ];
    
    return NextResponse.json({ departments });
  } catch (error) {
    console.error('[Departments GET Error]:', error);
    return NextResponse.json({ error: 'Failed to fetch departments' }, { status: 500 });
  }
}

/**
 * POST /api/admin/departments - Create custom department
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.id || !session.user.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const canManage = await hasPermission(session.user.id, 'settings:manage');
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const { name, color, icon, contractTypes, accessRules } = await request.json();
    
    if (!name) {
      return NextResponse.json({ error: 'Department name required' }, { status: 400 });
    }
    
    // Check for duplicate
    const existing = await prisma.department.findFirst({
      where: { 
        tenantId: session.user.tenantId,
        name: { equals: name, mode: 'insensitive' },
      },
    });
    
    if (existing) {
      return NextResponse.json({ error: 'Department already exists' }, { status: 409 });
    }
    
    const department = await prisma.department.create({
      data: {
        tenantId: session.user.tenantId,
        name,
        color: color || '#3B82F6',
        icon: icon || 'Folder',
        contractTypes: contractTypes || [],
        accessRules: accessRules || {},
        createdById: session.user.id,
      },
    });
    
    await auditLog({
      action: AuditAction.DEPARTMENT_CREATED,
      userId: session.user.id,
      tenantId: session.user.tenantId,
      resourceType: 'department',
      resourceId: department.id,
      metadata: { name },
      ...getAuditContext(request),
    });
    
    return NextResponse.json({ success: true, department });
  } catch (error) {
    console.error('[Departments POST Error]:', error);
    return NextResponse.json({ error: 'Failed to create department' }, { status: 500 });
  }
}

/**
 * PUT /api/admin/departments - Update department
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.id || !session.user.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const canManage = await hasPermission(session.user.id, 'settings:manage');
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const { departmentId, name, color, icon, contractTypes, accessRules } = await request.json();
    
    if (!departmentId) {
      return NextResponse.json({ error: 'Department ID required' }, { status: 400 });
    }
    
    // Verify department belongs to tenant
    const existing = await prisma.department.findFirst({
      where: { id: departmentId, tenantId: session.user.tenantId },
    });
    
    if (!existing) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }
    
    const department = await prisma.department.update({
      where: { id: departmentId },
      data: {
        name,
        color,
        icon,
        contractTypes,
        accessRules,
      },
    });
    
    return NextResponse.json({ success: true, department });
  } catch (error) {
    console.error('[Departments PUT Error]:', error);
    return NextResponse.json({ error: 'Failed to update department' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/departments - Delete custom department
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.id || !session.user.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const canManage = await hasPermission(session.user.id, 'settings:manage');
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const { departmentId } = await request.json();
    
    if (!departmentId) {
      return NextResponse.json({ error: 'Department ID required' }, { status: 400 });
    }
    
    // Verify department belongs to tenant
    const existing = await prisma.department.findFirst({
      where: { id: departmentId, tenantId: session.user.tenantId },
    });
    
    if (!existing) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }
    
    // Remove user assignments first
    await prisma.userDepartment.deleteMany({
      where: { departmentId },
    });
    
    await prisma.department.delete({
      where: { id: departmentId },
    });
    
    await auditLog({
      action: AuditAction.DEPARTMENT_DELETED,
      userId: session.user.id,
      tenantId: session.user.tenantId,
      resourceType: 'department',
      resourceId: departmentId,
      metadata: { name: existing.name },
      ...getAuditContext(request),
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Departments DELETE Error]:', error);
    return NextResponse.json({ error: 'Failed to delete department' }, { status: 500 });
  }
}

/**
 * Get contracts filtered by user's department access
 */
export async function getContractsByDepartmentAccess(
  userId: string,
  tenantId: string
): Promise<{ departmentIds: string[]; contractFilter: any }> {
  // Get user's departments
  const userDepartments = await prisma.userDepartment.findMany({
    where: { userId },
    select: { departmentId: true, accessLevel: true },
  });
  
  if (userDepartments.length === 0) {
    // User has no department restrictions - check role
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    
    // Admins and owners see all contracts
    if (user?.role && ['owner', 'admin'].includes(user.role)) {
      return { departmentIds: [], contractFilter: { tenantId } };
    }
    
    // Users without department see only assigned contracts
    return { 
      departmentIds: [], 
      contractFilter: { 
        tenantId,
        OR: [
          { uploadedBy: userId },
          { userAccess: { some: { userId } } },
        ],
      },
    };
  }
  
  const departmentIds = userDepartments.map(ud => ud.departmentId);
  
  // Get department contract type mappings
  const departments = await prisma.department.findMany({
    where: { id: { in: departmentIds } },
    select: { contractTypes: true },
  });
  
  const allowedContractTypes = new Set<string>();
  departments.forEach(d => {
    if (d.contractTypes && Array.isArray(d.contractTypes)) {
      (d.contractTypes as string[]).forEach(ct => allowedContractTypes.add(ct));
    }
  });
  
  // Build filter
  const contractFilter: any = {
    tenantId,
    OR: [
      // Contracts uploaded by user
      { uploadedBy: userId },
      // Contracts assigned to user
      { userAccess: { some: { userId } } },
      // Contracts in user's departments (by metadata.department)
      { 
        metadata: {
          path: ['department'],
          string_contains: departmentIds,
        },
      },
    ],
  };
  
  // Add contract type filter if departments have type restrictions
  if (allowedContractTypes.size > 0) {
    contractFilter.OR.push({
      contractType: { in: Array.from(allowedContractTypes) },
    });
  }
  
  return { departmentIds, contractFilter };
}
