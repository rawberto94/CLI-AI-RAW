/**
 * Team Members API
 * Manage team members and collaboration
 */

import { NextRequest, NextResponse } from 'next/server';

type UserRole = 'owner' | 'admin' | 'manager' | 'member' | 'viewer';
type UserStatus = 'active' | 'invited' | 'inactive';

interface TeamMember {
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

// In-memory storage for demo
const teamMembers: Map<string, TeamMember> = new Map();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    let members = Array.from(teamMembers.values());

    // Filter by role
    if (role) {
      members = members.filter(m => m.role === role);
    }

    // Filter by status
    if (status) {
      members = members.filter(m => m.status === status);
    }

    // Search by name or email
    if (search) {
      const searchLower = search.toLowerCase();
      members = members.filter(m =>
        m.name.toLowerCase().includes(searchLower) ||
        m.email.toLowerCase().includes(searchLower)
      );
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
    console.error('Error fetching team members:', error);
    return NextResponse.json(
      { error: 'Failed to fetch team members' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, role = 'member', department } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existing = Array.from(teamMembers.values()).find(m => m.email === email);
    if (existing) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    const member: TeamMember = {
      id: `member-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name: email.split('@')[0],
      email,
      role: role as UserRole,
      status: 'invited',
      joinedAt: new Date().toISOString(),
      contractsAccess: 0,
      department,
    };

    teamMembers.set(member.id, member);

    // TODO: Send invitation email

    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    console.error('Error inviting team member:', error);
    return NextResponse.json(
      { error: 'Failed to invite team member' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { memberId, role, status, department, name } = body;

    if (!memberId) {
      return NextResponse.json(
        { error: 'memberId is required' },
        { status: 400 }
      );
    }

    const member = teamMembers.get(memberId);
    if (!member) {
      return NextResponse.json(
        { error: 'Team member not found' },
        { status: 404 }
      );
    }

    // Prevent changing owner role
    if (member.role === 'owner' && role && role !== 'owner') {
      return NextResponse.json(
        { error: 'Cannot change owner role' },
        { status: 403 }
      );
    }

    const updatedMember = {
      ...member,
      ...(role && { role: role as UserRole }),
      ...(status && { status: status as UserStatus }),
      ...(department !== undefined && { department }),
      ...(name && { name }),
    };

    teamMembers.set(memberId, updatedMember);

    return NextResponse.json({ member: updatedMember });
  } catch (error) {
    console.error('Error updating team member:', error);
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

    if (!memberId) {
      return NextResponse.json(
        { error: 'memberId is required' },
        { status: 400 }
      );
    }

    const member = teamMembers.get(memberId);
    if (!member) {
      return NextResponse.json(
        { error: 'Team member not found' },
        { status: 404 }
      );
    }

    // Prevent removing owner
    if (member.role === 'owner') {
      return NextResponse.json(
        { error: 'Cannot remove owner' },
        { status: 403 }
      );
    }

    teamMembers.delete(memberId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing team member:', error);
    return NextResponse.json(
      { error: 'Failed to remove team member' },
      { status: 500 }
    );
  }
}
