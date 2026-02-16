/**
 * Contract Access Control API
 * 
 * Assign specific users/groups to specific contracts
 */

import { NextRequest } from 'next/server';
import { getServerSession } from '@/lib/auth';

import { prisma } from '@/lib/prisma';
import { contractService } from 'data-orchestration/services';
import { hasPermission } from '@/lib/permissions';
import { auditLog, AuditAction } from '@/lib/security/audit';
import { sendEmail } from '@/lib/email/email-service';
import { emailTemplates } from '@/lib/email/templates';
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

type AccessLevel = 'view' | 'edit' | 'manage' | 'admin';

/**
 * GET /api/contracts/[id]/access - Get access list for a contract
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const session = await getServerSession();
    const { id: contractId } = await params;
    
    if (!session?.user?.id || !session.user.tenantId) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
    }
    
    // Verify contract belongs to tenant
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId: session.user.tenantId },
      select: { id: true, fileName: true },
    });
    
    if (!contract) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
    }
    
    // Get user access
    const userAccess = await prisma.contractUserAccess.findMany({
      where: { contractId },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true, avatar: true },
        },
      },
    });
    
    // Get group access
    const groupAccess = await prisma.contractGroupAccess.findMany({
      where: { contractId },
      include: {
        group: {
          select: { id: true, name: true, color: true },
          include: {
            _count: { select: { members: true } },
          },
        },
      },
    });
    
    return createSuccessResponse(ctx, {
      contractId,
      users: userAccess.map(ua => ({
        id: ua.user.id,
        email: ua.user.email,
        name: `${ua.user.firstName || ''} ${ua.user.lastName || ''}`.trim() || ua.user.email,
        avatar: ua.user.avatar,
        accessLevel: ua.accessLevel,
        grantedAt: ua.grantedAt,
        expiresAt: ua.expiresAt,
      })),
      groups: groupAccess.map(ga => ({
        id: ga.group.id,
        name: ga.group.name,
        color: ga.group.color,
        memberCount: ga.group._count.members,
        accessLevel: ga.accessLevel,
        grantedAt: ga.grantedAt,
        expiresAt: ga.expiresAt,
      })),
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

/**
 * POST /api/contracts/[id]/access - Grant access to contract
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const session = await getServerSession();
    const { id: contractId } = await params;
    
    if (!session?.user?.id || !session.user.tenantId) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
    }
    
    // Check permission to manage contract access
    const canManage = await hasPermission(session.user.id, 'contracts:manage') ||
                      await hasContractAccess(session.user.id, contractId, 'manage');
    
    if (!canManage) {
      return createErrorResponse(ctx, 'FORBIDDEN', 'Forbidden', 403);
    }
    
    const body = await request.json();
    const { userIds, groupIds, accessLevel = 'view', expiresAt, notify = true } = body;
    
    if ((!userIds || userIds.length === 0) && (!groupIds || groupIds.length === 0)) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'userIds or groupIds required', 400);
    }
    
    if (!['view', 'edit', 'manage', 'admin'].includes(accessLevel)) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid access level', 400);
    }
    
    // Verify contract belongs to tenant via service layer
    const contractResult = await contractService.getContract(contractId, session.user.tenantId);
    
    if (!contractResult.success || !contractResult.data) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
    }
    
    const results = { usersGranted: 0, groupsGranted: 0 };
    
    // Grant user access
    if (userIds && userIds.length > 0) {
      // Verify users belong to same tenant
      const validUsers = await prisma.user.findMany({
        where: { id: { in: userIds }, tenantId: session.user.tenantId },
        select: { id: true },
      });
      
      for (const user of validUsers) {
        await prisma.contractUserAccess.upsert({
          where: {
            contractId_userId: { contractId, userId: user.id },
          },
          create: {
            contractId,
            userId: user.id,
            accessLevel,
            grantedBy: session.user.id,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
          },
          update: {
            accessLevel,
            grantedBy: session.user.id,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
          },
        });
      }
      results.usersGranted = validUsers.length;
    }
    
    // Grant group access
    if (groupIds && groupIds.length > 0) {
      // Verify groups belong to same tenant
      const validGroups = await prisma.userGroup.findMany({
        where: { id: { in: groupIds }, tenantId: session.user.tenantId },
        select: { id: true },
      });
      
      // Batch upserts in a single transaction for performance
      await prisma.$transaction(
        validGroups.map(group =>
          prisma.contractGroupAccess.upsert({
            where: {
              contractId_groupId: { contractId, groupId: group.id },
            },
            create: {
              contractId,
              groupId: group.id,
              accessLevel,
              grantedBy: session.user.id,
              expiresAt: expiresAt ? new Date(expiresAt) : null,
            },
            update: {
              accessLevel,
              grantedBy: session.user.id,
              expiresAt: expiresAt ? new Date(expiresAt) : null,
            },
          })
        )
      );
      results.groupsGranted = validGroups.length;
            grantedBy: session.user.id,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
          },
          update: {
            accessLevel,
            grantedBy: session.user.id,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
          },
        });
        results.groupsGranted++;
      }
    }
    
    await auditLog({
      action: AuditAction.CONTRACT_ACCESS_GRANTED,
      userId: session.user.id,
      tenantId: session.user.tenantId,
      resourceType: 'contract',
      resourceId: contractId,
      metadata: { userIds, groupIds, accessLevel, expiresAt },
      requestId: request.headers.get('x-request-id') || undefined,
    });
    
    // Send notifications if notify=true
    if (notify && userIds && userIds.length > 0) {
      try {
        // Fetch user details for notification
        const usersToNotify = await prisma.user.findMany({
          where: { id: { in: userIds }, tenantId: session.user.tenantId },
          select: { id: true, email: true, firstName: true },
        });
        
        const userSession = session.user as { firstName?: string; lastName?: string; email?: string } & typeof session.user;
        const granterName = userSession.firstName 
          ? `${userSession.firstName} ${userSession.lastName || ''}`
          : session.user.email || 'Unknown';
        
        const baseUrl = process.env.NEXT_PUBLIC_URL;
        if (!baseUrl) {
          throw new Error('NEXT_PUBLIC_URL environment variable must be configured');
        }
        
        // Send notification emails in parallel
        await Promise.allSettled(
          usersToNotify.map((user) => {
            const template = emailTemplates.contractAccessGranted({
              recipientName: user.firstName || user.email,
              contractTitle: (contract as any).title || (contract as any).contractTitle || 'Untitled Contract',
              accessLevel,
              grantedBy: granterName,
              expiresAt: expiresAt ? new Date(expiresAt).toLocaleDateString() : undefined,
              contractUrl: `${baseUrl}/contracts/${contractId}`,
            });
            
            return sendEmail({
              to: user.email,
              subject: template.subject,
              html: template.html,
            });
          })
        );
      } catch (notifyError) {
        // Log but don't fail the request if notifications fail
        console.error('[Contract Access] Notification error:', notifyError);
      }
    }
    
    return createSuccessResponse(ctx, { success: true, ...results });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

/**
 * DELETE /api/contracts/[id]/access - Revoke access
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const session = await getServerSession();
    const { id: contractId } = await params;
    
    if (!session?.user?.id || !session.user.tenantId) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
    }
    
    const canManage = await hasPermission(session.user.id, 'contracts:manage') ||
                      await hasContractAccess(session.user.id, contractId, 'manage');
    
    if (!canManage) {
      return createErrorResponse(ctx, 'FORBIDDEN', 'Forbidden', 403);
    }
    
    const body = await request.json();
    const { userIds, groupIds } = body;
    
    const results = { usersRevoked: 0, groupsRevoked: 0 };
    
    if (userIds && userIds.length > 0) {
      const result = await prisma.contractUserAccess.deleteMany({
        where: { contractId, userId: { in: userIds } },
      });
      results.usersRevoked = result.count;
    }
    
    if (groupIds && groupIds.length > 0) {
      const result = await prisma.contractGroupAccess.deleteMany({
        where: { contractId, groupId: { in: groupIds } },
      });
      results.groupsRevoked = result.count;
    }
    
    await auditLog({
      action: AuditAction.CONTRACT_ACCESS_REVOKED,
      userId: session.user.id,
      tenantId: session.user.tenantId,
      resourceType: 'contract',
      resourceId: contractId,
      metadata: { userIds, groupIds },
      requestId: request.headers.get('x-request-id') || undefined,
    });
    
    return createSuccessResponse(ctx, { success: true, ...results });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

/**
 * Check if user has specific access level to a contract
 */
