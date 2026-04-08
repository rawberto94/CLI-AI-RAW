/**
 * Team Members API
 * Manage team members and collaboration - Database persisted
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';
import { auditTrailService } from 'data-orchestration/services';
import { logger } from '@/lib/logger';

const TeamInviteSchema = z.object({
  email: z.string().email('Invalid email format').max(255),
  role: z.enum(['admin', 'manager', 'member', 'viewer']).default('member'),
  department: z.string().max(100).optional(),
  tenantId: z.string().optional(),
});

type UserRole = 'owner' | 'admin' | 'manager' | 'member' | 'viewer';
type UserStatus = 'active' | 'invited' | 'inactive';

interface TeamMemberResponse {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: UserRole;
  status: UserStatus;
  joinedAt: string;
  lastActive?: string;
  contractsAccess: number;
  department?: string;
}

// Map database user status to API status
function mapUserStatus(dbStatus: string): UserStatus {
  switch (dbStatus) {
    case 'ACTIVE': return 'active';
    case 'PENDING': return 'invited';
    case 'INACTIVE':
    case 'SUSPENDED':
      return 'inactive';
    default: return 'active';
  }
}

// Transform database user to API response
function transformUser(dbUser: any): TeamMemberResponse {
  const name = dbUser.firstName && dbUser.lastName 
    ? `${dbUser.firstName} ${dbUser.lastName}` 
    : dbUser.firstName || dbUser.lastName || dbUser.email.split('@')[0];
  
  // Get the highest role from UserRole relation
  const roleNames = dbUser.roles?.map((r: any) => r.role?.name?.toLowerCase()) || [];
  let role: UserRole = 'member';
  
  if (roleNames.includes('owner') || dbUser.role === 'owner') role = 'owner';
  else if (roleNames.includes('admin') || dbUser.role === 'admin') role = 'admin';
  else if (roleNames.includes('manager')) role = 'manager';
  else if (roleNames.includes('viewer') || dbUser.role === 'viewer') role = 'viewer';
  
  return {
    id: dbUser.id,
    name,
    email: dbUser.email,
    avatar: dbUser.avatar || undefined,
    role,
    status: mapUserStatus(dbUser.status),
    joinedAt: dbUser.createdAt.toISOString(),
    lastActive: dbUser.lastLoginAt?.toISOString(),
    contractsAccess: dbUser._count?.createdDrafts || 0,
    department: undefined, // Could add to User model if needed
  };
}

export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const { searchParams } = new URL(request.url);
  const role = searchParams.get('role');
  const status = searchParams.get('status');
  const search = searchParams.get('search');
  const tenantId = ctx.tenantId;

  // Build where clause
  const where: any = {};
  
  if (tenantId) {
    where.tenantId = tenantId;
  }

    // Map API status to DB status
    if (status) {
      switch (status) {
        case 'active': where.status = 'ACTIVE'; break;
        case 'invited': where.status = 'PENDING'; break;
        case 'inactive': where.status = { in: ['INACTIVE', 'SUSPENDED'] }; break;
      }
    }

    // Search by name or email
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Fetch users from database
    const dbUsers = await prisma.user.findMany({
      where,
      include: {
        roles: {
          include: {
            role: true,
          },
        },
        _count: {
          select: {
            createdDrafts: true,
          },
        },
      },
      orderBy: [
        { createdAt: 'asc' },
      ],
    });

    let members = dbUsers.map(transformUser);

    // Filter by role (done post-fetch since it's derived)
    if (role) {
      members = members.filter(m => m.role === role);
    }

    // Sort by role hierarchy, then by name
    const roleOrder: Record<UserRole, number> = {
      owner: 0,
      admin: 1,
      manager: 2,
      member: 3,
      viewer: 4,
    };

    members.sort((a, b) => {
      const roleDiff = roleOrder[a.role] - roleOrder[b.role];
      if (roleDiff !== 0) return roleDiff;
      return a.name.localeCompare(b.name);
    });

    return createSuccessResponse(ctx, {
      members,
      total: members.length,
      active: members.filter(m => m.status === 'active').length,
      pending: members.filter(m => m.status === 'invited').length,
    });
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const body = await request.json();
  const parsed = TeamInviteSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Invalid request body', 400);
  }
  const { email, role } = parsed.data;
  const tenantId = ctx.tenantId || parsed.data.tenantId;

  if (!tenantId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant ID is required', 400);
  }

  // Check if email already exists in tenant
  const existing = await prisma.user.findFirst({
    where: {
      email,
      tenantId,
    },
  });

  if (existing) {
    return createErrorResponse(ctx, 'CONFLICT', 'User with this email already exists', 409);
  }

    // Create user with PENDING status (invited)
    const bcrypt = await import('bcryptjs');
    const tempPassword = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const dbUser = await prisma.user.create({
      data: {
        email,
        tenantId,
        passwordHash,
        status: 'PENDING',
        role: role as string,
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
        _count: {
          select: {
            createdDrafts: true,
          },
        },
      },
    });

    const member = transformUser(dbUser);

    // Send invitation email
    try {
      const { sendEmail } = await import('@/lib/email/email-service');
      const { emailTemplates } = await import('@/lib/email/templates');
      
      const template = emailTemplates.teamInvitation({
        invitedBy: 'Team Admin',
        tenantName: 'Your Organization',
        inviteUrl: `${process.env.NEXT_PUBLIC_URL}/accept-invitation?email=${encodeURIComponent(member.email)}`,
        expiresIn: '7 days',
      });
      
      await sendEmail({
        to: member.email,
        subject: template.subject,
        html: template.html,
      });
    } catch (emailError) {
      logger.error('Failed to send invitation email:', emailError);
      // Continue even if email fails - user is created
    }

    return createSuccessResponse(ctx, { member }, { status: 201 });
});

export const PUT = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const body = await request.json();
  const { memberId, role, status, department: _department, name } = body;
  const tenantId = ctx.tenantId;

  if (!memberId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'memberId is required', 400);
  }

  // Find the user
  const user = await prisma.user.findUnique({
    where: { id: memberId },
    include: {
      roles: {
        include: {
          role: true,
        },
      },
    },
  });

  if (!user) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Team member not found', 404);
  }

  // Verify tenant access
  if (tenantId && user.tenantId !== tenantId) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Team member not found', 404);
  }

  // Prevent changing owner role
  const isOwner = user.role === 'owner' || user.roles?.some(r => r.role?.name === 'owner');
  if (isOwner && role && role !== 'owner') {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Cannot change owner role', 403);
  }

    // Build update data
    const updateData: any = {};
    
    if (role) {
      updateData.role = role;
    }
    
    if (status) {
      switch (status) {
        case 'active': updateData.status = 'ACTIVE'; break;
        case 'invited': updateData.status = 'PENDING'; break;
        case 'inactive': updateData.status = 'INACTIVE'; break;
      }
    }
    
    if (name) {
      const nameParts = name.split(' ');
      updateData.firstName = nameParts[0];
      updateData.lastName = nameParts.slice(1).join(' ') || null;
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: memberId },
      data: updateData,
      include: {
        roles: {
          include: {
            role: true,
          },
        },
        _count: {
          select: {
            createdDrafts: true,
          },
        },
      },
    });

    const member = transformUser(updatedUser);

    return createSuccessResponse(ctx, { member });
});

export const DELETE = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get('memberId');
  const tenantId = ctx.tenantId;

  if (!memberId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'memberId is required', 400);
  }

  // Find the user
  const user = await prisma.user.findUnique({
    where: { id: memberId },
    include: {
      roles: {
        include: {
          role: true,
        },
      },
    },
  });

  if (!user) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Team member not found', 404);
  }

  // Verify tenant access
  if (tenantId && user.tenantId !== tenantId) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Team member not found', 404);
  }

  // Prevent removing owner
  const isOwner = user.role === 'owner' || user.roles?.some(r => r.role?.name === 'owner');
  if (isOwner) {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Cannot remove owner', 403);
  }

  // Soft delete by setting status to INACTIVE
  await prisma.user.update({
    where: { id: memberId },
    data: { status: 'INACTIVE' },
  });

  return createSuccessResponse(ctx, { success: true });
});
