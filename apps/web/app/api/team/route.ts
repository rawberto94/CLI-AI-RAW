/**
 * Team Members API
 * Manage team members and collaboration - Database persisted
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiTenantId } from '@/lib/tenant-server';

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const tenantId = await getApiTenantId(request);

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

    return NextResponse.json({
      members,
      total: members.length,
      active: members.filter(m => m.status === 'active').length,
      pending: members.filter(m => m.status === 'invited').length,
    });
  } catch (error) {
    console.error('Failed to fetch team members:', error);
    return NextResponse.json(
      { error: 'Failed to fetch team members' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, role = 'member', department: _department } = body;
    const tenantId = await getApiTenantId(request) || body.tenantId;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      );
    }

    // Check if email already exists in tenant
    const existing = await prisma.user.findFirst({
      where: {
        email,
        tenantId,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
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
        inviteUrl: `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3005'}/accept-invitation?email=${encodeURIComponent(member.email)}`,
        expiresIn: '7 days',
      });
      
      await sendEmail({
        to: member.email,
        subject: template.subject,
        html: template.html,
      });
    } catch (emailError) {
      console.error('Failed to send invitation email:', emailError);
      // Continue even if email fails - user is created
    }

    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    console.error('Failed to invite team member:', error);
    return NextResponse.json(
      { error: 'Failed to invite team member' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { memberId, role, status, department: _department, name } = body;
    const tenantId = await getApiTenantId(request);

    if (!memberId) {
      return NextResponse.json(
        { error: 'memberId is required' },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: 'Team member not found' },
        { status: 404 }
      );
    }

    // Verify tenant access
    if (tenantId && user.tenantId !== tenantId) {
      return NextResponse.json(
        { error: 'Team member not found' },
        { status: 404 }
      );
    }

    // Prevent changing owner role
    const isOwner = user.role === 'owner' || user.roles?.some(r => r.role?.name === 'owner');
    if (isOwner && role && role !== 'owner') {
      return NextResponse.json(
        { error: 'Cannot change owner role' },
        { status: 403 }
      );
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

    return NextResponse.json({ member });
  } catch (error) {
    console.error('Failed to update team member:', error);
    return NextResponse.json(
      { error: 'Failed to update team member' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('memberId');
    const tenantId = await getApiTenantId(request);

    if (!memberId) {
      return NextResponse.json(
        { error: 'memberId is required' },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: 'Team member not found' },
        { status: 404 }
      );
    }

    // Verify tenant access
    if (tenantId && user.tenantId !== tenantId) {
      return NextResponse.json(
        { error: 'Team member not found' },
        { status: 404 }
      );
    }

    // Prevent removing owner
    const isOwner = user.role === 'owner' || user.roles?.some(r => r.role?.name === 'owner');
    if (isOwner) {
      return NextResponse.json(
        { error: 'Cannot remove owner' },
        { status: 403 }
      );
    }

    // Soft delete by setting status to INACTIVE
    await prisma.user.update({
      where: { id: memberId },
      data: { status: 'INACTIVE' },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to remove team member:', error);
    return NextResponse.json(
      { error: 'Failed to remove team member' },
      { status: 500 }
    );
  }
}