export async function hasContractAccess(
  userId: string,
  contractId: string,
  requiredLevel: AccessLevel
): Promise<boolean> {
  const levelHierarchy: AccessLevel[] = ['view', 'edit', 'manage', 'admin'];
  const requiredIndex = levelHierarchy.indexOf(requiredLevel);
  
  // Check direct user access
  const userAccess = await prisma.contractUserAccess.findFirst({
    where: {
      contractId,
      userId,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
  });
  
  if (userAccess) {
    const userLevel = levelHierarchy.indexOf(userAccess.accessLevel as AccessLevel);
    if (userLevel >= requiredIndex) return true;
  }
  
  // Check group access
  const userGroups = await prisma.userGroupMember.findMany({
    where: { userId },
    select: { groupId: true },
  });
  
  const groupIds = userGroups.map(ug => ug.groupId);
  
  if (groupIds.length > 0) {
    const groupAccess = await prisma.contractGroupAccess.findFirst({
      where: {
        contractId,
        groupId: { in: groupIds },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      orderBy: { accessLevel: 'desc' },
    });
    
    if (groupAccess) {
      const groupLevel = levelHierarchy.indexOf(groupAccess.accessLevel as AccessLevel);
      if (groupLevel >= requiredIndex) return true;
    }
  }
  
  return false;
}

/**
 * Get all contracts a user has access to
 */
export async function getUserAccessibleContracts(
  userId: string,
  tenantId: string
): Promise<string[]> {
  // Get user's direct access
  const directAccess = await prisma.contractUserAccess.findMany({
    where: {
      userId,
      contract: { tenantId },
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    select: { contractId: true },
  });
  
  // Get user's groups
  const userGroups = await prisma.userGroupMember.findMany({
    where: { userId },
    select: { groupId: true },
  });
  
  const groupIds = userGroups.map(ug => ug.groupId);
  
  // Get group access
  let groupAccess: { contractId: string }[] = [];
  if (groupIds.length > 0) {
    groupAccess = await prisma.contractGroupAccess.findMany({
      where: {
        groupId: { in: groupIds },
        contract: { tenantId },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      select: { contractId: true },
    });
  }
  
  // Combine and dedupe
  const allContractIds = new Set([
    ...directAccess.map(a => a.contractId),
    ...groupAccess.map(a => a.contractId),
  ]);
  
  return Array.from(allContractIds);
}
